// // RESSHIN SERVER (thin proxy)
// import { NextRequest, NextResponse } from "next/server";
// import { validateBackendToken } from "@/lib/validate-token";
// import { FIELD_MAP } from "@/lib/params";
// import { isValidReferer } from "@/lib/allowed-referers";
// import { createClient } from "@supabase/supabase-js";
// import { encryptUrl } from "@/lib/aes-encryptor";
// import { getWorkingProxy, proxies } from "@/lib/resshin-extractor";
// import { validateSession } from "@/lib/validate-session";
// import { encryptLink } from "@/lib/source-link-enc-dec";

// const supabase = createClient(
//   process.env.SUPABASE_URL_MOVIEBOX_APP!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY_MOVIEBOX_APP!,
// );
// const CLIENT_INFO = JSON.stringify({
//   package_name: "com.community.mbox.in.geobypass",
//   version_name: "3.0.14.0422.03",
//   version_code: 51042203,
//   os: "android",
//   os_version: "7.1.2",
//   brand: "samsung",
//   model: "SM-G955N",
//   system_language: "en",
//   net: "NETWORK_WIFI",
//   region: "US",
//   timezone: "Africa/Brazzaville",
//   sp_code: "20801",
//   "X-Play-Mode": "2",
//   "X-Family-Mode": "0",
// });
// const BASE_HEADERS = {
//   accept: "*/*",
//   "accept-encoding": "identity",
//   "user-agent":
//     "com.community.mbox.in.geobypass/51042203 (Linux; Android 7.1.2)",
//   "x-client-info": CLIENT_INFO,
//   "x-client-status": "0",
//   "x-family-mode": "0",
//   "x-play-mode": "2",
// };
// export async function GET(req: NextRequest) {
//   const logRequest = (status: number, reason: string) => {
//     const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
//     const mediaType = req.nextUrl.searchParams.get(FIELD_MAP.mediaType);
//     const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
//     const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
//     const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

//     const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

//     const message = `[RESSHIN] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`;

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
//     const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
//     const mediaType = req.nextUrl.searchParams.get(FIELD_MAP.mediaType);
//     const season = req.nextUrl.searchParams.get(FIELD_MAP.season) ?? "";
//     const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode) ?? "";
//     const title = req.nextUrl.searchParams.get(FIELD_MAP.title);
//     const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
//     const token = req.nextUrl.searchParams.get(FIELD_MAP.token);
//     const date = req.nextUrl.searchParams.get(FIELD_MAP.date);
//     //
//     const dubCode = req.nextUrl.searchParams.get("dubCode");
//     const dubType = Number(req.nextUrl.searchParams.get("dubType") ?? "0");

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
//         dubs.find((d: any) => d.original) ??
//         dubs.find((d: any) => d.lanCode === "en") ??
//         dubs[0];

//       if (original) {
//         let activeDub = original;

//         if (dubCode) {
//           const found = dubs.find(
//             (d: any) =>
//               d.lanCode === dubCode && Number(d.type ?? 0) === dubType,
//           );
//           if (found) activeDub = found;
//         }

//         const activeDubLang: string = activeDub?.lanCode ?? "orig";
//         const activeDubType: number = activeDub?.type ?? 0;

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
//           const sortedDownloads = cachedDl.downloads ?? [];

//           const workingProxy = await getWorkingProxy(proxies);
//           if (!workingProxy) {
//             logRequest(502, "No working proxy available");
//             return NextResponse.json(
//               { success: false, error: "No working proxy available" },
//               { status: 502 },
//             );
//           }

//           if (sortedDownloads.length) {
//             const PREFERRED_ORDER = ["720", "480", "1080", "360"];

//             const links = await Promise.all(
//               PREFERRED_ORDER.map((res) =>
//                 sortedDownloads.find(
//                   (q: any) => String(q.resolution).replace(/p$/i, "") === res,
//                 ),
//               )
//                 .filter(Boolean)
//                 .map(async (q: any) => {
//                   const encrypted = await encryptUrl(q.url);
//                   const encryptedHeader = await encryptUrl(
//                     JSON.stringify(BASE_HEADERS),
//                   );
//                   return {
//                     resolution: q.resolution,
//                     format: q.format,
//                     size: q.size,
//                     type: (q.url ?? "").includes(".m3u8")
//                       ? ("hls" as const)
//                       : ("mp4" as const),
//                     // link: encryptLink(
//                     //   `https://proxy.zxcstream.xyz/proxy?data=${encodeURIComponent(encrypted)}`,
//                     // ),
//                     link: encryptLink(
//                       `https://api1.zxcstream.xyz/media/mp4?url=${encodeURIComponent(encrypted)}&header=${encryptedHeader}`,
//                     ),
//                     // link: `${workingProxy}?data=${encodeURIComponent(encrypted)}`,
//                   };
//                 }),
//             );
//             if (links.length) {
//               const active =
//                 dubs.find((d: any) => d.lanCode === activeDubLang) ?? dubs[0];

//               const data = {
//                 success: true as const,
//                 links,
//                 subtitles: [] as any[],
//                 dubs: dubs.map((d: any) => ({
//                   lang: d.lanCode,
//                   type: d.type,
//                   name:
//                     d.type === 1
//                       ? d.lanName
//                           .replace(/\b(dub|audio)\b/gi, "")
//                           .trim()
//                           .replace(/sub$/i, "")
//                           .trim() + " (Subtitle)"
//                       : d.lanName.replace(/\b(dub|audio|sub)\b/gi, "").trim(),
//                   original: d.original,
//                 })),
//                 meow: true,
//                 meowmeow: true,
//                 active: {
//                   langCode: active?.lanCode ?? "",
//                   langType: active?.type ?? 0,
//                   langName:
//                     active?.lanName?.replace(/\b(dub|audio)\b/gi, "").trim() ??
//                     "",
//                 },
//                 top: true,
//                 fallback: dubCode ? dubCode !== active?.lanCode : false,
//               };

//               logRequest(200, "OK (cache hit)");
//               return NextResponse.json(data);
//             }
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
//       dubType: String(dubType),
//     });

//     const res = await fetch(
//       `https://school-project-production-9d70.up.railway.app/resshin?${params.toString()}`,
//       //`http://localhost:3000/backend_/sources/resshin_?${params.toString()}`,
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
//     logRequest(500, err.message);
//     return NextResponse.json(
//       { success: false, error: "Internal server error" },
//       { status: 500 },
//     );
//   }
// }
import crypto from "node:crypto";
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

const GATEWAY_SECRET = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";

const BOTTOM_TAB_URL =
  "https://api3.aoneroom.com/wefeed-mobile-bff/subject-api/bottom-tab";

const BOTTOM_TAB_CLIENT_TOKEN =
  "1782204604620,cea850d15d46b9b316c073ba0ad05f2f";

const BASE_HEADERS = {
  Origin: "https://movibox.net",
  Referer: "https://movibox.net/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
};

let cachedServerJwt: string | null = null;

let cachedDevice = {
  deviceId: "",
  gaid: "",
  timestamp: 0,
};

function getDeviceCredentials() {
  const now = Date.now();

  if (!cachedDevice.deviceId || now - cachedDevice.timestamp > 43200000) {
    cachedDevice = {
      deviceId: crypto.randomBytes(16).toString("hex"),
      gaid: [
        crypto.randomBytes(4).toString("hex"),
        crypto.randomBytes(2).toString("hex"),
        crypto.randomBytes(2).toString("hex"),
        crypto.randomBytes(2).toString("hex"),
        crypto.randomBytes(6).toString("hex"),
      ].join("-"),
      timestamp: now,
    };
  }

  return cachedDevice;
}

function normalizeQuery(qs: string): string {
  if (!qs) return "";

  const pairs: [string, string][] = [];

  for (const pair of qs.split("&")) {
    if (!pair) continue;

    const idx = pair.indexOf("=");

    const key = idx === -1 ? pair : pair.slice(0, idx);
    const val = idx === -1 ? "" : pair.slice(idx + 1);

    try {
      pairs.push([decodeURIComponent(key), decodeURIComponent(val)]);
    } catch {
      pairs.push([key, val]);
    }
  }

  pairs.sort((a, b) => a[0].localeCompare(b[0]));

  return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

function bodyMd5(body: string): string {
  if (!body) return "";

  const buf = Buffer.from(body, "utf8");

  const chunk = buf.length > 102400 ? buf.subarray(0, 102400) : buf;

  return crypto.createHash("md5").update(chunk).digest("hex");
}

function buildCanonical(
  method: string,
  headers: Record<string, string>,
  body: string,
  fullUrl: string,
  ts: number,
): string {
  const u = new URL(fullUrl);

  const accept = headers["accept"] ?? "";
  const contentType = headers["content-type"] ?? "";

  let contentLength = headers["content-length"] ?? "";

  if (!contentLength && body) {
    contentLength = String(Buffer.byteLength(body, "utf8"));
  }

  if (method.toUpperCase() === "GET" && !body) {
    contentLength = "";
  }

  const md5 = bodyMd5(body);

  const normalizedQuery = normalizeQuery(u.search.replace(/^\?/, ""));

  const pathUrl = u.pathname + (normalizedQuery ? `?${normalizedQuery}` : "");

  return [
    method.toUpperCase(),
    accept,
    contentType,
    contentLength,
    String(ts),
    md5,
    pathUrl,
  ].join("\n");
}

function sign(secretB64: string, canonical: string): string {
  const key =
    /^[A-Za-z0-9+/=]+$/.test(secretB64) && secretB64.length % 4 === 0
      ? Buffer.from(secretB64, "base64")
      : Buffer.from(secretB64, "utf8");

  const h = crypto.createHmac("md5", key);

  h.update(canonical, "utf8");

  return h.digest("base64");
}

function makeXTr(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string,
): string {
  const ts = Date.now();

  const canonical = buildCanonical(method, headers, body, url, ts);

  return `${ts}|2|${sign(GATEWAY_SECRET, canonical)}`;
}

async function getServerJwt(): Promise<string> {
  if (cachedServerJwt) {
    return cachedServerJwt;
  }

  const device = getDeviceCredentials();

  const headers: Record<string, string> = {
    accept: "*/*",
    "accept-encoding": "gzip, deflate, br",
    connection: "keep-alive",
    host: "api3.aoneroom.com",
    "user-agent":
      "com.community.mbox.in.geobypass/51042203 (Linux; U; Android 7.1.2; en_US; SM-G955N; Build/NRD90M.G955NKSU1AQDC; Cronet/104.0.5112.46)",
    "x-client-info": JSON.stringify({
      package_name: "com.community.mbox.in.geobypass",
      version_name: "3.0.14.0422.03",
      version_code: 51042203,
      os: "android",
      os_version: "7.1.2",
      device_id: device.deviceId,
      gaid: device.gaid,
      brand: "samsung",
      model: "SM-G955N",
      system_language: "en",
      net: "NETWORK_WIFI",
      region: "US",
      timezone: "Africa/Brazzaville",
      sp_code: "20801",
      "X-Play-Mode": "2",
      "X-Family-Mode": "0",
    }),
    "x-client-status": "0",
    "x-client-token": BOTTOM_TAB_CLIENT_TOKEN,
    "x-family-mode": "0",
    "x-play-mode": "2",
  };

  headers["x-tr-signature"] = makeXTr("GET", BOTTOM_TAB_URL, headers, "");

  headers["x-tr-signature-method"] = "HmacMD5";

  const res = await fetch(BOTTOM_TAB_URL, {
    method: "GET",
    headers,
  });

  const xuser = res.headers.get("x-user") || res.headers.get("X-User");

  if (!xuser) {
    throw new Error("Failed to get JWT");
  }

  let token = xuser;

  try {
    const parsed = JSON.parse(xuser);

    if (parsed?.token) {
      token = parsed.token;
    }
  } catch {}

  cachedServerJwt = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

  return cachedServerJwt;
}

async function gatewayRequest(
  method: string,
  url: string,
  opts: {
    headers?: Record<string, string>;
    body?: string;
  } = {},
) {
  const authToken = await getServerJwt();

  const headers: Record<string, string> = {
    accept: "*/*",
    authorization: authToken,
    "accept-encoding": "gzip, deflate, br",
    "user-agent":
      "com.community.mbox.in.geobypass/51042203 (Linux; U; Android 7.1.2; en_US; SM-G955N; Build/NRD90M.G955NKSU1AQDC; Cronet/104.0.5112.46)",
    "x-client-info": JSON.stringify({
      ...getDeviceCredentials(),
      timezone: "Africa/Brazzaville",
    }),
    ...opts.headers,
  };

  headers["x-tr-signature"] = makeXTr(method, url, headers, opts.body ?? "");

  headers["x-tr-signature-method"] = "HmacMD5";

  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? opts.body : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    cachedServerJwt = null;

    return gatewayRequest(method, url, opts);
  }

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      code: -1,
      raw: text,
    };
  }
}

async function gatewayGetResource(
  subjectId: string,
  query: Record<string, string> = {},
) {
  const params = {
    ...query,
    all: query.all ?? "0",
    page: query.page ?? "1",
    perPage: query.perPage ?? "5",
    subjectId,
  };

  const qs = new URLSearchParams(params).toString();

  return gatewayRequest(
    "GET",
    `https://api6.aoneroom.com/wefeed-mobile-bff/subject-api/resource?${qs}`,
  );
}

function extractQualities(list: any[]): any[] {
  const groups = new Map();

  for (const item of list ?? []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const url = item.url || item.resourceLink || item.link;

    if (!url) continue;

    const resolution = String(item.resolution || "1080");

    const quality = {
      resolution,
      url,
      size: Number(item.size) || 0,
      format: "mp4",
    };

    const existing = groups.get(resolution);

    if (!existing || quality.size > existing.size) {
      groups.set(resolution, quality);
    }
  }

  return Array.from(groups.values()).sort(
    (a: any, b: any) => parseInt(b.resolution) - parseInt(a.resolution),
  );
}

async function fetchSubjectQualities(
  subjectId: string,
  baseQuery: Record<string, string> = {},
) {
  const allItems: any[] = [];

  const first = await gatewayGetResource(subjectId, baseQuery);

  allItems.push(...(first?.data?.list ?? []));

  for (const resolution of ["360", "480", "720", "1080"]) {
    const res = await gatewayGetResource(subjectId, {
      ...baseQuery,
      resolution,
    });

    if (res?.code === 0) {
      allItems.push(...(res?.data?.list ?? []));
    }
  }

  return extractQualities(allItems);
}

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
    const fromCache = dubs.length > 0;

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

      dubs = searchData.dubs;

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
    // Get selected dub
    // -----------------------------

    const selectedDub =
      dubCode || dubType
        ? dubs.find(
            (d: any) =>
              (!dubCode || d.lanCode === dubCode) &&
              (!dubType || String(d.type) === String(dubType)),
          )
        : dubs.find((d: any) => d.original === true);

    if (!selectedDub?.subjectId) {
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
    // Resshin source extraction
    // -----------------------------

    const baseQuery: Record<string, string> =
      mediaType === "tv"
        ? {
            all: "0",
            page: "1",
            perPage: "5",
            se: String(season || 1),
            ep: String(episode || 1),
            epFrom: String(episode || 1),
            epTo: String(episode || 1),
            startPosition: String(episode || 1),
            endPosition: String(episode || 1),
            pagerMode: "2",
          }
        : {};

    let qualities = await fetchSubjectQualities(
      selectedDub.subjectId,
      baseQuery,
    );

    // Fallback to original audio
    let fallback = false;

    if (!qualities.length && !selectedDub.original) {
      const original = dubs.find((d: any) => d.original === true);

      if (original?.subjectId) {
        fallback = true;

        qualities = await fetchSubjectQualities(original.subjectId, baseQuery);
      }
    }

    const sortedDownloads = qualities
      .filter((q: any) => q?.url && typeof q.url === "string")
      .sort(
        (a: any, b: any) =>
          (parseInt(b.resolution) || 0) - (parseInt(a.resolution) || 0),
      );

    if (!sortedDownloads.length) {
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

    const PREFERRED_ORDER = ["720", "480", "1080", "360"];

    const links = await Promise.all(
      PREFERRED_ORDER.map((resolution) =>
        sortedDownloads.find(
          (q: any) => String(q.resolution).replace(/p$/i, "") === resolution,
        ),
      )
        .filter(Boolean)
        .map(async (source: any) => {
          const encrypted = await encryptUrl(source.url);

          return {
            resolution: source.resolution,
            format: source.format,
            size: source.size,
            type: source.url.includes(".m3u8") ? "hls" : "mp4",
            link: encryptLink(
              `https://api1.zxcstream.xyz/media/mp4?url=${encodeURIComponent(
                encrypted,
              )}`,
            ),
          };
        }),
    );

    logRequest(req, "ICARUS", 200, "OK");

    return NextResponse.json({
      success: true,
      links,
      cached: fromCache,
      fallback,

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
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
