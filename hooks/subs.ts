import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { MediaOption } from "./open-subtitle";
import { generateFrontendToken, FIELD_MAP } from "@/lib/token";

interface UseSubtitleParams {
  tmdbId: string;
  media_type: string;
  season: number;
  episode: number;
  title: string;
  year: string;
  date: string;
  enable: boolean;
}

export default function useSubtitle({
  tmdbId,
  media_type,
  season,
  episode,
  title,
  year,
  date,
  enable,
}: UseSubtitleParams) {
  return useQuery<MediaOption[]>({
    queryKey: ["get-subtitle", tmdbId, title, media_type, season, episode],
    enabled: enable,
    retry: false,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { xt, rt } = generateFrontendToken(String(tmdbId));
      const backendRes = await axios.post("/backend/meow", {
        [FIELD_MAP.id]: tmdbId,
        [FIELD_MAP.fToken]: xt,
        [FIELD_MAP.ts]: rt,
      });
      const sig = backendRes.data[FIELD_MAP.token];
      const ts = backendRes.data[FIELD_MAP.ts];

      const params = new URLSearchParams({
        [FIELD_MAP.id]: String(tmdbId),
        b: media_type,
        [FIELD_MAP.ts]: String(ts),
        [FIELD_MAP.token]: sig,
        [FIELD_MAP.fToken]: xt,
        [FIELD_MAP.title]: title,
        [FIELD_MAP.year]: year,
        date: date,
      });

      if (media_type === "tv") {
        params.append(FIELD_MAP.season, String(season));
        params.append(FIELD_MAP.episode, String(episode));
      }

      const res = await axios.get(`/backend_/subtitle_?${params.toString()}`);
      return res.data.subtitles ?? [];
    },
  });
}
