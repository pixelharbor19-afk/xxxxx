"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  Sliders,
  Tv2,
  Tv,
  Film,
  ArrowRight,
  Eclipse,
  ArrowRightIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Lamp from "./lamp";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAdsScript } from "@/hooks/useAdsScript";

const DEFAULT_PARAMS = [
  {
    key: "server",
    label: "server",
    desc: "Set your favorite server as default.",
    example: "e.g 1",
  },
  {
    key: "domainAd",
    label: "domainAd",
    desc: "Displays a domain intro splash before the player loads.",
    example: "e.g zxcstream.icu",
  },
  {
    key: "color",
    label: "color",
    desc: "Changes the accent color of the player UI. Pass a hex code without the #.",
    example: "e.g fafafa",
  },
  {
    key: "autoplay",
    label: "autoplay",
    desc: "Automatically plays the movie but muted.",
    example: "e.g true",
  },
  {
    key: "back",
    label: "back",
    desc: "Shows a back button inside the player for navigation.",
    example: "e.g true",
  },
];

const DEFAULT_IDS: Record<string, string> = {
  movie: "",
  tv: "",
};

const DEBOUNCE_MS = 600;

type Tab = "custom" | "builtin";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
}

function IdInputs({
  type,
  id,
  setId,
  season,
  setSeason,
  episode,
  setEpisode,
}: {
  type: string;
  id: string;
  setId: (v: string) => void;
  season: string;
  setSeason: (v: string) => void;
  episode: string;
  setEpisode: (v: string) => void;
}) {
  return (
    <div
      className={cn(
        "grid mx-auto",
        type === "tv" ? "grid-cols-3 gap-3 max-w-md" : "grid-cols-1 max-w-xs",
      )}
    >
      <Input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="ID"
        className="text-center bg-zinc-800 border-zinc-700 placeholder:text-muted-foreground"
      />
      {type === "tv" && (
        <>
          <Input
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="S"
            className="bg-zinc-800 border-zinc-700 placeholder:text-muted-foreground"
          />
          <Input
            value={episode}
            onChange={(e) => setEpisode(e.target.value)}
            placeholder="EP"
            className="bg-zinc-800 border-zinc-700 placeholder:text-muted-foreground"
          />
        </>
      )}
    </div>
  );
}

function CopyBar({
  url,
  onCopy,
  copied,
}: {
  url: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="mt-6 flex items-center gap-2 px-3 py-2 bg-card rounded-md">
      <span className="text-sm text-muted-foreground truncate flex-1 font-mono text-center">
        {url}
      </span>
      <button
        onClick={onCopy}
        className="shrink-0 text-muted-foreground hover transition-colors"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

function Player({
  pathPrefix,
  type,
  id,
  setId,
  season,
  setSeason,
  episode,
  setEpisode,
}: {
  pathPrefix: "player" | "embed";
  type: string;
  id: string;
  setId: (v: string) => void;
  season: string;
  setSeason: (v: string) => void;
  episode: string;
  setEpisode: (v: string) => void;
}) {
  const { copied, copy } = useCopy();

  const debounced = useDebounce({ type, id, season, episode }, DEBOUNCE_MS);

  const isReady =
    debounced.type === "tv"
      ? !!debounced.id && !!debounced.season && !!debounced.episode
      : !!debounced.id;
  const playerPath =
    debounced.type === "tv"
      ? `/${pathPrefix}/tv/${debounced.id}/${debounced.season}/${debounced.episode}`
      : `/${pathPrefix}/movie/${debounced.id}`;
  const fullUrl = `https://zxcstream.xyz${playerPath}`;

  return (
    <div className="w-full max-w-4xl flex flex-col gap-6">
      <div className="w-full max-w-4xl">
        <p className="text-sm text-zinc-500 uppercase tracking-widest mb-1.5 font-medium text-center">
          {type === "tv" ? "TMDB ID / SS / EP" : "TMDB ID"}
        </p>
        <IdInputs
          type={type}
          id={id}
          setId={setId}
          season={season}
          setSeason={setSeason}
          episode={episode}
          setEpisode={setEpisode}
        />
        <CopyBar url={fullUrl} onCopy={() => copy(fullUrl)} copied={copied} />
      </div>
      <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl shadow-black/60">
        {isReady ? (
          <iframe
            key={playerPath}
            className="h-full w-full"
            src={playerPath}
            allowFullScreen
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-zinc-900 text-muted-foreground lg:text-base text-sm">
            Enter an ID to load the player
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [type, setType] = useState("movie");
  const [id, setId] = useState(DEFAULT_IDS.movie);
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [activeTab, setActiveTab] = useState<Tab>("custom");
  const [open, setOpen] = useState(true);
  const handleTypeChange = (newType: string) => {
    setType(newType);
    setId(DEFAULT_IDS[newType]);
  };
  // useAdsScript({
  //   enabled: true,
  //   platform: "adsterra",
  // });
  return (
    <>
      <div>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>📢 Important Announcement</AlertDialogTitle>
              <AlertDialogDescription></AlertDialogDescription>
              <div className="md:text-base text-sm text-muted-foreground text-left space-y-3 max-h-100 overflow-auto pr-2">
                <div>
                  To avoid confusion, please only use and follow the{" "}
                  <strong>zxcstream.xyz</strong> or{" "}
                  <strong>zxcprime.xyz</strong> domain.
                </div>

                <div>
                  Our main domain serves as a central entry point and may
                  redirect to whichever active domain is currently available.
                  This ensures uninterrupted access even if we change domains in
                  the future.
                </div>

                <div>
                  ✅ Always use: <strong>zxcstream.xyz</strong> or{" "}
                  <strong>zxcprime.xyz</strong>
                </div>

                <div>
                  ✅ Any domain changes will be handled automatically through
                  redirects
                </div>

                <div>✅ No need to save or share temporary domains</div>

                <div className="mt-6">
                  Thank you for your support and understanding.
                </div>
              </div>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => setOpen(false)}
                className="w-full bg-blue-800! text-foreground! hover:bg-blue-700! cursor-pointer"
              >
                Got it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="dark bg-muted px-4 py-3 text-foreground">
          <div className="flex flex-col justify-between gap-2 md:flex-row overflow-hidden">
            <div className="flex grow gap-3">
              <Eclipse
                aria-hidden="true"
                className="mt-0.5 shrink-0 opacity-60"
                size={16}
              />
              <div className="flex grow flex-col justify-between gap-2 md:flex-row md:items-center">
                <p className="text-sm">
                  Download endpoint is now available, usage:
                  https://zxcstream.xyz/download/{`{media_type}`}/{`{tmdbId}`}
                </p>
                <Link
                  className="group whitespace-nowrap font-medium text-sm"
                  href={`/download/movie/128`}
                >
                  Sample Link
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="-mt-0.5 ms-1 inline-flex opacity-60 transition-transform group-hover:translate-x-0.5"
                    size={16}
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div
          className="relative min-h-screen flex flex-col bg-slate-700 overflow-hidden"
          style={{
            background: `linear-gradient(to bottom,rgba(16, 29, 43,0.5), var(--background) 40%, var(--background))`,
          }}
        >
          <Lamp />
          <div className="z-20 absolute inset-x-0 top-0 flex justify-center items-center p-6">
            <div className="flex flex-wrap gap-4 lg:gap-8 lg:text-lg font-medium  items-center">
              <Link href={`https://zxcprime.icu`} target="_blank">
                <div className="flex-1 text-center text-muted-foreground lg:text-base text-sm">
                  zxcprime.icu
                </div>
              </Link>
              <Link href={`https://zxcstream.xyz`} target="_blank">
                <div className="flex-1 text-center lg:text-xl text-base">
                  zxcstream.xyz
                </div>
              </Link>

              <Link href={`https://zxcprime.xyz`} target="_blank">
                <div className="flex-1 text-center text-muted-foreground lg:text-base text-sm">
                  zxcprime.xyz
                </div>
              </Link>
            </div>
          </div>

          {/* Hero Branding */}
          <div className="z-10 flex flex-col items-center justify-center lg:pt-50 pt-35  pb-20 px-4 text-center select-none">
            <Badge variant="secondary" className="mb-1" asChild>
              <Link href="https://discord.gg/yv7wJV97Jd">
                Join our Discord <ArrowRight />
              </Link>
            </Badge>
            <div className="flex items-center gap-3 mb-4">
              <h1
                style={{ textShadow: "1px 1px 1px rgba(0,0,0,0.2)" }}
                className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tighter"
              >
                <motion.span
                  className="bg-linear-to-r from-[rgb(237,236,233)] via-[rgb(94,84,72)] to-[rgb(172,149,119)] bg-clip-text text-transparent"
                  style={{ backgroundSize: "200% 200%" }}
                  animate={{
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  ZXCSTREAM
                </motion.span>
              </h1>
            </div>
            <p className="text-muted-foreground text-sm md:text-2xl max-w-2xl">
              Dive into endless hours of free streaming of Movies & TV Shows. A
              free, easy-to-embed player you can drop into any website
            </p>
          </div>

          {/* Main content */}
          <div className="flex flex-col items-center gap-8 px-4 pb-20 w-full">
            {/* Tab Switchers */}
            {[
              {
                label: "PLAYER",
                options: [
                  {
                    value: "custom",
                    icon: <Sliders className="w-4 h-4" />,
                    text: "Custom Player",
                  },
                  {
                    value: "builtin",
                    icon: <Tv2 className="w-4 h-4" />,
                    text: "Built-in Player",
                  },
                ],
                active: activeTab,
                setActive: (v: string) => setActiveTab(v as Tab),
              },
              {
                label: "MEDIA TYPE",
                options: [
                  {
                    value: "movie",
                    icon: <Film className="w-4 h-4" />,
                    text: "Movie Player",
                  },
                  {
                    value: "tv",
                    icon: <Tv className="w-4 h-4" />,
                    text: "Series Player",
                  },
                ],
                active: type,
                setActive: handleTypeChange,
              },
            ].map(({ label, options, active, setActive }) => (
              <div key={label}>
                <p className="text-sm text-zinc-500 uppercase tracking-widest mb-1.5 font-medium text-center">
                  {label}
                </p>
                <div className="flex items-center justify-center mx-auto gap-1 p-0.5 bg-zinc-900 rounded-lg w-fit">
                  {options.map(({ value, icon, text }) => (
                    <button
                      key={value}
                      onClick={() => setActive(value)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        active === value
                          ? "bg-blue-900 shadow-md"
                          : "text-zinc-400 hover"
                      }`}
                    >
                      {icon}
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Custom Player Tab */}
            {activeTab === "custom" && (
              <>
                <Player
                  pathPrefix="player"
                  type={type}
                  id={id}
                  setId={setId}
                  season={season}
                  setSeason={setSeason}
                  episode={episode}
                  setEpisode={setEpisode}
                />

                {/* Params */}
                <div className="w-full max-w-4xl space-y-5">
                  <p className="text-sm text-zinc-500 uppercase font-medium tracking-widest">
                    Query Parameters
                  </p>

                  <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
                    <div>
                      <h3 className="font-semibold text-white mb-1">
                        NEW UPDATE - dubLang
                      </h3>
                      <p>Sets the audio dub language when the player loads.</p>
                    </div>

                    <div>
                      <h4 className="font-medium text-white mb-1">Usage</h4>
                      <pre className="bg-zinc-900 rounded-lg p-3 overflow-x-auto text-xs">
                        {`/player/movie/1184918?dubLang=hi
/player/tv/66732/1/2?dubLang=tl`}
                      </pre>
                    </div>

                    <div>
                      <h4 className="font-medium text-white mb-2">
                        Available Values
                      </h4>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        <div>
                          <code>en</code> — Original
                        </div>
                        <div>
                          <code>fr</code> — French
                        </div>
                        <div>
                          <code>hi</code> — Hindi
                        </div>
                        <div>
                          <code>id</code> — Indonesian
                        </div>
                        <div>
                          <code>pt</code> — Portuguese
                        </div>
                        <div>
                          <code>ru</code> — Russian
                        </div>
                        <div>
                          <code>es</code> — Spanish
                        </div>
                        <div>
                          <code>tl</code> — Tagalog
                        </div>
                        <div>
                          <code>ta</code> — Tamil
                        </div>
                        <div>
                          <code>te</code> — Telugu
                        </div>
                        <div>
                          <code>esla</code> — Spanish (LA)
                        </div>
                        <div>
                          <code>ptbr</code> — Portuguese (BR)
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-white mb-1">Notes</h4>
                      <ul className="list-disc list-inside space-y-1 text-zinc-400">
                        <li>
                          If the requested <code>dubLang</code> is not
                          available, the player falls back to the original
                          audio.
                        </li>
                        <li>
                          Not all languages are available for every title.
                        </li>
                        <li>
                          Check the <code>dubs</code> array in the source
                          response to see which languages are available for a
                          specific title.
                        </li>
                      </ul>
                    </div>
                  </div>
                  {DEFAULT_PARAMS.map(({ key, label, desc, example }) => (
                    <div
                      key={key}
                      className="space-y-1 pb-5 border-b border-zinc-800 last:border-0"
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="text-base font-semibold font-mono">
                          {label}
                        </span>
                        <span className="text-sm font-mono text-muted-foreground">
                          = {example}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {desc}
                      </p>
                    </div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.7 }}
                  className="w-full max-w-4xl flex justify-between w-full lg:flex-row flex-col items-center gap-3"
                >
                  <h1 className="text-lg font-semibold">Join our community!</h1>
                  <div className="flex gap-6">
                    <Link target="_blank" href="https://t.me/+AZZmZ7-_SFsxM2M9">
                      <span className="text-sm hover:underline">Telegram</span>
                    </Link>
                    <Link target="_blank" href="https://discord.gg/yv7wJV97Jd">
                      <span className="text-sm hover:underline">Discord</span>
                    </Link>
                  </div>
                </motion.div>
              </>
            )}

            {/* Built-in Player Tab */}
            {activeTab === "builtin" && (
              <Player
                pathPrefix="embed"
                type={type}
                id={id}
                setId={setId}
                season={season}
                setSeason={setSeason}
                episode={episode}
                setEpisode={setEpisode}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
