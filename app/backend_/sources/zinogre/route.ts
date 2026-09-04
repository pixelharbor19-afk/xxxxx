import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { createClient } from "@supabase/supabase-js";
import { encryptLink } from "@/lib/source-link-enc-dec";
import { FIELD_MAP } from "@/lib/params";
import { logRequest } from "@/lib/log-request";
import { encryptUrl } from "@/lib/aes-encryptor";

const supabase = createClient(
  process.env.SUPABASE_URL_MOVIEBOX_WEB2!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_MOVIEBOX_WEB2!,
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams, pathname } = req.nextUrl;

    const tmdbId = searchParams.get(FIELD_MAP.id);
    const mediaType = searchParams.get(FIELD_MAP.mediaType);
    const season = searchParams.get(FIELD_MAP.season) ?? "";
    const episode = searchParams.get(FIELD_MAP.episode) ?? "";
    const title = searchParams.get(FIELD_MAP.title);
    const ts = Number(searchParams.get(FIELD_MAP.ts));
    const token = searchParams.get(FIELD_MAP.token);
    const date = searchParams.get(FIELD_MAP.date);
    const latestDate = searchParams.get(FIELD_MAP.latestDate);
    const path = pathname.split("/").pop()!;

    // -----------------------------
    // Validate params
    // -----------------------------

    if (
      !tmdbId ||
      !mediaType ||
      !title ||
      !date ||
      !Number.isFinite(ts) ||
      !token
    ) {
      logRequest(req, "AQUARIUS", 400, "missing params");

      return NextResponse.json(
        {
          success: false,
          error: "missing params",
        },
        { status: 400 },
      );
    }

    // -----------------------------
    // Validate token
    // -----------------------------

    if (
      !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
    ) {
      logRequest(req, "AQUARIUS", 401, "Invalid token");

      return NextResponse.json(
        {
          success: false,
          error: "Invalid token",
        },
        { status: 401 },
      );
    }

    // -----------------------------
    // Validate referer
    // -----------------------------

    if (!isValidReferer(req.headers.get("referer") || "")) {
      logRequest(req, "AQUARIUS", 403, "Forbidden");

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

    const { data: cached } = await supabase
      .from("moviebox_cache")
      .select("dubs")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle();

    let dubs = cached?.dubs ?? [];
    let fromCache = dubs.length > 0;
    // -----------------------------
    // Cache missing → ICARUS search
    // -----------------------------

    if (!dubs.length) {
      const searchParams = new URLSearchParams({
        id: tmdbId,
        b: mediaType,
        title,
        date,
      });
      if (latestDate && mediaType === "tv") {
        searchParams.set("latestDate", latestDate);
      }

      const searchRes = await fetch(
        `https://api1.zxcstream.xyz/search-moviebox?${searchParams.toString()}`,
        // `https://main-school-project-production.up.railway.app/search-moviebox?${searchParams.toString()}`,
        {
          cache: "no-store",
        },
      );

      if (!searchRes.ok) {
        logRequest(req, "AQUARIUS", 502, "ICARUS search failed");

        return NextResponse.json(
          {
            success: false,
            error: "ICARUS search failed",
          },
          { status: searchRes.status },
        );
      }

      const searchData = await searchRes.json();

      if (!searchData?.success || !searchData?.dubs?.length) {
        logRequest(req, "AQUARIUS", 404, "Unavailable");

        return NextResponse.json(
          {
            success: false,
            error: "Unavailable",
          },
          { status: 404 },
        );
      }

      // ICARUS found the dubs.
      dubs = searchData.dubs;
      fromCache = false;

      // -----------------------------
      // Save cache
      // -----------------------------

      await supabase.from("moviebox_cache").upsert(
        {
          tmdb_id: tmdbId,
          media_type: mediaType,
          dubs,
          release_date: date,
          title,
        },
        {
          onConflict: "tmdb_id,media_type",
          ignoreDuplicates: true,
        },
      );
    }

    // -----------------------------
    // Get original
    // -----------------------------

    const original = dubs.find((d: any) => d.original === true);

    if (!original?.subjectId || !original?.detailPath) {
      logRequest(req, "AQUARIUS", 404, "Original source not found");

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
    params.set("streamSignType", "1");
    const res = await fetch(
      `https://api1.zxcstream.xyz/moviebox?${params.toString()}`,
      {
        cache: "no-store",
      },
    );

    if (!res.ok) {
      logRequest(req, "AQUARIUS", res.status, "Main request failed");

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
      logRequest(req, "AQUARIUS", 404, "No sources found");

      return NextResponse.json(
        {
          success: false,
          error: "No sources found",
        },
        { status: 404 },
      );
    }

    // -----------------------------
    // Encrypt links
    // -----------------------------

    // const links = scraped.data.map((source: any) => ({
    //   resolution: source.resolutions?.split(",")[0] || "N/A",
    //   format: source.format,
    //   size: source.size,
    //   type: "dash",
    //   link: encryptLink(source.url),
    // }));

    const links = await Promise.all(
      scraped.data.map(async (source: any) => {
        const url = await encryptUrl(source.url);

        const header = await encryptUrl(
          JSON.stringify({
            Referer:
              "https://movibox.net/movies/the-runner-McIeQZEGPQ?id=715214082269397240&type=/movie/detail&detailSe=&detailEp=&lang=en",
            "X-MB-Token": source.signCookie,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
          }),
        );

        const proxyUrl = `https://api1.zxcstream.xyz/media/dash?url=${url}&header=${header}`;

        return {
          type: "dash",
          link: encryptLink(proxyUrl),
          resolution: Number(source.resolutions?.split(",")[0]) || 0,
        };
      }),
    );

    logRequest(req, "AQUARIUS", 200, "OK");

    return NextResponse.json({
      success: true,
      links,
      cached: fromCache,
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
