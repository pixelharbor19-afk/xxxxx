// ICARUS SERVER (thin proxy)
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { encryptLink } from "@/lib/link-crypto";

export async function GET(req: NextRequest) {
  const logRequest = (status: number, reason: string) => {
    const tmdbId = req.nextUrl.searchParams.get("id");
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get("season");
    const episode = req.nextUrl.searchParams.get("episode");
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

    const message = `[ICARUS] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`;

    if (status >= 500) {
      console.error(message);
    } else if (status >= 400) {
      console.warn(message);
    } else {
      console.log(message);
    }
  };

  try {
    const path = req.nextUrl.pathname.split("/").pop()!;

    const tmdbId = req.nextUrl.searchParams.get("id");
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get("season") ?? "";
    const episode = req.nextUrl.searchParams.get("episode") ?? "";
    const title = req.nextUrl.searchParams.get("title");
    const ts = Number(req.nextUrl.searchParams.get("ts"));
    const token = req.nextUrl.searchParams.get("token");
    const date = req.nextUrl.searchParams.get("date");

    const dubCode = req.nextUrl.searchParams.get("dubCode");
    const dubType = req.nextUrl.searchParams.get("dubType");

    if (!tmdbId || !mediaType || !title || !date || !ts || !token) {
      logRequest(400, "missing params");

      return NextResponse.json(
        { success: false, error: "missing params" },
        { status: 400 },
      );
    }

    if (
      !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
    ) {
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

    // -------- Call backend extractor --------

    const params = new URLSearchParams({
      tmdbId,
      mediaType,
      title,
      date,
      ...(season && { season }),
      ...(episode && { episode }),
      ...(dubCode && { dubCode }),
      ...(dubType && { dubType }),
    });

    const res = await fetch(
      `https://school-project-production-9d70.up.railway.app/icarus?${params.toString()}`,
      {
        method: "GET",
      },
    );

    const data = await res.json();

    if (!data.success) {
      logRequest(data.status || 500, data.error || "extraction failed");

      return NextResponse.json(
        {
          success: false,
          error: data.error || "extraction failed",
        },
        {
          status: data.status || 500,
        },
      );
    }

    logRequest(200, "OK");

    return NextResponse.json({
      ...data,
      links: data.links.map((link: any) => ({
        ...link,
        link: encryptLink(link.link),
      })),
    });
  } catch (err: any) {
    logRequest(500, `exception: ${err?.message}`);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      {
        status: 500,
      },
    );
  }
}
// // ICARUS SERVER (thin proxy) WITH CACHING
// import { NextRequest, NextResponse } from "next/server";
// import { validateBackendToken } from "@/lib/validate-token";
// import { isValidReferer } from "@/lib/allowed-referers";
// import { FIELD_MAP } from "@/lib/token";
// import { createClient } from "@supabase/supabase-js";
// import { encryptUrl } from "@/lib/encryptor";
// import { getWorkingProxy, proxies } from "@/lib/icarus-extractor";
// import { validateSession } from "@/lib/validate-session";
// import { encryptLink } from "@/lib/link-crypto";

// const supabase = createClient(
//   process.env.SUPABASE_URL_MOVIEBOX_WEB!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY_MOVIEBOX_WEB!,
// );

// export async function GET(req: NextRequest) {
//   const logRequest = (status: number, reason: string) => {
//     const tmdbId = req.nextUrl.searchParams.get("id");
//     const mediaType = req.nextUrl.searchParams.get("b");
//     const season = req.nextUrl.searchParams.get("season");
//     const episode = req.nextUrl.searchParams.get("episode");
//     const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

//     const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

//     const message = `[ICARUS] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`;

//     if (status >= 500) {
//       console.error(message);
//     } else if (status >= 400) {
//       console.warn(message);
//     } else {
//       console.log(message);
//     }
//   };
//   try {
//     const path = req.nextUrl.pathname.split("/").pop()!;
//     const tmdbId = req.nextUrl.searchParams.get("id");
//     const mediaType = req.nextUrl.searchParams.get("b");
//     const season = req.nextUrl.searchParams.get("season") ?? "";
//     const episode = req.nextUrl.searchParams.get("episode") ?? "";
//     const title = req.nextUrl.searchParams.get("title");
//     const ts = Number(req.nextUrl.searchParams.get("ts"));
//     const token = req.nextUrl.searchParams.get("token");
//     const date = req.nextUrl.searchParams.get("date");

//     //
//     const dubCode = req.nextUrl.searchParams.get("dubCode");
//     const dubType = req.nextUrl.searchParams.get("dubType");

//     if (!tmdbId || !mediaType || !title || !date || !ts || !token) {
//       logRequest(400, "missing params");
//       return NextResponse.json(
//         { success: false, error: "missing params" },
//         { status: 400 },
//       );
//     }
//     // const session = req.cookies.get("_ps")?.value;

//     // if (!session || !validateSession(session)) {
//     //   logRequest(401, "invalid session");

//     //   return NextResponse.json(
//     //     { success: false, error: "Invalid session" },
//     //     { status: 401 },
//     //   );
//     // }

//     if (
//       !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
//     ) {
//       logRequest(401, "invalid token");

//       return NextResponse.json(
//         { success: false, error: "Invalid token" },
//         { status: 401 },
//       );
//     }

//     const referer = req.headers.get("referer") || "";
//     if (!isValidReferer(referer)) {
//       logRequest(403, "invalid referrer");
//       return NextResponse.json(
//         { success: false, error: "Forbidden" },
//         { status: 403 },
//       );
//     }
//     // -------- Top-level Supabase cache checks --------
//     const { data: cachedDubsRow } = await supabase
//       .from("moviebox_cache")
//       .select("dubs")
//       .eq("tmdb_id", tmdbId)
//       .eq("media_type", mediaType)
//       .maybeSingle();

//     if (cachedDubsRow) {
//       const dubs = cachedDubsRow.dubs ?? [];

//       const original =
//         dubs.find((d: any) => d.original === true) ??
//         dubs.find((d: any) => d.lanCode === "en") ??
//         dubs[0];

//       if (original) {
//         let activeDubType: number = original.type ?? 0;
//         let activeDubLang: string = original.lanCode ?? "orig";

//         if (dubCode) {
//           const dubEntry = dubs.find(
//             (d: any) =>
//               d.lanCode === dubCode && d.type === Number(dubType ?? "0"),
//           );
//           if (dubEntry) {
//             activeDubType = dubEntry.type ?? 0;
//             activeDubLang = dubEntry.lanCode;
//           }
//         }

//         const dlQuery = supabase
//           .from("moviebox_downloads_cache")
//           .select("downloads")
//           .eq("tmdb_id", tmdbId)
//           .eq("media_type", mediaType)
//           .eq("dub", activeDubLang)
//           .eq("type", activeDubType)
//           .gt("expires_at", new Date().toISOString());

//         if (season) dlQuery.eq("season", season);
//         else dlQuery.eq("season", "");

//         if (episode) dlQuery.eq("episode", episode);
//         else dlQuery.eq("episode", "");

//         const { data: cachedDl } = await dlQuery.maybeSingle();

//         if (cachedDl) {
//           // Full cache hit — serve without calling backend
//           let sortedDownloads = cachedDl.downloads ?? [];

//           const workingProxy = await getWorkingProxy(proxies);
//           if (!workingProxy) {
//             logRequest(502, "No working proxy available");
//             return NextResponse.json(
//               { success: false, error: "No working proxy available" },
//               { status: 502 },
//             );
//           }

//           if (!sortedDownloads.length) {
//             // treat as miss and fall through to backend
//           } else {
//             const links = await Promise.all(
//               sortedDownloads.map(async (d: any) => {
//                 const encrypted = await encryptUrl(d.url);
//                 return {
//                   resolution: d.resolutions,
//                   format: d.format,
//                   size: d.size,
//                   type: d.url.includes(".m3u8")
//                     ? ("hls" as const)
//                     : ("mp4" as const),
//                   link: encryptLink(
//                     `${workingProxy}?data=${encodeURIComponent(encrypted)}`,
//                   ),
//                 };
//               }),
//             );

//             const activeDub =
//               dubs.find((d: any) => d.lanCode === activeDubLang) ?? dubs[0];

//             const data = {
//               success: true as const,
//               links,
//               subtitles: [] as any[],
//               dubs: dubs.map((d: any) => ({
//                 lang: d.lanCode,
//                 type: d.type,
//                 name:
//                   d.type === 1
//                     ? d.lanName
//                         .replace(/\b(dub|audio)\b/gi, "")
//                         .trim()
//                         .replace(/sub$/i, "")
//                         .trim() + " (Subtitle)"
//                     : d.lanName.replace(/\b(dub|audio|sub)\b/gi, "").trim(),
//                 original: d.original,
//               })),
//               meow: true,
//               meowmeow: true,
//               active: {
//                 langCode: activeDub?.lanCode ?? "",
//                 langType: activeDub?.type ?? 0,
//                 langName:
//                   activeDub?.lanName?.replace(/\b(dub|audio)\b/gi, "").trim() ??
//                   "",
//               },
//               top: true,
//               fallback: dubCode ? dubCode !== activeDub?.lanCode : false,
//             };

//             logRequest(200, "OK (cache hit)");
//             return NextResponse.json(data);
//           }
//         }
//       }
//     }

//     // -------- Cache miss → call backend extractor --------
//     const params = new URLSearchParams({
//       tmdbId,
//       mediaType,
//       title,
//       date,
//       ...(season && { season }),
//       ...(episode && { episode }),
//       ...(dubCode && { dubCode }),
//       ...(dubType && { dubType }),
//     });

//     const res = await fetch(
//       `https://school-project-production-9d70.up.railway.app/icarus?${params.toString()}`,
//       { method: "GET" },
//     );

//     const data = await res.json();

//     if (!data.success) {
//       logRequest(data.status || 500, data.error || "extraction failed");
//       return NextResponse.json(
//         { success: false, error: data.error || "extraction failed" },
//         { status: data.status || 500 },
//       );
//     }

//     logRequest(200, "OK");
//     return NextResponse.json({
//       ...data,
//       links: data.links.map((link: any) => ({
//         ...link,
//         link: encryptLink(link.link),
//       })),
//     });
//   } catch (err: any) {
//     logRequest(500, `exception: ${err?.message}`);
//     return NextResponse.json(
//       { success: false, error: "Internal server error" },
//       { status: 500 },
//     );
//   }
// }
