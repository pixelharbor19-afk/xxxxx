"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDoubleTap } from "use-double-tap";
import {
  ClockAlert,
  CloudOff,
  HatGlasses,
  RefreshCcw,
  RotateCw,
  SearchX,
  TriangleAlert,
  X,
} from "lucide-react";
import { Tailspin } from "ldrs/react";
import "ldrs/react/Tailspin.css";
import { cn } from "@/lib/utils";
import { makeKey } from "@/zustand/videoProgressStore";
import { useSettingsStore } from "@/zustand/settings-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHiddenOverlay } from "@/lib/hide-overlay";
import useSource from "@/hooks/source";
import { useOpenSubtitle } from "@/hooks/open-subtitle";
import { usePlayerServers } from "./useServers";
import { useVideoPlayer } from "./useVideoPlayer";
import { useKeyboardControls } from "./useKeyboard";
import { Button } from "@/components/ui/button";
import MainControls from "./controls/main";
import { LyricsServerPicker } from "./serverSelection";
import SubtitleOverlay from "./subtitle/SubtitleOverlay";
import Pause from "./pause";
import DynamicTip from "./tips";
import { useQueryClient } from "@tanstack/react-query";
import LoadingMetadata from "./logo";
import { ArrowLeftIcon } from "@/components/icons/arrow";
import { useTmdbDetails } from "@/hooks/fetch-details";
import { useAdStore2 } from "@/zustand/ad-store2";
import { useIntro } from "@/hooks/intro";
import { SkipSegment } from "./controls/skip_segment";
import { useAdsScript } from "@/hooks/useAdsScript";
import { useSandboxDetection } from "@/hooks/useSandboxDetection";
import { useTrackEmbedder } from "@/hooks/useTrackEmbedder";
import Link from "next/link";
import useSubtitle from "@/hooks/subs";
function getRootDomain(url: string) {
  try {
    const hostname = new URL(url).hostname;

    // localhost / IP addresses
    if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return hostname;
    }

    const parts = hostname.split(".");

    // Handles common ccTLDs like example.co.uk
    const secondLevel = ["co", "com", "net", "org", "gov", "edu", "ac"];

    if (
      parts.length >= 3 &&
      parts[parts.length - 1].length === 2 &&
      secondLevel.includes(parts[parts.length - 2])
    ) {
      return parts.slice(-3).join(".");
    }

    return parts.slice(-2).join(".");
  } catch {
    return url;
  }
}

// declare global {
//   interface Window {
//     webstats?: (
//       event: string,
//       data: {
//         type: "movie" | "tvshow";
//         ids: {
//           tmdb: string;
//         };
//         title: string;
//         episode?: {
//           season: number;
//           number: number;
//           title?: string;
//         };
//       },
//     ) => void;
//   }
// }

export {};
export default function Player() {
  // ─── URL Params ─────────────────────────────────────────────────────────────

  const { params } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const media_type = String(params?.[0]);
  const tmdbId = String(params?.[1]);
  const season = Number(params?.[2]) || 1;
  const episode = Number(params?.[3]) || 1;
  const [showServer, setShowServer] = useState(true);
  // const [startPlayer, setStartPlayer] = useState(false);
  const defaultServerIndex = Number(searchParams.get("server")) || 0;
  const domain = searchParams.get("domainAd") || "zxcstream.icu";
  const color = searchParams.get("color") || "e50914";
  const language = searchParams.get("language") || "en-US";
  const subLang = searchParams.get("subLang") || "off";
  const back = searchParams.get("back") === "true";
  const episodeSelector = searchParams.get("episodeSelector") !== "false";
  const resshin = searchParams.get("resshin") === "true";
  const dubLang =
    searchParams.get("dubLang") || searchParams.get("dublang") || "";
  const dubType =
    searchParams.get("dubType") || searchParams.get("dubtype") || "0";
  const [showFallbackBanner, setShowFallbackBanner] = useState(false);
  const auto_play = searchParams.get("autoplay") === "true";
  const enableSaveProgress = searchParams.get("save_progress") !== "false"; // default true
  const enableLoadProgress = searchParams.get("load_progress") !== "false"; // default true
  const load = Number(searchParams.get("load")) || undefined; // default undefined
  const dubLangApplied = useRef(false);
  const trackedRef = useRef(false);

  const [cooldown, setCooldown] = useState(0);
  const [retryCooldown, setRetryCooldown] = useState(0);
  // const restrictionActive = phHour >= 17 || phHour < 5;

  const whitelistSites = ["zxcstream"];

  const isWhitelisted =
    window.self === window.top ||
    whitelistSites.some((site) => document.referrer.includes(site));
  const { mutate: trackEmbedder } = useTrackEmbedder();
  const { isSandboxed, isLoading } = useSandboxDetection();

  // ─── Local State ─────────────────────────────────────────────────────────────
  const isMobile = useIsMobile();
  const [doubleTapSide, setDoubleTapSide] = useState<"left" | "right" | null>(
    null,
  );
  const [cCToggle, setCcToggle] = useState(true);

  // ─── Settings ────────────────────────────────────────────────────────────────
  const { triggerAd } = useAdStore2();
  const aspectRatio = useSettingsStore(
    (s) => s.values["Aspect Ratio"]?.id ?? "16:9",
  );
  const mirror = useSettingsStore((s) => s.values["Mirror"]?.id ?? "off");
  const subtitleUrl = useSettingsStore(
    (s) => s.values["Subtitles"]?.file ?? null,
  );
  const dualSubtitleUrl = useSettingsStore(
    (s) => s.values["Dual subtitles"]?.file ?? null,
  );
  const autoplay = useSettingsStore((s) => s.values["Autoplay"]?.id ?? "on");
  const sourceQualityId = useSettingsStore(
    (s) => s.values["Source quality"]?.id ?? "auto",
  );
  const brightness = useSettingsStore(
    (s) => s.values["Brightness"]?.id ?? "100%",
  );
  const dub = useSettingsStore((s) => s.values["Audio Dub"]?.value ?? "");
  const initialType = useSettingsStore(
    (s) => s.values["Audio Dub"]?.type ?? "",
  );
  // derive after
  const type = dub === "" ? "" : initialType;

  // ─── Servers ─────────────────────────────────────────────────────────────────
  const {
    handleCanPlay,
    handleManualSelect,
    handleServerFail,
    handleMarkConnecting,
    handleMarkChecking,
    handleQualityChange,
    handleMarkQueue,
    serverIndex,
    servers,
    setServers,
    playingIndex,
    allFailed,
    handleResetServers,
    handleMarkDub,
    retryCooldown: serverCooldown,
  } = usePlayerServers({ defaultServerIndex, resshin });

  const fetchServer = servers[serverIndex];

  // ─── Metadata ────────────────────────────────────────────────────────────────
  // const { data: metadata, isError: metadataError } = useMovieById({
  //   media_type,
  //   tmdbId,
  //   language,
  // });
  const {
    data: metadata,
    isError: isMetadataError,
    error: metadataError,
    refetch: refetchTmdb,
  } = useTmdbDetails(
    media_type,
    tmdbId,
    language,
    // !isLoading && !isSandboxed,
    // !isLoading && !(restricted && isSandboxed),
    // !isLoading && !(!isWhitelisted && isSandboxed && restrictionActive),
    !isLoading && !(!isWhitelisted && isSandboxed),
    //
    // !isLoading && !(!isWhitelisted && isSandboxed) && startPlayer,
  );
  const isRateLimited = metadataError?.response?.status === 429;
  const isForbidden = metadataError?.response?.status === 403;
  const imdbId = metadata?.imdb_id || null;
  const status = metadata?.status || "";
  const backdropArray = metadata?.backdrop_paths || [];
  const [backdropIndex, setBackdropIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const webstatsTracked = useRef(false);
  useEffect(() => {
    if (!backdropArray.length) return;
    setBackdropIndex(Math.floor(Math.random() * backdropArray.length));
  }, [metadata?.id, serverIndex]);

  const backdrop = backdropArray[backdropIndex] ?? null;

  // const backdrop = backdropArray.length
  //   ? backdropArray[Math.floor(Math.random() * backdropArray.length)]
  //   : null;
  const title = metadata?.title || "";
  const date = metadata?.release_date;
  const year = date ? String(new Date(date).getFullYear()) : "";
  const genre = metadata?.genres?.[0]?.name ?? "N/A";
  const seasons = metadata?.seasons ?? [];
  const logo = metadata?.logo_paths?.[0] ?? null;

  // ─── Source ──────────────────────────────────────────────────────────────────
  const metadataLoad = !!tmdbId && !!metadata && !!title;
  const {
    data: source,
    isError: isSourceError,
    isLoading: sourceLoading,
    error: sourceError,
    refetch: refetchSource,
  } = useSource({
    media_type,
    tmdbId,
    season,
    episode,
    path: fetchServer.server,
    imdbId,
    title,
    year,
    date: String(date),
    enable: !allFailed && metadataLoad,
    dubCode: dub || dubLang,
    dubType: dub || dubLang ? (dub ? type : dubType) : "",
  });
  const isSourceRateLimited = sourceError?.response?.status === 429;
  const isSourceForbidden = sourceError?.response?.status === 403;
  const { data: subtitles = [], isLoading: subtitlesLoading } = useSubtitle({
    tmdbId,
    media_type,
    season,
    episode,
    title,
    year,
    date: String(date),
    enable: metadataLoad, // or tie it to source being loaded
  });
  const { data: introData } = useIntro({
    imdbId,
    tmdbId,
    season,
    episode,
    enabled: media_type === "tv" && metadataLoad,
  });

  // ─── Subtitles ───────────────────────────────────────────────────────────────
  const { data: openSubtitleData = [] } = useOpenSubtitle({
    imdbId,
    season: media_type === "tv" ? season : undefined,
    episode: media_type === "tv" ? episode : undefined,
    enabled: metadataLoad,
  });
  const dubs = source?.dubs || [];
  const mergeSubtitles = [
    ...(source?.subtitles || []),
    ...(subtitles || []),
    ...openSubtitleData,
  ];

  const isAuto = sourceQualityId === "auto" ? "0" : sourceQualityId;
  // ─── Video Player ────────────────────────────────────────────────────────────
  const playerSrc =
    servers[serverIndex].status === "connecting" ||
    servers[serverIndex].status === "available"
      ? (source?.links[Number(isAuto)]?.link ?? null)
      : null;

  // console.log("server index:", serverIndex, " player src=", playerSrc);

  const srcType = source?.links?.[Number(isAuto)]?.type ?? "";
  // console.log(isAuto, playerSrc, srcType);

  const {
    videoRef,
    containerRef,
    // New return values
    currentTime,
    duration,
    buffered,
    playback,
    ui,
    controls,
    quality,
    setQuality,
    audioTracks,
    setAudioTracks,
  } = useVideoPlayer({
    playerSrc,
    srcType,
    serverIndex,
    progressKey: makeKey(media_type, tmdbId, season, episode),
    initialMuted: auto_play && autoplay === "on",
    enableSaveProgress,
    enableLoadProgress,
    load,
    handleServerFail,
  });

  const timer = isMobile ? 5000 : 3000;
  const { isVisible, resetTimer, setIsVisible, lockTimer } =
    useHiddenOverlay(timer);

  useEffect(() => {
    if (window.self === window.top) return;

    window.parent.postMessage(
      {
        type: "OVERLAY_VISIBILITY",
        payload: {
          isVisible,
        },
      },
      "*",
    );
  }, [isVisible]);

  // ─── Next Episode ────────────────────────────────────────────────────────────
  const allSeason = metadata?.seasons?.length ?? 0;
  const activeSeason = metadata?.seasons?.find(
    (s) => s.season_number === season,
  );
  const episodeCount = activeSeason?.episode_count ?? 0;

  let nextSeason = season;
  let nextEpisode = episode;
  let canNext = true;

  if (episode < episodeCount) {
    nextEpisode = episode + 1;
  } else if (season < allSeason) {
    nextSeason = season + 1;
    nextEpisode = 1;
  } else {
    canNext = false;
  }

  // ─── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sourceLoading) handleMarkChecking();
  }, [sourceLoading]);

  useEffect(() => {
    return () => {
      handleMarkQueue();
    };
  }, [serverIndex]);

  // useEffect(() => {
  //   if (isSourceRateLimited) return;
  //   if (isSourceError || source?.links.length === 0) {
  //     queryClient.removeQueries({
  //       queryKey: [
  //         "get-source",
  //         tmdbId,
  //         media_type,
  //         season,
  //         episode,
  //         imdbId,
  //         fetchServer.server,
  //         title,
  //         year,
  //       ],
  //     });
  //     handleServerFail();
  //   }
  // }, [source?.links, isSourceError, isSourceRateLimited]);

  // default dub effect

  useEffect(() => {
    if (isSourceRateLimited || isSourceForbidden) return;
    if (isSourceError || source?.links.length === 0) {
      queryClient.removeQueries({
        queryKey: [
          "get-source",
          tmdbId,
          media_type,
          season,
          episode,
          imdbId,
          fetchServer.server,
          title,
          year,
        ],
      });
      handleServerFail();
    }
  }, [source?.links, isSourceError, isSourceRateLimited, isSourceForbidden]);
  useEffect(() => {
    if (dubLangApplied.current) return; // skip if dubLang was applied or user picked
    if (dubLang) return;
    if (!source?.dubs?.[0]) return;
    useSettingsStore.getState().setValue("Audio Dub", {
      display: String(source.dubs[0].name),
      id: "0",
      value: "",
      type: "",
    });
  }, [source?.dubs]);

  useEffect(() => {
    if (!source?.fallback) return;
    if (!playback.canPlay) return;
    if (fetchServer.server !== "icarus") return;
    setShowFallbackBanner(true);
    const timer = setTimeout(() => setShowFallbackBanner(false), 5000);
    return () => clearTimeout(timer);
  }, [source?.fallback, playback.canPlay]);

  // useEffect(() => {
  //   if (!playback.canPlay) return;
  //   if (fetchServer.server !== "icarus") return;
  //   if (playCountCalled.current) return;
  //   if (!source?.active) return;

  //   playCountCalled.current = true;

  //   fetch("/backend_/sources/icarus/report_play", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({
  //       tmdbId,
  //       mediaType: media_type,
  //       season: media_type === "tv" ? season : "",
  //       episode: media_type === "tv" ? episode : "",
  //       dub: source.active.langCode,
  //       type: source.active.langType,
  //     }),
  //   });
  // }, [playback.canPlay, source?.active]);

  useEffect(() => {
    if (trackedRef.current) return;
    if (isLoading) return;
    if (!metadataLoad) return;

    trackedRef.current = true;

    // Direct visit
    if (window.self === window.top) {
      trackEmbedder({
        embed: getRootDomain(window.location.origin),
        embedder: "direct",
        sandbox: false,
      });
      return;
    }

    // Ignore sandboxed embeds
    if (isSandboxed && !isWhitelisted) return;

    let embedder = "unknown";

    try {
      if (document.referrer) {
        embedder = getRootDomain(document.referrer);
      }
    } catch {}

    trackEmbedder({
      embed: getRootDomain(window.location.origin),
      embedder,
      sandbox: isSandboxed,
    });
  }, [isLoading, isSandboxed, trackEmbedder, metadataLoad]);

  // useEffect(() => {
  //   dubLangApplied.current = false;
  //    if (!source?.dubs?.[0]) return;
  //   useSettingsStore.getState().setValue("Audio Dub", {
  //     display: String(source.dubs[0].name),
  //     id: "0",
  //     value: "",
  //     type: "",
  //   });
  //   setLoaded(false);
  // }, [serverIndex]);
  // useEffect(() => {
  //   if (backdropArray.length <= 1) return;
  //   if (playback.canPlay) return; // stop cycling once video is playing

  //   const interval = setInterval(() => {
  //     setBackdropIndex((prev) => (prev + 1) % backdropArray.length);
  //   }, 3000);

  //   return () => clearInterval(interval);
  // }, [backdropArray.length, playback.canPlay]);
  // dubLang effect
  useEffect(() => {
    if (!dubLang) return;
    if (dubLangApplied.current) return;
    if (!source?.dubs?.length) return;
    const index = source.dubs.findIndex(
      (f) => f.lang === dubLang && String(f.type) === dubType,
    );
    const matched = index !== -1 ? source.dubs[index] : null;
    dubLangApplied.current = true;
    useSettingsStore.getState().setValue("Audio Dub", {
      display: matched?.name ?? source.dubs[0].name, // 👈 fallback to first
      id: index !== -1 ? String(index) : "0",
      type: dubType,
      value: matched?.lang ?? source.dubs[0].lang, // 👈 fallback to first
    });
  }, [source?.dubs]);

  // user manually picks
  useEffect(() => {
    if (!dub && !type) return;
    dubLangApplied.current = true; // 👈 same ref, locks out both effects above
    handleMarkDub();
  }, [dub, type]);

  useEffect(() => {
    if (!source?.links?.[0]?.resolution) return;

    useSettingsStore.getState().setValue("Source quality", {
      display:
        String(source.links[0].resolution) +
        (source.links[0].resolution === 4 ? "K" : "p"),
      id: "auto",
    });
  }, [source?.links]);

  useEffect(() => {
    if (!source?.links) return;
    if (source?.links.length > 0) handleMarkConnecting();
  }, [source?.links]);

  // Effect 2: Handle quality change separately
  useEffect(() => {
    if (!playerSrc) return;
    handleQualityChange();
  }, [playerSrc]);

  useEffect(() => {
    if (canNext && playback.ended) {
      router.replace(`/player/tv/${tmdbId}/${nextSeason}/${nextEpisode}`);
    }
  }, [playback.ended]);

  // console.log("sds", servers[serverIndex].status);

  useEffect(() => {
    if (!mergeSubtitles.length) return;

    const exactMatch = [...mergeSubtitles]
      .reverse()
      .find((s) => s.display.toLowerCase() === subLang);
    const fuzzyMatch = mergeSubtitles.find((s) =>
      s.display.toLowerCase().includes(subLang),
    );
    const chosen = exactMatch ?? fuzzyMatch;

    useSettingsStore.getState().setValue("Subtitles", {
      display: chosen?.display ?? "Off",
      id: chosen?.id ?? "off",
      file: chosen?.file,
    });
    useSettingsStore.getState().setValue("Dual subtitles", {
      display: "Off",
      id: "off",
    });
  }, [mergeSubtitles.length]);

  useAdsScript({
    enabled: metadataLoad,
    platform: "profiton",
  });

  useKeyboardControls({ controls, setDoubleTapSide });
  // useEffect(() => {
  //   // If not in an iframe, mark as checked immediately (no sandbox to worry about)
  //   if (window.self === window.top) {
  //     setCheckedSandbox(true);
  //     return;
  //   }

  //   // Inside an iframe — defer the popup test to first click as before
  // }, []);
  // ─── Interactions ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (playback.canPlay) {
      setShowServer(false);
      resetTimer();
    } else {
      setShowServer(true);
      lockTimer();
    }
  }, [playback.canPlay]);

  const handleDoubleTap = useDoubleTap(
    (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const side = e.clientX - rect.left < rect.width / 2 ? "left" : "right";
      controls.skipBy(side === "left" ? -15 : 15);
      setDoubleTapSide(side);
      resetTimer();
      setTimeout(() => setDoubleTapSide(null), 600);
    },
    250,
    {
      onSingleTap: () => {
        if (isMobile) {
          setIsVisible((prev) => !prev);
        } else {
          controls.togglePlay();
          resetTimer();
        }
      },
    },
  );
  // useEffect(() => {
  //   if (!isRateLimited && !isSourceRateLimited) return;
  //   if (cooldown > 0) return; // Don't restart if already counting down

  //   setCooldown(10);
  // }, [isRateLimited, isSourceRateLimited]);
  useEffect(() => {
    if (
      !isRateLimited &&
      !isSourceRateLimited &&
      !isForbidden &&
      !isSourceForbidden
    )
      return;
    if (cooldown > 0) return;

    setCooldown(10);
  }, [isRateLimited, isSourceRateLimited, isForbidden, isSourceForbidden]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  // const handleTryAgain = () => {
  //   if (cooldown > 0) return;
  //   setCooldown(10);
  //   if (isRateLimited) {
  //     refetchTmdb();
  //   }
  //   if (isSourceRateLimited) {
  //     refetchSource();
  //   }
  // };

  const handleTryAgain = () => {
    if (cooldown > 0) return;
    setCooldown(10);
    if (isRateLimited || isForbidden) {
      refetchTmdb();
    }
    if (isSourceRateLimited || isSourceForbidden) {
      refetchSource();
    }
  };

  useEffect(() => {
    if (retryCooldown <= 0) return;

    const timer = setTimeout(() => {
      setRetryCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [retryCooldown]);
  const handleMetadataRetry = () => {
    if (retryCooldown > 0) return;

    setRetryCooldown(10);
    refetchTmdb();
  };
  // console.log(
  //   "restricted",
  //   restricted,
  //   "restrictionActive",
  //   restrictionActive,
  //   "isSandboxed",
  //   isSandboxed,
  // );
  // console.log(restricted && restrictionActive && isSandboxed);

  // useEffect(() => {
  //   if (webstatsTracked.current) return;
  //   if (!loaded || !metadataLoad) return;

  //   webstatsTracked.current = true;

  //   if (media_type === "tv") {
  //     window.webstats?.("content", {
  //       type: "tvshow",
  //       ids: { tmdb: tmdbId },
  //       title,
  //       episode: {
  //         season: Number(season),
  //         number: Number(episode),
  //       },
  //     });
  //   } else {
  //     window.webstats?.("content", {
  //       type: "movie",
  //       ids: { tmdb: tmdbId },
  //       title,
  //     });
  //   }
  // }, [loaded, metadataLoad, media_type, tmdbId, title, season, episode]);

  // if (!startPlayer) {
  //   return (
  //     <div className="h-dvh flex justify-center items-center">
  //       <button
  //         onClick={() => setStartPlayer(true)}
  //         className="cursor-pointer animate-pulse"
  //       >
  //         <Play className="size-13" strokeWidth={3} />
  //       </button>
  //     </div>
  //   );
  // }
  if (isLoading) {
    return <div className="bg-black  h-svh flex justify-center items-center" />;
  }
  if (!isWhitelisted && isSandboxed) {
    return (
      <div
        className={cn(
          " h-screen flex flex-col justify-center items-center gap-6 bg-background relative overflow-hidden",
        )}
      >
        {back && !playback.canPlay && (
          <button onClick={() => router.back()} className="cursor-pointer">
            <ArrowLeftIcon className="absolute lg:top-4 top-3 lg:left-6 left-2 lg:size-13  md:size-10 size-8  landscape:size-5.5 text-muted-foreground z-30" />
          </button>
        )}
        <div className="absolute w-64 h-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none animate-pulse" />
        <div className="relative z-10 text-center px-4">
          <div className="space-y-2">
            <div>
              <span className="font-bold lg:text-xl md:text-lg text-base landscape:text-sm">
                ༼;´༎ຶ ۝ ༎ຶ༽
              </span>
            </div>

            <p className="lg:text-2xl md:text-xl text-lg landscape:text-base -tracking-[0.04em] font-semibold mt-6 landscape:mt-1">
              Sandbox Not Supported
            </p>

            <p className="text-muted-foreground lg:text-lg text-sm font-medium landscape:text-xs max-w-xl mt-3">
              Contact the website owner to remove the{" "}
              <code className="mx-1">sandbox</code>
              attribute or allow this player to run without sandbox
              restrictions.
            </p>
          </div>
        </div>

        <div className="absolute md:bottom-4 bottom-2 text-center md:text-sm text-xs  text-muted-foreground">
          If you're the website owner, join us on{" "}
          <Link
            href="https://discord.gg/yv7wJV97Jd"
            target="_blank"
            className="text-blue-400 underline hover:text-blue-300"
          >
            Discord
          </Link>
          .
        </div>
      </div>
    );
  }
  if (isRateLimited || isSourceRateLimited) {
    return (
      <div
        className={cn(
          " h-screen flex flex-col justify-center items-center gap-6 bg-background relative overflow-hidden",
        )}
      >
        <div className="absolute w-64 h-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none animate-pulse" />
        <div className="relative z-10 text-center px-4">
          <div className="space-y-4 landscape:space-y-2">
            <div className="flex flex-col items-center justify-center space-y-2 landscape:space-y-1">
              <div className="flex items-center justify-center rounded-full bg-orange-500/10 p-3 ring-1 ring-orange-500/20 landscape:p-1.5">
                <ClockAlert className="size-8 text-orange-500 md:size-10 landscape:size-4" />
              </div>

              <p className="text-lg font-semibold tracking-tight md:text-2xl landscape:text-sm">
                Too Many Requests
              </p>
            </div>

            <p className="mx-auto max-w-xl text-sm font-medium text-muted-foreground md:text-lg landscape:text-xs">
              You've made too many requests too quickly. Please wait a few
              seconds before trying again.
            </p>

            <div className="mx-auto w-fit rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-2.5 landscape:px-2 landscape:py-1">
              <p className="text-sm font-semibold text-orange-500 md:text-base landscape:text-[10px]">
                Please wait and try again.
              </p>
            </div>
          </div>
          <Button
            variant={cooldown ? "outline" : "secondary"}
            className="mt-6"
            onClick={handleTryAgain}
            disabled={cooldown > 0}
          >
            <RotateCw className={cn(cooldown > 0 && "animate-spin")} />{" "}
            {cooldown > 0 ? `Try Again (${cooldown}s)` : "Try Again"}
          </Button>
        </div>

        <SocialLinks />
      </div>
    );
  }
  if (isForbidden || isSourceForbidden) {
    return (
      <div
        className={cn(
          " h-screen flex flex-col justify-center items-center gap-6 bg-background relative overflow-hidden",
        )}
      >
        <div className="absolute w-64 h-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none animate-pulse" />
        <div className="relative z-10 text-center px-4">
          <div className="space-y-4 landscape:space-y-2">
            <div className="flex flex-col items-center justify-center space-y-2 landscape:space-y-1">
              <div className="flex items-center justify-center rounded-full bg-yellow-500/10 p-3 ring-1 ring-yellow-500/20 landscape:p-1.5">
                <HatGlasses className="size-8 text-yellow-500 md:size-10 landscape:size-4" />
              </div>

              <p className="text-lg font-semibold tracking-tight md:text-2xl landscape:text-sm">
                VPN Detected
              </p>
            </div>

            <p className="mx-auto max-w-xl text-sm font-medium text-muted-foreground md:text-lg landscape:text-xs">
              Your VPN or proxy IP address is currently blocked due to abuse.
            </p>

            <div className="mx-auto w-fit rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 landscape:px-2 landscape:py-1">
              <p className="text-sm font-semibold text-yellow-500 md:text-base landscape:text-[10px]">
                Please disconnect your VPN and try again.
              </p>
            </div>

            <p className="mx-auto max-w-xl text-sm font-medium text-muted-foreground md:text-lg landscape:text-xs">
              Not using a VPN? Try disabling your proxy, switching networks, or
              using another browser.
            </p>
          </div>
          <Button
            variant={cooldown ? "outline" : "secondary"}
            className="mt-6"
            onClick={handleTryAgain}
            disabled={cooldown > 0}
          >
            <RotateCw className={cn(cooldown > 0 && "animate-spin")} />{" "}
            {cooldown > 0 ? `Try Again (${cooldown}s)` : "Try Again"}
          </Button>
        </div>

        <SocialLinks />
      </div>
    );
  }
  if (isMetadataError) {
    return (
      <div
        className={cn(
          " h-screen flex flex-col justify-center items-center gap-6 bg-background relative overflow-hidden",
        )}
      >
        <div className="absolute w-64 h-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none animate-pulse" />
        <div className="relative z-10 text-center px-4">
          <div className="space-y-4 landscape:space-y-2">
            <div className="flex flex-col items-center justify-center space-y-2 landscape:space-y-1">
              <div className="flex items-center justify-center rounded-full bg-muted/50 p-3 ring-1 ring-border landscape:p-1.5">
                <SearchX className="size-8 text-muted-foreground md:size-10 landscape:size-4" />
              </div>

              <p className="text-lg font-semibold tracking-tight md:text-2xl landscape:text-sm">
                No Resources Found
              </p>
            </div>

            <p className="mx-auto max-w-xl text-sm font-medium text-muted-foreground md:text-lg landscape:text-xs">
              Nothing to stream here. The resource you're looking for doesn't
              exist or has been removed.
            </p>

            <div className="mx-auto w-fit rounded-lg border border-border bg-muted/30 px-4 py-2.5 landscape:px-2 landscape:py-1">
              <p className="text-sm font-medium text-muted-foreground md:text-base landscape:text-[10px]">
                Try again or check back later.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleMetadataRetry}
            disabled={retryCooldown > 0}
            className="mt-8 landscape:text-xs landscape:px-2 landscape:py-1 gap-2"
          >
            <RefreshCcw
              className={cn("size-4", retryCooldown > 0 && "animate-spin")}
            />
            {retryCooldown > 0 ? `Try Again (${retryCooldown}s)` : "Try Again"}
          </Button>
        </div>

        <SocialLinks />
      </div>
    );
  }
  if (allFailed) {
    return (
      <div
        className={cn(
          "h-screen flex flex-col justify-center items-center gap-6 bg-background relative overflow-hidden",
        )}
      >
        {back && !playback.canPlay && (
          <button onClick={() => router.back()} className="cursor-pointer">
            <ArrowLeftIcon className="absolute lg:top-4 top-3 lg:left-6 left-2 lg:size-13  md:size-10 size-8  landscape:size-5.5 text-muted-foreground z-30" />
          </button>
        )}

        <div className="absolute w-64 h-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none animate-pulse" />
        <div className="relative z-10 text-center px-4">
          <div className="space-y-4 landscape:space-y-2">
            <div className="flex flex-col items-center justify-center space-y-2 landscape:space-y-1">
              <div className="flex items-center justify-center rounded-full bg-muted/60 p-3 ring-1 ring-border landscape:p-1.5">
                <CloudOff className="size-8 text-muted-foreground md:size-10 landscape:size-4" />
              </div>

              <p className="text-lg font-semibold tracking-tight md:text-2xl landscape:text-sm">
                Unable to Load Content
              </p>
            </div>

            <p className="mx-auto max-w-xl text-sm font-medium text-muted-foreground md:text-lg landscape:text-xs">
              We couldn't find a working server for this content. It may be
              temporarily unavailable or still processing.
            </p>

            <div className="mx-auto w-fit rounded-lg border border-border bg-muted/40 px-4 py-2.5 landscape:px-2 landscape:py-1">
              <p className="text-sm font-medium text-muted-foreground md:text-base landscape:text-[10px]">
                Please try again later.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            className="mt-6"
            onClick={handleResetServers}
            disabled={serverCooldown > 0}
          >
            <RefreshCcw className={cn(serverCooldown > 0 && "animate-spin")} />
            {serverCooldown > 0
              ? `Try Again (${serverCooldown}s)`
              : "Try Again"}
          </Button>
        </div>

        <SocialLinks />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-svh w-full overflow-hidden bg-black ",
        isVisible ? "" : "cursor-none",
      )}
    >
      {/* <Script
        src="https://a.vidstats.top/js/p.js?s=81b8fdef-01aa-4a35-91b8-562982270e9d"
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
      /> */}

      <AnimatePresence>
        {showFallbackBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "absolute lg:top-4 top-2 inset-x-0  flex justify-center items-center z-30",
            )}
          >
            <div
              className={cn(
                "flex items-center lg:gap-3 md:gap-2 gap-1.5",
                "bg-amber-600/80 backdrop-blur-md rounded-md",
                "text-foreground lg:text-base md:text-sm text-xs  lg:px-4 md:px-3 px-2 lg:py-2.5 py-1.5",
              )}
            >
              <TriangleAlert className="md:size-4 size-3" />
              <h3>Language unavailable, falling back to default.</h3>
              <button
                onClick={() => setShowFallbackBanner(false)}
                className="hover:opacity-70"
              >
                <X className="md:size-4 size-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Video */}
      <div className="h-full w-full">
        <video
          key={playerSrc}
          ref={videoRef}
          onCanPlayThrough={handleCanPlay}
          playsInline
          onError={() => {
            if (source?.links && Number(isAuto) < source.links.length - 1) {
              useSettingsStore.getState().setValue("Source quality", {
                display: "Auto",
                id: String(Number(isAuto) + 1),
              });

              return;
            }

            handleServerFail();
          }}
          autoPlay={auto_play && autoplay === "on"}
          muted={auto_play && autoplay === "on"}
          className={cn(
            "absolute inset-0 w-full h-full transition-opacity duration-700 mx-auto brightness-200",
            servers[serverIndex].status === "available"
              ? "opacity-100"
              : "opacity-0",
            mirror === "on" && "-scale-x-100",
            aspectRatio === "fill" && "object-fill",
            aspectRatio === "4:3" && "object-contain max-w-[calc(100vh*4/3)]",
            aspectRatio === "21:9" && "object-contain max-w-[calc(100vh*21/9)]",
            aspectRatio === "16:9" && "object-contain",
            brightness === "50%" && "brightness-50",
            brightness === "75%" && "brightness-75",
            brightness === "100%" && "brightness-100",
            brightness === "125%" && "brightness-125",
            brightness === "150%" && "brightness-150",
            brightness === "200%" && "brightness-200",
          )}
        />
      </div>

      {/* Backdrop (shown while buffering) */}
      <AnimatePresence mode="wait">
        {!playback.canPlay && backdrop && (
          <motion.img
            key={backdrop}
            src={`https://image.tmdb.org/t/p/original/${backdrop}`}
            alt=""
            className="fixed inset-0 h-full w-full object-cover"
            initial={{
              opacity: 0,
              filter: "grayscale(1) contrast(1.3) brightness(0.75)",
            }}
            animate={{
              opacity: 1,
              filter:
                servers[serverIndex].status === "checking" ||
                servers[serverIndex].status === "queue"
                  ? "grayscale(1) contrast(1.3) brightness(0.75)"
                  : "grayscale(0)",
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>
      {back && !playback.canPlay && (
        <button onClick={() => router.back()} className="cursor-pointer">
          <ArrowLeftIcon className="absolute lg:top-4 top-3 lg:left-6 left-2 lg:size-13  md:size-10 size-8  landscape:size-5.5 text-muted-foreground z-30" />
        </button>
      )}
      {playback.playing && playback.canPlay && (
        <SkipSegment
          className="absolute  lg:bottom-32  lg:right-7 md:bottom-23 md:right-5 bottom-27 right-3 z-60 landscape:bottom-20"
          currentTime={currentTime}
          intro={introData?.intro}
          outro={introData?.outro}
          onSkip={controls.skipTo}
        />
      )}

      {/* Loading tip */}
      {!playback.canPlay && <DynamicTip />}

      {/* Pause overlay */}
      <AnimatePresence>
        {metadata && !playback.playing && !isVisible && playback.canPlay && (
          <Pause metadata={metadata} color={color} />
        )}
      </AnimatePresence>

      {logo && !isMobile && !playback.canPlay && (
        <LoadingMetadata logo={logo} />
      )}
      {/* Double tap indicator */}
      <AnimatePresence>
        {doubleTapSide && playback.canPlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={`absolute top-0 bottom-0 w-1/2 flex items-center justify-center z-20 pointer-events-none ${
              doubleTapSide === "left" ? "left-0" : "right-0"
            }`}
          >
            <span className="text-3xl landscape:text-xs font-medium text-white">
              {doubleTapSide === "left" ? "−15s" : "+15s"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buffering spinner */}
      <div
        className={cn(
          "absolute -translate-y-1/2 top-1/2 -translate-x-1/2 left-1/2 z-30 transition-opacity duration-300",
          playback.waiting && playback.canPlay
            ? "opacity-100"
            : "opacity-0 pointer-events-none",
        )}
      >
        <Tailspin size="60" stroke="8" speed="0.9" color="white" />
      </div>

      {/* Subtitles */}
      {cCToggle && playback.canPlay && playback.playing && (
        <>
          <SubtitleOverlay
            subtitleUrl={subtitleUrl}
            currentTime={currentTime}
            isVisible={isVisible}
            domain={domain}
          />
          <SubtitleOverlay
            subtitleUrl={dualSubtitleUrl}
            currentTime={currentTime}
            position="top"
            isVisible={isVisible}
            domain={domain}
          />
        </>
      )}

      {/* Touch / pointer interaction layer */}
      {playback.canPlay && (
        <div
          className="absolute inset-0"
          onPointerMove={resetTimer}
          {...handleDoubleTap}
        />
      )}

      {/* Server picker */}
      <AnimatePresence>
        {(isVisible || !playback.canPlay) && showServer && (
          <LyricsServerPicker
            servers={servers}
            playingIndex={playingIndex}
            activeIndex={serverIndex}
            onSelect={handleManualSelect}
            lockTimer={lockTimer}
          />
        )}
      </AnimatePresence>

      {/* Main controls */}
      <AnimatePresence>
        {isVisible && playerSrc && playback.canPlay && (
          <MainControls
            currentTime={currentTime}
            duration={duration}
            buffered={buffered}
            playback={playback}
            ui={ui}
            controls={controls}
            playerSrc={playerSrc}
            tmdbId={tmdbId}
            imdbId={imdbId}
            season={season}
            episode={episode}
            media_type={media_type}
            skipBy={controls.skipBy}
            year={year}
            genre={genre}
            quality={quality}
            audioTracks={audioTracks}
            mergeSubtitles={mergeSubtitles}
            dubs={dubs}
            title={title}
            onPip={controls.togglePip}
            cCToggle={cCToggle}
            setCcToggle={setCcToggle}
            resetTimer={resetTimer}
            lockTimer={lockTimer}
            seasons={seasons}
            source={source?.links ?? []}
            color={color}
            back={back}
            canNext={canNext}
            nextEpisode={nextEpisode}
            nextSeason={nextSeason}
            showServer={showServer}
            setShowServer={setShowServer}
            introData={introData}
            status={status}
            episodeSelector={episodeSelector}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
function SocialLinks() {
  return (
    <div className="absolute bottom-8 right-8 flex flex-col gap-6 border p-1 bg-white/5 rounded-md">
      <button className="text-[#5865F2] md:size-8 size-6">
        <Link href="https://discord.gg/yv7wJV97Jd" target="_blank">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-full h-full icon icon-tabler icons-tabler-filled icon-tabler-brand-discord"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M14.983 3l.123 .006c2.014 .214 3.527 .672 4.966 1.673a1 1 0 0 1 .371 .488c1.876 5.315 2.373 9.987 1.451 12.28c-1.003 2.005 -2.606 3.553 -4.394 3.553c-.732 0 -1.693 -.968 -2.328 -2.045a21.512 21.512 0 0 0 2.103 -.493a1 1 0 1 0 -.55 -1.924c-3.32 .95 -6.13 .95 -9.45 0a1 1 0 0 0 -.55 1.924c.717 .204 1.416 .37 2.103 .494c-.635 1.075 -1.596 2.044 -2.328 2.044c-1.788 0 -3.391 -1.548 -4.428 -3.629c-.888 -2.217 -.39 -6.89 1.485 -12.204a1 1 0 0 1 .371 -.488c1.439 -1.001 2.952 -1.459 4.966 -1.673a1 1 0 0 1 .935 .435l.063 .107l.651 1.285l.137 -.016a12.97 12.97 0 0 1 2.643 0l.134 .016l.65 -1.284a1 1 0 0 1 .754 -.54l.122 -.009zm-5.983 7a2 2 0 0 0 -1.977 1.697l-.018 .154l-.005 .149l.005 .15a2 2 0 1 0 1.995 -2.15zm6 0a2 2 0 0 0 -1.977 1.697l-.018 .154l-.005 .149l.005 .15a2 2 0 1 0 1.995 -2.15z" />
          </svg>
        </Link>
      </button>

      {/* <button className="text-[#0088CC] md:size-8 size-6">
            <Link href="https://discord.gg/yv7wJV97Jd" target="_blank">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-full h-full icon icon-tabler icons-tabler-outline icon-tabler-brand-telegram"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M15 10l-4 4l6 6l4 -16l-18 7l4 2l2 6l3 -4" />
              </svg>
            </Link>
          </button> */}
    </div>
  );
}
