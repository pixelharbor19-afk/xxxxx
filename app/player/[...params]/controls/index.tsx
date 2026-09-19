// index.tsx
"use client";
import { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingsIcon } from "@/components/icons/settings";
import { SettingsRow } from "./settings-row";
import { SubmenuPanel } from "./submenu-panel";
import { DynamicKey, groups, SettingsItem, SettingsOption } from "./data";
import { MediaOption } from "@/hooks/open-subtitle";
import { useSettingsStore } from "@/zustand/settings-store";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { AudioTrackTypes, QualityLevel } from "../useVideoPlayer";
import { SubtitleSettingsModal } from "./subtitle-settings";
import { DubTypes, QualityTrack } from "@/hooks/whatdaheli";
import { cn } from "@/lib/utils";

type ActiveItem = {
  item: SettingsItem;
  groupIndex: number;
  itemIndex: number;
};

export default function Settings({
  mergeSubtitles,
  //
  quality,
  audioTracks,
  //
  onPip,
  //
  imdbId,
  season,
  episode,
  media_type,
  //
  // onSubtitleSettings,
  //
  resetTimer,
  lockTimer,

  source,
  dubs,
}: {
  mergeSubtitles: MediaOption[];

  //
  quality: QualityLevel[];
  audioTracks: AudioTrackTypes[];

  //
  onPip: () => void;

  //
  imdbId: string | null;
  season: number;
  episode: number;
  media_type: string;
  //
  // onSubtitleSettings: () => void;
  resetTimer: () => void;
  lockTimer: () => void;

  source: QualityTrack[];
  dubs: DubTypes[];
}) {
  const [subtitleSettings, setSubtitleSettings] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ActiveItem | null>(null);
  // const [values, setValues] = useState<Record<string, SelectedValue>>(() =>
  //   Object.fromEntries(
  //     groups.flatMap((g) =>
  //       g.items
  //         .filter((i) => i.value != null)
  //         .map((i) => [
  //           i.label,
  //           {
  //             display: i.value as string,
  //             id: (i.value as string).toLowerCase(), // 👈 important
  //           },
  //         ]),
  //     ),
  //   ),
  // );

  const { values, setValue } = useSettingsStore();

  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleSelect(label: string, option: SettingsOption) {
    setValue(label, {
      display: option.display,
      id: option.id,
      file: option.file,
      type: option.type,
      value: option.value,
    });
    setActive(null);
  }

  const resolvedGroups = useMemo(() => {
    const dynamic: Record<DynamicKey, SettingsOption[]> = {
      //////////
      dub:
        dubs.length > 1
          ? [
              ...dubs.map((q, i) => ({
                id: String(i),
                display: q.name,
                value: q.lang,
                type: String(q.type),
              })),
            ]
          : [],
      //////////
      downloads: source
        .filter((l) => l.type !== "hls")
        .map((l, i) => ({
          id: l.link,
          display: l.resolution
            ? `${l.resolution}${l.resolution === 4 ? "K" : "p"} — ${formatSize(l.size)}`
            : (l.format ?? `Source ${i + 1}`),
        })),
      //////////
      qualities: [
        { id: "auto", display: "Auto" },
        ...(quality?.length > 1
          ? quality.map((q, i) => ({
              id: String(i),
              display: `${q.height}p`,
            }))
          : []),
      ],
      /////////
      audioTracks:
        audioTracks.length > 1
          ? audioTracks.map((a, i) => ({
              id: String(i),
              display: a.lang ? `${a.name} (${a.lang.toUpperCase()})` : a.name,
            }))
          : [],
      /////////
      subtitles: [
        { id: "off", display: "Off" },
        ...mergeSubtitles.map((s) => ({
          id: s.id,
          display: s.display,
          file: s.file,
        })),
      ],
      //////
      sourceQualities: [
        { id: "auto", display: "Auto" },
        ...(source?.length > 1
          ? source.map((l, i) => ({
              id: String(i),
              display: l.resolution
                ? `${l.resolution}${l.resolution === 4 ? "K" : "p"}`
                : (l.format ?? `Source ${i + 1}`),
            }))
          : []),
      ],
    };

    return groups.map((group) => ({
      ...group,
      items: group.items
        .map((item) => {
          //
          if (item.label === "Picture in picture") {
            return { ...item, action: onPip };
          }
          //
          if (item.label === "Subtitle settings")
            return { ...item, action: () => setSubtitleSettings(true) };
          return item.dynamicKey
            ? { ...item, options: dynamic[item.dynamicKey] }
            : item;
        })
        .filter((item) => {
          // if (item.label === "Source quality")
          //   return dynamic.sourceQualities.length > 1;
          // if (item.label === "Quality") return dynamic.qualities.length > 0;
          if (item.label === "Audio track")
            return dynamic.audioTracks.length > 0;
          if (item.label === "Download") return dynamic.downloads.length > 0;
          if (item.label === "Audio Dub") return dynamic.dub.length > 0;
          return true;
        }),
    }));
  }, [mergeSubtitles, audioTracks, quality]);

  useEffect(() => {
    if (open || subtitleSettings) {
      lockTimer();
    } else {
      resetTimer();
    }
  }, [open, subtitleSettings]);

  return (
    <div className="relative">
      <motion.span
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        animate={{ rotate: open ? 90 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="relative z-20 "
      >
        <Button
          size="lg"
          variant="outline"
          className="px-4 w-42 justify-between border-none hidden lg:flex"
        >
          <SettingsIcon /> Settings <ChevronRight />
        </Button>

        <button className="text-white/80 hover:text-white cursor-pointer lg:hidden block">
          <motion.div
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <SettingsIcon
              className={cn("lg:size-13 md:size-7.5 size-7.5 landscape:size-6")}
            />
          </motion.div>
        </button>
      </motion.span>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-10 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setOpen(false);
                setActive(null);
              }}
            />

            <motion.div
              className="absolute md:right-0 right-1/2 translate-x-1/2 md:translate-x-0 bottom-full lg:mb-3 z-20 lg:w-90 w-3xs bg-neutral-950/80 backdrop-blur-lg rounded-md shadow-xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <AnimatePresence mode="wait">
                {active ? (
                  <motion.div
                    key="submenu"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.15, ease: "easeInOut" }}
                  >
                    <SubmenuPanel
                      item={active.item}
                      currentValue={values[active.item.label] ?? null}
                      onSelect={(val) => handleSelect(active.item.label, val)}
                      onBack={() => setActive(null)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="main"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15, ease: "easeInOut" }}
                    className="pr-0.5"
                  >
                    <div className="lg:px-3 px-2.5 lg:pb-3 pb-1.5 lg:pt-3 pt-1.5 border-b border-neutral-800">
                      <p className="text-muted-foreground lg:text-sm text-xs font-medium uppercase tracking-wider">
                        Settings
                      </p>
                    </div>

                    <ScrollArea className="lg:max-h-[60vh] max-h-[60vh]  landscape:max-h-[60vh] lg:pl-2 pl-1 lg:pr-3 pr-1.5">
                      <div className="space-y-1 pt-1 pb-3">
                        {resolvedGroups.map(({ label, items }, i) => (
                          <div key={label}>
                            {i > 0 && (
                              <div className="h-px bg-neutral-800 my-1" />
                            )}
                            <p className="lg:px-3 px-1.5 pt-2 pb-1 text-xs text-neutral-600 uppercase tracking-wider">
                              {label}
                            </p>
                            {items.map((item, itemIndex) => (
                              <SettingsRow
                                key={item.label}
                                item={{
                                  ...item,
                                  value:
                                    values[item.label]?.display ?? item.value,
                                }}
                                onClick={() => {
                                  if (item.action) {
                                    item.action();
                                    setOpen(false);
                                  } else if (item.label === "Download") {
                                    setActive({
                                      item,
                                      groupIndex: i,
                                      itemIndex,
                                    });
                                  } else if (item.options?.length) {
                                    setActive({
                                      item,
                                      groupIndex: i,
                                      itemIndex,
                                    });
                                  }
                                }}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {subtitleSettings && (
          <SubtitleSettingsModal onClose={() => setSubtitleSettings(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
function formatSize(bytes: string | undefined): string {
  if (!bytes) return "";
  const b = Number(bytes);
  if (b >= 1_000_000_000) return `${(b / 1_000_000_000).toFixed(1)} GB`;
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(0)} MB`;
  return `${b} B`;
}
