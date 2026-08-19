// RESSHIN SERVER (thin proxy)
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { FIELD_MAP } from "@/lib/token";
import { isValidReferer } from "@/lib/allowed-referers";
import { createClient } from "@supabase/supabase-js";
import { encryptUrl } from "@/lib/encryptor";
import { getWorkingProxy, proxies } from "@/lib/resshin-extractor";

const supabase = createClient(
  process.env.SUPABASE_URL_MOVIEBOX_APP!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_MOVIEBOX_APP!,
);

export async function GET(req: NextRequest) {
  const logRequest = (status: number, reason: string) => {
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

    const message = `[RESSHIN] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`;

    if (status >= 500) {
      console.error(message);
    } else if (status >= 400) {
      console.warn(message);
    } else {
      console.log(message);
    }
  };

  try {
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const title = req.nextUrl.searchParams.get(FIELD_MAP.title);
    const date = req.nextUrl.searchParams.get("date");
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const token = req.nextUrl.searchParams.get(FIELD_MAP.token)!;
    const f_token = req.nextUrl.searchParams.get(FIELD_MAP.fToken)!;
    const dubCode = req.nextUrl.searchParams.get("dubCode");
    const dubType = Number(req.nextUrl.searchParams.get("dubType") ?? "0");

    if (!tmdbId || !mediaType || !title || !date || !ts || !token) {
      logRequest(400, "missing params");
      return NextResponse.json(
        { success: false, error: "missing params" },
        { status: 400 },
      );
    }

    if (Date.now() - ts > 120000) {
      logRequest(401, "token expired");
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 },
      );
    }

    if (!validateBackendToken(tmdbId, f_token, ts, token)) {
      logRequest(401, "invalid token");
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 },
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

    // -------- Top-level Supabase cache checks --------
    const { data: cachedDubsRow } = await supabase
      .from("moviebox_cache")
      .select("dubs")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle();

    if (cachedDubsRow) {
      const dubs = cachedDubsRow.dubs ?? [];

      const original =
        dubs.find((d: any) => d.original) ??
        dubs.find((d: any) => d.lanCode === "en") ??
        dubs[0];

      if (original) {
        let activeDub = original;

        if (dubCode) {
          const found = dubs.find(
            (d: any) =>
              d.lanCode === dubCode && Number(d.type ?? 0) === dubType,
          );
          if (found) activeDub = found;
        }

        const activeDubLang: string = activeDub?.lanCode ?? "orig";
        const activeDubType: number = activeDub?.type ?? 0;

        const dlQuery = supabase
          .from("moviebox_downloads_cache")
          .select("downloads")
          .eq("tmdb_id", tmdbId)
          .eq("media_type", mediaType)
          .eq("dub", activeDubLang)
          .eq("type", activeDubType)
          .gt("expires_at", new Date().toISOString());

        if (season) dlQuery.eq("season", season);
        else dlQuery.eq("season", "");

        if (episode) dlQuery.eq("episode", episode);
        else dlQuery.eq("episode", "");

        const { data: cachedDl } = await dlQuery.maybeSingle();

        if (cachedDl) {
          // Full cache hit — serve without calling backend
          const sortedDownloads = cachedDl.downloads ?? [];

          const workingProxy = await getWorkingProxy(proxies);
          if (!workingProxy) {
            logRequest(502, "No working proxy available");
            return NextResponse.json(
              { success: false, error: "No working proxy available" },
              { status: 502 },
            );
          }

          if (sortedDownloads.length) {
            const PREFERRED_ORDER = ["720", "480", "1080", "360"];

            const links = await Promise.all(
              PREFERRED_ORDER.map((res) =>
                sortedDownloads.find(
                  (q: any) => String(q.resolution).replace(/p$/i, "") === res,
                ),
              )
                .filter(Boolean)
                .map(async (q: any) => {
                  const encrypted = await encryptUrl(q.url);
                  return {
                    resolution: q.resolution,
                    format: q.format,
                    size: q.size,
                    type: (q.url ?? "").includes(".m3u8")
                      ? ("hls" as const)
                      : ("mp4" as const),
                    link: `https://proxy.zxcstream.xyz/proxy?data=${encodeURIComponent(encrypted)}`,
                    // link: `${workingProxy}?data=${encodeURIComponent(encrypted)}`,
                  };
                }),
            );
            if (links.length) {
              const active =
                dubs.find((d: any) => d.lanCode === activeDubLang) ?? dubs[0];

              const data = {
                success: true as const,
                links,
                subtitles: [] as any[],
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
                meow: true,
                meowmeow: true,
                active: {
                  langCode: active?.lanCode ?? "",
                  langType: active?.type ?? 0,
                  langName:
                    active?.lanName?.replace(/\b(dub|audio)\b/gi, "").trim() ??
                    "",
                },
                top: true,
                fallback: dubCode ? dubCode !== active?.lanCode : false,
              };

              logRequest(200, "OK (cache hit)");
              return NextResponse.json(data);
            }
          }
        }
      }
    }

    // -------- Cache miss → call backend extractor --------
    const params = new URLSearchParams({
      tmdbId,
      mediaType,
      title,
      date,
      ...(season && { season }),
      ...(episode && { episode }),
      ...(dubCode && { dubCode }),
      dubType: String(dubType),
    });

    const res = await fetch(
      `https://school-project-production-9d70.up.railway.app/resshin?${params.toString()}`,
      //`http://localhost:3000/backend_/servers/resshin_?${params.toString()}`,
      { method: "GET" },
    );

    const data = await res.json();

    if (!data.success) {
      logRequest(data.status || 500, data.error || "extraction failed");
      return NextResponse.json(
        { success: false, error: data.error || "extraction failed" },
        { status: data.status || 500 },
      );
    }

    logRequest(200, "OK");
    return NextResponse.json(data);
  } catch (err: any) {
    logRequest(500, err.message);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
