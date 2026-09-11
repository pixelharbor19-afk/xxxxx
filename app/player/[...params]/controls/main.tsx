import { ArrowLeftIcon } from "@/components/icons/arrow";
import { CcOffIcon, CcOnIcon } from "@/components/icons/cc";
import { MaximizeIcon, MinimizeIcon } from "@/components/icons/fullscreen";
import { PauseIcon, PlayIcon } from "@/components/icons/play-pause";
import { VolumeOffIcon, VolumeOnIcon } from "@/components/icons/volume";
import { Slider } from "@/components/ui/slider";
import Settings from "@/app/player/[...params]/controls/index";
import {
  AudioTrackTypes,
  QualityLevel,
  VideoPlayerControls,
  VideoPlayerState,
} from "../useVideoPlayer";
import { MediaOption } from "@/hooks/open-subtitle";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/format-time";
import { AnimatePresence, motion } from "framer-motion";
import Episodes from "../episodes";
import { useRouter, useSearchParams } from "next/navigation";
import { DubTypes, QualityTrack } from "@/hooks/sauce";
import Link from "next/link";
import { Cloud, Inbox, Layers2, Server, TextAlignEnd } from "lucide-react";

import { cn } from "@/lib/utils";
import { SeasonsType } from "@/hooks/tmdb-types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IntroTypesResponse } from "@/hooks/intro";
import { EpisodesIcon } from "@/components/icons/episodes";
export interface VideoControlsProps {
  currentTime: number;
  duration: number;
  buffered: number;

  playback: {
    playing: boolean;
    waiting: boolean;
    ended: boolean;
    canPlay: boolean;
  };

  ui: {
    volume: number;
    muted: boolean;
    fullscreen: boolean;
    pip: boolean;
  };
  controls: VideoPlayerControls;
  playerSrc: string | null;
  tmdbId: string;
  imdbId: string | null;
  season: number;
  episode: number;
  media_type: string;
  skipBy: (skip: number) => void;
  year: string;
  genre: string;
  status: string;
  //
  quality: QualityLevel[];
  audioTracks: AudioTrackTypes[];
  //

  mergeSubtitles: MediaOption[];
  dubs: DubTypes[];
  //
  title: string;
  //
  onPip: () => void;
  //
  cCToggle: boolean;
  setCcToggle: Dispatch<SetStateAction<boolean>>;

  //
  resetTimer: () => void;
  lockTimer: () => void;
  //
  seasons: SeasonsType[];

  source: QualityTrack[];
  //
  color: string;
  back: boolean;

  canNext: boolean;
  nextSeason: number;
  nextEpisode: number;

  showServer: boolean;
  setShowServer: Dispatch<SetStateAction<boolean>>;

  introData: IntroTypesResponse | undefined;
  episodeSelector: boolean;
}
export default function MainControls({
  currentTime,
  duration,
  buffered,
  playback,
  ui,
  controls,
  playerSrc,
  tmdbId,
  imdbId,
  season,
  episode,
  media_type,
  skipBy,
  year,
  genre,
  status,
  //
  quality,
  audioTracks,
  //

  mergeSubtitles,
  dubs,
  //

  title,
  //
  onPip,
  //
  cCToggle,
  setCcToggle,
  //
  resetTimer,
  lockTimer,
  //
  seasons,
  //
  source,
  color,
  back,

  ///
  canNext,
  nextEpisode,
  nextSeason,
  showServer,
  setShowServer,

  introData,
  episodeSelector,
}: VideoControlsProps) {
  const router = useRouter();
  const sliderRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const [hoverX, setHoverX] = useState(0);
  const [open, setOpen] = useState(false);
  const [selectSeason, setSeasonSelect] = useState(season);

  const handleSliderHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderRef.current || !duration) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const percent = Math.min(Math.max(x / rect.width, 0), 1);
    const time = percent * duration;

    setHoverX(x);
    setHoverTime(time);
  };
  const clearHover = () => {
    setHoverTime(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "z-50 absolute inset-0",
        "flex flex-col justify-between",
        "pointer-events-none",
        "bg-linear-to-b from-black/30 via-transparent to-black/80",

        "after:absolute after:inset-0 after:content-['']",
        "after:bg-linear-to-bl after:from-transparent after:via-transparent after:to-black/50",
      )}
      onPointerMove={lockTimer}
      onPointerDown={lockTimer}
    >
      <div
        className={cn(
          "lg:p-4 p-3  landscape:p-2",
          "flex justify-between items-center",
          "z-30",
        )}
      >
        {back ? (
          <button
            onClick={() => router.back()}
            className="cursor-pointer pointer-events-auto"
          >
            <ArrowLeftIcon
              className={cn(
                "lg:size-13 md:size-10 size-10 landscape:size-7",
                "text-muted-foreground",
              )}
            />
          </button>
        ) : (
          <div className="hidden md:block"></div>
        )}
        {/* UPPER */}
        <div
          className={cn("md:hidden landscape:block", back ? "text-center" : "")}
        >
          <p className={cn("text-xs landscape:text-[0.6rem]", "text-gray-400")}>
            Your'e Watching
          </p>
          <h1 className="text-base landscape:text-sm font-semibold">
            {title} {media_type === "tv" ? `S${season}E${episode}` : ""}
          </h1>
        </div>
        <div className="flex items-center gap-6">
          {open && media_type === "tv" && (
            <div className="cursor-pointer pointer-events-auto">
              <Select
                value={String(selectSeason)}
                onValueChange={(val) => setSeasonSelect(Number(val))}
              >
                <SelectTrigger className="w-full backdrop-blur-md">
                  <SelectValue placeholder="Select season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {seasons.map((s) => (
                      <SelectItem
                        key={s.season_number}
                        value={String(s.season_number)}
                      >
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
          <button
            onClick={() => setShowServer((prev) => !prev)}
            className="cursor-pointer pointer-events-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
          >
            <Inbox
              strokeWidth={3}
              className={cn(
                "lg:size-8 md:size-7 size-6.5 landscape:size-5 ",
                showServer ? "text-foreground" : "text-gray-300",
              )}
            />
          </button>
        </div>
      </div>
      <div
        className={cn(
          "w-full ",
          "lg:p-4 p-3 landscape:p-2",
          "lg:py-6 py-3",
          "space-y-2 ",
          "z-30",
        )}
      >
        <div
          className={cn(
            "pointer-events-none",
            "hidden md:block landscape:hidden",
            "lg:p-3 landscape:p-2 md:p-2",
          )}
        >
          <span className={cn("flex lg:gap-3 gap-1.5 items-center")}>
            <div
              className={cn("lg:w-1 w-0.5 lg:h-5 h-3 rounded-full")}
              style={{ backgroundColor: `#${color}` }}
            ></div>
            <p
              className={cn(
                "lg:text-base md:text-sm text-gray-400 tracking-wide",
                "[text-shadow:0_2px_4px_rgba(0,0,0,0.5)]",
              )}
            >
              You're Watching
            </p>
          </span>
          <h1
            className={cn(
              "text-[clamp(1.5rem,2.3vw,2rem)]",
              " md:mt-1",
              "font-bold tracking-wide",
              "[text-shadow:0_2px_4px_rgba(0,0,0,0.5)]",
            )}
          >
            {title} {media_type === "tv" ? `S${season}E${episode}` : ""} ({year}
            )
          </h1>
          <div
            className={cn(
              "lg:text-lg md:text-sm",
              "text-gray-300 font-medium",
              "md:mt-2",
              "flex gap-3",
              "[text-shadow:0_2px_4px_rgba(0,0,0,0.5)]",
            )}
          >
            <p>{media_type === "tv" ? "TV Show" : "Movie"}</p> /<p>{genre}</p>/
            <p>{status}</p>
          </div>
        </div>

        <div
          className={cn(
            "space-y-3 landscape:space-y-0.5",
            "pointer-events-auto",
          )}
        >
          <div
            className={cn(
              "space-y-2 landscape:space-y-1",
              "md:px-2 lg:px-3 landscape:px-2",
            )}
          >
            <div
              className={cn(
                "group",
                "lg:h-4 h-2",
                "flex justify-center items-center",
              )}
            >
              <div
                className="relative w-full"
                ref={sliderRef}
                onMouseMove={handleSliderHover}
                onMouseLeave={clearHover}
              >
                <Slider
                  value={[currentTime]}
                  max={duration || 1}
                  step={0.1}
                  buffered={buffered}
                  onValueChange={(value) => controls.handleSeekChange(value)}
                  onValueCommit={(value) => controls.handleSeekCommit(value)}
                  color={color}
                  intro={introData?.intro}
                  outro={introData?.outro}
                  showTooltip={true}
                />
              </div>
            </div>
            <div
              className={cn(
                "md:hidden",
                "flex justify-between",
                "text-sm landscape:text-xs",
                "[text-shadow:0_2px_4px_rgba(0,0,0,0.5)]",
              )}
            >
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <div
            className={cn(
              "flex md:justify-between justify-center items-center",
              "w-full",
              "lg:gap-3 gap-6",
            )}
          >
            <div className={cn("flex items-center md:gap-3 gap-6")}>
              <button
                onClick={controls.togglePlay}
                className="text-white/80 hover:text-white cursor-pointer   drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
              >
                {playback.playing ? (
                  <motion.div
                    key="pause"
                    initial={{ opacity: 0, scale: 1.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.3 }}
                    transition={{ duration: 0.1 }}
                  >
                    <PauseIcon
                      className={cn(
                        "lg:size-13 md:size-10 size-9 landscape:size-7",
                      )}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="play"
                    initial={{ opacity: 0, scale: 1.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.3 }}
                    transition={{ duration: 0.1 }}
                  >
                    <PlayIcon
                      className={cn(
                        "lg:size-13 md:size-10 size-9 landscape:size-7",
                      )}
                    />
                  </motion.div>
                )}
              </button>

              <div className="flex items-center gap-2 group">
                <button
                  onClick={controls.toggleMute}
                  className="text-white/80 hover:text-white cursor-pointer drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                >
                  {ui.muted || ui.volume === 0 ? (
                    <motion.div
                      key="muted"
                      initial={{ opacity: 0, scale: 1.3 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.3 }}
                      transition={{ duration: 0.1 }}
                    >
                      <VolumeOffIcon
                        className={cn(
                          "lg:size-13 md:size-10 size-9 landscape:size-7",
                        )}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="unmuted"
                      initial={{ opacity: 0, scale: 1.3 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.3 }}
                      transition={{ duration: 0.1 }}
                    >
                      <VolumeOnIcon
                        className={cn(
                          "lg:size-13 md:size-10 size-9 landscape:size-7",
                        )}
                      />
                    </motion.div>
                  )}
                </button>
                <Slider
                  value={[ui.muted ? 0 : ui.volume]}
                  min={0}
                  max={1}
                  step={0.02}
                  onValueChange={([v]) => controls.setVolume(v)}
                  className={cn(
                    "w-0 group-hover:w-24",
                    "transition-[width] duration-200 ease-in-out",
                    "hidden md:flex",
                  )}
                  color={color}
                />
              </div>
              <div
                className={cn(
                  "md:flex hidden",
                  "lg:gap-2 gap-1 items-center",
                  "lg:ml-2",
                  "lg:text-base text-sm",
                )}
              >
                <span>{formatTime(currentTime)}</span>/
                <span>{formatTime(duration)}</span>
              </div>

              {media_type === "tv" && canNext && (
                <Link
                  className={cn(
                    "cursor-pointer text-muted-foreground hover:text-foreground transition duration-200",
                    "hidden lg:block",
                  )}
                  href={`/player/tv/${tmdbId}/${nextSeason}/${nextEpisode}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}
                  replace
                >
                  Next Episode S{nextSeason}-E{nextEpisode}
                </Link>
              )}
            </div>

            <div className={cn("flex items-center md:gap-3 gap-6")}>
              <Settings
                mergeSubtitles={mergeSubtitles}
                quality={quality}
                audioTracks={audioTracks}
                onPip={onPip}
                imdbId={imdbId}
                season={season}
                episode={episode}
                media_type={media_type}
                resetTimer={resetTimer}
                lockTimer={lockTimer}
                source={source}
                dubs={dubs}
              />
              {media_type === "tv" && episodeSelector && (
                <button
                  onClick={() => {
                    setOpen((prev) => !prev);
                    lockTimer();
                  }}
                  onPointerMove={lockTimer}
                  onPointerDown={lockTimer}
                  className={cn(
                    "lg:-translate-y-0.5  text-white/80 hover:text-white cursor-pointer drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]",
                    open ? "text-foreground" : "",
                  )}
                >
                  <EpisodesIcon className="lg:size-9.5 md:size-7 size-7.5 landscape:size-6" />
                </button>
              )}
              {/* <button
                onClick={controls.toggleFullscreen}
                className="cursor-pointer text-white/80 hover:text-white"
              >
                <Lock
                  strokeWidth={3}
                  className={cn(
                    "lg:size-9 md:size-7 size-6 landscape:size-4.5",
                  )}
                />
              </button> */}
              <button
                onClick={controls.toggleFullscreen}
                className="cursor-pointer text-white/80 hover:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
              >
                {ui.fullscreen ? (
                  <motion.div
                    key="minimize"
                    initial={{ opacity: 0, scale: 1.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.3 }}
                    transition={{ duration: 0.1 }}
                  >
                    <MinimizeIcon
                      className={cn(
                        "lg:size-13 md:size-10 size-9 landscape:size-7",
                      )}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="maximize"
                    initial={{ opacity: 0, scale: 1.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.3 }}
                    transition={{ duration: 0.1 }}
                  >
                    <MaximizeIcon
                      className={cn(
                        "lg:size-13 md:size-10 size-9 landscape:size-7",
                      )}
                    />
                  </motion.div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      {media_type === "tv" && episodeSelector && (
        <Episodes
          tmdbId={tmdbId}
          season={season}
          episode={episode}
          lockTimer={lockTimer}
          resetTimer={resetTimer}
          seasons={seasons}
          open={open}
          setOpen={setOpen}
          selectSeason={selectSeason}
          color={color}
        />
      )}
    </motion.div>
  );
}
