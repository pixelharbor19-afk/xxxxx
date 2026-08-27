import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { encryptUrl } from "@/lib/aes-encryptor";
import { encryptLink } from "@/lib/source-link-enc-dec";
import { FIELD_MAP } from "@/lib/params";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const tmdbId = params.get(FIELD_MAP.id);
  const mediaType = params.get(FIELD_MAP.mediaType);
  const season = params.get(FIELD_MAP.season);
  const episode = params.get(FIELD_MAP.episode);

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
