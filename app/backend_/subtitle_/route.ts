// ICARUS SERVER (thin proxy)
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { FIELD_MAP } from "@/lib/token";

export async function GET(req: NextRequest) {
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

    if (!tmdbId || !mediaType || !title || !date || !ts || !token) {
      return NextResponse.json(
        { success: false, error: "need token" },
        { status: 404 },
      );
    }

    if (Date.now() - ts > 30000) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }

    if (!validateBackendToken(tmdbId, f_token, ts, token)) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
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

    // Forward only the extraction params to Backend B
    const params = new URLSearchParams({
      tmdbId,
      mediaType,
      title,
      date,
      ...(season && { season }),
      ...(episode && { episode }),
    });

    const res = await fetch(
      `https://school-project-production-9d70.up.railway.app/subtitle?${params.toString()}`,
      { method: "GET" },
    );

    const data = await res.json();

    if (!data.success) {
      return NextResponse.json(
        { success: false, error: data.error || "extraction failed" },
        { status: data.status || 500 },
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
