import { isValidReferer } from "@/lib/allowed-referers";
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
      `[TITAN] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | IP: ${ip}`,
    );
  };

  try {
    const id = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get("b"); // "movie" | "tv"
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const b_token = req.nextUrl.searchParams.get(FIELD_MAP.token)!;
    const f_token = req.nextUrl.searchParams.get(FIELD_MAP.fToken)!;

    // --- Validation ---
    if (!id || !mediaType || !ts || !b_token) {
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
    const referer = req.headers.get("referer") || "";
    if (!isValidReferer(referer)) {
      logRequest(403, "invalid referrer");
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // --- Build Titan request ---
    const params = new URLSearchParams({
      id: id,
      type: mediaType,
      skip: "signalvault",
      browserPlatform: "desktop",
      browserHevc: "1",
      browserH2644k: "1",
      browserMatroska: "1",
      public_embed: "1",
      parent: "fluxtv.co.uk",
      sid: crypto.randomUUID(),
    });

    if (mediaType === "tv") {
      if (!season || !episode) {
        logRequest(400, "missing season/episode");
        return NextResponse.json(
          { success: false, error: "season and episode required for tv" },
          { status: 400 },
        );
      }
      params.set("season", season);
      params.set("episode", episode);
      params.set("cache_only", "1");
    } else {
      params.set("refresh", "1");
      params.set("fresh", "1");
    }

    const titanUrl = `https://nflixmovies.app/api/titan/play?${params.toString()}`;

    const titanRes = await fetch(titanUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        Referer: "https://fluxtv.co.uk/",
      },
      cache: "no-store",
    });

    if (!titanRes.ok) {
      logRequest(titanRes.status, "titan upstream error");
      return NextResponse.json(
        { success: false, error: "Failed to fetch upstream" },
        { status: 404 },
      );
    }

    const data = await titanRes.json();

    if (!data?.ok) {
      logRequest(404, "no playable source");
      return NextResponse.json(null);
    }

    // ---------- Only return the progressive MP4 ----------
    const mp4Url =
      data.progressiveUrl ||
      data.sources?.find((s: any) => s.progressiveUrl)?.progressiveUrl ||
      null;

    if (!mp4Url) {
      logRequest(404, "no mp4 found");
      return NextResponse.json(null);
    }

    const res =
      (data.progressiveQuality || data.quality || "1080")
        .toString()
        .replace(/p$/i, "") || "1080";

    logRequest(200, "TITAN OK (MP4 only)");

    return NextResponse.json({
      success: true,
      links: [
        {
          resolution: 1,
          type: "mp4",
          link: `https://zxczxczxc.test153-224.workers.dev/?url=${encodeURIComponent(mp4Url)}`,
        },
      ],
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
