import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { FIELD_MAP } from "@/lib/token";
import { createClient } from "@supabase/supabase-js";
import { isValidReferer } from "@/lib/allowed-referers";

const supabase = createClient(
  process.env.SUPABASE_URL_SENTINEL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_SENTINEL!,
);
const ONETOUCH_API = "https://api3.devcorp.me/web/vod";
const ENC_DEC_API = "https://enc-dec.app/api";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
};

async function fetchOneTouchStreams(
  mediaType: string,
  season: string | null,
  episode: string | null,
  title: string,
  year: string,
): Promise<{ links: any[]; subtitles: any[] }> {
  // Search
  const keyword = `${title}`.toLowerCase();

  // console.log({
  //   mediaType,
  //   title,
  //   normalizedTitle: keyword,
  //   season,
  //   wantedSeason: season,
  // });
  const searchEncrypted = await fetchWithTimeout(
    `https://api3.devcorp.me/vod/search?page=1&keyword=${encodeURIComponent(keyword)}`,
    {
      headers: HEADERS,
    },
    20000,
  ).then((r) => r.text());

  const searchDec = await fetchWithTimeout(
    `${ENC_DEC_API}/dec-onetouchtv`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: searchEncrypted,
      }),
    },
    15000,
  ).then((r) => r.json());

  if (searchDec.status !== 200 || !searchDec.result) {
    return {
      links: [],
      subtitles: [],
    };
  }

  const results = Array.isArray(searchDec.result) ? searchDec.result : [];
  // console.log(results);
  const normalizedTitle = title
    .replace(/\s*\(\d{4}\)/g, "")
    .trim()
    .toLowerCase();

  const wantedSeason = Number(season ?? "1");

  const cleanTitle = (value: string) =>
    value
      .replace(/\s*Season\s+\d+.*/i, "")
      .replace(/\s*\(\d{4}\)/g, "")
      .trim()
      .toLowerCase();

  const match =
    mediaType === "movie"
      ? results.find(
          (item: any) =>
            item.type === "movie" && cleanTitle(item.title) === normalizedTitle,
        )
      : results.find((item: any) => {
          const cleaned = cleanTitle(item.title);
          const m = item.title.match(/Season\s+(\d+)/i);
          const seasonNumber = m ? Number(m[1]) : 1;

          // console.log({
          //   title: item.title,
          //   cleaned,
          //   normalizedTitle,
          //   titleMatch: cleaned === normalizedTitle,
          //   seasonNumber,
          //   wantedSeason,
          //   seasonMatch: seasonNumber === wantedSeason,
          // });

          if (cleaned !== normalizedTitle) return false;

          return seasonNumber === wantedSeason;
        });

  if (!match) {
    return {
      links: [],
      subtitles: [],
    };
  }

  const url =
    mediaType === "movie"
      ? `${ONETOUCH_API}/${match.id}/episode/1`
      : `${ONETOUCH_API}/${match.id}/episode/${episode ?? 1}`;

  const encrypted = await fetchWithTimeout(
    url,
    {
      headers: HEADERS,
    },
    20000,
  ).then((r) => r.text());

  const dec = await fetchWithTimeout(
    `${ENC_DEC_API}/dec-onetouchtv`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: encrypted,
      }),
    },
    15000,
  ).then((r) => r.json());

  if (dec.status !== 200 || !dec.result) {
    return {
      links: [],
      subtitles: [],
    };
  }

  const result = dec.result;

  const sources =
    result.sources ??
    result.streams ??
    result.stream ??
    result.data?.sources ??
    [];

  const links = sources
    .map((s: any) => ({
      type: url.toLowerCase().includes(".m3u8") ? "hls" : "mp4",
      link: s.file ?? s.url ?? s.src,
      resolution: parseInt(s.label ?? s.quality ?? "0") || 0,
    }))
    .filter((s: any) => s.link);

  const rawSubs =
    result.track ??
    result.subtitles ??
    result.captions ??
    result.tracks ??
    result.data?.subtitles ??
    [];

  const subtitles = rawSubs
    .filter((s: any) => s.kind !== "thumbnails")
    .map((s: any) => ({
      id: s.code ?? s.id,
      display: s.name ?? s.label ?? s.language ?? "Unknown",
      file: s.file ?? s.url,
    }))
    .filter((s: any) => s.file);

  return {
    links,
    subtitles,
  };
}

export async function GET(req: NextRequest) {
  const logRequest = (status: number, reason: string) => {
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

    console.log(
      `[SENTINEL] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`,
    );
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
      const result = await fetchOneTouchStreams(
        mediaType,
        season,
        episode,
        title,
        year,
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
