import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { FIELD_MAP } from "@/lib/token";
import { isValidReferer } from "@/lib/allowed-referers";
import { createClient } from "@supabase/supabase-js";
import { validateSession } from "@/lib/validate-session";
const supabase = createClient(
  process.env.VIDLINK_SUPABASE_URL!,
  process.env.VIDLINK_SUPABASE_SERVICE_ROLE_KEY!,
);
const ENC_DEC_API = "https://enc-dec.app/api";
const VIDLINK_API = "https://vidlink.pro/api/b";
const DASH_PROXY = "https://noon.mooncase.online";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  Origin: "https://vidlink.pro",
  Referer: "https://vidlink.pro/",
};

const VIDLINK_HEADERS = {
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.7",
  Referer: "https://vidlink.pro/movie/1184918",
  "Sec-CH-UA": '"Not=A?Brand";v="99", "Brave";v="151", "Chromium";v="151"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "Sec-GPC": "1",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  "X-Playback-Environment": "dash-hevc",
};

type Link = {
  type: string;
  link: string;
  resolution: number;
  headers?: Record<string, string>;
};

type Subtitle = {
  id: string;
  display: string;
  file: string;
};

type StreamResult = {
  links: Link[];
  subtitles: Subtitle[];
  error?: string;
};

async function fetchVidlinkStreams(
  tmdbId: string,
  mediaType: string,
  season: string | null,
  episode: string | null,
): Promise<StreamResult> {
  const encryptedResponse = await fetchWithTimeout(
    `${ENC_DEC_API}/enc-vidlink?text=${encodeURIComponent(tmdbId)}`,
    { headers: HEADERS },
    15000,
  );

  if (!encryptedResponse.ok) {
    return {
      links: [],
      subtitles: [],
      error: `decoder HTTP ${encryptedResponse.status}`,
    };
  }

  const encryptedData = await encryptedResponse.json();

  if (!encryptedData.result) {
    return {
      links: [],
      subtitles: [],
      error: `decoder returned status ${encryptedData.status}`,
    };
  }

  const encryptedId = encryptedData.result;

  const url =
    mediaType === "movie"
      ? `${VIDLINK_API}/movie/${encryptedId}?multiLang=0`
      : `${VIDLINK_API}/tv/${encryptedId}/${season}/${episode}?multiLang=0`;

  const response = await fetchWithTimeout(
    url,
    { headers: VIDLINK_HEADERS },
    20000,
  );

  if (!response.ok) {
    return {
      links: [],
      subtitles: [],
      error: `Source HTTP ${response.status}`,
    };
  }

  const data = await response.json();
  const stream = data?.stream;

  if (!stream?.playlist) {
    return {
      links: [],
      subtitles: [],
      error: "Source returned no playlist",
    };
  }

  const subtitles: Subtitle[] = Array.isArray(stream.captions)
    ? stream.captions
        .map((caption: any) => ({
          id: String(caption.id ?? caption.language ?? "unknown"),
          display: caption.language ?? "Unknown",
          file: caption.url,
        }))
        .filter((caption: Subtitle) => Boolean(caption.file))
    : [];

  const cookie = stream.playlistHeaders?.Cookie;

  return {
    links: [
      {
        type: "dash",
        link: stream.playlist,
        resolution: 0,
        ...(cookie && {
          headers: {
            Cookie: cookie,
          },
        }),
      },
    ],
    subtitles,
  };
}

function proxyLinks(links: Link[]): Link[] {
  return links.map((link) => {
    if (link.type !== "dash" || !link.link) {
      return link;
    }

    const cookie = link.headers?.Cookie;

    if (!cookie) {
      return link;
    }

    const mpd = new URL(link.link);

    const proxyUrl = new URL(`${DASH_PROXY}/sacdn${mpd.pathname}`);

    proxyUrl.searchParams.set("host", mpd.origin);
    proxyUrl.searchParams.set("sc", cookie);

    return {
      type: "dash",
      link: proxyUrl.toString(),
      resolution: link.resolution,
    };
  });
}
export async function GET(req: NextRequest) {
  const logRequest = (status: number, reason: string) => {
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

    const message = `[VIDLINK] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`;

    if (status >= 500) {
      console.error(message);
    } else if (status >= 400) {
      console.warn(message);
    } else {
      console.log(message);
    }
  };

  const error = (status: number, message: string) => {
    logRequest(status, message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status },
    );
  };

  try {
    const path = req.nextUrl.pathname.split("/").pop()!;
    const tmdbId = req.nextUrl.searchParams.get("id");
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get("season") ?? "";
    const episode = req.nextUrl.searchParams.get("episode") ?? "";
    const title = req.nextUrl.searchParams.get("title");
    const year = req.nextUrl.searchParams.get("year");
    const ts = Number(req.nextUrl.searchParams.get("ts"));
    const token = req.nextUrl.searchParams.get("token");

    if (!tmdbId || !mediaType || !title || !year || !ts || !token) {
      logRequest(400, "missing params");
      return NextResponse.json(
        { success: false, error: "missing params" },
        { status: 400 },
      );
    }
    const session = req.cookies.get("_ps")?.value;

    if (!session || !validateSession(session)) {
      logRequest(401, "invalid session");

      return NextResponse.json(
        { success: false, error: "Invalid session" },
        { status: 401 },
      );
    }

    if (
      !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
    ) {
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

    const seasonKey = season ?? "";
    const episodeKey = episode ?? "";

    // ─── CACHE (1 day via created_at) ──────────────────────────────────────

    const { data: cached } = await supabase
      .from("vidlink_cache")
      .select("playlist, cookie, subtitles")
      .eq("tmdb_id", Number(tmdbId))
      .eq("media_type", mediaType)
      .eq("season", seasonKey)
      .eq("episode", episodeKey)
      .gt(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      )
      .maybeSingle();

    if (cached?.playlist && cached?.cookie) {
      const links = proxyLinks([
        {
          type: "dash",
          link: cached.playlist,
          resolution: 0,
          headers: { Cookie: cached.cookie },
        },
      ]);
      logRequest(200, "CACHE HIT");
      return NextResponse.json({
        success: true,
        links,
        subtitles: cached.subtitles ?? [],
        meow: true,
      });
    }

    // ─── Fresh ──────────────────────────────────────────────────────────────
    const result = await fetchVidlinkStreams(
      tmdbId,
      mediaType,
      season,
      episode,
    );

    if (result.error) {
      return error(502, result.error);
    }

    const original = result.links[0];
    const playlist = original?.link;
    const cookie = original?.headers?.Cookie;

    if (playlist && cookie) {
      await supabase.from("vidlink_cache").upsert(
        {
          tmdb_id: Number(tmdbId),
          media_type: mediaType,
          season: seasonKey,
          episode: episodeKey,
          playlist,
          cookie,
          subtitles: result.subtitles,
          created_at: new Date().toISOString(), // reset TTL
        },
        { onConflict: "tmdb_id,media_type,season,episode" },
      );
    }

    const links = proxyLinks(result.links);

    logRequest(200, "VIDLINK OK");

    return NextResponse.json({
      success: true,
      links,
      subtitles: result.subtitles,
      meow: false,
    });
  } catch (err: any) {
    console.error("API Error:", err);

    return NextResponse.json(
      {
        success: false,
        error: err?.message ?? "Internal server error",
      },
      { status: 500 },
    );
  }
}
