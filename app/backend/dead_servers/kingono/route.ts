import { FIELD_MAP } from "@/lib/token";
import { validateBackendToken } from "@/lib/validate-token";
import { NextRequest, NextResponse } from "next/server";

const USER_HASH = "64feb517ff768c647777cd394052a778b5ac981f";

function decryptFile(encrypted: string) {
  const binary = Buffer.from(encrypted, "base64");
  const key = binary.subarray(0, 38);
  const data = binary.subarray(38);
  const decrypted = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i] ^ key[i % key.length];
  }

  return JSON.parse(decrypted.toString("utf8"));
}

function extractM3u8(fileField: string) {
  const results: Record<string, string> = {};

  for (const part of fileField.split(",")) {
    const match = part.match(/\[([^\]]+)\](https:\/\/[^\s]+?\.m3u8)/);

    if (match) {
      results[match[1]] = match[2];
    }
  }

  return results;
}

export async function GET(req: NextRequest) {
  const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
  const mediaType = req.nextUrl.searchParams.get("b");
  const season = req.nextUrl.searchParams.get(FIELD_MAP.season) ?? "";
  const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode) ?? "";
  const title = req.nextUrl.searchParams.get(FIELD_MAP.title);
  const year = req.nextUrl.searchParams.get(FIELD_MAP.year);
  const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
  const token = req.nextUrl.searchParams.get(FIELD_MAP.token)!;
  const f_token = req.nextUrl.searchParams.get(FIELD_MAP.fToken)!;
  let url = req.nextUrl.searchParams.get("url");
  if (!tmdbId || !mediaType || !title || !year || !ts || !token) {
    return NextResponse.json(
      { success: false, error: "need token" },
      { status: 404 },
    );
  }

  if (Date.now() - ts > 120000) {
    return NextResponse.json(
      { success: false, error: "Invalid token" },
      { status: 403 },
    );
  }

  if (!validateBackendToken(tmdbId, f_token, ts, token)) {
    return NextResponse.json(
      { success: false, error: "Invalid token" },
      { status: 403 },
    );
  }
  const query = title.toLowerCase();
  // Search first if query is provided
  if (!url && query) {
    const body = new URLSearchParams({
      query,
      user_hash: USER_HASH,
    });

    const searchRes = await fetch(
      "https://kinogo-films.vip/engine/ajax/controller.php?mod=search",
      {
        method: "POST",
        headers: {
          Accept: "*/*",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Origin: "https://kinogo-films.vip",
          Referer: "https://kinogo-films.vip/",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        },
        body,
      },
    );

    const searchHtml = await searchRes.text();

    const match = searchHtml.match(/<a\s+href="([^"]+)"/i);

    if (!match) {
      return NextResponse.json(
        { error: "No search results found" },
        { status: 404 },
      );
    }

    url = `https://kinogo-films.vip${match[1]}`;
  }

  if (!url) {
    return NextResponse.json(
      { error: "Missing url or query parameter" },
      { status: 400 },
    );
  }

  // Get the embed URLs from Python
  const serversRes = await fetch(
    `http://127.0.0.1:8000/servers?url=${encodeURIComponent(url)}`,
    {
      cache: "no-store",
    },
  );

  if (!serversRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch servers" },
      { status: 500 },
    );
  }

  const servers = await serversRes.json();

  const kinogo = servers.find(
    (s: any) => s.name === "KINOGO" || s.provider === "8",
  );

  if (!kinogo) {
    return NextResponse.json(
      { error: "KINOGO server not found" },
      { status: 404 },
    );
  }

  const response = await fetch(kinogo.url, {
    headers: {
      "Accept-Language": "en-US,en;q=0.7",
      Referer: "https://kinogo-films.vip/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    },
    redirect: "follow",
    cache: "no-store",
  });

  const html = await response.text();

  const fileMatch = html.match(/"file":"([^"]+)"/);

  if (!fileMatch) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  const playlist = decryptFile(fileMatch[1]);

  const resolutionMap: Record<string, number> = {
    "1080p FullHD": 3,
    "1080p HD": 3,
    "720p HD": 2,
    "480p": 1,
    "360p": 0,
  };

  const links = playlist
    .filter((item: any) => item.id === 381)
    .flatMap((item: any) => {
      const qualities = extractM3u8(item.file);

      return Object.entries(qualities).map(([quality, link]) => ({
        type: "hls",
        link: `/backend_/servers/rui/proxy?url=${link}`,
        resolution: resolutionMap[quality] ?? 0,
      }));
    });

  return NextResponse.json({
    success: true,
    links,
    subtitles: [],
    meow: false,
  });
}
