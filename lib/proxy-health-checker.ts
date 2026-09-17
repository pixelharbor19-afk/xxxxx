import { fetchWithTimeout } from "@/lib/fetch-timeout";

export const workerProxies = [
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
  "https://late-meadow-f5cf.icarus042.workers.dev/",
  "https://icy-frost-2f13.icarus053.workers.dev/",
  "https://yellow-truth-b7cf.icarus057.workers.dev/",
  "https://fragrant-wind-40f0.icarus059.workers.dev/",
  "https://long-meadow-047f.vps9-9ce.workers.dev/",
  "https://damp-rain-dad6.icarus048.workers.dev/",
  "https://old-smoke-c852.icarus043.workers.dev/",
  "https://autumn-sky-7829.icarus041.workers.dev/",
  "https://super-tree-8f2e.icarus040.workers.dev/",
  "https://steep-sky-b7c6.icarus039.icarus039.workers.dev/",
  "https://patient-base-d281.icarus038.workers.dev/",
  "https://small-bonus-631a.icarus044.workers.dev/",
  "https://tight-fog-810b.icarus046.workers.dev/",
  "https://sweet-frost-4413.icarus037.workers.dev/",
  "https://wild-frost-90b0.icarus035.workers.dev/",
  "https://frosty-term-80f0.icarus036.workers.dev/",
  "https://misty-wildflower-f895.icarus034.workers.dev/",
  //
  "https://shy-rice-3f7d.gmail1.workers.dev/",
  "https://tiny-night-3f17.gmail3.workers.dev/",
  "https://damp-resonance-edc1.facebook1.workers.dev/",
  "https://round-term-b231.facebook2-891.workers.dev/",
  "https://dry-morning-c50d.facebook3.workers.dev/",
  "https://flat-resonance-2702.facebook4.workers.dev/",
  "https://aged-thunder-925d.facebook5.workers.dev/",

  "https://throbbing-thunder-2359.facebook6.workers.dev/",
  "https://quiet-heart-aaca.facebook7.workers.dev/",
  "https://fancy-math-b578.facebook8.workers.dev/",
  "https://square-fog-9d75.facebook9.workers.dev/",

  "https://steep-fog-c825.facebook10.workers.dev/",
  "https://crimson-sky-185f.facebook11.workers.dev/",
  "https://winter-wind-3b69.facebook12.workers.dev/",
  "https://hidden-breeze-2e88.facebook13.workers.dev/",

  "https://holy-snowflake-2fb4.orion0001.workers.dev/",
  "https://hidden-moon-0989.orion0002.workers.dev/",
  "https://throbbing-pine-dceb.orion0003.workers.dev/",
  "https://gentle-boat-15ec.orion0004.workers.dev/",
  "https://lingering-glade-54f6.orion0005.workers.dev/",
  "https://lively-bush-0572.orion0006.workers.dev/",
  "https://broken-pond-08af.orion007.workers.dev/",
  "https://wispy-sea-c35e.orion008.workers.dev/",
  "https://morning-paper-2c32.orion009.workers.dev/",
  "https://dry-rain-6c61.orion0010.workers.dev/",

  "https://late-firefly-ca73.orion0011.workers.dev/",
  "https://sparkling-bush-c28f.orion0012.workers.dev/",
  "https://billowing-glitter-4e38.orion0013.workers.dev/",
  "https://snowy-grass-18ac.orion0014.workers.dev/",

  "https://billowing-hat-4025.orion0015.workers.dev/",
  "https://curly-glitter-b0c4.orion0016.workers.dev/",
  "https://restless-hill-ae23.orion0017.workers.dev/",
  "https://dark-wave-57fc.orion0018.workers.dev/",

  "https://morning-voice-8620.orion0019.workers.dev/",
  "https://cold-hat-5c06.orion0020.workers.dev/",
  "https://green-resonance-ba27.orion001.workers.dev/",
  "https://plain-tooth-a5ef.orion002.workers.dev/",

  "https://morning-mountain-b270.orion003.workers.dev/",
  "https://lively-rice-79f8.orion004.workers.dev/",
  "https://young-poetry-2f1e.orion005.workers.dev/",
  "https://broken-fire-37fb.orion006.workers.dev/",

  "https://plain-waterfall-fe4e.facebook14.workers.dev/",
  "https://tight-king-45e5.facebook15.workers.dev/",

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
  "https://restless-term-9ca1.test72-165.workers.dev/",
  "https://wispy-sea-969e.test71-dc9.workers.dev/",
  "https://silent-rain-377c.test68-6e8.workers.dev/",
  "https://flat-darkness-ef7a.test70-ee3.workers.dev/",
  "https://restless-brook-d944.test67-989.workers.dev/",
  "https://long-dew-a85b.test84-c55.workers.dev/",
  "https://muddy-sky-afea.test92-0aa.workers.dev/",

  "https://jolly-bread-cd55.orion0007.workers.dev/",
  "https://nameless-paper-1bf8.orion0008.workers.dev/",
  "https://super-hat-bcbd.orion0009.workers.dev/",
  "https://old-fog-35b0.orion00010.workers.dev/",

  ///////////////////////////////////////////////////
  "https://dry-moon-e266.test66-8cc.workers.dev/",
  "https://fragrant-rice-8998.test65-8de.workers.dev/",
  "https://restless-resonance-a8a8.test63-bfc.workers.dev/",
  "https://nameless-tooth-8cbb.test64-0d5.workers.dev/",

  "https://spring-darkness-8beb.test61-86c.workers.dev/",
  "https://odd-river-ed9f.test29-be6.workers.dev/",
  "https://soft-shadow-1443.expired8.workers.dev/",
  "https://floral-limit-aeb0.expired9.workers.dev/",
  "https://still-mode-5f32.expired6.workers.dev/",
  "https://cool-wave-a9c1.expired7.workers.dev/",
  "https://shrill-smoke-e6eb.test60-598.workers.dev/",
  "https://twilight-resonance-eb4d.test28-f24.workers.dev/",

  // "https://billowing-rain-7239.test27-15e.workers.dev/",
];

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

export async function workerProxyHealth(proxies: string[]) {
  const shuffledProxies = shuffle(proxies);

  for (const proxy of shuffledProxies) {
    try {
      const res = await fetchWithTimeout(
        proxy,
        { method: "HEAD", headers: { Range: "bytes=0-1" } },
        7000,
      );

      if (res.ok) return proxy;
    } catch (err: any) {
      console.error(
        `[PROXY] ${proxy} → ${err?.name || err?.message || "failed"}`,
      );
    }
  }

  return null;
}
