import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { MediaOption } from "./open-subtitle";
import { generateFrontendToken, FIELD_MAP } from "@/lib/token";
import { AxiosError } from "axios";
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

export interface SourceTypes {
  success: boolean;
  links: QualityTrack[];
  subtitles: MediaOption[];
  dubs?: DubTypes[];
  active?: ActiveTypes;
  fallback: boolean;
}
export interface ActiveTypes {
  langCode: string;
  langName: string;
  langType: string;
}
interface UseSourceParams {
  media_type: string;
  tmdbId: string;
  season: number;
  episode: number;
  imdbId: string | null;
  server: string;
  title: string;
  year: string;
  date: string;
  quality?: "4k" | null;
  dubCode: string;
  dubType: string;
  enable: boolean;
}

export default function useSource(
  params: UseSourceParams & { onCancel?: () => void },
) {
  const {
    media_type,
    tmdbId,
    season,
    episode,
    imdbId,
    server,
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
      server, // ← only refetches after scroll stops
      title,
      year,
      quality,
      dubCode,
      dubType,
    ],
    enabled: enable, // ← blocks fetch while scrolling
    retry: false,
    staleTime: 1000 * 60 * 60, // 1 hour → no refetch for 1 hour
    gcTime: 1000 * 60 * 60, // 1 hour → garbage collect after 1 hour
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      // console.log("🚀 queryFn fired with:", {
      //   dubCode,
      //   dubType,
      //   server,
      //   tmdbId,
      // });
      // if (server === "thanatos") {
      //   return fetchThanatosSource({
      //     media_type,
      //     tmdbId,
      //     season,
      //     episode,
      //     imdbId,
      //     title,
      //     year,
      //   });
      // }
      const { xt, rt } = generateFrontendToken(String(tmdbId));

      const backendRes = await fetchBackendToken(tmdbId, xt, rt);
      const sig = backendRes[FIELD_MAP.token]; // "sig"
      const ts = backendRes[FIELD_MAP.ts]; // "rt"
      const url = buildSourceURL({
        server,
        tmdbId,
        media_type,
        season,
        episode,
        imdbId,
        title,
        year,
        date,
        dubCode,
        dubType,
        // quality,
        ts,
        sig,
        xt,
      });
      const res = await axios.get(url);
      await sleep(1200);
      return res.data;
    },
  });
}

async function fetchBackendToken(id: string, xt: string, rt: number) {
  const res = await axios.post("/backend/token", {
    [FIELD_MAP.id]: id, // "mid"
    [FIELD_MAP.fToken]: xt, // "xt"
    [FIELD_MAP.ts]: rt, // "rt"
  });
  return res.data;
}
interface BuildSourceURLParams {
  server: string;
  tmdbId: string;
  media_type: string;
  season: number;
  episode: number;
  imdbId: string | null;
  title: string;
  year: string;
  date: string;
  ts: number;
  sig: string; // was: token
  xt: string; // was: f_token

  dubCode: string;
  dubType: string;
}

function buildSourceURL({
  server,
  tmdbId,
  imdbId,
  media_type,
  season,
  episode,
  title,
  year,
  ts,
  sig,
  xt,
  dubCode,
  dubType,
  date,
}: BuildSourceURLParams) {
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
  if (!!dubCode && !!dubType) {
    params.append("dubCode", dubCode);
    params.append("dubType", dubType);
  }
  if (imdbId) {
    params.append(FIELD_MAP.imdbId, imdbId);
  }
  // params.append("dub", "tl");
  return `/backend_/servers/${server}?${params.toString()}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// videasy-2.zxcprime365.workers.dev

// async function fetchThanatosSource({
//   media_type,
//   tmdbId,
//   season,
//   episode,
//   title,
//   year,
//   imdbId,
// }: {
//   media_type: string;
//   tmdbId: string;
//   season: number;
//   episode: number;
//   imdbId: string | null;
//   title: string;
//   year: string;
// }): Promise<SourceTypes> {
//   // Step 1: Fetch encrypted source directly (user's IP)
//   const qs = new URLSearchParams({
//     title,
//     mediaType: media_type,
//     year,
//     tmdbId,
//   });

//   if (imdbId) {
//     qs.set("imdbId", imdbId);
//   }

//   if (media_type === "tv") {
//     qs.set("seasonId", String(season));
//     qs.set("episodeId", String(episode));
//   } else {
//     // Movies still need episodeId=1 and seasonId=1 per the example URL
//     qs.set("episodeId", "1");
//     qs.set("seasonId", "1");
//   }

//   const videasyRes = await axios.get(
//     `https://api.videasy.to/mb-flix/sources-with-title?${qs}`,
//     {
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
//         Referer: "https://videasy.to/",
//       },
//     },
//   );

//   // Step 2: Decrypt directly from browser (user's IP)
//   const decryptRes = await axios.post("https://enc-dec.app/api/dec-videasy", {
//     text: videasyRes.data,
//     id: tmdbId,
//   });

//   const sources = decryptRes.data?.result?.sources;
//   if (!Array.isArray(sources) || sources.length === 0) {
//     throw new Error("No stream found");
//   }

//   // Step 3: Still use backend only for proxy selection (no rate-limited calls here)
//   const finalM3u8 = encodeURIComponent(
//     sources.find((f: any) => f.quality === "1080p")?.url ??
//       sources.at(0)?.url ??
//       "",
//   );

//   const proxies = [
//     "/backend/proxy/videasy/",
//     // "https://crimson-disk-c4aa.zxcprime368.workers.dev/",
//     // "https://damp-glitter-6277.zxcprime367.workers.dev/",
//     // "https://billowing-king-b723.jerometecson33.workers.dev/",
//     // "https://snowy-recipe-f96e.jerometecson000.workers.dev/",
//     // "https://morning-unit-723b.jinluxus303.workers.dev/",
//     // "https://square-darkness-1efb.amenohabakiri174.workers.dev/",
//   ];

//   // Step 4: Find working proxy client-side
//   const workingProxy = await getWorkingProxyClient(finalM3u8, proxies);
//   if (!workingProxy) throw new Error("No working proxy available");

//   await sleep(1200);
//   return {
//     success: true,
//     links: [{ type: "hls", link: `${workingProxy}?m3u8-proxy=${finalM3u8}` }],
//     subtitles: [],
//   };
// }

async function getWorkingProxyClient(
  url: string,
  proxies: string[],
  signal?: AbortSignal,
): Promise<string | null> {
  for (const proxy of proxies) {
    try {
      const res = await fetch(`${proxy}?m3u8-proxy=${url}`, {
        method: "HEAD",
        headers: { Range: "bytes=0-1" },
        signal,
      });
      if (res.ok) return proxy;
    } catch {
      // try next
    }
  }
  return null;
}
