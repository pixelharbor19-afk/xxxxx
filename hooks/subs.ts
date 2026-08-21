import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { MediaOption } from "./open-subtitle";

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
      const { data: token } = await axios.post("/backend/session", {
        id: tmdbId,
        media_type,
        path: "subtitle_",
        ...(media_type === "tv" && { season, episode }),
      });

      const search = new URLSearchParams({
        id: tmdbId,
        b: media_type,
        ts: String(token.ts),
        token: token.token,
        title,
        year,
        date,
      });

      if (media_type === "tv") {
        search.set("season", String(season));
        search.set("episode", String(episode));
      }

      const { data } = await axios.get(
        `/backend_/subtitle_?${search.toString()}`,
      );

      return data.subtitles ?? [];
    },
  });
}
