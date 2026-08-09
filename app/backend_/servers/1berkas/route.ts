import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { FIELD_MAP } from "@/lib/token";
import { createClient } from "@supabase/supabase-js";
import { encryptUrl } from "@/lib/encryptor";

//AES_KEY
//48cea93448b6719f32471b15777eb140db961b6ba6f1fc92cb92b0fdd7da555d
const supabase = createClient(
  process.env.SUPABASE_URL_BERKAS!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_BERKAS!,
);
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
  await supabase
    .from("proxy_blacklist")
    .upsert(
      { proxy, expires_at: await getNext8AMPH() },
      { onConflict: "proxy" },
    );
  console.log(`[PROXY] ⛔ blacklisted ${proxy}`);
}

async function getActiveProxies(proxies: string[]): Promise<string[]> {
  const { data } = await supabase
    .from("proxy_blacklist")
    .select("proxy")
    .gt("expires_at", new Date().toISOString());
  const blocked = new Set((data ?? []).map((r: any) => r.proxy));
  return proxies.filter((p) => !blocked.has(p));
}
async function getHealthyWorker(): Promise<string | null> {
  const active = await getActiveProxies(PROXY_WORKERS);
  const candidates = shuffle(active);
  if (!candidates.length) return null;
  for (const worker of candidates) {
    try {
      const res = await fetchWithTimeout(worker, { method: "HEAD" }, 3000);
      if (res.status === 429) {
        await blacklistProxy(worker);
        continue;
      }
      if (res.ok) return worker;
    } catch (err) {
      console.error(worker, err);
    }
  }
  return null;
}
// /workers/subdomain
const PROXY_WORKERS = [
  "https://snowy-brook-8333.berkas016.workers.dev/",
  "https://withered-wind-d29d.berkas015.workers.dev/",
  "https://dry-sea-54e2.berkas014.workers.dev/",
  "https://late-lake-bf67.berkas013.workers.dev/",
  "https://tight-fog-8f33.berkas012.workers.dev/",
  "https://dawn-sound-29da.berkas011.workers.dev/",
  "https://hidden-term-bd90.berkas010.workers.dev/",
  "https://long-pine-34a6.berkas09.workers.dev/",
  "https://lingering-frog-21bf.berkas08.workers.dev/",
  "https://royal-boat-ed13.berkas07.workers.dev/",
  "https://bitter-disk-bffb.berkas06.workers.dev/",
  "https://rough-waterfall-90f0.berkas05.workers.dev/",
  //
  "https://tight-glitter-3cac.berkas04.workers.dev/",
  "https://tiny-meadow-5f2b.berkas03.workers.dev/",
  "https://rapid-forest-0c46.berkas02.workers.dev/",
  "https://autumn-bonus-a535.berkas01.workers.dev/",
  "https://zxcstream.berkas65.workers.dev/",
  "https://zxcstream.berkas64.workers.dev/",
  "https://zxcstream.berkas63.workers.dev/",
  "https://zxcstream.berkas61.workers.dev/",
  "https://zxcstream.berkas60.workers.dev/",
  "https://zxcstream.berkas58.workers.dev/",
  "https://zxcstream.berkas57.workers.dev/",
  "https://zxcstream.berkas55.workers.dev/",
  "https://zxcstream.berkas54.workers.dev/",
  "https://zxcstream.berkas53.workers.dev/",
  "https://zxcstream.berkas52.workers.dev/",
  "https://zxcstream.berkas51.workers.dev/",
  "https://zxcstream.berkas50.workers.dev/",
  "https://zxcstream.berkas49.workers.dev/",
  "https://zxcstream.berkas48.workers.dev/",
  "https://zxcstream.berkas47.workers.dev/",
  "https://zxcstream.berkas46.workers.dev/",
  "https://zxcstream.berkas45.workers.dev/",
  //
  "https://zxcstream.berkas44.workers.dev/",
  "https://zxcstream.berkas43.workers.dev/",
  "https://zxcstream.berkas42.workers.dev/",
  "https://zxcstream.berkas41.workers.dev/",
  "https://zxcstream.berkas40.workers.dev/",
  "https://zxcstream.berkas39.workers.dev/",
  "https://zxcstream.berkas38.workers.dev/",
  "https://zxcstream.berkas37.workers.dev/",
  "https://zxcstream.berkas36.workers.dev/",
  "https://zxcstream.berkas35.workers.dev/",
  "https://zxcstream.berkas34.workers.dev/",
  "https://zxcstream.berkas33.workers.dev/",
  "https://zxcstream.berkas32.workers.dev/",
  "https://zxcstream.berkas31.workers.dev/",
  "https://zxcstream.berkas30.workers.dev/",
  "https://zxcstream.berkas29.workers.dev/",
  "https://zxcstream.berkas28.workers.dev/",
  "https://zxcstream.berkas27.workers.dev/",
  "https://berkas.berkas26.workers.dev/",
  "https://berkas.berkas25.workers.dev/",
  "https://zxcstream.berkas24.workers.dev/",
  "https://zxcstream.berkas23.workers.dev/",
  "https://zxcstream.berkas22.workers.dev/",
  "https://zxcstream.berkas21.workers.dev/",
  "https://zxcstream.berkas20.workers.dev/",
  "https://zxcstream.berkas19.workers.dev/",
  "https://zxcstream.berkas18.workers.dev/",
  "https://zxcstream.berkas17.workers.dev/",
  "https://zxcstream.berkas16.workers.dev/",
  "https://zxcstream.berkas15.workers.dev/",
  "https://zxcstream.berkas14.workers.dev/",
  "https://zxcstream.berkas13.workers.dev/",
  "https://zxcstream.berkas12.workers.dev/",
  "https://zxcstream.berkas11.workers.dev/",
  "https://zxcstream.berkas10.workers.dev/",
  "https://zxcstream.berkas9.workers.dev/",
  "https://zxcstream.berkas8.workers.dev/",
  "https://zxcstream.berkas7.workers.dev/",
  "https://zxcstream.berkas6.workers.dev/",
  "https://zxcstream.berkas5.workers.dev/",
  "https://zxcstream.berkas4.workers.dev/",
  "https://zxcstream.berkas3.workers.dev/",
  "https://zxcstream.berkas2.workers.dev/",
  "https://zxcstream.berkas1.workers.dev/",
  "https://berkas.test075-123.workers.dev/",
  "https://berkas.test078-123.workers.dev/",
  "https://berkas.test077-123.workers.dev/",
  "https://berkas.test076-123.workers.dev/",
  "https://berkas.test068-abc.workers.dev/",
  "https://berkas.test073-123.workers.dev/",
  "https://berkas.test074-123.workers.dev/",
  "https://berkas.test072-123.workers.dev/",
  "https://berkas.test071-123.workers.dev/",
  "https://berkas.test070-123.workers.dev/",
  "https://berkas.test069-123.workers.dev/",
  "https://berkas.test0670-123.workers.dev/",
  "https://berkas.test063-123.workers.dev/",
  "https://berkas.test06-123.workers.dev/",
  "https://berkas.test064-123.workers.dev/",
  "https://berkas.test065-123.workers.dev/",
  "https://berkas.test061-123.workers.dev/",
  "https://berkas.test059-123.workers.dev/",
  "https://berkas.test060-123.workers.dev/",
  "https://berkas.test062-123.workers.dev/",
  "https://berkas.test055-123.workers.dev/",
  "https://berkas.test058-123.workers.dev/",
  "https://berkas.test057-123.workers.dev/",
  "https://berkas.test056-123.workers.dev/",
  "https://berkas.test052-123.workers.dev/",
  "https://berkas.test054-123.workers.dev/",
  "https://berkas.test053-123.workers.dev/",
  "https://berkas.test051-123.workers.dev/",
  "https://berkas.test047-123.workers.dev/",
  "https://berkas.test049-123.workers.dev/",
  "https://berkas.test050-123.workers.dev/",
  "https://berkas.test048-123.workers.dev/",
  "https://berkas.test045.workers.dev/",
  "https://berkas.test046-43r.workers.dev/",
  "https://berkas.test98-a64.workers.dev/",
  "https://berkas.test97-f4b.workers.dev/",
  "https://berkas.test96-27b.workers.dev/",
  "https://berkas.test95-7d8.workers.dev/",
  "https://berkas.test100-1ff.workers.dev/",
  "https://berkas.test-zxcstream.workers.dev/",
  "https://berkas.test042.workers.dev/",
  "https://berkas.test041.workers.dev/",
  "https://berkas.zxcstream.workers.dev/", //Test040
  "https://berkas.test038.workers.dev/",
  "https://berkas.test032.workers.dev/",
  "https://berkas.test034.workers.dev/",
  "https://berkas.test035.workers.dev/",
  "https://berkas.test033.workers.dev/",
  "https://berkas.test031.workers.dev/",
  "https://berkas.test030.workers.dev/",
  "https://berkas.test029.workers.dev/",
  "https://berkas.test027.workers.dev/",
  "https://berkas.test028.workers.dev/",
  "https://berkas.test025.workers.dev/",
  "https://berkas.test026.workers.dev/",
  "https://berkas.test024.workers.dev/",
  "https://berkas.test023.workers.dev/",
  "https://berkas.test022.workers.dev/",
  "https://berkas.test021.workers.dev/",
  "https://berkas.test017.workers.dev/",
  "https://berkas.test019.workers.dev/",
  "https://berkas.test018.workers.dev/",
  "https://berkas.test020.workers.dev/",
  // "https://berkas.test013.workers.dev/",
  "https://berkas.test015-505.workers.dev/",
  "https://berkas.test016.workers.dev/",
  "https://berkas.test014-25a.workers.dev/",
  "https://berkas.test09-635.workers.dev/",
  "https://berkas.test010-f3d.workers.dev/",
  "https://berkas.test011.workers.dev/",
  "https://berkas.test012.workers.dev/",
  "https://berkas.test05-187.workers.dev/",
  "https://berkas.test06-c51.workers.dev/",
  "https://berkas.test07-84f.workers.dev/",
  "https://berkas.test08-0df.workers.dev/",
  "https://berkas.test01-05a.workers.dev/",
  "https://berkas.test02-663.workers.dev/",
  // "https://berkas.test03-4fb.workers.dev/",
  // "https://berkas.test04-cee.workers.dev/",
  "https://rapid-rain-5111.berkas002.workers.dev/",
  "https://dry-unit-59a0.berkas001.workers.dev/",
  "https://empty-cloud-4a95.berkas004.workers.dev/",
  "https://noisy-star-55c7.berkas003.workers.dev/",
  "https://twilight-sky-ee61.berkas006.workers.dev/",
  "https://white-bar-36b1.berkas005.workers.dev/",
  "https://wispy-frog-30dc.berkas007.workers.dev/",
  "https://wispy-river-ce4f.berkas008.workers.dev/",
  "https://mute-disk-de22.berkas0010.workers.dev/",
  "https://still-sound-93be.berkas009.workers.dev/",
  //
  "https://bitter-cake-30a3.berkas0001.workers.dev/",
  "https://sparkling-union-988a.berkas0002.workers.dev/",
  "https://floral-queen-8843.berkas0004.workers.dev/",
  "https://late-band-520f.berkas0003.workers.dev/",
  "https://purple-bar-caf1.berkas0006.workers.dev/",
  "https://wispy-credit-3692.berkas0005.workers.dev/",
  "https://proud-paper-2687.berkas0007.workers.dev/",
  "https://morning-glade-1938.berkas0008.workers.dev/",
  //
  "https://delicate-haze-a9bb.invalid1.workers.dev/",
  "https://muddy-butterfly-b8c9.invalid2.workers.dev/",
  "https://holy-tooth-f9cb.invalid3.workers.dev/",
  "https://dry-sun-eda6.invalid4.workers.dev/",
  "https://nameless-wildflower-767a.invalid6.workers.dev/",
  "https://wild-union-5a40.invalid5.workers.dev/",
  "https://divine-night-80da.invalid8.workers.dev/",
  "https://empty-frog-2095.invalid7.workers.dev/",
  "https://cool-block-670c.invalid10.workers.dev/",
  "https://black-cake-f379.invalid9.workers.dev/",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const STREAMDATA_URL = "https://streamdata.vaplayer.ru/api.php";

export async function GET(req: NextRequest) {
  const logRequest = (status: number, reason: string) => {
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

    console.log(
      `[BERKAS]  ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`,
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
    // -------- Cache Lookup --------
    let streamUrls: string[];
    let subtitles: any[];

    const cacheQuery = supabase
      .from("berkas_cache")
      .select("stream_urls, subtitles")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .eq("season", season ?? "")
      .eq("episode", episode ?? "")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    const { data: cached } = await cacheQuery;

    if (cached) {
      streamUrls = cached.stream_urls ?? [];
      subtitles = cached.subtitles ?? [];
    } else {
      const qs = new URLSearchParams({
        tmdb: tmdbId,
        type: mediaType,
      });

      if (mediaType === "tv") {
        qs.set("season", season!);
        qs.set("episode", episode!);
      }

      const res = await fetchWithTimeout(
        `${STREAMDATA_URL}?${qs.toString()}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
            Origin: "https://nextgencloudfabric.com",
            Referer: "https://nextgencloudfabric.com/",
            Accept: "*/*",
            "Accept-Language": "en-US,en;q=0.7",
          },
        },
        8000,
      );
      const data = await res.json();

      streamUrls = data?.data?.stream_urls ?? [];

      if (data?.status_code !== "200" || !streamUrls.length) {
        logRequest(404, "no streams found");
        return NextResponse.json(
          { success: false, error: "No streams found" },
          { status: 404 },
        );
      }

      subtitles = (data?.default_subs ?? []).map((sub: any, index: number) => ({
        id: sub.sid ?? sub.id ?? index,
        display:
          sub.lang ?? sub.language ?? sub.display ?? sub.code ?? "Unknown",
        language: sub.code ?? "",
        file: sub.url ?? sub.file,
      }));

      await supabase.from("berkas_cache").upsert(
        {
          tmdb_id: tmdbId,
          media_type: mediaType,
          season: season ?? "",
          episode: episode ?? "",
          stream_urls: streamUrls,
          subtitles,
          refreshed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
        },
        { onConflict: "tmdb_id,media_type,season,episode" },
      );
    }

    const proxyWorker = await getHealthyWorker();

    if (!proxyWorker) {
      logRequest(503, "all proxy workers unavailable");
      return NextResponse.json(
        { success: false, error: "No proxy workers available" },
        { status: 503 },
      );
    }

    const links = await Promise.all(
      streamUrls.map(async (url, i) => {
        const encrypted = await encryptUrl(url);

        return {
          type: "hls" as const,
          link: `${proxyWorker}?data=${encodeURIComponent(encrypted)}`,
          resolution: streamUrls.length - i,
        };
      }),
    );

    logRequest(200, "BERKAS OK!!!!!");
    return NextResponse.json({
      success: true,
      links,
      subtitles,
      meow: !!cached,
    });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
