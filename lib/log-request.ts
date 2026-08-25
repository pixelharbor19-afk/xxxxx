import { NextRequest } from "next/server";
import { FIELD_MAP } from "@/lib/params";

export function logRequest(
  req: NextRequest,
  name: string,
  status: number,
  reason: string,
) {
  const searchParams = req.nextUrl.searchParams;

  const tmdbId = searchParams.get(FIELD_MAP.id);
  const mediaType = searchParams.get(FIELD_MAP.mediaType);
  const season = searchParams.get(FIELD_MAP.season);
  const episode = searchParams.get(FIELD_MAP.episode);

  const extra = mediaType === "tv" ? `/${season}/${episode}` : "";
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

  const message =
    `[${name}] ${tmdbId}/${mediaType}${extra} | ` +
    `${status} | ${reason} | ` +
    `ts: ${new Date().toISOString()} | IP: ${ip}`;

  if (status >= 500) {
    console.error(message);
  } else if (status >= 400) {
    console.warn(message);
  } else {
    console.log(message);
  }
}
