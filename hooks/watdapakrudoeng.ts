import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { MediaOption } from "./open-subtitle";
import { AxiosError } from "axios";
import { decryptLink } from "@/lib/source-link-enc-dec";
import { FIELD_MAP } from "@/lib/params";

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
  latestDate?: string;
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
    latestDate,
    quality,
    dubCode,
    dubType,
    enable,
  } = params;
  console.log("latestDate1", latestDate);
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
      date,
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
      const { data: token } = await axios.post("/backend_/whattheheal", {
        [FIELD_MAP.id]: tmdbId,
        [FIELD_MAP.mediaType]: media_type,
        [FIELD_MAP.path]: path,
        ...(media_type === "tv" && {
          [FIELD_MAP.season]: season,
          [FIELD_MAP.episode]: episode,
        }),
      });

      const search = new URLSearchParams({
        [FIELD_MAP.id]: tmdbId,
        [FIELD_MAP.path]: path,
        [FIELD_MAP.mediaType]: media_type,
        [FIELD_MAP.ts]: String(token.ts),
        [FIELD_MAP.token]: token.token,
        [FIELD_MAP.title]: title,
        [FIELD_MAP.year]: year,
        [FIELD_MAP.date]: date,
      });

      if (media_type === "tv") {
        search.set(FIELD_MAP.season, String(season));
        search.set(FIELD_MAP.episode, String(episode));

        if (latestDate) {
          console.log("latestDate2", latestDate);
          search.set(FIELD_MAP.latestDate, latestDate);
        }
      }

      if (dubCode && dubType) {
        search.set("dubCode", dubCode);
        search.set("dubType", dubType);
      }

      if (imdbId) {
        search.set(FIELD_MAP.imdbId, imdbId);
      }

      const { data } = await axios.get<SourceTypes>(
        `/backend_/sources/${path}?${search.toString()}`,
      );

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
