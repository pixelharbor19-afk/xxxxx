import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { FIELD_MAP } from "@/lib/params";
import { createClient } from "@supabase/supabase-js";
import { encryptUrl } from "@/lib/aes-encryptor";
import { validateSession } from "@/lib/validate-session";
import { encryptLink } from "@/lib/source-link-enc-dec";

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

  const TIMEOUT = 7000;
  const MAX_TRIES = 5;

  for (let i = 0; i < Math.min(candidates.length, MAX_TRIES); i++) {
    const worker = candidates[i];

    try {
      const res = await fetchWithTimeout(worker, { method: "HEAD" }, TIMEOUT);

      if (res.status === 429) {
        await blacklistProxy(worker);
        continue;
      }

      if (res.status < 500) {
        return worker;
      }
    } catch (err: any) {
      console.error(
        `[BERKAS PROXY] ${worker} → ${err?.name || err?.message || "failed"}`,
      );
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
  "https://berkas.test014-25a.workers.dev/",
  "https://berkas.test09-635.workers.dev/",
  "https://berkas.test010-f3d.workers.dev/",
  "https://berkas.test011.workers.dev/",
  "https://berkas.test012.workers.dev/",
  "https://berkas.test05-187.workers.dev/",
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
  //
  "https://long-haze-0a62.garlic2.workers.dev/",
  "https://rough-grass-d308.cabbage1-790.workers.dev/",
  "https://divine-rice-b7eb.cabbage2.workers.dev/",
  "https://muddy-bar-7745.cabbage4-59a.workers.dev/",
  "https://rough-meadow-63f9.cabbage3.workers.dev/",
  "https://dry-mountain-b7c5.cabbage5.workers.dev/",
  "https://super-salad-9019.cabbage6.workers.dev/",
  "https://aged-surf-de3a.whattheheal1.workers.dev/",
  "https://aged-dawn-0319.whattheheal2.workers.dev/",
  "https://broken-meadow-04ae.whattheheal3.workers.dev/",
  "https://shy-dew-1020.whattheheal4.workers.dev/",
  "https://floral-math-77db.cabbage8.workers.dev/",
  "https://royal-bush-1d6b.cabbage7.workers.dev/",
  "https://misty-surf-ee67.cabbage10.workers.dev/",
  "https://square-bird-8675.cabbage9.workers.dev/",
  "https://round-leaf-921d.cabbag11.workers.dev/",
  "https://purple-dust-6060.cabbage12.workers.dev/",
  "https://noisy-fire-7646.cabbage13.workers.dev/",
  "https://still-glade-c30d.cabbage14.workers.dev/",
  "https://empty-snow-66a1.cabbag15.workers.dev/",

  //
  "https://sparkling-sun-6be0.eggplant2.workers.dev/",
  "https://calm-cake-38bb.eggplant1.workers.dev/",
  "https://plain-boat-ff0f.eggplant4.workers.dev/",
  "https://aged-mode-1015.eggplant3.workers.dev/",
  "https://morning-mud-1c64.eggplant6.workers.dev/",
  "https://winter-sky-d6cf.eggplant5.workers.dev/",
  "https://broken-paper-de7d.eggplant8.workers.dev/",
  "https://empty-mouse-d0c0.eggplant7.workers.dev/",
  //
  "https://calm-leaf-e4aa.eggplant9.workers.dev/",
  "https://orange-meadow-1144.eggplant10.workers.dev/",
  "https://plain-forest-d989.eggplant11.workers.dev/",
  "https://still-wind-8eae.eggplant12.workers.dev/",
  "https://late-field-9467.eggplant14.workers.dev/",
  "https://polished-cake-b12c.eggplant13.workers.dev/",
  "https://throbbing-shape-77d9.eggplant15.workers.dev/",
  "https://square-bird-5087.eggplant16.workers.dev/",
  "https://hidden-forest-4358.tomato1.workers.dev/",
  "https://fragrant-credit-7730.tomato4.workers.dev/",
  "https://delicate-unit-cc83.tomato3.workers.dev/",
  "https://yellow-feather-1b31.tomato5.workers.dev/",
  "https://fragrant-sun-a1d8.tomato6.workers.dev/",
  "https://white-cloud-79db.tomato7.workers.dev/",
  "https://late-dew-e4b9.tomato8.workers.dev/",
  "https://purple-mud-9dd2.tomato10.workers.dev/",
  "https://jolly-bread-f35a.tomato11-5a3.workers.dev/",
  "https://ancient-math-bc3f.tomato12.workers.dev/",
  "https://sweet-snow-fa63.tomato13.workers.dev/",
  "https://dawn-glitter-d569.wubbalubbadubdub1.workers.dev/",
  "https://dawn-butterfly-cf4e.wubbalubbadubdub2.workers.dev/",
  "https://cold-dust-67b4.wubbalubbadubdub3.workers.dev/",
  "https://aged-glitter-ff14.wubbalubbadubdub4.workers.dev/",
  "https://weathered-bonus-4c38.wubbalubbadubdub5.workers.dev/",
  "https://damp-dew-0cf6.wubbalubbadubdub6.workers.dev/",
  "https://sparkling-unit-41dd.wubbalubbadubdub7.workers.dev/",
  "https://late-voice-46fe.wubbalubbadubdub8.workers.dev/",
  "https://small-credit-b431.wubbalubbadubdub9.workers.dev/",
  "https://silent-unit-7d42.wubbalubbadubdub10.workers.dev/",
  "https://icy-shape-463d.wubbalubbadubdub11.workers.dev/",

  "https://mute-disk-13fc.wubbalubbadubdub12.workers.dev/",
  "https://steep-wood-b1cc.wubbalubbadubdub13.workers.dev/",
  "https://autumn-bar-07db.wubbalubbadubdub14.workers.dev/",
  "https://polished-resonance-a78f.wubbalubbadubdub15.workers.dev/",

  "https://cool-sun-dbbc.wubbalubbadubdub16.workers.dev/",
  "https://shy-hill-e858.wubbalubbadubdub17.workers.dev/",
  "https://patient-smoke-9421.wubbalubbadubdub18.workers.dev/",

  "https://white-rice-8ff0.wubbalubbadubdub20.workers.dev/",
  "https://wispy-dawn-7ed0.datikabanggago18.workers.dev/",
  "https://fancy-mode-48d1.datikabanggago20.workers.dev/",
  "https://curly-wind-96c9.datikabanggago19.workers.dev/",

  "https://morning-waterfall-484c.datikabanggago1.workers.dev/",
  "https://crimson-star-89c1.datikabanggago4.workers.dev/",
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

  //
  "https://curly-field-b7ab.onlinesho1.workers.dev/",
  "https://icy-glade-a2f9.onlineshop2-4fa.workers.dev/",
  "https://misty-smoke-703c.onlineshop3.workers.dev/",
  "https://steep-mode-f072.onlineshop4.workers.dev/",
  "https://damp-tree-2a80.onlineshop5.workers.dev/",
  "https://shy-glade-89f9.onlineshop6.workers.dev/",
  "https://empty-glade-d144.onlineshop7.workers.dev/",
  "https://orange-bush-746c.onlineshop8.workers.dev/",

  "https://wild-limit-4cdd.onion-468.workers.dev/",
  "https://shiny-feather-61d5.onion2.workers.dev/",
  "https://blue-morning-b0ed.onlineshop10.workers.dev/",
  "https://cold-block-fb91.onlineshop9.workers.dev/",
  "https://daedalus.test52-b2c.workers.dev/",
  "https://daedalus.test51-8b1.workers.dev/",
  "https://daedalus.test50-6c3.workers.dev/",
  "https://daedalus.test49-3b0.workers.dev/",
  "https://daedalus.test48-104.workers.dev/",
  "https://daedalus.test47-0f7.workers.dev/",
  "https://daedalus.test46-96a.workers.dev/",
  "https://daedalus.test45-b77.workers.dev/",

  //
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
  "https://summer-sunset-baa7.cabbage18.workers.dev/",
  "https://nameless-darkness-6726.cabbage20.workers.dev/",
  "https://dawn-flower-62aa.cabbage19.workers.dev/",
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
    const mediaType = req.nextUrl.searchParams.get(FIELD_MAP.mediaType);
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

    const message = `[BERKAS] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`;

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
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get(FIELD_MAP.mediaType);
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season) ?? "";
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode) ?? "";
    const title = req.nextUrl.searchParams.get(FIELD_MAP.title);
    const year = req.nextUrl.searchParams.get(FIELD_MAP.year);
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const token = req.nextUrl.searchParams.get(FIELD_MAP.token);
    const date = req.nextUrl.searchParams.get(FIELD_MAP.date);

    if (!tmdbId || !mediaType || !title || !year || !ts || !token || !date) {
      logRequest(400, "missing params");
      return NextResponse.json(
        { success: false, error: "missing params" },
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
          link: encryptLink(
            `${proxyWorker}?data=${encodeURIComponent(encrypted)}`,
          ),
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
