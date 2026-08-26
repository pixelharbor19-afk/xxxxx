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
const BASE_HEADERS = {
  Origin: "https://movibox.net",
  Referer: "https://movibox.net/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
};
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

    //
    const dubCode = searchParams.get("dubCode");
    const dubType = searchParams.get("dubType");
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
      logRequest(req, "ICARUS", 400, "missing params");

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
      logRequest(req, "ICARUS", 401, "Invalid token");

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
      logRequest(req, "ICARUS", 403, "Forbidden");

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
        `https://api1.zxcstream.xyz/search?${searchParams.toString()}`,
        {
          cache: "no-store",
        },
      );

      if (!searchRes.ok) {
        logRequest(req, "ICARUS", 502, "ICARUS search failed");

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
        logRequest(req, "ICARUS", 404, "Unavailable");

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

    const selectedDub =
      dubCode || dubType
        ? dubs.find(
            (d: any) =>
              (!dubCode || d.lanCode === dubCode) &&
              (!dubType || String(d.type) === String(dubType)),
          )
        : dubs.find((d: any) => d.original === true);

    if (!selectedDub?.subjectId || !selectedDub?.detailPath) {
      logRequest(req, "ICARUS", 404, "Dub source not found");

      return NextResponse.json(
        {
          success: false,
          error: "Dub source not found",
        },
        { status: 404 },
      );
    }

    // -----------------------------
    // Scraper
    // -----------------------------

    const params = new URLSearchParams({
      type: "mp4",
      subjectId: selectedDub.subjectId,
      detailPath: selectedDub.detailPath,
    });

    if (mediaType === "tv") {
      params.set("se", season || "0");
      params.set("ep", episode || "0");
    }
    const res = await fetch(
      `https://api1.zxcstream.xyz/scrape/123movies?${params.toString()}`,
      {
        cache: "no-store",
      },
    );

    if (!res.ok) {
      logRequest(req, "ICARUS", res.status, "Main request failed");

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
      logRequest(req, "ICARUS", 404, "No sources found");

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

    const links = await Promise.all(
      scraped.data.map(async (source: any) => {
        const encrypted = await encryptUrl(source.url);
        const encryptedHeader = await encryptUrl(JSON.stringify(BASE_HEADERS));

        return {
          resolution: source.resolutions,
          format: source.format,
          size: source.size,
          type: "mp4",
          link: encryptLink(
            `https://api1.zxcstream.xyz/media/mp4?url=${encodeURIComponent(
              encrypted,
            )}&header=${encodeURIComponent(encryptedHeader)}`,
          ),
        };
      }),
    );
    logRequest(req, "ICARUS", 200, "OK");

    return NextResponse.json({
      success: true,
      links,
      cached: fromCache,
      dubs: dubs.map((d: any) => ({
        lang: d.lanCode,
        type: d.type,
        name:
          d.type === 1
            ? d.lanName
                .replace(/\b(dub|audio)\b/gi, "")
                .trim()
                .replace(/sub$/i, "")
                .trim() + " (Subtitle)"
            : d.lanName.replace(/\b(dub|audio|sub)\b/gi, "").trim(),
        original: d.original,
      })),
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
