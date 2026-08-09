import { FIELD_MAP } from "@/lib/token";
import { validateBackendToken } from "@/lib/validate-token";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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
      `[VIXSRC] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | IP: ${ip}`,
    );
  };
  try {
    const id = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const title = req.nextUrl.searchParams.get(FIELD_MAP.title);
    const year = req.nextUrl.searchParams.get(FIELD_MAP.year);
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const b_token = req.nextUrl.searchParams.get(FIELD_MAP.token)!;
    const f_token = req.nextUrl.searchParams.get(FIELD_MAP.fToken)!;

    // --- 1. Search ---
    if (!id || !title || !mediaType || !ts || !b_token) {
      logRequest(404, "missing token");
      return NextResponse.json(
        { success: false, error: "need token" },
        { status: 404 },
      );
    }

    if (Date.now() - Number(ts) > 8000) {
      logRequest(403, "expired token");
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }

    if (!validateBackendToken(id, f_token, ts, b_token)) {
      logRequest(403, "invalid token");
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }

    const q = title?.toLowerCase();
    const searchUrl = `https://streamingunity.cc/en/search?q=${encodeURIComponent(q)}`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        Accept: "text/html, application/xhtml+xml",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.6",
        "Content-Type": "application/json",
        Cookie:
          "XSRF-TOKEN=eyJpdiI6InBXNkVNUjBiVGljYVhqOUNZd1ZQRUE9PSIsInZhbHVlIjoiMDZDcERGS0ZsazlXWUNzOEZqdWhuclNOOUFBajNmZU01UVlJdEhTWndCd1EyUFEvZ2Q5NTFtcW5HRnVVbkpES0FXTGdiT1l6OUV1RE5FMjRHbkhZNHZvN2R2cWordFVwWW5yaGFnR2dmR2pHVnQ4U0lsYWozNFpUdDRZRDNRMUEiLCJtYWMiOiJjNzZkODA5NDczZTZiNWIxNTllM2FiZTEzYTBkZDI0MmY2ZWI3NTE0MTM2YTU2NWQ2NzQ1YjY2YTQyNmI1MWMzIiwidGFnIjoiIn0%3D; streamingcommunity_session=eyJpdiI6IjJxM1NVVEFOY2JRbmNEREJCMlNzSXc9PSIsInZhbHVlIjoiMTJXdTNhZEg1dnJZM25Sc2JQeC9VTms4azZXUGp1ZjJmTWNSMGZjOXBmcGd5YTNnZ0lGK1RLUmhDU2lPRDRSRUtUYWxucjhvcU92M1VGdXpQakpNK2dTYWpWMllOUEhuRXJ4Z0lyakpQRGZhZGFpRFVBaXBIT2l0QUxlNy9rT2ciLCJtYWMiOiJkOTA2MTMxYzg4NzJlNTE0NzY0NDc2N2IwNjBjOTRlNjJiNzRlMjQ5ODgxMjU5ZDE1MGQ3ZTEwMGZmMDA0ZDBkIiwidGFnIjoiIn0%3D",
        Priority: "u=1, i",
        Referer: searchUrl,
        "Sec-CH-UA": '"Not;A=Brand";v="8", "Chromium";v="150", "Brave";v="150"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Sec-GPC": "1",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        "X-Inertia": "true",
        "X-Inertia-Version": "bb68be11cfdb585b21ab9538f0d0e334",
        "X-Requested-With": "XMLHttpRequest",
        "X-XSRF-TOKEN":
          "eyJpdiI6InBXNkVNUjBiVGljYVhqOUNZd1ZQRUE9PSIsInZhbHVlIjoiMDZDcERGS0ZsazlXWUNzOEZqdWhuclNOOUFBajNmZU01UVlJdEhTWndCd1EyUFEvZ2Q5NTFtcW5HRnVVbkpES0FXTGdiT1l6OUV1RE5FMjRHbkhZNHZvN2R2cWordFVwWW5yaGFnR2dmR2pHVnQ4U0lsYWozNFpUdDRZRDNRMUEiLCJtYWMiOiJjNzZkODA5NDczZTZiNWIxNTllM2FiZTEzYTBkZDI0MmY2ZWI3NTE0MTM2YTU2NWQ2NzQ1YjY2YTQyNmI1MWMzIiwidGFnIjoiIn0=",
      },
      cache: "no-store",
    });

    if (!searchResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch upstream" },
        { status: searchResponse.status },
      );
    }

    const json = await searchResponse.json();

    const result =
      (json?.props?.titles ?? [])
        .filter((item: any) => {
          if (mediaType && item.type !== mediaType) return false;
          if (year && item.last_air_date?.slice(0, 4) !== year) return false;
          return true;
        })
        .map((item: any) => ({
          id: item.id,
          slug: item.slug,
          title: item.name,
          type: item.type,
          score: item.score,
          year: item.last_air_date?.slice(0, 4) ?? null,
          seasons: item.type === "tv" ? item.seasons_count : undefined,
          poster:
            item.images?.find((i: any) => i.type === "poster")?.filename ??
            null,
          cover:
            item.images?.find((i: any) => i.type === "cover")?.filename ?? null,
          logo:
            item.images?.find((i: any) => i.type === "logo")?.filename ?? null,
        }))[0] ?? null;

    if (!result) {
      return NextResponse.json(null);
    }

    // --- 2. Iframe fetch using the found id ---
    const iframeResponse = await fetch(
      `https://streamingunity.cc/en/iframe/${result.id}`,
      {
        headers: {
          "sec-ch-ua-platform": '"Windows"',
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "sec-ch-ua":
            '"Not;A=Brand";v="8", "Chromium";v="150", "Brave";v="150"',
          "upgrade-insecure-requests": "1",
          "sec-ch-ua-mobile": "?0",
          "sec-gpc": "1",
          "accept-language": "en-US,en;q=0.6",
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "empty",
          referer: `https://streamingunity.cc/en/watch/${result.id}`,
          "accept-encoding": "gzip, deflate, br",
          cookie:
            "XSRF-TOKEN=eyJpdiI6ImRNbC9DaHVrczVSVGRYYTh2QWtTdlE9PSIsInZhbHVlIjoiT2dlVVZkVTFWSU9tQndMUG44UkVSQjc5WVNYcDA2aFZweEZBOUQ1bm44clpGcTBsQjFSOHBYRVhoeldwZ0NaanlDa3F1UzNlbHVHaTRzUjQ5blhlYk5MSGdab0lZZ2lHMFRhWWRYazR1MlZLL1h4L3dCaDhFcnpDT0RoVzBLZlYiLCJtYWMiOiI2Njk3MTgxYjc1YmE0MmJjODk1NjQxNjAzOWFhZTMyYzA0NWEzMzA1Zjg3NzVlYjM1YmUyYjRmOTkyYTk2ZjI5IiwidGFnIjoiIn0%3D; streamingcommunity_session=eyJpdiI6IjJIdkZmdmUvOVF4b0FqcVZobHVVYnc9PSIsInZhbHVlIjoiVHIvRzY4OTdwdUp2cUM2L29TTVZHdkFYWmFZWDREUy85NVZQbk1oc2RjTWVZSjlFRFppY2Z4YTdJWTBjSCtqUmpWSkZtU0VTUU9EWjBxSTd5QlYwRGNQMWxXdFZZaHU4V1dsODIvb2l3RVRJVXY0SHNQYUdxWEdTM05pMWRMaUEiLCJtYWMiOiJlYjhjOTBlYTMzNzRlMWVlZTMwZTY3ZjY5Zjc4YmMzMmExOThiOWRlNjY3MDZmNzY0N2RlYzRiNmFjNjVjODVjIiwidGFnIjoiIn0%3D",
          priority: "u=0, i",
        },
        cache: "no-store",
      },
    );

    if (!iframeResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch iframe" },
        { status: iframeResponse.status },
      );
    }

    const iframeHtml = await iframeResponse.text();

    const src = iframeHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];

    if (!src) {
      return NextResponse.json(
        { error: "Iframe src not found" },
        { status: 404 },
      );
    }

    const decodedSrc = src.replace(/&amp;/g, "&");

    // --- 3. Stream page parse ---
    const pageResponse = await fetch(decodedSrc, {
      headers: {
        "sec-ch-ua": '"Not;A=Brand";v="8", "Chromium";v="150", "Brave";v="150"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "upgrade-insecure-requests": "1",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "sec-gpc": "1",
        "accept-language": "en-US,en;q=0.6",
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "iframe",
        "sec-fetch-storage-access": "none",
        referer: "https://streamingunity.cc/",
      },
      cache: "no-store",
    });

    if (!pageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch page" },
        { status: pageResponse.status },
      );
    }

    const pageHtml = await pageResponse.text();

    const videoId =
      pageHtml.match(/window\.video\s*=\s*{[\s\S]*?id:\s*'([^']+)'/)?.[1] ??
      null;

    const masterUrl =
      pageHtml.match(/url:\s*'([^']*playlist\/[^']+)'/)?.[1] ?? null;

    const token = pageHtml.match(/'token':\s*'([^']+)'/)?.[1] ?? null;

    const expires = pageHtml.match(/'expires':\s*'([^']+)'/)?.[1] ?? null;

    const asn = pageHtml.match(/'asn':\s*'([^']*)'/)?.[1] ?? "";

    const canPlayFHD =
      pageHtml.match(/window\.canPlayFHD\s*=\s*(true|false)/)?.[1] === "true";

    const thumbnails =
      pageHtml.match(/window\.thumbnailsUrl\s*=\s*'([^']+)'/)?.[1] ?? null;

    const download =
      pageHtml.match(/window\.downloadUrl\s*=\s*'([^']+)'/)?.[1] ?? null;

    const embedParams = new URL(decodedSrc).searchParams;
    const lang = embedParams.get("lang") ?? "en";

    let streamUrl: string | null = null;

    if (masterUrl && token && expires) {
      const params = new URLSearchParams({
        token,
        expires,
        h: "1",
        lang,
      });

      if (asn) {
        params.set("asn", asn);
      }

      streamUrl = `${masterUrl}?${params.toString()}`;
    }
    //  return NextResponse.json({
    //    success: true,
    //    links: [{ type: "hls", link: signedUrl }],
    //    subtitles: [],
    //    meow: !!cached,
    //  });
    logRequest(200, "VIXSRC OK!!!!!");
    return NextResponse.json({
      success: true,
      links: [{ type: "hls", link: streamUrl }],
      subtitles: [],
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
