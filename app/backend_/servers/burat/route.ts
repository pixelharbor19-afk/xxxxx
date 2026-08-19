import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { FIELD_MAP } from "@/lib/token";
import { isValidReferer } from "@/lib/allowed-referers";
import { createClient } from "@supabase/supabase-js";
import { encryptUrl } from "@/lib/encryptor";

const ENC_DEC_API = "https://enc-dec.app/api";
const VIDLINK_API = "https://vidlink.pro/api/b";

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

const DASH_WORKERS = [
  "https://aged-snow-6862.kantuninkita1.workers.dev/",
  "https://calm-base-d874.kantuninkita2.workers.dev/",
  "https://noisy-mud-be53.kantuninkita3.workers.dev/",
];

const supabase = createClient(
  process.env.VIDLINK_SUPABASE_URL!,
  process.env.VIDLINK_SUPABASE_SERVICE_ROLE_KEY!,
);

let blacklistCache: Set<string> | null = null;
let blacklistCacheTime = 0;
const BLACKLIST_TTL = 5 * 60_000;

async function getNext8AMPH(): Promise<string> {
  const now = new Date();
  const ph = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const next8AM = new Date(ph);
  next8AM.setHours(8, 0, 0, 0);
  if (ph >= next8AM) next8AM.setDate(next8AM.getDate() + 1);
  return new Date(
    now.getTime() + (next8AM.getTime() - ph.getTime()),
  ).toISOString();
}

async function blacklistProxy(proxy: string) {
  const expires_at = await getNext8AMPH();
  await supabase
    .from("proxy_blacklist")
    .upsert(
      { proxy, expires_at },
      { onConflict: "proxy", ignoreDuplicates: false },
    );
  blacklistCache?.add(proxy);
  console.log(`[PROXY] ⛔ blacklisted ${proxy}`);
}

async function getActiveProxies(proxies: string[]): Promise<string[]> {
  if (!blacklistCache || Date.now() - blacklistCacheTime > BLACKLIST_TTL) {
    const { data } = await supabase
      .from("proxy_blacklist")
      .select("proxy")
      .gt("expires_at", new Date().toISOString());
    blacklistCache = new Set((data ?? []).map((r: any) => r.proxy));
    blacklistCacheTime = Date.now();
  }
  return proxies.filter((p) => !blacklistCache!.has(p));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function getWorkingProxy(
  activeProxies: string[],
): Promise<string | null> {
  if (!activeProxies.length) return null;
  if (activeProxies.length === 1) return activeProxies[0];

  const shuffled = shuffle(activeProxies);
  const TIMEOUT = 7000;
  const MAX_TRIES = 5;

  for (let i = 0; i < Math.min(shuffled.length, MAX_TRIES); i++) {
    const proxy = shuffled[i];
    try {
      const res = await fetchWithTimeout(
        proxy,
        { method: "HEAD", headers: { Range: "bytes=0-1" } },
        TIMEOUT,
      );
      if (res.status === 429) {
        await blacklistProxy(proxy);
        continue;
      }
      if (res.status < 500) return proxy;
    } catch (err: any) {
      console.error(
        `[VIDLINK PROXY] ${proxy} → ${err?.name || err?.message || "failed"}`,
      );
    }
  }
  return null;
}

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

  const encryptedData = await encryptedResponse.json();
  if (encryptedData.status !== 200 || !encryptedData.result) {
    return { links: [], subtitles: [] };
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
  if (!response.ok) return { links: [], subtitles: [] };

  const data = await response.json();
  const stream = data?.stream;
  if (!stream?.playlist) return { links: [], subtitles: [] };

  const subtitles: Subtitle[] = Array.isArray(stream.captions)
    ? stream.captions
        .map((caption: any) => ({
          id: String(caption.id ?? caption.language ?? "unknown"),
          display: caption.language ?? "Unknown",
          file: caption.url,
        }))
        .filter((c: Subtitle) => Boolean(c.file))
    : [];

  const cookie = stream.playlistHeaders?.Cookie;

  return {
    links: [
      {
        type: "dash",
        link: stream.playlist,
        resolution: 0,
        ...(cookie && { headers: { Cookie: cookie } }),
      },
    ],
    subtitles,
  };
}

async function buildProxiedLink(
  playlist: string,
  cookie: string,
  worker: string,
): Promise<Link> {
  const mpd = new URL(playlist);
  const base = `${mpd.origin}${mpd.pathname.substring(0, mpd.pathname.lastIndexOf("/") + 1)}`;

  const encrypted = await encryptUrl(
    JSON.stringify({
      exp: Date.now() + 5 * 60 * 60 * 1000,
      base,
      cookie,
    }),
  );

  return {
    type: "dash",
    link: `${worker}?data=${encodeURIComponent(encrypted)}`,
    resolution: 0,
  };
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const tmdbId = params.get(FIELD_MAP.id);
  const mediaType = params.get("b");
  const season = params.get(FIELD_MAP.season) ?? "";
  const episode = params.get(FIELD_MAP.episode) ?? "";
  const timestamp = Number(params.get(FIELD_MAP.ts));
  const token = params.get(FIELD_MAP.token);
  const fToken = params.get(FIELD_MAP.fToken);

  const logRequest = (status: number, reason: string) => {
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";
    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    const message =
      `[SENTINEL] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ` +
      `ts: ${new Date().toISOString()} | IP: ${ip}`;

    if (status >= 500) console.error(message);
    else if (status >= 400) console.warn(message);
    else console.log(message);
  };

  const error = (status: number, message: string) => {
    logRequest(status, message);
    return NextResponse.json({ success: false, error: message }, { status });
  };

  try {
    if (!tmdbId || !mediaType || !timestamp || !token) {
      return error(400, "need token");
    }
    if (mediaType !== "movie" && mediaType !== "tv") {
      return error(400, "Invalid media type");
    }
    if (mediaType === "tv" && (!season || !episode)) {
      return error(400, "TV requires season and episode");
    }
    if (Date.now() - timestamp > 120000) {
      return error(401, "Invalid token");
    }
    if (!validateBackendToken(tmdbId, fToken!, timestamp, token)) {
      return error(401, "Invalid token");
    }

    const referer = req.headers.get("referer") ?? "";
    if (!isValidReferer(referer)) {
      return error(403, "Forbidden");
    }

    const activeProxies = await getActiveProxies(DASH_WORKERS);
    const worker = await getWorkingProxy(activeProxies);
    if (!worker) {
      return error(502, "No available worker");
    }

    // ─── CACHE ──────────────────────────────────────────────────────────────
    const { data: cached } = await supabase
      .from("vidlink_cache")
      .select("playlist, cookie, subtitles")
      .eq("tmdb_id", Number(tmdbId))
      .eq("media_type", mediaType)
      .eq("season", season)
      .eq("episode", episode)
      .maybeSingle();

    if (cached?.playlist && cached?.cookie) {
      const link = await buildProxiedLink(
        cached.playlist,
        cached.cookie,
        worker,
      );
      logRequest(200, "CACHE HIT");
      return NextResponse.json({
        success: true,
        links: [link],
        subtitles: cached.subtitles ?? [],
        meow: true,
        remaining: activeProxies.length,
      });
    }

    // ─── Fresh ──────────────────────────────────────────────────────────────
    const result = await fetchVidlinkStreams(
      tmdbId,
      mediaType,
      season || null,
      episode || null,
    );

    if (!result.links.length) {
      return error(404, "No streams found");
    }

    const original = result.links[0];
    const playlist = original.link;
    const cookie = original.headers?.Cookie;
    if (!cookie) {
      return error(404, "No streams found");
    }

    await supabase.from("vidlink_cache").upsert(
      {
        tmdb_id: Number(tmdbId),
        media_type: mediaType,
        season,
        episode,
        playlist,
        cookie,
        subtitles: result.subtitles,
      },
      { onConflict: "tmdb_id,media_type,season,episode" },
    );

    const link = await buildProxiedLink(playlist, cookie, worker);

    logRequest(200, "VIDLINK OK");
    return NextResponse.json({
      success: true,
      links: [link],
      subtitles: result.subtitles,
      meow: false,
      remaining: activeProxies.length,
    });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
