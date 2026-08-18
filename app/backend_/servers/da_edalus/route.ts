import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { FIELD_MAP } from "@/lib/token";
import { createClient } from "@supabase/supabase-js";
import { isValidReferer } from "@/lib/allowed-referers";
import CryptoJS from "crypto-js";

const supabase = createClient(
  process.env.SUPABASE_URL_SENTINEL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_SENTINEL!,
);

const ROGPLAY_API = "https://web.rogplay.app/api/movies/castle";
const STREAM_SECRET = "highriskxd";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
};

async function fetchRogplayStreams(
  tmdbId: string,
  mediaType: string,
  season: string | null,
  episode: string | null,
): Promise<{ links: any[]; subtitles: any[] }> {
  try {
    const params = new URLSearchParams({
      tmdbId,
      mediaType,
    });
    if (mediaType === "tv") {
      if (season) params.set("seasonNum", season);
      if (episode) params.set("episodeNum", episode);
    }
    const encryptedRes = await fetchWithTimeout(
      `${ROGPLAY_API}?${params.toString()}`,
      { headers: HEADERS },
      20000,
    );

    const encryptedJson = await encryptedRes.json();

    if (
      !encryptedJson?.data ||
      typeof encryptedJson.data !== "string" ||
      !encryptedJson.data.startsWith("U2FsdGVkX1")
    ) {
      return { links: [], subtitles: [] };
    }

    const decrypted = CryptoJS.AES.decrypt(
      encryptedJson.data,
      STREAM_SECRET,
    ).toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      return { links: [], subtitles: [] };
    }

    const parsed = JSON.parse(decrypted);
    const streams = Array.isArray(parsed.streams) ? parsed.streams : [];

    const links = streams
      .map((s: any) => {
        const originalLink = s.url ?? s.file ?? s.src;
        if (!originalLink) return null;

        const isHls = originalLink.toLowerCase().includes(".m3u8");
        const qualityStr = String(s.quality ?? s.label ?? "0");
        const resolution = parseInt(qualityStr.replace(/\D/g, "") || "0") || 0;

        return {
          type: isHls ? "hls" : "mp4",
          link: originalLink,
          resolution,
        };
      })
      .filter((s: any) => s !== null);

    // Rogplay currently does not return subtitles in the payload
    return {
      links,
      subtitles: [],
    };
  } catch (err) {
    console.error("Rogplay fetch error:", err);
    return { links: [], subtitles: [] };
  }
}

export async function GET(req: NextRequest) {
  const logRequest = (status: number, reason: string) => {
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

    const message = `[DAEDALUS] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`;

    if (status >= 500) {
      console.error(message);
    } else if (status >= 400) {
      console.warn(message);
    } else {
      console.log(message);
    }
  };

  try {
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const title = req.nextUrl.searchParams.get(FIELD_MAP.title);
    const year = req.nextUrl.searchParams.get(FIELD_MAP.year);
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const token = req.nextUrl.searchParams.get(FIELD_MAP.token)!;
    const f_token = req.nextUrl.searchParams.get(FIELD_MAP.fToken)!;

    if (!tmdbId || !mediaType || !title || !year || !ts || !token) {
      logRequest(400, "missing params");
      return NextResponse.json(
        { success: false, error: "need token" },
        { status: 400 },
      );
    }

    if (Date.now() - ts > 120000) {
      logRequest(401, "token expired");
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 },
      );
    }

    if (!validateBackendToken(tmdbId, f_token, ts, token)) {
      logRequest(401, "invalid token");
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 },
      );
    }

    const referer = req.headers.get("referer") || "";
    if (!isValidReferer(referer)) {
      logRequest(403, "invalid referrer");
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    let links: any[];
    let subtitles: any[];

    const { data: cached } = await supabase
      .from("onetouch_cache")
      .select("links, subtitles")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .eq("season", season ?? "")
      .eq("episode", episode ?? "")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      links = cached.links ?? [];
      subtitles = cached.subtitles ?? [];
    } else {
      const result = await fetchRogplayStreams(
        tmdbId,
        mediaType,
        season,
        episode,
      );

      links = result.links;
      subtitles = result.subtitles;

      if (links.length > 0) {
        await supabase.from("onetouch_cache").upsert(
          {
            tmdb_id: tmdbId,
            media_type: mediaType,
            season: season ?? "",
            episode: episode ?? "",
            links,
            subtitles,
            refreshed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 mins
          },
          {
            onConflict: "tmdb_id,media_type,season,episode",
          },
        );
      }
    }

    if (!links.length) {
      logRequest(404, "no streams found");
      return NextResponse.json(
        { success: false, error: "No streams found" },
        { status: 404 },
      );
    }

    links = links.map((link: any) => {
      if (!link.link) return link;

      const isHls = link.link.toLowerCase().includes(".m3u8");

      if (!isHls) {
        return link;
      }

      return {
        ...link,
        type: "hls",
        link: link.link,
      };
    });

    logRequest(200, "SENTINEL OK!!!!!");

    return NextResponse.json({
      success: true,
      links,
      subtitles,
      meow: !!cached,
    });
  } catch (err: any) {
    console.error("API Error:", err);

    return NextResponse.json(
      {
        success: false,
        error: err.message ?? "Internal server error",
      },
      {
        status: 500,
      },
    );
  }
}
