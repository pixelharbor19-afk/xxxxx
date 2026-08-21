import { NextRequest, NextResponse } from "next/server";
import { isValidReferer } from "@/lib/allowed-referers";
import { FIELD_MAP } from "@/lib/token";

const MEGACLOUD = "https://megacloudx.net";

async function fetchEmbedUrl(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Origin: MEGACLOUD,
      Referer: `${MEGACLOUD}/`,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site",
      "Sec-CH-UA":
        '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
      "Sec-CH-UA-Mobile": "?0",
      "Sec-CH-UA-Platform": '"Windows"',
      Priority: "u=1, i",
    },
    redirect: "follow",
    cache: "no-store",
  });

  if (!res.ok) return null;

  // Final redirected embed URL
  return res.url;
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const media_type = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const imdbId = req.nextUrl.searchParams.get(FIELD_MAP.imdbId);
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const token = req.nextUrl.searchParams.get(FIELD_MAP.token)!;
    const f_token = req.nextUrl.searchParams.get(FIELD_MAP.fToken)!;

    if (!id || !media_type || !ts || !token) {
      return NextResponse.json(
        { success: false, error: "need token" },
        { status: 404 },
      );
    }

    if (Date.now() - ts > 8000) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }

    const referer = req.headers.get("referer") || "";
    if (!isValidReferer(referer)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const pageUrl =
      media_type === "tv"
        ? `${MEGACLOUD}/pl/${id}/${season ?? ""}/${episode ?? ""}/`
        : `${MEGACLOUD}/mv/${imdbId}/${id}/`;

    const embedUrl = await fetchEmbedUrl(pageUrl);

    if (!embedUrl) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      embed: embedUrl,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
