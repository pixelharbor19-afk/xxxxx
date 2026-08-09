import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";

import { FIELD_MAP } from "@/lib/token";
import { encryptUrl } from "@/lib/encryptor";
import { createClient } from "@supabase/supabase-js";

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
  Cookie:
    "cf_clearance=Shib.kVZbVDgJDU1GKv1nbUVUVOmaQ5xdjU5pvCwLxg-1783909046-1.2.1.1-3iK8K2GIOeCtRAJ3l3WmPdDHjpKVpo8ieaAy17TRByJ0l0wKYlDPz2dRkqyRSeqz0TziVHmaJraDRzSBukJ.zJxeUwgxvat9hz8kCvB9kMjEmtKQpFxcxoYQ3I7FguWEndAqQppX9Xo.wkTgzNHGaQZuzDE6znn7G0RvI2BcRsIIR0u4wlxrsANladOz8CRnsMN.EQ7mvPcHd3AWq0hXpsjG1n6WJljyriChUetClEthytE4mhzRc_3qMEPlJ85W2wz9RfuH1247.rEjaBt1ztWlACrkcUtDDsYOquAojthHFmKygvZOYhnw.KVZXacdIQGVSakwm4ISD9z4C4M_qkxqYV4gG6jdqvOBLKKFho3j9rU.VpZ1vzMErFSMYH5NgETYeV3sYBCSOQFtd.ELqqBLIM_vvCF6WMj1OPDynQSxX28EGs7irFkcJGLQh6WPwE4LzHYfPYUfuP76bfKx3tj6aE6HVYfhZlmNb7QYTkgC62NvSBh6eh3snymTMkVN",
};
const HOLLY_WORKERS = [
  "https://orion.zxcprime362.workers.dev/",
  "https://orion.test8-98b.workers.dev/",
  "https://orion.test15-e6c.workers.dev/",
  "https://orion.test14-b67.workers.dev/",
  "https://orion.test13-ab8.workers.dev/",
  "https://orion.test12-3d3.workers.dev/",
  "https://orion.test11-a1b.workers.dev/",
  "https://orion.test5-9ab.workers.dev/",
  "https://orion.test7-337.workers.dev/",
  "https://orion.test6-cb9.workers.dev/",
  "https://orion.test9-6da.workers.dev/",
  "https://lucky-leaf-9eed.test26-ee5.workers.dev/",
  "https://black-thunder-0223.test25-30d.workers.dev/",
  "https://plain-lab-17af.test24-6ad.workers.dev/",
  "https://small-wood-adba.test23-515.workers.dev/",
  "https://dawn-field-efbb.test22-f82.workers.dev/",
  "https://rapid-rain-1898.test21-0af.workers.dev/",
  "https://blue-sun-2b6e.test20-5b4.workers.dev/",
  "https://broken-paper-2e14.test19-31a.workers.dev/",
  "https://polished-rice-b094.test18-8cb.workers.dev/",
  "https://soft-bread-864e.test16-011.workers.dev/",
  "https://dry-moon-e266.test66-8cc.workers.dev/",
  "https://fragrant-rice-8998.test65-8de.workers.dev/",
  "https://restless-resonance-a8a8.test63-bfc.workers.dev/",
  "https://nameless-tooth-8cbb.test64-0d5.workers.dev/",
  "https://spring-darkness-8beb.test61-86c.workers.dev/",
  "https://odd-river-ed9f.test29-be6.workers.dev/",
  "https://shrill-smoke-e6eb.test60-598.workers.dev/",
  "https://twilight-resonance-eb4d.test28-f24.workers.dev/",
  "https://billowing-rain-7239.test27-15e.workers.dev/",
  "https://throbbing-dream-bb83.test62-63e.workers.dev/",
  "https://small-hall-439b.test83-291.workers.dev/",
  "https://rough-bonus-f4e3.test82-ac2.workers.dev/",
  "https://quiet-sun-4390.test80-1f4.workers.dev/",
  "https://curly-sea-0553.test79-29a.workers.dev/",
  "https://mute-bonus-b2b6.test78-564.workers.dev/",
  "https://fragrant-silence-a7d1.test77-a68.workers.dev/",
  "https://weathered-king-9f51.test76-4e9.workers.dev/",
  "https://delicate-dream-a0ac.test75-da4.workers.dev/",
  "https://twilight-mode-af23.test74-635.workers.dev/",
  "https://sweet-feather-58ef.test73-bfb.workers.dev/",
  "https://morning-bar-88d3.test74-635.workers.dev/",
  "https://curly-fire-36d7.test73-bfb.workers.dev/",
  "https://restless-term-9ca1.test72-165.workers.dev/",
  "https://wispy-sea-969e.test71-dc9.workers.dev/",
  "https://silent-rain-377c.test68-6e8.workers.dev/",
  "https://flat-darkness-ef7a.test70-ee3.workers.dev/",
  "https://restless-brook-d944.test67-989.workers.dev/",
  "https://silent-rain-377c.test68-6e8.workers.dev/",
  "https://long-dew-a85b.test84-c55.workers.dev/",
  "https://muddy-sky-afea.test92-0aa.workers.dev/",
  //
  "https://green-resonance-ba27.orion001.workers.dev/",
  "https://plain-tooth-a5ef.orion002.workers.dev/",
  "https://lively-rice-79f8.orion004.workers.dev/",
  "https://morning-mountain-b270.orion003.workers.dev/",
  "https://young-poetry-2f1e.orion005.workers.dev/",
  "https://broken-fire-37fb.orion006.workers.dev/",
  "https://wispy-sea-c35e.orion008.workers.dev/",
  "https://broken-pond-08af.orion007.workers.dev/",
  "https://dry-rain-6c61.orion0010.workers.dev/",
  "https://morning-paper-2c32.orion009.workers.dev/",
  "https://sparkling-bush-c28f.orion0012.workers.dev/",
  "https://late-firefly-ca73.orion0011.workers.dev/",
  "https://snowy-grass-18ac.orion0014.workers.dev/",
  "https://billowing-glitter-4e38.orion0013.workers.dev/",
  "https://curly-glitter-b0c4.orion0016.workers.dev/",
  "https://billowing-hat-4025.orion0015.workers.dev/",
  "https://restless-hill-ae23.orion0017.workers.dev/",
  "https://dark-wave-57fc.orion0018.workers.dev/",
  "https://cold-hat-5c06.orion0020.workers.dev/",
  "https://morning-voice-8620.orion0019.workers.dev/",
  //
  "https://holy-snowflake-2fb4.orion0001.workers.dev/",
  "https://hidden-moon-0989.orion0002.workers.dev/",
  "https://throbbing-pine-dceb.orion0003.workers.dev/",
  "https://gentle-boat-15ec.orion0004.workers.dev/",
  "https://lingering-glade-54f6.orion0005.workers.dev/",
  "https://lively-bush-0572.orion0006.workers.dev/",
  "https://jolly-bread-cd55.orion0007.workers.dev/",
  "https://nameless-paper-1bf8.orion0008.workers.dev/",
  "https://super-hat-bcbd.orion0009.workers.dev/",
  "https://old-fog-35b0.orion00010.workers.dev/",
  //
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
  "https://long-haze-0a62.garlic2.workers.dev/",
  //qCABBAGE
  "https://rough-grass-d308.cabbage1-790.workers.dev/",
  "https://divine-rice-b7eb.cabbage2.workers.dev/",
  "https://muddy-bar-7745.cabbage4-59a.workers.dev/",
  "https://rough-meadow-63f9.cabbage3.workers.dev/",
  "https://dry-mountain-b7c5.cabbage5.workers.dev/",
  "https://super-salad-9019.cabbage6.workers.dev/",
  "https://floral-math-77db.cabbage8.workers.dev/",
  "https://royal-bush-1d6b.cabbage7.workers.dev/",
  "https://misty-surf-ee67.cabbage10.workers.dev/",
  "https://square-bird-8675.cabbage9.workers.dev/",
  "https://round-leaf-921d.cabbag11.workers.dev/",
  "https://purple-dust-6060.cabbage12.workers.dev/",
  "https://noisy-fire-7646.cabbage13.workers.dev/",
  "https://still-glade-c30d.cabbage14.workers.dev/",
  "https://empty-snow-66a1.cabbag15.workers.dev/",
  "https://dawn-surf-3fd4.cabbag16.workers.dev/",
  "https://rapid-mountain-88b5.cabbage17.workers.dev/",
  "https://summer-sunset-baa7.cabbage18.workers.dev/",
  "https://nameless-darkness-6726.cabbage20.workers.dev/",
  "https://dawn-flower-62aa.cabbage19.workers.dev/",
  "https://weathered-bar-2ae0.carrot1.workers.dev/",
  "https://little-bird-702a.carrot2.workers.dev/",
  "https://round-wave-420a.carrot4.workers.dev/",
  "https://soft-tree-cf19.carrot3.workers.dev/",
  "https://restless-night-5882.carrot5.workers.dev/",
  "https://sweet-breeze-2630.carrot6.workers.dev/",
  "https://purple-cake-7e15.carrot7.workers.dev/",
  "https://jolly-butterfly-081a.carrot8.workers.dev/",
  "https://curly-surf-ddc0.carrot9.workers.dev/",
  "https://steep-meadow-bbeb.carrot10.workers.dev/",
  "https://wild-math-4113.carrot12.workers.dev/",
  "https://young-cherry-ce34.carrot11.workers.dev/",
  "https://restless-frost-4949.carrot13.workers.dev/",
  "https://raspy-firefly-a523.carrot14.workers.dev/",
  "https://red-dawn-bf1d.carrot16.workers.dev/",
  "https://square-paper-11d3.carrot15.workers.dev/",
  "https://lively-rain-6889.carrot17.workers.dev/",
  "https://summer-salad-552a.carrot18.workers.dev/",
  "https://purple-sea-e132.carrot20.workers.dev/",
  "https://quiet-paper-8f9c.carrot19.workers.dev/",
  "https://sparkling-sun-6be0.eggplant2.workers.dev/",
  "https://calm-cake-38bb.eggplant1.workers.dev/",
  "https://plain-boat-ff0f.eggplant4.workers.dev/",
  "https://aged-mode-1015.eggplant3.workers.dev/",
  "https://morning-mud-1c64.eggplant6.workers.dev/",
  "https://winter-sky-d6cf.eggplant5.workers.dev/",
  "https://broken-paper-de7d.eggplant8.workers.dev/",
  "https://empty-mouse-d0c0.eggplant7.workers.dev/",
  "https://calm-leaf-e4aa.eggplant9.workers.dev/",
  "https://orange-meadow-1144.eggplant10.workers.dev/",
  "https://plain-forest-d989.eggplant11.workers.dev/",
  "https://still-wind-8eae.eggplant12.workers.dev/",
  "https://late-field-9467.eggplant14.workers.dev/",
  "https://polished-cake-b12c.eggplant13.workers.dev/",
  "https://throbbing-shape-77d9.eggplant15.workers.dev/",
  "https://square-bird-5087.eggplant16.workers.dev/",
  "https://shy-mountain-1e6e.eggplant17.workers.dev/",
  "https://autumn-art-09cb.eggplant18.workers.dev/",
  "https://jolly-cell-b82a.eggplant20.workers.dev/",
  "https://cool-king-6047.eggplant19.workers.dev/",
  "https://soft-snow-25d5.tomato2.workers.dev/",
  "https://hidden-forest-4358.tomato1.workers.dev/",
  "https://fragrant-credit-7730.tomato4.workers.dev/",
  "https://delicate-unit-cc83.tomato3.workers.dev/",
  "https://fragrant-sun-a1d8.tomato6.workers.dev/",
  "https://yellow-feather-1b31.tomato5.workers.dev/",
  "https://late-dew-e4b9.tomato8.workers.dev/",
  "https://white-cloud-79db.tomato7.workers.dev/",
  "https://purple-mud-9dd2.tomato10.workers.dev/",
  "https://blue-salad-c1f6.tomato9.workers.dev/",
  "https://jolly-bread-f35a.tomato11-5a3.workers.dev/",
  "https://ancient-math-bc3f.tomato12.workers.dev/",
  "https://sweet-snow-fa63.tomato13.workers.dev/",
  "https://winter-resonance-4397.tomato14.workers.dev/",
  "https://long-mountain-c477.tomato15.workers.dev/",
  "https://icy-recipe-7f1f.tomato16.workers.dev/",
  "https://quiet-boat-d3c5.tomato17.workers.dev/",
  "https://nameless-river-3e50.tomato18.workers.dev/",
  "https://billowing-thunder-d61e.tomato19.workers.dev/",
  "https://round-lab-5901.tomato20.workers.dev/",
  "https://noisy-sunset-b145.angsarapmopia1.workers.dev/",
  "https://shiny-hill-6358.angsarapmopia2.workers.dev/",
  "https://muddy-salad-d42e.angsarapmopia3.workers.dev/",
  "https://empty-wind-d8f1.angsarapmopia4.workers.dev/",
  "https://rapid-hat-66b0.angsarapmopia6.workers.dev/",
  "https://frosty-unit-f38c.angsarapmopia5.workers.dev/",
  "https://bitter-hat-f3d7.angsarapmopia7.workers.dev/",
  "https://weathered-queen-9908.angsarapmopia8.workers.dev/",
  "https://proud-smoke-1acf.angsarapmopia10.workers.dev/",
  "https://polished-dawn-ad7d.angsarapmopia9.workers.dev/",
  "https://raspy-glitter-ae5f.angsarapmopia11.workers.dev/",
  "https://lively-firefly-5f98.angsarapmopia12.workers.dev/",
  "https://red-sea-b7e3.angsarapmopia13.workers.dev/",
  "https://noisy-rain-cec7.angsarapmopia14.workers.dev/",
  "https://shy-truth-902b.angsarapmopia16.workers.dev/",
  "https://silent-poetry-5e5b.angsarapmopia15.workers.dev/",
  "https://steep-shadow-990e.angsarapmopia18.workers.dev/",
  "https://lively-heart-12e9.angsarapmopia17.workers.dev/",
  "https://white-breeze-14ca.angsarapmopia19.workers.dev/",
  "https://solitary-flower-6ebd.angsarapmopia20.workers.dev/",
  "https://green-salad-281b.datikabanggago2.workers.dev/",
  "https://morning-waterfall-484c.datikabanggago1.workers.dev/",
  "https://crimson-star-89c1.datikabanggago4.workers.dev/",
  "https://cold-waterfall-1e9a.datikabanggago3.workers.dev/",
  "https://white-cherry-b207.datikabanggago5.workers.dev/",
  "https://sweet-waterfall-2678.datikabanggago6.workers.dev/",
  "https://fragrant-voice-c481.datikabanggago8.workers.dev/",
  "https://polished-hall-78b6.datikabanggago7.workers.dev/",
  "https://shy-butterfly-b784.datikabanggago10.workers.dev/",
  "https://flat-paper-c525.datikabanggago9.workers.dev/",
  "https://super-paper-6001.datikabanggago11.workers.dev/",
  "https://white-block-0cef.datikabanggago12.workers.dev/",
  "https://delicate-resonance-1155.datikabanggago14.workers.dev/",
  "https://twilight-poetry-295d.datikabanggago13.workers.dev/",
  "https://morning-tree-8e11.datikabanggago15.workers.dev/",
  "https://shrill-night-9970.datikabanggago16.workers.dev/",
  "https://still-mouse-ad28.datikabanggago17.workers.dev/",
  "https://wispy-dawn-7ed0.datikabanggago18.workers.dev/",
  "https://fancy-mode-48d1.datikabanggago20.workers.dev/",
  "https://curly-wind-96c9.datikabanggago19.workers.dev/",

  //
  "https://dawn-glitter-d569.wubbalubbadubdub1.workers.dev/",
  "https://dawn-butterfly-cf4e.wubbalubbadubdub2.workers.dev/",
  "https://aged-glitter-ff14.wubbalubbadubdub4.workers.dev/",
  "https://cold-dust-67b4.wubbalubbadubdub3.workers.dev/",
  "https://weathered-bonus-4c38.wubbalubbadubdub5.workers.dev/",
  "https://damp-dew-0cf6.wubbalubbadubdub6.workers.dev/",
  "https://late-voice-46fe.wubbalubbadubdub8.workers.dev/",
  "https://sparkling-unit-41dd.wubbalubbadubdub7.workers.dev/",
  "https://small-credit-b431.wubbalubbadubdub9.workers.dev/",
  "https://silent-unit-7d42.wubbalubbadubdub10.workers.dev/",
  "https://icy-shape-463d.wubbalubbadubdub11.workers.dev/",
  "https://mute-disk-13fc.wubbalubbadubdub12.workers.dev/",
  "https://steep-wood-b1cc.wubbalubbadubdub13.workers.dev/",
  "https://autumn-bar-07db.wubbalubbadubdub14.workers.dev/",
  "https://cool-sun-dbbc.wubbalubbadubdub16.workers.dev/",
  "https://polished-resonance-a78f.wubbalubbadubdub15.workers.dev/",
  "https://shy-hill-e858.wubbalubbadubdub17.workers.dev/",
  "https://patient-smoke-9421.wubbalubbadubdub18.workers.dev/",
  "https://empty-meadow-7845.wubbalubbadubdub19.workers.dev/",
  "https://white-rice-8ff0.wubbalubbadubdub20.workers.dev/",
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
  for (const proxy of shuffledProxies) {
    try {
      const res = await fetchWithTimeout(
        proxy,
        { method: "HEAD", headers: { Range: "bytes=0-1" } },
        3000,
      );
      if (res.status === 429) {
        await blacklistProxy(proxy);
        continue;
      }
      if (res.ok) {
        return proxy;
      }
    } catch (e: any) {
      // console.log(`[PROXY] ✗ ${proxy} | ${e?.message}`);
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
  const logRequest = (status: number, reason: string) => {
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    console.log(
      `[ORION] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | IP: ${ip}`,
    );
  };

  try {
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season) ?? "";
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode) ?? "";
    const title = req.nextUrl.searchParams.get(FIELD_MAP.title);
    const year = req.nextUrl.searchParams.get(FIELD_MAP.year);
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const token = req.nextUrl.searchParams.get(FIELD_MAP.token)!;
    const f_token = req.nextUrl.searchParams.get(FIELD_MAP.fToken)!;

    if (!tmdbId || !mediaType || !title || !year || !ts || !token) {
      logRequest(404, "missing params");
      return NextResponse.json(
        { success: false, error: "need token" },
        { status: 404 },
      );
    }

    if (Date.now() - ts > 120000) {
      logRequest(403, "token expired");
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }

    if (!validateBackendToken(tmdbId, f_token, ts, token)) {
      logRequest(403, "invalid token");
      return NextResponse.json(
        { success: false, error: "Invalid token" },
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
      const encryptedH = await encryptUrl(JSON.stringify(GOOD_HEADERS));

      const links = await Promise.all(
        [...cached.sources]
          .sort((a: any, b: any) => priority(a.file) - priority(b.file))
          .map(async (source: any) => ({
            source: source.file.includes("/pl/")
              ? "pl"
              : source.file.includes("/streamsvr/")
                ? "streamsvr"
                : "default",
            type: source.type === "hls" ? "hls" : "mp4",
            link: `${worker}proxy?data=${encodeURIComponent(await encryptUrl(source.file))}&h=${encodeURIComponent(encryptedH)}`,
          })),
      );
      logRequest(200, "OK!!!!!");
      return NextResponse.json({
        success: true,
        links,
        subtitles: [],
        meow: true,
        remaining: activeProxies.length,
      });
    }

    // ─── STEP 1: Scrape ──────────────────────────────────────────────────────
    const baseSlug = title
      .toLowerCase()
      .replace(/['''`]/g, "")
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
        .map(async (source: any) => ({
          source: source.file.includes("/pl/")
            ? "pl"
            : source.file.includes("/streamsvr/")
              ? "streamsvr"
              : "default",
          type: source.type === "hls" ? "hls" : "mp4",
          link: `${worker}proxy?data=${encodeURIComponent(await encryptUrl(source.file))}&h=${encodeURIComponent(encryptedH)}`,
        })),
    );

    logRequest(200, "ORION OK!!!!!");
    return NextResponse.json({
      success: true,
      links,
      subtitles: [],
      remaining: activeProxies.length,
    });
  } catch (err) {
    console.error("Holly route error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
