import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { encryptUrl } from "@/lib/aes-encryptor";
import { encryptLink } from "@/lib/source-link-enc-dec";
import { FIELD_MAP } from "@/lib/params";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { logRequest } from "@/lib/log-request";

export async function GET(req: NextRequest) {
  const { searchParams, pathname } = req.nextUrl;

  const tmdbId = searchParams.get(FIELD_MAP.id);
  const mediaType = searchParams.get(FIELD_MAP.mediaType);
  const season = searchParams.get(FIELD_MAP.season) ?? "";
  const episode = searchParams.get(FIELD_MAP.episode) ?? "";
  const token = searchParams.get(FIELD_MAP.token);
  const ts = Number(searchParams.get(FIELD_MAP.ts));
  const path = pathname.split("/").pop()!;

  if (!tmdbId || !mediaType || !token) {
    logRequest(req, "VALSTRAX", 400, "missing params");
    return NextResponse.json(
      { success: false, error: "missing params" },
      { status: 400 },
    );
  }

  if (
    !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
  ) {
    logRequest(req, "VALSTRAX", 401, "invalid token");
    return NextResponse.json(
      { success: false, error: "Invalid token" },
      { status: 401 },
    );
  }

  const referer = req.headers.get("referer") || "";
  if (!isValidReferer(referer)) {
    logRequest(req, "VALSTRAX", 403, "invalid referrer");
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  try {
    const workerUrl = new URL("https://api1.zxcstream.xyz/vidlink");

    workerUrl.searchParams.set("tmdbId", tmdbId!);
    workerUrl.searchParams.set("mediaType", mediaType!);

    if (season) workerUrl.searchParams.set("season", season);
    if (episode) workerUrl.searchParams.set("episode", episode);

    const response = await fetchWithTimeout(
      workerUrl.toString(),
      { method: "GET" },
      8000,
    );

    if (!response.ok) {
      logRequest(req, "VALSTRAX", 404, "No stream found");
      return NextResponse.json(
        {
          success: false,
          error: "No streams found",
        },
        { status: 404 },
      );
    }

    const { stream } = await response.json();

    if (!stream) {
      logRequest(req, "VALSTRAX", 404, "No stream found");
      return NextResponse.json(
        {
          success: false,
          error: "No stream found",
        },
        { status: 404 },
      );
    }

    const links = [];

    // MP4
    if (stream.type === "file" && stream.qualities) {
      const qualities = Object.entries(stream.qualities) as [
        string,
        {
          url?: string;
          headers?: Record<string, string>;
        },
      ][];

      for (const [resolution, quality] of qualities) {
        if (!quality.url) continue;

        const url = await encryptUrl(quality.url);
        const header = await encryptUrl(JSON.stringify(quality.headers ?? {}));

        const link = {
          type: "mp4",
          link: `https://api1.zxcstream.xyz/media/mp4?url=${url}&header=${header}`,
          resolution: Number(resolution) || 0,
        };

        links.push({
          ...link,
          link: encryptLink(link.link),
        });
      }
    }

    // HLS / DASH
    else if (
      (stream.type === "hls" || stream.type === "dash") &&
      stream.playlist
    ) {
      const url = await encryptUrl(stream.playlist);
      const header = await encryptUrl(
        JSON.stringify(stream.playlistHeaders ?? {}),
      );

      const link = {
        type: stream.type,
        link: `https://api1.zxcstream.xyz/media/${stream.type}?url=${url}&header=${header}`,
        resolution: Number(stream.playbackMetadata?.resolutions?.[0]) || 0,
      };

      links.push({
        ...link,
        link: encryptLink(link.link),
      });
    }
    logRequest(req, "VALSTRAX", 200, "OK!!!!!!");
    return NextResponse.json({
      success: true,
      links,
      subtitles: [],
    });
  } catch (err) {
    console.error("API Error:", err);

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
