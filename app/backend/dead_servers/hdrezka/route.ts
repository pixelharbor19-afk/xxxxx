import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "X-Requested-With": "XMLHttpRequest",
  Origin: "https://hdrezka-home.tv",
  Referer: "https://hdrezka-home.tv/",
  Cookie:
    "techaro.lol-anubis-auth=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhY3Rpb24iOiJDSEFMTEVOR0UiLCJjaGFsbGVuZ2UiOiIwMTlmYWMzNy1iYTVjLTc3YmEtOTZiNi05ZjFkZDNjYTk4YzUiLCJleHAiOjE3ODc4OTI3NjIsImlhdCI6MTc4NTMwMDc2MiwibWV0aG9kIjoiZmFzdCIsIm5iZiI6MTc4NTMwMDcwMiwicG9saWN5UnVsZSI6ImFjOTgwZjQ5YzRkMzVmYWIiLCJyZXN0cmljdGlvbiI6IjJkODZmMGMzZjRiYTg1ODY5NzA5NDQ4NzhhMjM0MDQ0YzI4YjE3Y2JlMDkzYTg1MzI0Y2NjNzMwZDM4ZDZmMDcifQ.Od_JSvTDyVrYDlDSmFUZbiw7s_owH0ZwLv_js-qE5Jhb7RIaUrp2Fp9ZIGh3_kEb29lYIrUzvhFrZNTZZPLfAg; PHPSESSID=t1l02sl6tdg6m7o17li5ff0nuu; dle_user_taken=1; dle_user_token=80595b3c0d2a6b8e3419d53881169808; _vc_id=E_rgXBIoJm-r96q6wFL7tLbcGh0TKth2; _vc_day=2026-07-29",
};

async function searchId(query: string): Promise<{
  id: string;
  title: string;
  url: string;
} | null> {
  const form = new URLSearchParams({ q: query });

  const res = await fetch("https://hdrezka-home.tv/engine/ajax/search.php", {
    method: "POST",
    headers: {
      ...HEADERS,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: form.toString(),
  });

  if (!res.ok) return null;

  const html = await res.text();

  // First result link: /films/.../2259-interstellar-2014.html
  const match = html.match(
    /href="(https:\/\/hdrezka-home\.tv\/[^"]+\/(\d+)-[^"]+\.html)"[^>]*>[\s\S]*?<span class="enty">([^<]+)<\/span>/,
  );

  if (!match) return null;

  return {
    url: match[1],
    id: match[2],
    title: match[3].trim(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim();

    if (!q) {
      return NextResponse.json(
        { error: "Missing ?q= search query" },
        { status: 400 },
      );
    }

    // 1. Search → get ID
    const found = await searchId(q);
    if (!found) {
      return NextResponse.json(
        { error: `No results for "${q}"` },
        { status: 404 },
      );
    }

    // 2. Fetch English original streams (translator_id=238)
    const form = new URLSearchParams({
      id: found.id,
      translator_id: "238",
      is_camrip: "0",
      is_ads: "0",
      is_director: "0",
      favs: "be567b24-5253-4e0c-9dcb-a0a42f023799",
      action: "get_movie",
    });

    const streamRes = await fetch(
      `https://hdrezka-home.tv/ajax/get_cdn_series/?t=${Date.now()}`,
      {
        method: "POST",
        headers: {
          ...HEADERS,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Referer: found.url,
        },
        body: form.toString(),
      },
    );

    if (!streamRes.ok) {
      return NextResponse.json(
        { error: `Stream request failed: ${streamRes.status}` },
        { status: streamRes.status },
      );
    }

    const data = await streamRes.json();

    if (!data.success || !data.url) {
      return NextResponse.json(
        {
          error: data.message || "No streams (maybe no original audio)",
          id: found.id,
          title: found.title,
        },
        { status: 404 },
      );
    }

    // Parse streams
    const streamRegex =
      /\[(.*?)\](https?:\/\/[^\s,"]+)(?:\s+or\s+(https?:\/\/[^\s,"]+))?/g;

    const streams: {
      quality: string;
      hls: string | null;
      mp4: string | null;
    }[] = [];

    let m: RegExpExecArray | null;
    while ((m = streamRegex.exec(data.url)) !== null) {
      const quality = m[1].replace(/<[^>]+>/g, "").trim();
      const first = m[2];
      const second = m[3] ?? null;

      streams.push({
        quality,
        hls: first.includes(":hls:manifest.m3u8") ? first : second,
        mp4: first.includes(":hls:manifest.m3u8") ? second : first,
      });
    }

    // Parse subtitles
    const subtitleRegex = /\[(.*?)\](https?:\/\/[^\s,"]+)/g;
    const subtitles: { language: string; url: string }[] = [];

    if (data.subtitle) {
      while ((m = subtitleRegex.exec(data.subtitle)) !== null) {
        subtitles.push({ language: m[1], url: m[2] });
      }
    }

    const englishSub = subtitles.find(
      (s) => s.language.toLowerCase() === "english",
    );

    return NextResponse.json({
      id: found.id,
      title: found.title,
      url: found.url,
      streams,
      subtitles,
      defaultSubtitle: englishSub?.url ?? null,
      quality: data.quality,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
