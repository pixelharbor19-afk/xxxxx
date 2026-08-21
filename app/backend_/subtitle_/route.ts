// ICARUS SERVER (thin proxy)
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { validateSession } from "@/lib/validate-session";
import { isValidReferer } from "@/lib/allowed-referers";

export async function GET(req: NextRequest) {
  try {
    const path = req.nextUrl.pathname.split("/").pop()!;

    const tmdbId = req.nextUrl.searchParams.get("id");
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get("season") ?? "";
    const episode = req.nextUrl.searchParams.get("episode") ?? "";
    const title = req.nextUrl.searchParams.get("title");
    const year = req.nextUrl.searchParams.get("year");
    const date = req.nextUrl.searchParams.get("date");
    const ts = Number(req.nextUrl.searchParams.get("ts"));
    const token = req.nextUrl.searchParams.get("token");

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
