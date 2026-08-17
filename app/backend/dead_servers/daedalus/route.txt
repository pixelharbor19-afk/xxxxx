import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { isValidReferer } from "@/lib/allowed-referers";
import { FIELD_MAP } from "@/lib/token";

const BASE_URL = "https://play.xpass.top";

const XPASS_HEADERS = {
  cookie: `cf_clearance=oEnCaOiyiobiMNcmzDQPose8LuNzFZ2MHvvdAvru6.o-1781028012-1.2.1.1-xT7f3UQqtGtAlYq6RvTekFQyzyMPnzg5Uj6UdzqUycZe33i9lsXkoeNGQX3fyF_8P2pMdQxajQE2uZXOCVUjZhjGYu5W3_fe_C3AvLgjh4fpxAzT4F07YP39F873bigooM_TANzBy8DOKLR84eEBrpXk0MMbEcPMan1caO.SnQLPQR.39wfsvPKN9KCcVYt0ZqnnOVTUdg2WoUIoFCcahQfEICLSUldpTyVRwcfmf5pAOYFViP3P_HOP_eSGEEhOuHwYsVW0UtxgO6h06D4.otQuh88b5zFyDNCY_45Bw9pkZLvS8XHSIgYyljiZbZWnd23Cj7um6L8OzexRPAY_QA; auth_token=67b2acd4932092ea587d94ba20fa9672a45bf8fc73a12720d3f92c116d029970`,
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
};

async function fetchSrc(
  mediaType: string,
  id: string,
  server: number,
  season?: string | null,
  episode?: string | null,
): Promise<{ file: string; type: string; label: string }[] | null> {
  const episodePath =
    mediaType === "tv" && season && episode ? `/${season}/${episode}` : "";

  const pageRes = await fetchWithTimeout(
    `${BASE_URL}/e/${mediaType}/${id}${episodePath}?autostart=false`,
    { headers: XPASS_HEADERS },
    12000,
  );

  if (!pageRes.ok) return null;

  const html = await pageRes.text();
  const match = html.match(/var backups=(\[.*\])/);
  if (!match) return null;

  const servers = JSON.parse(match[1]);
  if (!Array.isArray(servers) || servers.length < server) return null;

  const selected = servers[server - 1];

  const playlistUrl = selected.url.startsWith("http")
    ? selected.url
    : `${BASE_URL}${selected.url}`;

  const playlistRes = await fetchWithTimeout(
    playlistUrl,
    { headers: XPASS_HEADERS },
    12000,
  );

  if (!playlistRes.ok) return null;

  const playlist = await playlistRes.json();
  const sources = playlist?.playlist?.[0]?.sources;
  if (!sources || sources.length === 0) return null;

  const tikSource = sources.find((s: { file: string }) =>
    s.file.includes("tik.1x2.space"),
  );

  if (!tikSource) return null;

  return [
    {
      file: tikSource.file,
      type: tikSource.type,
      label: tikSource.label,
    },
  ];
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get(FIELD_MAP.id);
    const media_type = req.nextUrl.searchParams.get("b");
    const ts = Number(req.nextUrl.searchParams.get(FIELD_MAP.ts));
    const token = req.nextUrl.searchParams.get(FIELD_MAP.token)!;
    const f_token = req.nextUrl.searchParams.get(FIELD_MAP.fToken)!;
    const tmdbId = req.nextUrl.searchParams.get(FIELD_MAP.imdbId); // reusing imdbId field for tmdb id
    const server = Number(req.nextUrl.searchParams.get("server") || "1");
    const season = req.nextUrl.searchParams.get(FIELD_MAP.season);
    const episode = req.nextUrl.searchParams.get(FIELD_MAP.episode);

    if (!id || !media_type || !ts || !token) {
      return NextResponse.json(
        { success: false, error: "need token" },
        { status: 404 },
      );
    }

    if (Date.now() - Number(ts) > 8000) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }

    if (!validateBackendToken(id, f_token, ts, token)) {
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

    let sources: { file: string; type: string; label: string }[] | null = null;

    try {
      sources = await fetchSrc(media_type, tmdbId!, server, season, episode);
    } catch {
      return NextResponse.json(
        { success: false, error: "Timed out" },
        { status: 504 },
      );
    }

    if (!sources) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      links: sources.map((s) => ({
        type: s.type,
        link: `/backend/proxy/?url=${encodeURIComponent(s.file)}`,
        label: s.label,
      })),
      subtitles: [],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
