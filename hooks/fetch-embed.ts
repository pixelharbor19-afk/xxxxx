import { generateFrontendToken, FIELD_MAP } from "@/lib/params";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";

interface FetchEmbedParams {
  tmdbId: string;
  media_type: string;
  season?: number;
  episode?: number;
  imdbId?: string | null;
  enabled?: boolean;
}

interface SentinelEmbedResponse {
  success: boolean;
  embed: string;
}
async function fetchSentinelEmbed({
  tmdbId,
  media_type,
  season,
  episode,
  imdbId,
}: FetchEmbedParams) {
  const { xt, rt } = generateFrontendToken(tmdbId);

  const backendRes = await axios.post("/backend/wtf", {
    [FIELD_MAP.id]: tmdbId,
    [FIELD_MAP.fToken]: xt,
    [FIELD_MAP.ts]: rt,
  });

  const sig = backendRes.data[FIELD_MAP.token];
  const ts = backendRes.data[FIELD_MAP.ts];

  const params = new URLSearchParams({
    [FIELD_MAP.id]: tmdbId,
    b: media_type,
    [FIELD_MAP.ts]: String(ts),
    [FIELD_MAP.token]: sig,
    [FIELD_MAP.fToken]: xt,
  });

  if (media_type === "tv") {
    params.append(FIELD_MAP.season, String(season));
    params.append(FIELD_MAP.episode, String(episode));
  }

  if (imdbId) {
    params.append(FIELD_MAP.imdbId, imdbId);
  }

  const res = await fetch(`/backend_/embed/sentinel?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch embed URL");
  return res.json();
}

export function useSentinelEmbed(params: FetchEmbedParams) {
  return useQuery<SentinelEmbedResponse>({
    queryKey: [
      "sentinel",
      params.tmdbId,
      params.media_type,
      params.season,
      params.episode,
    ],
    queryFn: () => fetchSentinelEmbed(params),
    enabled: !!params.tmdbId && (params.enabled ?? true),
  });
}
