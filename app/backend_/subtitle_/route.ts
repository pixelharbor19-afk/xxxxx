// ICARUS SERVER (thin proxy)
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { validateSession } from "@/lib/validate-session";
import { isValidReferer } from "@/lib/allowed-referers";
import { FIELD_MAP } from "@/lib/params";

export async function GET(req: NextRequest) {
  try {
    const path = req.nextUrl.pathname.split("/").pop()!;

    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const mediaType = req.nextUrl.searchParams.get(FIELD_MAP.mediaType);
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season) ?? "";
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode) ?? "";
    const title = req.nextUrl.searchParams.get(FIELD_MAP.title);
    const year = req.nextUrl.searchParams.get(FIELD_MAP.year);
    const date = req.nextUrl.searchParams.get(FIELD_MAP.date);
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const token = req.nextUrl.searchParams.get(FIELD_MAP.token);

    if (!tmdbId || !mediaType || !title || !year || !date || !ts || !token) {
      return NextResponse.json(
        { success: false, error: "missing params" },
        { status: 400 },
      );
    }

    // const session = req.cookies.get("_ps")?.value;

    // if (!session || !validateSession(session)) {
    //   return NextResponse.json(
    //     { success: false, error: "Invalid session" },
    //     { status: 401 },
    //   );
    // }

    if (
      !validateBackendToken(tmdbId, mediaType, season, episode, path, ts, token)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 403 },
      );
    }

    const referer = req.headers.get("referer") || "";

    if (!isValidReferer(referer)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const params = new URLSearchParams({
      tmdbId,
      mediaType,
      title,
      date,
      ...(season && { season }),
      ...(episode && { episode }),
    });

    const res = await fetch(
      `https://school-project-production-9d70.up.railway.app/subtitle?${params}`,
    );

    const data = await res.json();

    if (!data.success) {
      return NextResponse.json(
        { success: false, error: data.error || "extraction failed" },
        { status: data.status || 500 },
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
