import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { MediaOption } from "./open-subtitle";
import { FIELD_MAP } from "@/lib/params";

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
      const { data: token } = await axios.post("/backend_/razercobrapro", {
        [FIELD_MAP.id]: tmdbId,
        [FIELD_MAP.mediaType]: media_type,
        [FIELD_MAP.path]: "subtitle_",
        ...(media_type === "tv" && {
          [FIELD_MAP.season]: season,
          [FIELD_MAP.episode]: episode,
        }),
      });

      const search = new URLSearchParams({
        [FIELD_MAP.id]: tmdbId,
        [FIELD_MAP.mediaType]: media_type,
        [FIELD_MAP.path]: "subtitle_",
        [FIELD_MAP.ts]: String(token.ts),
        [FIELD_MAP.token]: token.token,
        [FIELD_MAP.title]: title,
        [FIELD_MAP.year]: year,
        [FIELD_MAP.date]: date,
      });

      if (media_type === "tv") {
        search.set(FIELD_MAP.season, String(season));
        search.set(FIELD_MAP.episode, String(episode));
      }

      const { data } = await axios.get(
        `/backend_/subtitle_?${search.toString()}`,
      );

      return data.subtitles ?? [];
    },
  });
}
