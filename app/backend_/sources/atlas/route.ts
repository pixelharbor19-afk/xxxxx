import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { createClient } from "@supabase/supabase-js";
import { encryptLink } from "@/lib/source-link-enc-dec";
import { FIELD_MAP } from "@/lib/params";
import { logRequest } from "@/lib/log-request";
import { encryptUrl } from "@/lib/aes-encryptor";
import { workerProxies, workerProxyHealth } from "@/lib/proxy-health-checker";

const supabase = createClient(
  process.env.SUPABASE_URL_MOVIEBOX_WEB2!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_MOVIEBOX_WEB2!,
);

export async function GET(req: NextRequest) {
  const { searchParams, pathname } = req.nextUrl;
  const path = pathname.split("/").pop()!;

  try {
    const tmdbId = searchParams.get(FIELD_MAP.id);
    const mediaType = searchParams.get(FIELD_MAP.mediaType);
    const season = searchParams.get(FIELD_MAP.season) ?? "";
    const episode = searchParams.get(FIELD_MAP.episode) ?? "";
    const title = searchParams.get(FIELD_MAP.title);
    const ts = Number(searchParams.get(FIELD_MAP.ts));
    const token = searchParams.get(FIELD_MAP.token);
    const date = searchParams.get(FIELD_MAP.date);
    const latestDate = searchParams.get(FIELD_MAP.latestDate);
    const dubCode = searchParams.get("dubCode");
    const dubType = searchParams.get("dubType");

    if (
      !tmdbId ||
      !mediaType ||
      !title ||
      !date ||
      !Number.isFinite(ts) ||
      !token
    ) {
      logRequest(req, "ZINOGRE", 400, "missing params");

      return NextResponse.json(
        {
          success: false,
          error: "missing params",
          server: path,
        },
        { status: 400 },
      );
    }

    if (
      !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
    ) {
      logRequest(req, "ZINOGRE", 401, "Invalid token");

      return NextResponse.json(
        {
          success: false,
          error: "Invalid token",
          server: path,
        },
        { status: 401 },
      );
    }

    // -----------------------------
    // Validate referer
    // -----------------------------

    if (!isValidReferer(req.headers.get("referer") || "")) {
      logRequest(req, "ZINOGRE", 403, "Forbidden");

      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        { status: 403 },
      );
    }

    const { data: cached } = await supabase
      .from("moviebox_cache")
      .select("dubs")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle();

    let dubs = cached?.dubs ?? [];
    let fromCache = dubs.length > 0;

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
        `https://embed.vidstuck.xyz/backend/database/search-moviebox?${searchParams.toString()}`,
        {
          cache: "no-store",
        },
      );

      if (!searchRes.ok) {
        logRequest(req, "ZINOGRE", 502, "zinogre search failed");

        return NextResponse.json(
          {
            success: false,
            error: "zinogre search failed",
            server: path,
          },
          { status: 502 },
        );
      }

      const searchData = await searchRes.json();

      if (!searchData?.success || !searchData?.dubs?.length) {
        logRequest(req, "ZINOGRE", 404, "Unavailable");

        return NextResponse.json(
          {
            success: false,
            error: "Unavailable",
            server: path,
          },
          { status: 404 },
        );
      }

      dubs = searchData.dubs;
      fromCache = false;

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

    const selectedDub =
      dubs.find(
        (dub: any) =>
          dub.lanCode === dubCode && String(dub.type) === String(dubType),
      ) ??
      dubs.find((dub: any) => dub.original === true) ??
      dubs[0];

    const publicDubs = dubs.map(
      ({ subjectId, detailPath, ...dub }: any) => dub,
    );

    if (!selectedDub?.subjectId || !selectedDub?.detailPath) {
      logRequest(req, "ZINOGRE", 404, "Dub source not found");

      return NextResponse.json(
        {
          success: false,
          error: "Dub source not found",
          server: path,
        },
        { status: 404 },
      );
    }

    const dub = selectedDub.lanCode;
    const type = Number(selectedDub.type) || 0;
    const original = selectedDub.original === true;

    const { data: cachedSources } = await supabase
      .from("moviebox_sources_cache")
      .select("sources")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .eq("season", season)
      .eq("episode", episode)
      .eq("dub", dub)
      .eq("type", type)
      .eq("original", original)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    const shuffledProxy = await workerProxyHealth(workerProxies);

    if (!shuffledProxy) {
      logRequest(req, "ZINOGRE", 502, "No proxy available");

      return NextResponse.json(
        {
          success: false,
          error: "No proxy available",
          server: path,
        },
        { status: 502 },
      );
    }

    if (cachedSources?.sources?.length) {
      const links = await Promise.all(
        cachedSources.sources.map(async (source: any) => {
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

          const proxyType =
            source.type === "hls" ? "a" : source.type === "dash" ? "b" : "c";

          const proxyUrl = `${shuffledProxy}${proxyType}?u=${encodeURIComponent(url)}&h=${encodeURIComponent(header)}`;

          return {
            type: source.type,
            link: encryptLink(proxyUrl),
            resolution: source.resolution,
          };
        }),
      );

      logRequest(req, "ZINOGRE", 200, "Cache hit");

      return NextResponse.json({
        success: true,
        links,
        dubs: publicDubs,
        meow: true,
        server: path,
      });
    }

    const params = new URLSearchParams({
      subjectId: selectedDub.subjectId,
      detailPath: selectedDub.detailPath,
    });

    if (mediaType === "tv") {
      params.set("se", season || "0");
      params.set("ep", episode || "0");
    }

    params.set("streamSignType", "1");

    const res = await fetch(
      `https://embed.vidstuck.xyz/backend/database/moviebox?${params.toString()}`,
      {
        cache: "no-store",
      },
    );

    if (!res.ok) {
      logRequest(req, "ZINOGRE", 502, "Main request failed");

      return NextResponse.json(
        {
          success: false,
          error: "Main request failed",
          server: path,
        },
        { status: 502 },
      );
    }

    const scraped = await res.json();

    const dashSources = scraped?.data?.dash ?? [];
    const hlsSources = scraped?.data?.hls ?? [];
    const mp4Sources = scraped?.data?.streams ?? [];

    let rawSources: any[];
    let sourceType: "dash" | "hls" | "mp4";

    if (dashSources.length) {
      rawSources = dashSources;
      sourceType = "dash";
    } else if (hlsSources.length) {
      rawSources = hlsSources;
      sourceType = "hls";
    } else if (mp4Sources.length) {
      rawSources = mp4Sources;
      sourceType = "mp4";
    } else {
      logRequest(req, "ZINOGRE", 404, "No sources found");

      return NextResponse.json(
        {
          success: false,
          error: "No sources found",
          server: path,
        },
        { status: 404 },
      );
    }

    const sources = rawSources.map((source: any) => ({
      url: source.url,
      signCookie: source.signCookie,
      signHeaderKey: source.signHeaderKey,
      type: sourceType,
      resolution: Number(source.resolutions?.split(",")[0]) || 0,
    }));

    await supabase.from("moviebox_sources_cache").upsert(
      {
        tmdb_id: tmdbId,
        media_type: mediaType,
        season,
        episode,
        dub,
        type,
        original,
        sources,
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      },
      {
        onConflict: "tmdb_id,media_type,season,episode,dub,type,original",
      },
    );

    const links = await Promise.all(
      sources.map(async (source: any) => {
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
        const proxyType =
          source.type === "hls" ? "a" : source.type === "dash" ? "b" : "c";

        const proxyUrl = `${shuffledProxy}${proxyType}?u=${encodeURIComponent(url)}&h=${encodeURIComponent(header)}`;

        return {
          type: source.type,
          link: encryptLink(proxyUrl),
          resolution: source.resolution,
        };
      }),
    );

    logRequest(req, "ZINOGRE", 200, "OK");

    return NextResponse.json({
      success: true,
      links,
      dubs: publicDubs,
      meow: fromCache,
      server: path,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        server: path,
      },
      { status: 500 },
    );
  }
}
