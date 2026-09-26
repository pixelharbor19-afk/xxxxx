import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FIELD_MAP } from "@/lib/params";
import { logRequest } from "@/lib/log-request";
import { validateBackendToken } from "@/lib/validate-token";
import { encryptLink } from "@/lib/source-link-enc-dec";
import { encryptUrl } from "@/lib/aes-encryptor";
import { isValidReferer } from "@/lib/allowed-referers";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

const domain = "https://embed.vidstuck.xyz";
const holly = `${domain}/backend/database/holly`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_HOLLY_SUPABASE_URL_HOLLY!,
  process.env.HOLLY_SUPABASE_SERVICE_ROLE_KEY_HOLLY!,
);

export async function GET(req: NextRequest) {
  const path = req.nextUrl.pathname.split("/").pop()!;
  const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
  const mediaType = req.nextUrl.searchParams.get(FIELD_MAP.mediaType);
  const season = req.nextUrl.searchParams.get(FIELD_MAP.season) ?? "";
  const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode) ?? "";
  const title = req.nextUrl.searchParams.get(FIELD_MAP.title);
  const year = req.nextUrl.searchParams.get(FIELD_MAP.year);
  const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
  const token = req.nextUrl.searchParams.get(FIELD_MAP.token);
  const date = req.nextUrl.searchParams.get(FIELD_MAP.date);

  if (!tmdbId || !mediaType || !title || !year || !ts || !token || !date) {
    logRequest(req, "ALATREON", 400, "missing params");
    return NextResponse.json(
      { success: false, error: "missing params", server: path },
      { status: 400 },
    );
  }

  if (
    !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
  ) {
    logRequest(req, "ALATREON", 401, "invalid token");
    return NextResponse.json(
      { success: false, error: "Invalid token", server: path },
      { status: 401 },
    );
  }

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

  try {
    let sources: any[] = [];

    // 1. Check cache
    const { data: cached } = await supabase
      .from("holly_movie_cache")
      .select("sources")
      .eq("tmdb_id", Number(tmdbId))
      .eq("media_type", mediaType)
      .eq("season", season)
      .eq("episode", episode)
      .single();

    // 2. Use cached sources
    if (cached?.sources?.length) {
      sources = cached.sources;
    } else {
      // 3. Scrape Holly
      const slug = `${title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}${
        mediaType === "tv" ? `-season-${season}-episode-${episode}` : `-${year}`
      }`;

      const scrapeRes = await fetchWithTimeout(
        `${holly}/scrape?slug=${encodeURIComponent(slug)}`,
        {},
        10000,
      );

      if (!scrapeRes.ok) {
        logRequest(req, "ALATREON", 404, "Holly scrape failed");
        return NextResponse.json(
          { success: false, error: "Holly scrape failed", server: path },
          { status: 404 },
        );
      }

      const scraped = await scrapeRes.json();

      if (!scraped?.qualities?.length) {
        logRequest(req, "ALATREON", 404, "No Holly embeds found");
        return NextResponse.json(
          { success: false, error: "No Holly embeds found", server: path },
          { status: 404 },
        );
      }

      const embed = scraped.qualities[0];

      const resolveRes = await fetchWithTimeout(
        `${holly}/resolve?embed_url=${encodeURIComponent(embed.embed_url)}`,
        {},
        10000,
      );

      if (!resolveRes.ok) {
        logRequest(req, "ALATREON", 502, "Holly resolve failed");
        return NextResponse.json(
          { success: false, error: "Holly resolve failed", server: path },
          { status: 502 },
        );
      }

      const data = await resolveRes.json();

      sources = data?.sources ?? [];

      if (!sources.length) {
        logRequest(req, "ALATREON", 404, "No Holly sources found");
        return NextResponse.json(
          { success: false, error: "No Holly sources found", server: path },
          { status: 404 },
        );
      }

      // Save embeds + sources
      await supabase.from("holly_movie_cache").upsert(
        {
          tmdb_id: Number(tmdbId),
          media_type: mediaType,
          season,
          episode,
          embeds: [embed],
          sources,
        },
        {
          onConflict: "tmdb_id,media_type,season,episode",
        },
      );
    }

    // 6. Return sources
    const links = await Promise.all(
      sources
        .filter((s: any) => s.type !== "mp4")
        .sort(
          (a: any, b: any) =>
            Number(b.file.includes("/pl/")) - Number(a.file.includes("/pl/")),
        )
        .map(async (source: any) => {
          const url = await encryptUrl(source.file);

          return {
            type: source.type,
            resolution: null,
            link: encryptLink(
              `${domain}/backend/servers/atlas/edge?url=${encodeURIComponent(
                url,
              )}&id=${tmdbId}&mediaType=${mediaType}&season=${encodeURIComponent(
                season,
              )}&episode=${encodeURIComponent(episode)}`,
            ),
          };
        }),
    );

    if (!links.length) {
      logRequest(req, "ALATREON", 404, "No /pl/ sources found");
      return NextResponse.json(
        { success: false, error: "No /pl/ sources found", server: path },
        { status: 404 },
      );
    }

    logRequest(req, "ALATREON", 200, "OK");

    return NextResponse.json({
      success: true,
      links,
      server: path,
    });
  } catch (error) {
    console.error("[ATLAS]", error);

    logRequest(req, "ALATREON", 500, "Internal server error");

    return NextResponse.json(
      { success: false, error: "Internal server error", server: path },
      { status: 500 },
    );
  }
}

// import { NextRequest, NextResponse } from "next/server";
// import { createClient } from "@supabase/supabase-js";
// import { FIELD_MAP } from "@/lib/params";
// import { logRequest } from "@/lib/log-request";
// import { validateBackendToken } from "@/lib/validate-token";
// import { isValidReferer } from "@/lib/allowed-referers";
// import { encryptLink } from "@/lib/source-link-enc-dec";
// import { encryptUrl } from "@/lib/aes-encryptor";

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_HOLLY_SUPABASE_URL_HOLLY!,
//   process.env.HOLLY_SUPABASE_SERVICE_ROLE_KEY_HOLLY!,
// );

// export async function GET(req: NextRequest) {
//   const domain = "https://vidstuck.xyz";
//   const path = req.nextUrl.pathname.split("/").pop()!;
//   const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
//   const mediaType = req.nextUrl.searchParams.get(FIELD_MAP.mediaType);
//   const season = req.nextUrl.searchParams.get(FIELD_MAP.season) ?? "";
//   const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode) ?? "";
//   const title = req.nextUrl.searchParams.get(FIELD_MAP.title);
//   const year = req.nextUrl.searchParams.get(FIELD_MAP.year);
//   const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
//   const token = req.nextUrl.searchParams.get(FIELD_MAP.token);
//   const date = req.nextUrl.searchParams.get(FIELD_MAP.date);

//   if (!tmdbId || !mediaType || !title || !year || !ts || !token || !date) {
//     logRequest(req, "ALATREON", 400, "missing params");
//     return NextResponse.json(
//       { success: false, error: "missing params", server: path },
//       { status: 400 },
//     );
//   }
//   if (
//     !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
//   ) {
//     logRequest(req, "ALATREON", 401, "invalid token");
//     return NextResponse.json(
//       { success: false, error: "Invalid token", server: path },
//       { status: 401 },
//     );
//   }

//   const referer = req.headers.get("referer") || "";

//   if (!isValidReferer(referer)) {
//     logRequest(req, "ALATREON", 401, "invalid token");

//     return NextResponse.json(
//       {
//         success: false,
//         error: "Forbidden",
//       },
//       {
//         status: 403,
//       },
//     );
//   }

//   try {
//     const { data: cached } = await supabase
//       .from("holly_movie_cache")
//       .select("sources")
//       .eq("tmdb_id", Number(tmdbId))
//       .eq("media_type", mediaType)
//       .eq("season", season)
//       .eq("episode", episode)
//       .single();

//     if (!cached?.sources?.length) {
//       logRequest(req, "ALATREON", 404, "No cached sources");
//       return NextResponse.json(
//         { success: false, error: "No cached sources", server: path },
//         { status: 404 },
//       );
//     }

//     const links = await Promise.all(
//       cached.sources
//         .filter((s: any) => s.type !== "mp4")
//         .sort(
//           (a: any, b: any) =>
//             Number(b.file.includes("/pl/")) - Number(a.file.includes("/pl/")),
//         )
//         .map(async (source: any) => {
//           const url = await encryptUrl(source.file);

//           return {
//             type: source.type,
//             resolution: null,
//             link: encryptLink(
//               `${domain}/backend/servers/atlas/edge?url=${encodeURIComponent(
//                 url,
//               )}&id=${tmdbId}&mediaType=${mediaType}&season=${encodeURIComponent(
//                 season,
//               )}&episode=${encodeURIComponent(episode)}`,
//             ),
//           };
//         }),
//     );
//     if (!links.length) {
//       logRequest(req, "ALATREON", 404, "No /pl/ sources found");
//       return NextResponse.json(
//         { success: false, error: "No /pl/ sources found", server: path },
//         { status: 404 },
//       );
//     }
//     logRequest(req, "ALATREON", 200, "OK");
//     return NextResponse.json({
//       success: true,
//       links,
//       server: path,
//     });
//   } catch {
//     return NextResponse.json(
//       { success: false, error: "Internal server error", server: path },
//       { status: 500 },
//     );
//   }
// }
