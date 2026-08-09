// //https://daedalus.test30-997.workers.dev/
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { FIELD_MAP } from "@/lib/token";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL_SCREENIFY!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_SCREENIFY!,
);

const SCREENIFY = "https://www.screenify.fun";

const DAEDALUS_WORKERS = [
  "test52-b2c",
  "test51-8b1",
  "test50-6c3",
  "test49-3b0",
  "test48-104",
  "test47-0f7",
  "test46-96a",
  "test45-b77",
  "test44-255",
  "test42-947",
  "test43-cbe",
  //NO TOKEN
  "test41-2c1",
  "test40-fdf",
  "test39-43c",
  "test38-eab",
  "test37-93b",
  "test36-59e",
  "test35-f46",
  "test34-2ea",
  "test33-4ce",
  "test32-dc9",
  "test31-5f3",
  "test30-997",
  "amenohabakiri174",
  "zxcprime371",
];

async function resolveWorker(upstreamPath: string): Promise<string | null> {
  const shuffled = [...DAEDALUS_WORKERS].sort(() => Math.random() - 0.5);

  for (const worker of shuffled) {
    const baseUrl = `https://daedalus.${worker}.workers.dev`;
    try {
      const probe = await fetchWithTimeout(
        baseUrl,
        { method: "GET" },
        4000,
      ).catch(() => null);

      if (
        probe &&
        (probe.status === 200 || probe.status === 404 || probe.status === 206)
      ) {
        return `${baseUrl}${upstreamPath}`;
      }
    } catch {
      // try next
    }
  }

  return null;
}
async function fetchSrc(
  imdbId: string,
  media_type: string,
  season: string | null,
  episode: string | null,
): Promise<string | null> {
  const watchPage =
    media_type === "tv"
      ? `${SCREENIFY}/watch-series/${imdbId}`
      : `${SCREENIFY}/watch-movies/${imdbId}`;

  const page = await fetchWithTimeout(
    watchPage,
    {
      headers: {
        Referer: `${SCREENIFY}/`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      cache: "no-store",
    },
    12000,
  );

  if (!page.ok) return null;

  const html = await page.text();
  const match = html.match(/var initialSrc='([^']+)'/);
  if (!match) return null;

  let srcPath = match[1];

  if (media_type === "tv" && season && episode) {
    srcPath = srcPath.replace(
      /\/(\d+)\/(\d+)\/playlist\.m3u8$/,
      `/${season}/${episode}/playlist.m3u8`,
    );
  }

  return srcPath;
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
      `[ATHENA] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`,
    );
  };

  try {
    const id = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const media_type = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const imdbId = req.nextUrl.searchParams.get(FIELD_MAP.imdbId);
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const token = req.nextUrl.searchParams.get(FIELD_MAP.token)!;
    const f_token = req.nextUrl.searchParams.get(FIELD_MAP.fToken)!;

    if (!id || !media_type || !ts || !token) {
      logRequest(400, "missing token");
      return NextResponse.json(
        { success: false, error: "need token" },
        { status: 400 },
      );
    }

    if (Date.now() - Number(ts) > 120000) {
      logRequest(401, "expired token");
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 },
      );
    }

    if (!validateBackendToken(id, f_token, ts, token)) {
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

    // check cache first
    let srcPath: string | null = null;

    const { data: cached } = await supabase
      .from("screenify_source")
      .select("src_path")
      .eq("imdb_id", imdbId!)
      .eq("media_type", media_type)
      .eq("season", seasonKey)
      .eq("episode", episodeKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.src_path) {
      srcPath = cached.src_path;
    }

    if (!srcPath) {
      try {
        srcPath = await fetchSrc(imdbId!, media_type, season, episode);

        if (!srcPath) {
          const mxId = imdbId!.replace(/^tt/, "mx");
          srcPath = await fetchSrc(mxId, media_type, season, episode);
        }
      } catch {
        logRequest(504, "fetch timeout");
        return NextResponse.json(
          { success: false, error: "Timed out" },
          { status: 504 },
        );
      }

      if (!srcPath) {
        logRequest(502, "source not found");
        return NextResponse.json(
          { success: false, error: "Source not found" },
          { status: 502 },
        );
      }

      // cache the freshly resolved src
      await supabase.from("screenify_source").upsert(
        {
          imdb_id: imdbId!,
          tmdb_id: id,
          media_type,
          season: seasonKey,
          episode: episodeKey,
          src_path: srcPath,
        },
        {
          onConflict: "imdb_id,media_type,season,episode",
          ignoreDuplicates: true,
        },
      );
    }

    const upstreamPath = new URL(`${SCREENIFY}${srcPath}`).pathname;

    const workerUrl = await resolveWorker(upstreamPath);
    if (!workerUrl) {
      logRequest(502, "no proxy available");
      return NextResponse.json(
        { success: false, error: "No available proxy" },
        { status: 502 },
      );
    }
    const signedUrl = await signWorkerUrl(workerUrl);

    logRequest(200, "ATHENA OK!!!!!");
    return NextResponse.json({
      success: true,
      links: [{ type: "hls", link: signedUrl }],
      subtitles: [],
      meow: !!cached,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// lib/sign-worker-url.ts
export async function signWorkerUrl(workerUrl: string): Promise<string> {
  const url = new URL(workerUrl);
  const pathname = url.pathname;
  const exp = String(Date.now() + 6 * 60 * 60 * 1000); // 6 hours

  const secret = process.env.DAEDALUS!;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${pathname}:${exp}`),
  );

  const tok = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  url.searchParams.set("tok", tok);
  url.searchParams.set("exp", exp);
  return url.toString();
}
