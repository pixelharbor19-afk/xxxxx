import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { createClient } from "@supabase/supabase-js";
import { encryptLink } from "@/lib/link-crypto";

const supabase = createClient(
  process.env.SUPABASE_URL_MOVIEBOX_WEB!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_MOVIEBOX_WEB!,
);

export async function GET(req: NextRequest) {
  const logRequest = (status: number, reason: string) => {
    const tmdbId = req.nextUrl.searchParams.get("id");
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get("season");
    const episode = req.nextUrl.searchParams.get("episode");
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

    const message = `[AQUARUIS] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`;

    if (status >= 500) {
      console.error(message);
    } else if (status >= 400) {
      console.warn(message);
    } else {
      console.log(message);
    }
  };

  try {
    const { searchParams, pathname } = req.nextUrl;

    const tmdbId = searchParams.get("id");
    const mediaType = searchParams.get("b");
    const season = searchParams.get("season") ?? "";
    const episode = searchParams.get("episode") ?? "";
    const title = searchParams.get("title");
    const ts = Number(searchParams.get("ts"));
    const token = searchParams.get("token");
    const date = searchParams.get("date");
    const path = pathname.split("/").pop()!;

    if (!tmdbId || !mediaType || !title || !date || !ts || !token) {
      logRequest(400, "missing params");

      return NextResponse.json(
        {
          success: false,
          error: "missing params",
        },
        { status: 400 },
      );
    }

    if (
      !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
    ) {
      logRequest(401, "Invalid token");

      return NextResponse.json(
        {
          success: false,
          error: "Invalid token",
        },
        { status: 401 },
      );
    }

    if (!isValidReferer(req.headers.get("referer") || "")) {
      logRequest(403, "Forbidden");

      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        { status: 403 },
      );
    }

    // -----------------------------
    // Cache lookup
    // -----------------------------

    let { data } = await supabase
      .from("moviebox_cache")
      .select("dubs")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle();

    // -----------------------------
    // Cache missing → ICARUS search
    // -----------------------------

    if (!data?.dubs?.length) {
      const searchParams = new URLSearchParams({
        id: tmdbId,
        b: mediaType,
        title,
        date,
      });

      const searchRes = await fetch(
        `https://api1.zxcstream.xyz/search?${searchParams.toString()}`,
        {
          cache: "no-store",
        },
      );

      if (!searchRes.ok) {
        logRequest(404, "ICARUS search failed");

        return NextResponse.json(
          {
            success: false,
            error: "ICARUS search failed",
          },
          { status: searchRes.status },
        );
      }

      const searchData = await searchRes.json();

      if (!searchData?.success) {
        logRequest(404, "ICARUS unavailable");

        return NextResponse.json(
          {
            success: false,
            error: "Unavailable",
          },
          { status: 404 },
        );
      }

      // Search endpoint has already saved
      // the dubs to Supabase, so fetch cache again.
      const result = await supabase
        .from("moviebox_cache")
        .select("dubs")
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType)
        .maybeSingle();

      data = result.data;
    }

    // -----------------------------
    // Get original
    // -----------------------------

    const original = data?.dubs?.find((d: any) => d.original === true);

    if (!original?.subjectId || !original?.detailPath) {
      logRequest(404, "Original source not found");

      return NextResponse.json(
        {
          success: false,
          error: "Original source not found",
        },
        { status: 404 },
      );
    }

    // -----------------------------
    // Scraper
    // -----------------------------

    const params = new URLSearchParams({
      type: "dash",
      subjectId: original.subjectId,
      detailPath: original.detailPath,
    });

    if (mediaType === "tv") {
      params.set("se", season || "0");
      params.set("ep", episode || "0");
    }

    const res = await fetch(
      `https://main-school-project-production.up.railway.app/scrape/123movies?${params}`,
      {
        cache: "no-store",
      },
    );

    if (!res.ok) {
      logRequest(404, "Main request failed");

      return NextResponse.json(
        {
          success: false,
          error: "Main request failed",
        },
        { status: res.status },
      );
    }

    const scraped = await res.json();

    if (!scraped?.data?.length) {
      logRequest(404, "No sources found");

      return NextResponse.json(
        {
          success: false,
          error: "No sources found",
        },
        { status: 404 },
      );
    }

    const links = scraped.data.map((source: any) => ({
      resolution: source.resolutions,
      format: source.format,
      size: source.size,
      type: "dash",
      link: encryptLink(source.url),
    }));

    logRequest(200, "AQUARIUS OK!!!!!");

    return NextResponse.json({
      success: true,
      links,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
