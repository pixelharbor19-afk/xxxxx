import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { FIELD_MAP } from "@/lib/token";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL_SENTINEL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_SENTINEL!,
);

const MEGACLOUD = "https://megacloudx.net";

async function fetchSource(url: string): Promise<{
  hls: string;
  tracks: object[];
  embed_url: string;
} | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Origin: MEGACLOUD,
      Referer: `${MEGACLOUD}/`,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site",
      "Sec-CH-UA":
        '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
      "Sec-CH-UA-Mobile": "?0",
      "Sec-CH-UA-Platform": '"Windows"',
      Priority: "u=1, i",
    },
    redirect: "follow",
    cache: "no-store",
  });

  if (!res.ok) return null;

  const embed_url = res.url; // https://megacloudx.net/e/0114ig6p6pvy?sub.info=...

  const html = await res.text();

  const hlsMatch = html.match(/var HLS\s*=\s*"([^"]+)"/);
  const tracksMatch = html.match(/var TRACKS\s*=\s*(\[.*?\]);/);

  if (!hlsMatch) return null;

  return {
    hls: hlsMatch[1],
    tracks: tracksMatch ? JSON.parse(tracksMatch[1]) : [],
    embed_url,
  };
}
function formatTracks(tracks: any[]) {
  return tracks.map((t) => ({ ...t, display: t.label }));
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const media_type = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const imdbId = req.nextUrl.searchParams.get(FIELD_MAP.imdbId);
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const token = req.nextUrl.searchParams.get(FIELD_MAP.token)!;
    const f_token = req.nextUrl.searchParams.get(FIELD_MAP.fToken)!;

    if (!id || !media_type || !ts || !token) {
      return NextResponse.json(
        { success: false, error: "need token" },
        { status: 404 },
      );
    }

    if (Date.now() - Number(ts) > 8000) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }

    if (!validateBackendToken(id, f_token, ts, token)) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }

    const referer = req.headers.get("referer") || "";
    if (!isValidReferer(referer)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const seasonKey = season ?? "";
    const episodeKey = episode ?? "";

    // check cache
    const { data: cached } = await supabase
      .from("megacloud_source")
      .select("hls, tracks")
      .eq("media_type", media_type)
      .eq("tmdb_id", id)
      .eq("season", seasonKey)
      .eq("episode", episodeKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      return NextResponse.json({
        success: true,
        links: [{ type: "hls", link: cached.hls }],
        subtitles: formatTracks(cached.tracks),
        cached: true,
      });
    }

    // fetch fresh
    const pageUrl =
      media_type === "tv"
        ? `${MEGACLOUD}/pl/${id}/${seasonKey}/${episodeKey}/`
        : `${MEGACLOUD}/mv/${imdbId}/${id}/`;

    const source = await fetchSource(pageUrl);

    if (!source) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 502 },
      );
    }

    // cache it

    await supabase.from("megacloud_source").upsert(
      {
        media_type,
        tmdb_id: id,
        imdb_id: imdbId ?? null,
        season: seasonKey,
        episode: episodeKey,
        hls: source.hls,
        tracks: source.tracks,
        embed_url: source.embed_url,
        expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        onConflict: "media_type,tmdb_id,season,episode",
        ignoreDuplicates: false,
      },
    );

    return NextResponse.json({
      success: true,
      links: [{ type: "hls", link: source.hls }],
      subtitles: formatTracks(source.tracks),
      cached: false,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
