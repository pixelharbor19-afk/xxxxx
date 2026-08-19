import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { useSettingsStore } from "@/zustand/settings-store";
import { useVideoProgressStore } from "@/zustand/videoProgressStore";
import { stat } from "fs";
export interface VideoPlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  fullscreen: boolean;
  pip: boolean;
  waiting: boolean;
  ended: boolean;
  canPlay: boolean;
}
export interface QualityLevel {
  bitrate: number;
  height: number;
  width: number;
  frameRate: number;
  id: number;
  name?: string;
  url: string[];
}
export interface VideoPlayerControls {
  togglePlay: () => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  togglePip: () => void;
  skipBy: (seconds: number) => void;
  seek: (time: number) => void;
  handleSeekChange: (value: number[]) => void;
  handleSeekCommit: (value: number[]) => void;
  skipTo: (time: number) => void;
  skipToTime: (seconds: number) => void;
}
export interface AudioTrackTypes {
  id: number;
  name: string;
  lang?: string;
  groupId: string;
  default?: boolean;
  autoselect?: boolean;
}

export interface SubtitleTrackTypes {
  id: number;
  name: string;
  lang?: string;
  groupId: string;
  default: boolean;
  autoselect: boolean;
  forced: boolean;
}

export function useVideoPlayer({
  playerSrc,
  srcType,
  serverIndex,
  progressKey,
  initialMuted = false,
  enableSaveProgress = true, // ← new
  enableLoadProgress = true, // ← new
  load,
  handleServerFail,
}: {
  playerSrc: string | null;
  srcType: string;
  serverIndex: number;
  progressKey: string;
  initialMuted?: boolean;
  enableSaveProgress?: boolean; // ← new
  enableLoadProgress?: boolean; // ← new
  load?: number;
  handleServerFail: () => void;
}) {
  const isEmbedded = window.self !== window.top;
  const [quality, setQuality] = useState<QualityLevel[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrackTypes[]>([]);

  const qualityId = useSettingsStore((s) => s.values["Quality"]?.id ?? "auto");
  const audioId = useSettingsStore((s) => s.values["Audio track"]?.id ?? null);

  // === NEW SPLIT STATES ===
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);

  const [playback, setPlayback] = useState({
    playing: false,
    waiting: false,
    ended: false,
    canPlay: false,
  });

  const [ui, setUi] = useState({
    volume: 1,
    muted: initialMuted,
    fullscreen: false,
    pip: false,
  });

  // ========================
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSeekingRef = useRef(false);
  const hlsRef = useRef<Hls | null>(null);
  const hasRestoredRef = useRef(false);
  const lastPostRef = useRef(0);
  const lastSaveRef = useRef(0);
  const has90PercentFiredRef = useRef(false);
  const lastSavedTimeRef = useRef(0);
  //TESTING PURPOSE
  const effectRunCount = useRef(0);
  //
  const playbackSpeed = useSettingsStore(
    (state) => state.values["Playback speed"]?.id ?? "1×",
  );
  const sleepTimer = useSettingsStore(
    (state) => state.values["Sleep timer"]?.id ?? "off",
  );
  const autoplay = useSettingsStore(
    (state) => state.values["Autoplay"]?.id ?? "on",
  );
  const loop = useSettingsStore((state) => state.values["Loop"]?.id ?? "off");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = parseFloat(playbackSpeed); // "1.5×" → 1.5
  }, [playbackSpeed]);

  useEffect(() => {
    hasRestoredRef.current = false;
    has90PercentFiredRef.current = false;
  }, [playerSrc, progressKey, load]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playerSrc) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported() && srcType === "hls") {
      const hls = new Hls();

      hls.loadSource(playerSrc);
      hls.attachMedia(video);

      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        handleServerFail();
      });
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        video.play().catch(() => {});
        setQuality(data.levels);

        useSettingsStore.getState().setValue("Quality", {
          display: "Auto",
          id: "auto",
        });
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const level = hls.levels[data.level];
        if (level) {
          const res = level.height;
          useSettingsStore.getState().setValue("Quality", {
            display: `${res}${res === 2160 ? "K" : "p"}`,
            id: "auto",
          });
        }
      });
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        setAudioTracks(data.audioTracks);
        const first = data.audioTracks[0];
        if (first) {
          useSettingsStore.getState().setValue("Audio track", {
            display: first.lang
              ? `${first.name} (${first.lang.toUpperCase()})`
              : first.name,
            id: "0", // index 0
          });
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else {
      video.src = playerSrc;
      video.load();
      video.play().catch(() => {});
    }
  }, [playerSrc, srcType]);

  useEffect(() => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = qualityId === "auto" ? -1 : Number(qualityId);
  }, [qualityId]);

  useEffect(() => {
    if (!hlsRef.current) return;
    hlsRef.current.audioTrack = audioId === null ? 0 : Number(audioId);
  }, [audioId]);

  useEffect(() => {
    // effectRunCount.current += 1;
    // console.log(`Main video effect ran ${effectRunCount.current} times`, {
    //   playerSrc: !!playerSrc,
    //   progressKey,
    //   serverIndex,
    //   hasHandleServerFail: !!handleServerFail,
    //   timestamp: Date.now(),
    // });
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (isSeekingRef.current) return;

      const time = video.currentTime;

      if (video.duration > 0) {
        const now = Date.now();

        // =========================
        // 💾 SAVE PROGRESS (every 1s)
        // =========================
        if (enableSaveProgress) {
          if (now - lastSaveRef.current >= 1000) {
            lastSaveRef.current = now;
            useVideoProgressStore
              .getState()
              .saveProgress(progressKey, time, video.duration);
          }
        }

        // =========================
        // 📡 POST MESSAGE (every 1s)
        // =========================
        if (isEmbedded && now - lastPostRef.current >= 1000) {
          lastPostRef.current = now;
          window.parent.postMessage(
            {
              type: "VIDEO_PROGRESS",
              payload: {
                progressKey,
                currentTime: time,
                duration: video.duration,
                percent: Math.round((time / video.duration) * 100),
              },
            },
            "*",
          );
        }

        // =========================
        // 📡 POST MESSAGE AT 90%
        // =========================
        if (
          isEmbedded &&
          !has90PercentFiredRef.current &&
          time / video.duration >= 0.9
        ) {
          has90PercentFiredRef.current = true;
          window.parent.postMessage(
            {
              type: "VIDEO_NINETY_PERCENT",
              payload: {
                progressKey,
              },
            },
            "*",
          );
        }
      }

      setCurrentTime(time);
      if (video.ended !== playback.ended) {
        setPlayback((p) => ({ ...p, ended: video.ended }));
      }
    };
    const onDurationChange = () => setDuration(video.duration || 0);

    const onProgress = () =>
      setBuffered(
        video.buffered.length > 0
          ? video.buffered.end(video.buffered.length - 1)
          : 0,
      );

    const onVolumeChange = () =>
      setUi((p) => ({ ...p, volume: video.volume, muted: video.muted }));
    const onWaiting = () => setPlayback((p) => ({ ...p, waiting: true }));

    const onPlaying = () => {
      if (isEmbedded) {
        window.parent.postMessage(
          {
            type: "VIDEO_PLAY",
            payload: {
              progressKey,
            },
          },
          "*",
        );
      }
      setPlayback((p) => ({ ...p, waiting: false, playing: true }));
    };
    const onPause = () => {
      if (isEmbedded) {
        window.parent.postMessage(
          {
            type: "VIDEO_PAUSE",
            payload: {
              progressKey,
            },
          },
          "*",
        );
      }
      setPlayback((p) => ({ ...p, playing: false }));
    };

    const onEnded = () => {
      if (isEmbedded) {
        window.parent.postMessage(
          {
            type: "VIDEO_ENDED",
            payload: {
              progressKey,
            },
          },
          "*",
        );
      }
      if (enableSaveProgress) {
        // ← guard
        useVideoProgressStore.getState().clearProgress(progressKey);
      }
      setPlayback((p) => ({ ...p, playing: false, ended: true }));
    };
    const onPip = () => setUi((p) => ({ ...p, pip: true }));
    const onLeavePip = () => setUi((p) => ({ ...p, pip: false }));
    const onFullscreenChange = () =>
      setUi((p) => ({ ...p, fullscreen: !!document.fullscreenElement }));

    const onCanPlay = () => {
      if (!hasRestoredRef.current) {
        const MIN_RESTORE_SECONDS = 5;

        if (load !== undefined && load > 0) {
          video.currentTime = load;
          setCurrentTime(load);
        } else if (enableLoadProgress) {
          const saved = useVideoProgressStore
            .getState()
            .getProgress(progressKey);
          if (saved && saved.currentTime > MIN_RESTORE_SECONDS) {
            video.currentTime = saved.currentTime;
            setCurrentTime(saved.currentTime);
          }
        }
        hasRestoredRef.current = true;
      }
      setPlayback((p) => ({ ...p, waiting: false, canPlay: true }));
    };

    const onLoadStart = () =>
      setPlayback((p) => ({ ...p, waiting: true, canPlay: false }));
    const onSeeking = () => {
      isSeekingRef.current = true;
    };
    const onSeeked = () => {
      isSeekingRef.current = false;
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("play", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("enterpictureinpicture", onPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadstart", onLoadStart);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("play", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("enterpictureinpicture", onPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadstart", onLoadStart);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [
    playerSrc,
    progressKey,
    load,
    enableSaveProgress,
    enableLoadProgress,
    handleServerFail,
    playback.ended,
  ]);

  useEffect(() => {
    setQuality([]);
    setAudioTracks([]);
    useSettingsStore
      .getState()
      .setValue("Quality", { display: "Auto", id: "auto" });
    useSettingsStore
      .getState()
      .setValue("Source quality", { display: "Auto", id: "auto" });
    useSettingsStore
      .getState()
      .setValue("Audio track", { display: "Default", id: "0" });
    setPlayback((p) => ({
      ...p,
      canPlay: false,
      waiting: true,
      playing: false,
    }));
  }, [serverIndex]); // immediate reset on server switch

  useEffect(() => {
    setPlayback((p) => ({
      ...p,
      canPlay: false,
      waiting: true,
      playing: false,
    }));
  }, [playerSrc]); // catches null → new url transition

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = initialMuted;
  }, []); // runs once on mount

  useEffect(() => {
    if (sleepTimer === "off") return;

    const minutes = Number(sleepTimer);
    const ms = minutes * 60 * 1000;

    const timeout = setTimeout(() => {
      if (!videoRef.current?.paused) {
        videoRef.current?.pause();
      }
      useSettingsStore.getState().setValue("Sleep timer", {
        display: "Off",
        id: "off",
      });
    }, ms);

    return () => clearTimeout(timeout);
  }, [sleepTimer]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.loop = loop === "on";
  }, [loop]);

  const seek = useCallback(
    (time: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = time;
      setCurrentTime(time);
      if (duration > 0 && time >= duration) {
        setPlayback((p) => ({ ...p, ended: true }));
      }
    },
    [duration],
  );

  const controls: VideoPlayerControls = {
    togglePlay: useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      v.paused ? v.play().catch(() => {}) : v.pause();
    }, []),

    setVolume: useCallback((vol: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.volume = Math.max(0, Math.min(1, vol));
      v.muted = vol === 0;
    }, []),

    toggleMute: useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      v.muted = !v.muted;
    }, []),

    // toggleFullscreen: useCallback(() => {
    //   const container = containerRef.current;
    //   if (!container) return;
    //   document.fullscreenElement
    //     ? document.exitFullscreen()
    //     : container.requestFullscreen();
    // }, []),
    toggleFullscreen: useCallback(() => {
      const container = containerRef.current;
      const video = videoRef.current as any;
      if (!container || !video) return;

      if (document.fullscreenElement) {
        document.exitFullscreen();
        return;
      }

      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        // iOS Safari: no container fullscreen support, only the video element
        video.webkitEnterFullscreen();
      }
    }, []),
    togglePip: useCallback(async () => {
      const v = videoRef.current;
      if (!v) return;
      document.pictureInPictureElement
        ? await document.exitPictureInPicture()
        : await v.requestPictureInPicture();
    }, []),

    skipBy: useCallback(
      (seconds: number) => {
        const v = videoRef.current;
        if (!v) return;
        const newTime = Math.max(
          0,
          Math.min(v.currentTime + seconds, v.duration || 0),
        );
        seek(newTime);
      },
      [seek],
    ),

    // Preview thumb position while dragging — does NOT move the video yet
    handleSeekChange: useCallback((value: number[]) => {
      isSeekingRef.current = true;
      setCurrentTime(value[0]);
    }, []),

    // Commit the seek when the user releases the slider
    handleSeekCommit: useCallback(
      (value: number[]) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = value[0];
        setCurrentTime(value[0]);
        if (value[0] < duration) setPlayback((p) => ({ ...p, ended: false }));
      },
      [duration],
    ),

    seek,

    // Alias for seek — moves video to an exact time without resetting ended
    skipTo: useCallback((time: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = time;
      setCurrentTime(time);
    }, []),

    // Same as seek but always clears ended flag
    skipToTime: useCallback(
      (seconds: number) => {
        seek(seconds);
        setPlayback((p) => ({ ...p, ended: false }));
      },
      [seek],
    ),
  };
  return {
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
  };
}
