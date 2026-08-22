import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOST = "www.screenify.fun";
const ALLOWED_ORIGIN = `https://${ALLOWED_HOST}`;

// const DAEDALUS_WORKERS = [
//   "test52-b2c",
//   "test51-8b1",
//   "test50-6c3",
//   "test49-3b0",
//   "test48-104",
//   "test47-0f7",
//   "test46-96a",
//   "test45-b77",
//   "test44-255",
//   "test42-947",
//   "test43-cbe",
//   //NO TOKEN
//   "test41-2c1",
//   "test40-fdf",
//   "test39-43c",
//   "test38-eab",
//   "test37-93b",
//   "test36-59e",
//   "test35-f46",
//   "test34-2ea",
//   "test33-4ce",
//   "test32-dc9",
//   "test31-5f3",
//   "test30-997",
//   "amenohabakiri174",
//   "zxcprime371",
// ];

const UPSTREAM_HEADERS = {
  Referer: `${ALLOWED_ORIGIN}/`,
  Origin: ALLOWED_ORIGIN,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  Accept: "*/*",
};

function isAllowedUrl(url: URL) {
  return url.protocol === "https:" && url.hostname === ALLOWED_HOST;
}

function resolveUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function rewriteUriAttributes(line: string, baseUrl: string, proxyUrl: string) {
  return line.replace(/URI="([^"]+)"/g, (_, uri: string) => {
    const absolute = resolveUrl(uri, baseUrl);

    if (!absolute) {
      return `URI="${uri}"`;
    }

    return `URI="${proxyUrl}?url=${encodeURIComponent(absolute)}"`;
  });
}

function rewriteM3U8(text: string, upstreamUrl: string, proxyUrl: string) {
  const upstream = new URL(upstreamUrl);

  const baseUrl = upstream.href.substring(
    0,
    upstream.href.lastIndexOf("/") + 1,
  );

  const lines = text.split("\n");

  const rewritten = lines.map((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return line;
    }

    // Rewrite URI="..." inside tags
    if (trimmed.startsWith("#") && trimmed.includes('URI="')) {
      return rewriteUriAttributes(line, baseUrl, proxyUrl);
    }

    // Keep comments/tags unchanged
    if (trimmed.startsWith("#")) {
      return line;
    }

    // Rewrite segment / playlist URL
    const absolute = resolveUrl(trimmed, baseUrl);

    if (!absolute) {
      return line;
    }

    return `${proxyUrl}?url=${encodeURIComponent(absolute)}`;
  });

  // Sort audio tracks:
  // English first
  // Audio Description last
  const audioIndices: number[] = [];

  rewritten.forEach((line, index) => {
    if (line.startsWith("#EXT-X-MEDIA") && line.includes("TYPE=AUDIO")) {
      audioIndices.push(index);
    }
  });

  const audioLines = audioIndices.map((index) => rewritten[index]);

  audioLines.sort((a, b) => {
    const aEnglish = a.includes('LANGUAGE="en"') ? 0 : 1;
    const bEnglish = b.includes('LANGUAGE="en"') ? 0 : 1;

    if (aEnglish !== bEnglish) {
      return aEnglish - bEnglish;
    }

    const aDescription = a.includes("Audio Description") ? 1 : 0;

    const bDescription = b.includes("Audio Description") ? 1 : 0;

    return aDescription - bDescription;
  });

  audioIndices.forEach((index, i) => {
    rewritten[index] = audioLines[i];
  });

  return rewritten.join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const urlParam = req.nextUrl.searchParams.get("url");

    if (!urlParam) {
      return new NextResponse("Missing url", {
        status: 400,
      });
    }

    let upstreamUrl: URL;

    try {
      upstreamUrl = new URL(urlParam);
    } catch {
      return new NextResponse("Invalid url", {
        status: 400,
      });
    }

    // Only allow Screenify
    if (!isAllowedUrl(upstreamUrl)) {
      return new NextResponse("Forbidden", {
        status: 403,
      });
    }

    // Only allow m3u8 and ts
    const pathname = upstreamUrl.pathname.toLowerCase();

    const isM3U8 = pathname.endsWith(".m3u8");
    const isTS = pathname.endsWith(".ts");

    if (!isM3U8 && !isTS) {
      return new NextResponse("Not found", {
        status: 404,
      });
    }

    const upstream = await fetch(upstreamUrl.toString(), {
      headers: UPSTREAM_HEADERS,
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new NextResponse("Bad gateway", {
        status: 502,
      });
    }

    const contentType = upstream.headers.get("content-type") || "";

    const detectedM3U8 =
      isM3U8 || contentType.includes("mpegurl") || contentType.includes("m3u8");

    /*
     * M3U8
     */
    if (detectedM3U8) {
      const text = await upstream.text();

      const proxyUrl = new URL(
        "/backend_/sources/1athena/proxy",
        req.url,
      ).toString();

      const rewritten = rewriteM3U8(text, upstreamUrl.toString(), proxyUrl);

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "public, max-age=604800",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
      });
    }

    /*
     * TS segment
     */
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType || "video/mp2t",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  } catch (error) {
    console.error("[PROXY]", error);

    return new NextResponse("Internal server error", {
      status: 500,
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
