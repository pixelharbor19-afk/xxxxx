import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { isValidReferer } from "@/lib/allowed-referers";
import { createClient } from "@supabase/supabase-js";
import { encryptUrl } from "@/lib/encryptor";
import { encryptLink } from "@/lib/link-crypto";

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
  "https://blue-flower-fe30.icarus026.workers.dev/",
  "https://billowing-truth-c158.icarus025.workers.dev/",
  "https://divine-sun-7d33.icarus024.workers.dev/",
  "https://billowing-dream-d9ad.icarus023.workers.dev/",
  "https://mute-flower-d701.icarus022.workers.dev/",
  "https://dark-boat-61e0.icarus021.workers.dev/",
  "https://billowing-bread-6c35.icarus019.workers.dev/",
  "https://gentle-frost-0125.icarus018.workers.dev/",
  "https://summer-poetry-a019.icarus017.workers.dev/",
  "https://billowing-sea-003c.icarus016.workers.dev/",
  "https://summer-poetry-0561.icarus015.workers.dev/",
  "https://dawn-mud-4987.icarus014.workers.dev/",
  "https://wandering-flower-cc32.icarus011.workers.dev/",
  "https://small-recipe-9008.icarus09.workers.dev/",
  // "https://morning-haze-36e3.icarus08.workers.dev/",
  // "https://little-limit-e11e.icarus05.workers.dev/",
  // "https://ancient-limit-83f0.icarus03.workers.dev/",
  // "https://sparkling-credit-c6b8.icarus02.workers.dev/",
  // "https://green-dawn-9241.icarus01.workers.dev/",
  // "https://proxy.icarus14.workers.dev/",
  // "https://proxy.icarus13.workers.dev/",
  // "https://proxy.icarus12.workers.dev/",
  // "https://proxy.icarus11.workers.dev/",
  // "https://proxy.icarus10.workers.dev/",
  // "https://proxy.icarus9.workers.dev/",
  // "https://proxy.icarus8.workers.dev/",
  // "https://proxy.icarus7.workers.dev/",
  // "https://proxy.icarus3.workers.dev/",
  // "https://icarus.test155-123.workers.dev/",
  // "https://proxy.icarus1.workers.dev/",
  // "https://proxy.icarus2.workers.dev/",
  // "https://late-snowflake-5076.zxcprime362.workers.dev/",
  // "https://weathered-frost-60b0.zxcprime361.workers.dev/",
  // "https://icarus.test154-123.workers.dev/",
  // "https://icarus.test156-123.workers.dev/",
  // "https://icarus.test157-123.workers.dev/",

  // "https://proxy.zxcprime359-test1.workers.dev/",
  // "https://proxy.orbitprime27.workers.dev/",
  // "https://proxy.silverlantern64.workers.dev/",
  // "https://proxy.zxcprime380.workers.dev/",
  // "https://orange-tooth-0e36.zxcprime369.workers.dev/",
  // "https://silent-glitter-744f.zxcprime365.workers.dev/",
  // "https://nameless-feather-4fca.zxcprime364.workers.dev/",
  // "https://proxy.zxcprime.workers.dev/",
  // "https://proxy.zxcprime3.workers.dev/",
  // "https://proxy.zxcprime2.workers.dev/",
  // "https://orange-poetry-e481.jindaedalus2.workers.dev/",
  // "https://proxy.primezxc9.workers.dev/",
  // "https://sweet-dust-bdb3.vetenabejar.workers.dev/",
  // "https://long-frog-ec4e.coupdegrace21799.workers.dev/",
  // "https://damp-bonus-5625.mosangfour.workers.dev/",
  // "https://orange-paper-a80d.j61202287.workers.dev/",
  // "https://still-butterfly-9b3e.zxcprime360.workers.dev/",
  // "https://empty-pond-805b.zxcprime363.workers.dev/",
  // //
  // "https://summer-snow-a035.vps7.workers.dev/",
  // "https://wandering-star-4ce0.vps8-cc9.workers.dev/",
  // "https://fragrant-pond-cb40.vps5.workers.dev/",
  // "https://crimson-wind-e271.vps6.workers.dev/",
  // "https://broken-unit-25d8.vps3-705.workers.dev/",
  // "https://silent-queen-3238.vps4-c8e.workers.dev/",
  // "https://dawn-hall-287d.vps1-058.workers.dev/",
  // "https://ancient-lake-48d8.vps2-260.workers.dev/",
  // //
  // "https://little-frog-dbca.icarus049.workers.dev/",
  // "https://dawn-violet-1bfc.icarus045.workers.dev/",
  // "https://cool-bonus-53bc.vps10-af1.workers.dev/",
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
  const workerUrl = new URL("https://silent-sound-504b.vidlink.workers.dev/"); 
  workerUrl.searchParams.set("tmdbId", tmdbId);
  workerUrl.searchParams.set("mediaType", mediaType);
  if (season) workerUrl.searchParams.set("season", season);
  if (episode) workerUrl.searchParams.set("episode", episode);

  const response = await fetchWithTimeout(
    workerUrl.toString(),
    { method: "GET" },
    8000,
  );

  if (!response.ok) {
    return { links: [], subtitles: [] };
  }

  const data = await response.json();
  return {
    links: data.links ?? [],
    subtitles: data.subtitles ?? [],
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

  const path = req.nextUrl.pathname.split("/").pop()!;
  const tmdbId = params.get("id");
  const mediaType = params.get("b");
  const season = params.get("season") ?? "";
  const episode = params.get("episode") ?? "";
  const title = params.get("title");
  const year = params.get("year");
  const ts = Number(params.get("ts"));
  const token = params.get("token");

  const logRequest = (status: number, reason: string) => {
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";
    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    const message =
      `[VIDLINK] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ` +
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
    if (!tmdbId || !mediaType || !title || !year || !ts || !token) {
      return error(400, "missing params");
    }
    if (mediaType !== "movie" && mediaType !== "tv") {
      return error(400, "Invalid media type");
    }
    if (mediaType === "tv" && (!season || !episode)) {
      return error(400, "TV requires season and episode");
    }
    if (
      !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
    ) {
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

    const link = await buildProxiedLink(playlist, cookie, worker);

    logRequest(200, "VIDLINK OK");
    return NextResponse.json({
      success: true,
      links: [
        {
          ...link,
          link: encryptLink(link.link),
        },
      ],
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
