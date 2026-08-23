import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { MediaOption } from "./open-subtitle";
import { AxiosError } from "axios";
import { decryptLink } from "@/lib/link-crypto";

export interface QualityTrack {
  resolution?: number;
  format?: string;
  size?: string;
  type: "mp4" | "hls";
  link: string;
}

export interface DubTypes {
  lang: string;
  name: string;
  original: boolean;
  type: 0 | 1;
}

export interface ActiveTypes {
  langCode: string;
  langName: string;
  langType: string;
}

export interface SourceTypes {
  success: boolean;
  links: QualityTrack[];
  subtitles: MediaOption[];
  dubs?: DubTypes[];
  active?: ActiveTypes;
  fallback: boolean;
}

interface UseSourceParams {
  media_type: string;
  tmdbId: string;
  season: number;
  episode: number;
  imdbId: string | null;
  path: string;
  title: string;
  year: string;
  date: string;
  quality?: "4k" | null;
  dubCode: string;
  dubType: string;
  enable: boolean;
}

export default function useSource(params: UseSourceParams) {
  const {
    media_type,
    tmdbId,
    season,
    episode,
    imdbId,
    path,
    title,
    year,
    date,
    quality,
    dubCode,
    dubType,
    enable,
  } = params;

  return useQuery<SourceTypes, AxiosError>({
    queryKey: [
      "get-source",
      tmdbId,
      media_type,
      season,
      episode,
      imdbId,
      path,
      title,
      year,
      quality,
      dubCode,
      dubType,
    ],

    enabled: enable,
    retry: false,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,

    queryFn: async () => {
      const { data: token } = await axios.post("/backend_/dynamic-token", {
        id: tmdbId,
        media_type,
        path,
        ...(media_type === "tv" && { season, episode }),
      });

      const ts = token.ts;
      const sig = token.token;

      const search = new URLSearchParams({
        id: tmdbId,
        b: media_type,
        ts: String(ts),
        token: sig,
        title,
        year,
        date,
      });

      if (media_type === "tv") {
        search.set("season", String(season));
        search.set("episode", String(episode));
      }

      if (dubCode && dubType) {
        search.set("dubCode", dubCode);
        search.set("dubType", dubType);
      }

      if (imdbId) {
        search.set("imdbId", imdbId);
      }

      const { data } = await axios.get<SourceTypes>(
        `/backend_/sources/${path}?${search.toString()}`,
      );

      // await new Promise((resolve) => setTimeout(resolve, 1200));

      return {
        ...data,
        links: data.links.map((link) => ({
          ...link,
          link: decryptLink(link.link),
        })),
      };
    },
  });
}
