// Backend B route example
import { NextRequest, NextResponse } from "next/server";
import { extractIcarus } from "@/lib/icarus-extractor";

export async function GET(req: NextRequest) {
  const tmdbId = req.nextUrl.searchParams.get("tmdbId")!;
  const mediaType = req.nextUrl.searchParams.get("mediaType")!;
  const title = req.nextUrl.searchParams.get("title")!;
  const date = req.nextUrl.searchParams.get("date")!;
  const season = req.nextUrl.searchParams.get("season");
  const episode = req.nextUrl.searchParams.get("episode");
  const dubCode = req.nextUrl.searchParams.get("dubCode");
  const dubType = req.nextUrl.searchParams.get("dubType");

  const result = await extractIcarus({
    tmdbId,
    mediaType,
    title,
    date,
    season,
    episode,
    dubCode,
    dubType,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: result.status });
  }

  return NextResponse.json(result);
}
