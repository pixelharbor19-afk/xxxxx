"use client";
import { ServerStatus, ServerTypes } from "@/types/player-types";
import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, Keyboard } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import {
  Ban,
  Wifi,
  WifiOff,
  Clock,
  Loader,
  X,
  Minus,
  SquareCheckBig,
  PlayCircle,
  Cast,
  LoaderCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import "swiper/css";
import { cn } from "@/lib/utils";

type Props = {
  servers: ServerTypes[];
  activeIndex: number;
  onSelect: (i: number) => void;
  playingIndex: number | null;

  lockTimer?: () => void;
};

export function LyricsServerPicker({
  servers,
  activeIndex,
  onSelect,
  playingIndex,

  lockTimer,
}: Props) {
  const swiperRef = useRef<SwiperInstance | null>(null);
  const [visualIndex, setVisualIndex] = useState(activeIndex);

  // Sync swiper when parent changes activeIndex
  useEffect(() => {
    if (!swiperRef.current) return;

    swiperRef.current.slideTo(activeIndex);
    setVisualIndex(activeIndex);
  }, [activeIndex]);

  const handleSlideChange = (swiper: SwiperInstance) => {
    setVisualIndex(swiper.activeIndex);
    // resetTimer();
  };

  const handleClick = (i: number) => {
    onSelect(i); // parent controls activeIndex
  };

  const statusLabel: Record<ServerStatus, string> = {
    queue: "queue",
    checking: "checking...",
    connecting: "connecting...",
    available: "available",
    failed: "No video found",
  };

  const statusClass: Record<ServerStatus, string> = {
    queue: "text-white/30",
    checking: "text-muted-foreground",
    connecting: "text-muted-foreground animate-pulse",
    available: "text-emerald-500",
    failed: "text-red-600",
  };

  const statusIcon: Record<ServerStatus, React.ElementType> = {
    queue: Minus,
    checking: Loader,
    connecting: LoaderCircle,
    available: SquareCheckBig,
    failed: X,
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && swiperRef.current) {
        const index = swiperRef.current.activeIndex;
        onSelect(index);
      }
    };

    window.addEventListener("keydown", handler);

    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [onSelect]);
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "h-full inset-0 absolute right-0 z-40",
        "pointer-events-none",
        "bg-linear-to-l from-black/60 lg:via-transparent to-transparent",
      )}
      onPointerMove={lockTimer}
    >
      <Swiper
        modules={[Mousewheel, Keyboard]}
        direction="vertical"
        slidesPerView="auto"
        centeredSlides
        mousewheel={{ sensitivity: 1, thresholdDelta: 10, forceToAxis: true }}
        initialSlide={activeIndex}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        onSlideChange={handleSlideChange}
        keyboard={{ enabled: true, onlyInViewport: true }}
        className="absolute h-full"
        style={
          {
            "--swiper-wrapper-transition-timing-function":
              "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          } as React.CSSProperties
        }
      >
        {servers.map((s, i) => {
          const isActive = i === visualIndex;
          const isNear = Math.abs(i - visualIndex) === 1;
          const isFailed = s.status === "failed";
          const isPlaying = i === playingIndex;
          const Icon = statusIcon[s.status];

          return (
            <SwiperSlide
              key={s.server}
              className={cn(
                "h-auto! w-fit! ml-auto",
                "transition-all! duration-200",
                "[text-shadow:0_2px_4px_rgba(0,0,0,0.5)]",
                "pointer-events-auto cursor-pointer select-none",
                "group text-end",
                "lg:py-8 md:py-6 py-5 landscape:py-3",
                "lg:px-8 px-2",
                isActive &&
                  "lg:-translate-x-18 -translate-x-8 landscape:-translate-x-4",
                isNear &&
                  "lg:-translate-x-10 -translate-x-4 landscape:-translate-x-2 opacity-80",
                !isActive &&
                  !isNear &&
                  "lg:opacity-30 opacity-10 pointer-events-none md:pointer-events-auto",
              )}
              onClick={() => handleClick(i)}
            >
              <p
                className={cn(
                  "transition-all duration-400 font-semibold",
                  isActive &&
                    "lg:text-3xl md:text-2xl text-lg landscape:text-xs text-foreground",
                  isNear &&
                    !isActive &&
                    "lg:text-2xl md:text-xl text-base landscape:text-xs",
                  !isActive &&
                    !isNear &&
                    "lg:text-2xl md:text-xl text-sm landscape:text-[0.5rem]",
                  isFailed && "line-through",
                )}
              >
                {s.name}
              </p>

              <p
                className={cn(
                  "text-gray-300 font-medium",
                  "lg:mt-1",
                  "lg:text-base text-sm landscape:text-[0.6rem]",
                )}
              >
                {s.desc}
              </p>

              <span
                className={cn(
                  "capitalize font-medium",
                  "flex justify-end items-center gap-2",
                  "lg:text-base text-xs landscape:text-[0.6rem]",
                  "lg:mt-3 mt-1.5 landscape:mt-0.5",
                  isPlaying ? "text-green-500" : statusClass[s.status],
                )}
              >
                <p>{isPlaying ? "connected" : statusLabel[s.status]}</p>

                {isPlaying ? (
                  <Cast
                    strokeWidth={3}
                    className={cn("size-4 landscape:size-2.5")}
                  />
                ) : (
                  <Icon
                    strokeWidth={3}
                    className={cn(
                      "size-4 landscape:size-2.5",
                      (s.status === "checking" || s.status === "connecting") &&
                        "animate-spin",
                    )}
                  />
                )}
              </span>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </motion.div>
  );
}
