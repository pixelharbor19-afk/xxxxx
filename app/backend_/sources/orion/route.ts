import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";

import { createClient } from "@supabase/supabase-js";
import { isValidReferer } from "@/lib/allowed-referers";
import { encryptUrl } from "@/lib/encryptor";
import { validateSession } from "@/lib/validate-session";
import { encryptLink } from "@/lib/link-crypto";

let blacklistCache: Set<string> | null = null;
let blacklistCacheTime = 0;
const BLACKLIST_TTL = 5 * 60_000;
async function getNext8AMPH(): Promise<string> {
  const now = new Date();
  const ph = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const next8AM = new Date(ph);
  next8AM.setHours(8, 0, 0, 0);
  if (ph >= next8AM) next8AM.setDate(next8AM.getDate() + 1);
  const diff = next8AM.getTime() - ph.getTime();
  return new Date(now.getTime() + diff).toISOString();
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
const supabase = createClient(
  process.env.NEXT_PUBLIC_HOLLY_SUPABASE_URL_HOLLY!,
  process.env.HOLLY_SUPABASE_SERVICE_ROLE_KEY_HOLLY!,
);
const GOOD_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.114 Safari/537.36",
  Origin: "https://goodstream.cc",
  Referer:
    "https://goodstream.cc/embed/W3cPjhjEzF?__cf_chl_tk=SUf37oAYSwhfVhF8URs6D8SK2iP_w5RW9NDtbtCzul8-1783909042-1.0.1.1-2jmKyV_qr4Y10vE0u8rjgxQxVJxZZwFDSCLLQ_FdlbI",
};

// Cookie:
//   "cf_clearance=Shib.kVZbVDgJDU1GKv1nbUVUVOmaQ5xdjU5pvCwLxg-1783909046-1.2.1.1-3iK8K2GIOeCtRAJ3l3WmPdDHjpKVpo8ieaAy17TRByJ0l0wKYlDPz2dRkqyRSeqz0TziVHmaJraDRzSBukJ.zJxeUwgxvat9hz8kCvB9kMjEmtKQpFxcxoYQ3I7FguWEndAqQppX9Xo.wkTgzNHGaQZuzDE6znn7G0RvI2BcRsIIR0u4wlxrsANladOz8CRnsMN.EQ7mvPcHd3AWq0hXpsjG1n6WJljyriChUetClEthytE4mhzRc_3qMEPlJ85W2wz9RfuH1247.rEjaBt1ztWlACrkcUtDDsYOquAojthHFmKygvZOYhnw.KVZXacdIQGVSakwm4ISD9z4C4M_qkxqYV4gG6jdqvOBLKKFho3j9rU.VpZ1vzMErFSMYH5NgETYeV3sYBCSOQFtd.ELqqBLIM_vvCF6WMj1OPDynQSxX28EGs7irFkcJGLQh6WPwE4LzHYfPYUfuP76bfKx3tj6aE6HVYfhZlmNb7QYTkgC62NvSBh6eh3snymTMkVN",
const HOLLY_WORKERS = [
  "https://curly-field-b7ab.onlinesho1.workers.dev/",
  "https://icy-glade-a2f9.onlineshop2-4fa.workers.dev/",
  "https://misty-smoke-703c.onlineshop3.workers.dev/",
  "https://steep-mode-f072.onlineshop4.workers.dev/",
  "https://damp-tree-2a80.onlineshop5.workers.dev/",
  "https://shy-glade-89f9.onlineshop6.workers.dev/",
  "https://empty-glade-d144.onlineshop7.workers.dev/",
  "https://orange-bush-746c.onlineshop8.workers.dev/",
  "https://blue-morning-b0ed.onlineshop10.workers.dev/",
  "https://cold-block-fb91.onlineshop9.workers.dev/",
  "https://wild-limit-4cdd.onion-468.workers.dev/",
  "https://shiny-feather-61d5.onion2.workers.dev/",
  "https://dark-cherry-6a91.onion1-15b.workers.dev/",
  "https://proud-cell-5939.onion3.workers.dev/",
  "https://tiny-recipe-0260.onion4.workers.dev/",
  "https://little-river-b101.onion5.workers.dev/",
  "https://silent-bonus-7a24.onion6.workers.dev/",
  "https://aged-base-c9ac.onion7.workers.dev/",
  "https://muddy-lab-95c2.onion8.workers.dev/",
  "https://empty-wind-c60d.onion9.workers.dev/",
  "https://silent-poetry-4f31.onion10.workers.dev/",
  "https://misty-flower-259e.onion11.workers.dev/",
  "https://yellow-flower-c806.onion12.workers.dev/",
  "https://winter-snowflake-221b.onion13.workers.dev/",
  "https://patient-cake-5c11.onion14.workers.dev/",
  "https://misty-sunset-2fbb.onion15.workers.dev/",
  "https://round-frost-a275.onion16.workers.dev/",
  "https://empty-rice-a229.onion18.workers.dev/",
  "https://dry-limit-0202.onion17.workers.dev/",
  "https://late-field-848e.onion20.workers.dev/",
  "https://delicate-rice-21d0.onion19.workers.dev/",
  "https://broken-shape-6e6f.onion22.workers.dev/",
  "https://broken-king-75d2.onion21.workers.dev/",
  "https://small-cake-d1a9.garlic1.workers.dev/",

  "https://summer-sunset-baa7.cabbage18.workers.dev/",
  "https://nameless-darkness-6726.cabbage20.workers.dev/",
  "https://dawn-flower-62aa.cabbage19.workers.dev/",

  "https://shy-mountain-1e6e.eggplant17.workers.dev/",
  "https://autumn-art-09cb.eggplant18.workers.dev/",
  "https://jolly-cell-b82a.eggplant20.workers.dev/",
  "https://cool-king-6047.eggplant19.workers.dev/",
  "https://soft-snow-25d5.tomato2.workers.dev/",

  "https://winter-resonance-4397.tomato14.workers.dev/",
  "https://long-mountain-c477.tomato15.workers.dev/",
  "https://icy-recipe-7f1f.tomato16.workers.dev/",
  "https://quiet-boat-d3c5.tomato17.workers.dev/",
  "https://nameless-river-3e50.tomato18.workers.dev/",
  "https://billowing-thunder-d61e.tomato19.workers.dev/",
  "https://round-lab-5901.tomato20.workers.dev/",
  

  "https://lucky-bird-0b3f.tantado1.workers.dev/",
  "https://rapid-resonance-41cd.tantado2.workers.dev/",
  "https://shrill-star-8c65.tantado4.workers.dev/",
  "https://spring-smoke-eeed.tantado3.workers.dev/",
  "https://round-boat-b15b.tukmol1.workers.dev/",
  "https://wispy-tree-61f1.tukmol2.workers.dev/",
  "https://quiet-fog-57a4.tukmol3.workers.dev/",
  "https://square-frost-cb9f.tukmol4.workers.dev/",
  "https://divine-water-54c8.tukmol5.workers.dev/",
  "https://snowy-star-94e0.tukmol6.workers.dev/",
  "https://long-dawn-1507.tukmol7.workers.dev/",
  "https://dark-dream-899d.tukmol8.workers.dev/",
  "https://nameless-tooth-ba9c.tukmol10.workers.dev/",
  "https://solitary-bread-d752.tukmol9.workers.dev/",
  "https://frosty-pine-d395.tukmol11.workers.dev/",
  "https://winter-silence-9027.tukmol12.workers.dev/",
  "https://blue-shape-8725.hotdog1.workers.dev/",
  "https://lively-voice-cc6c.hotdog2.workers.dev/",
  "https://aged-firefly-c044.hotdog3.workers.dev/",
  "https://old-river-95a1.hotdog4.workers.dev/",
  "https://solitary-wind-5759.hotdog5.workers.dev/",
  "https://spring-water-af97.hotdog6.workers.dev/",
  "https://muddy-glade-0cdd.hotdog8.workers.dev/",
  "https://wandering-lab-8aaf.hotdog7.workers.dev/",
  "https://lucky-lake-4dcd.hotdog9.workers.dev/",
  "https://wandering-bar-125d.hotdog10.workers.dev/",
  "https://old-thunder-6829.hotdog12.workers.dev/",
  "https://spring-snowflake-0b64.hotdog11.workers.dev/",
  "https://little-hall-3be5.friedrice1.workers.dev/",
  "https://raspy-union-8ac8.friedrice2.workers.dev/",
  "https://rapid-meadow-568b.friedrice3.workers.dev/",
  "https://polished-waterfall-8667.friedrice4.workers.dev/",
];
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export async function getWorkingProxy(activeProxies: string[]) {
  const shuffledProxies = shuffle(activeProxies);
  const TIMEOUT = 7000;
  const MAX_TRIES = 5;

  for (let i = 0; i < Math.min(shuffledProxies.length, MAX_TRIES); i++) {
    const proxy = shuffledProxies[i];

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

      if (res.status < 500) {
        return proxy;
      }
    } catch (err: any) {
      console.error(
        `[ORION PROXY] ${proxy} → ${err?.name || err?.message || "failed"}`,
      );
    }
  }

  return null;
}
const priority = (file: string) => {
  if (file.includes("tripplestream.online")) return 0;
  if (file.includes("/pl/")) return 1;
  if (file.includes("/streamsvr/")) return 2;

  return 3;
};
export async function GET(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const logRequest = (status: number, reason: string) => {
    const tmdbId = req.nextUrl.searchParams.get("id");
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get("season");
    const episode = req.nextUrl.searchParams.get("episode");
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

    const message = `[ORION] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`;

    if (status >= 500) {
      console.error(message);
    } else if (status >= 400) {
      console.warn(message);
    } else {
      console.log(message);
    }
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
        { success: false, error: "need token" },
        { status: 400 },
      );
    }
    // const session = req.cookies.get("_ps")?.value;

    // if (!session || !validateSession(session)) {
    //   logRequest(401, "invalid session");

    //   return NextResponse.json(
    //     { success: false, error: "Invalid session" },
    //     { status: 401 },
    //   );
    // }

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
    const activeProxies = await getActiveProxies(HOLLY_WORKERS);
    const worker = await getWorkingProxy(activeProxies);

    if (!worker) {
      logRequest(502, "no working worker");
      return NextResponse.json(
        { success: false, error: "No available worker" },
        { status: 502 },
      );
    }
    // ─── CACHE CHECK ─────────────────────────────────────────────────────────
    const { data: cached } = await supabase
      .from("holly_movie_cache")
      .select("sources")
      .eq("tmdb_id", Number(tmdbId))
      .eq("media_type", mediaType)
      .eq("season", season)
      .eq("episode", episode)
      .single();

    if (cached?.sources?.length) {
      const links = await Promise.all(
        [...cached.sources]
          .sort((a: any, b: any) => priority(a.file) - priority(b.file))
          .map(async (source: any) => {
            const payload = JSON.stringify({
              exp: Date.now() + 5 * 60 * 60 * 1000,
              url: source.file,
              headers: GOOD_HEADERS,
            });

            const encrypted = await encryptUrl(payload);

            return {
              source: source.file.includes("/pl/")
                ? "pl"
                : source.file.includes("/streamsvr/")
                  ? "streamsvr"
                  : "default",
              type: source.type === "hls" ? "hls" : "mp4",
              link: `${worker}proxy?data=${encodeURIComponent(encrypted)}`,
            };
          }),
      );
      logRequest(200, "OK!!!!!");
      return NextResponse.json({
        success: true,
        links: links.map((link) => ({
          ...link,
          link: encryptLink(link.link),
        })),
        subtitles: [],
        meow: true,
        remaining: activeProxies.length,
      });
    }

    // ─── STEP 1: Scrape ──────────────────────────────────────────────────────
    const baseSlug = title
      .toLowerCase()
      .replace(/['''`']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const hollySlug =
      mediaType === "tv" && season && episode
        ? `${baseSlug}-season-${season}-episode-${episode}`
        : `${baseSlug}-${year}`;

    let step1Res = await fetchWithTimeout(
      `${worker}scrape?slug=${encodeURIComponent(hollySlug)}`,
      {},
      15000,
    );

    if (step1Res.status === 429) {
      const remaining = (await getActiveProxies(HOLLY_WORKERS)).filter(
        (w) => w !== worker,
      );
      for (const w of shuffle(remaining)) {
        const res = await fetchWithTimeout(
          `${w}scrape?slug=${encodeURIComponent(hollySlug)}`,
          {},
          15000,
        );
        if (res.status === 429) continue;
        step1Res = res;
        break;
      }
    }

    if (!step1Res.ok) {
      logRequest(502, "step 1 failed");
      return NextResponse.json(
        { success: false, error: "Holly step 1 failed" },
        { status: 502 },
      );
    }

    const step1Data = await step1Res.json();
    const qualities = step1Data.qualities ?? [];

    if (!qualities.length) {
      logRequest(404, "no qualities found");
      return NextResponse.json(
        { success: false, error: "No qualities found" },
        { status: 404 },
      );
    }

    // ─── STEP 2: Resolve embed ────────────────────────────────────────────────
    const bestQuality =
      qualities.find((q: any) => q.quality === "1080p") ??
      qualities.find((q: any) => q.quality === "default") ??
      qualities[0];
    const encryptedH = await encryptUrl(JSON.stringify(GOOD_HEADERS));
    const step2Res = await fetchWithTimeout(
      `${worker}resolve?embed_url=${encodeURIComponent(bestQuality.embed_url)}&h=${encodeURIComponent(encryptedH)}`,
      {},
      15000,
    );

    if (!step2Res.ok) {
      logRequest(502, "step 2 failed");
      return NextResponse.json(
        { success: false, error: "Holly step 2 failed" },
        { status: 502 },
      );
    }

    const step2Data = await step2Res.json();
    const sources = step2Data.sources ?? [];

    if (!sources.length) {
      logRequest(404, "no sources from step 2");
      return NextResponse.json(
        { success: false, error: "No sources from step 2" },
        { status: 404 },
      );
    }

    await supabase.from("holly_movie_cache").upsert(
      {
        tmdb_id: Number(tmdbId),
        media_type: mediaType,
        season,
        episode,
        embeds: qualities,
        sources,
      },
      { onConflict: "tmdb_id,media_type,season,episode" },
    );

    // ─── STEP 3: Build links ──────────────────────────────────────────────────

    const links = await Promise.all(
      [...sources]
        .sort((a: any, b: any) => priority(a.file) - priority(b.file))
        .map(async (source: any) => {
          const payload = JSON.stringify({
            exp: Date.now() + 5 * 60 * 60 * 1000,
            url: source.file,
            headers: GOOD_HEADERS,
          });

          const encrypted = await encryptUrl(payload);

          return {
            source: source.file.includes("/pl/")
              ? "pl"
              : source.file.includes("/streamsvr/")
                ? "streamsvr"
                : "default",
            type: source.type === "hls" ? "hls" : "mp4",
            link: `${worker}proxy?data=${encodeURIComponent(encrypted)}`,
          };
        }),
    );

    logRequest(200, "ORION OK!!!!!");
    return NextResponse.json({
      success: true,
      links: links.map((link) => ({
        ...link,
        link: encryptLink(link.link),
      })),
      subtitles: [],
      remaining: activeProxies.length,
    });
  } catch (err: any) {
    console.error(
      `[ORION] 500 | Holly route error | ${err?.name || err?.message || err} | IP: ${ip}`,
    );
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
