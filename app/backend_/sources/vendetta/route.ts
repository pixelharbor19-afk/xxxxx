import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { encryptLink } from "@/lib/source-link-enc-dec";
import { FIELD_MAP } from "@/lib/params";

export async function GET(req: NextRequest) {
  const logRequest = (status: number, reason: string) => {
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get(FIELD_MAP.mediaType);
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);
    const extra = mediaType === "tv" ? `/${season}/${episode}` : "";

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

    const message = `[FATALIS] ${tmdbId}/${mediaType}${extra} | ${status} | ${reason} | ts: ${new Date().toISOString()} | IP: ${ip}`;

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

    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get(FIELD_MAP.mediaType);
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season) ?? "";
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode) ?? "";
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const token = req.nextUrl.searchParams.get(FIELD_MAP.token);

    if (!tmdbId || !mediaType || !ts || !token) {
      logRequest(400, "missing params");

      return NextResponse.json(
        {
          success: false,
          error: "missing params",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
    ) {
      logRequest(401, "invalid token");

      return NextResponse.json(
        {
          success: false,
          error: "Invalid token",
        },
        {
          status: 401,
        },
      );
    }

    const referer = req.headers.get("referer") || "";

    if (!isValidReferer(referer)) {
      logRequest(403, "invalid referrer");

      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        {
          status: 403,
        },
      );
    }

    const params = new URLSearchParams({
      id: tmdbId,
      mediaType,
      ...(season && { season }),
      ...(episode && { episode }),
    });

    const res = await fetch(
      `https://api1.zxcstream.xyz/vendetta?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    const data = await res.json();

    if (!data.success) {
      logRequest(
        data.status || res.status || 500,
        data.error || "extraction failed",
      );

      return NextResponse.json(
        {
          success: false,
          error: data.error || "extraction failed",
        },
        {
          status: data.status || res.status || 500,
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
