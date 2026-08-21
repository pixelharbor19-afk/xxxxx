"use client";
import { Button } from "@/components/ui/button";
import { useTmdbDetails } from "@/hooks/fetch-details";
import useSource from "@/hooks/source";
import { cn } from "@/lib/utils";
import { Ring } from "ldrs/react";
import "ldrs/react/Ring.css";
import { Star, StarHalf, Download, Languages, Film } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdStore2 } from "@/zustand/ad-store2";

type Tab = "overview" | "trailer" | "stream" | "download";

function RatingStars({ value }: { value: number }) {
  const stars = value / 2; // TMDB rates out of 10, display out of 5
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`Rated ${value.toFixed(1)} out of 10`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        if (stars >= i) {
          return (
            <Star key={i} className="size-4 fill-current text-yellow-400" />
          );
        }
        if (stars >= i - 0.5) {
          return (
            <StarHalf key={i} className="size-4 fill-current text-yellow-400" />
          );
        }
        return <Star key={i} className="size-4 text-white/15" />;
      })}
    </div>
  );
}

function formatRuntime(minutes?: number) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function MovieDetails() {
  const param = useParams();
  const media_type = String(param.media_type);
  const id = String(param.id);
  const { data } = useTmdbDetails(media_type, id, "en-US");
  const isTv = media_type === "tv";
  const [tab, setTab] = useState<Tab>("overview");
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [backdropLoaded, setBackdropLoaded] = useState(false);

  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [selectedDub, setSelectedDub] = useState("");
  const seasons = data?.seasons ?? [];
  const currentSeasonMeta = seasons.find(
    (s) => s.season_number === selectedSeason,
  );
  const episodeCount = currentSeasonMeta?.episode_count ?? 0;
  const episodeNumbers = Array.from({ length: episodeCount }, (_, i) => i + 1);

  // reset episode whenever season changes so it can't point past the new season's count
  useEffect(() => {
    setSelectedEpisode(1);
  }, [selectedSeason]);

  const title = data?.title || "";
  const genres = data?.genres ?? [];
  const overview = data?.overview;
  const backdropArray = data?.backdrop_paths || [];
  const [backdropIndex, setBackdropIndex] = useState(0);
  useEffect(() => {
    if (!backdropArray.length) return;
    setBackdropIndex(Math.floor(Math.random() * backdropArray.length));
  }, [data?.id]);

  const backdrop = backdropArray[backdropIndex] ?? null;

  const poster = data?.poster_path;
  const rating = data?.rating || 0;
  const imdbId = data?.imdb_id ?? null;
  const runtime = formatRuntime(data?.runtime);
  const year = data?.release_date?.slice(0, 4) || "";
  const date = data?.release_date || "";
  const trailer = data?.trailer;
  const original_language = data?.original_language;
  const country = data?.country;
  const cast = data?.cast;

  const {
    data: source,
    error: sourceError,
    isLoading: sourceLoading,
    refetch,
  } = useSource({
    media_type,
    tmdbId: id,
    season: isTv ? selectedSeason : 1,
    episode: isTv ? selectedEpisode : 1,
    path: "resshin_",
    imdbId,
    title,
    year,
    date: String(date),
    enable: tab === "download",
    dubCode: selectedDub,
    dubType: "0",
  });

  const dubs = source?.dubs ?? [];

  function imagePath(path: string | null | undefined, quality: string) {
    return path ? `https://image.tmdb.org/t/p/${quality}${path}` : undefined;
  }
  const triggerAd = useAdStore2((state) => state.triggerAd);
  const backdropUrl = imagePath(backdrop, "original");
  const posterUrl = imagePath(poster, "w780");
  console.log(selectedDub);
  return (
    <div className="min-h-screen bg-background " onClick={triggerAd}>
      {/* Banner */}

      <div className="absolute inset-0 h-[60vh]">
        {backdropUrl && (
          <img
            className={cn(
              "h-full w-full object-cover object-[center_20%] grayscale-50 contrast-125 brightness-80 transition-opacity duration-700",
              backdropLoaded ? "opacity-100" : "opacity-0",
            )}
            src={backdropUrl}
            alt=""
            onLoad={() => setBackdropLoaded(true)}
          />
        )}
        <div className="absolute hidden md:block inset-0 bg-linear-to-r from-background via-background/10 to-transparent" />
        <div className="absolute hidden md:block inset-0 bg-linear-to-t from-background via-background/10 to-transparent" />
        <div className="absolute hidden md:block inset-0 bg-linear-to-r from-background via-background/10 to-transparent" />
        <div className="absolute  inset-0 bg-linear-to-t from-background via-background/10 to-transparent" />
      </div>
      <div className="relative h-[30vh] w-full overflow-hidden md:h-[25vh]"></div>

      {/* Header: poster overlaps the banner */}
      <div className="relative z-10 mx-auto -mt-16 flex max-w-6xl flex-col gap-6 md:px-6 px-4 sm:-mt-20 sm:flex-row sm:items-end  md:mt-0">
        <div className="relative w-32 shrink-0 overflow-hidden rounded-md bg-black shadow-2xl shadow-black/70  sm:w-40 md:w-52">
          <div className="aspect-11/16 drop-shadow-md">
            {posterUrl ? (
              <img
                className={cn(
                  "h-full w-full object-cover transition-opacity duration-500",
                  posterLoaded ? "opacity-100" : "opacity-0",
                )}
                src={posterUrl}
                alt={title ? `${title} poster` : "Poster"}
                onLoad={() => setPosterLoaded(true)}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground"></div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 pb-1 sm:pb-2">
          <h1 className="text-2xl font-semibold leading-tight  sm:text-4xl md:text-5xl">
            {title ?? "Loading\u2026"}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2  text-sm  text-muted-foreground tracking-wide">
            <RatingStars value={rating} />
            <span className="">{rating}/10</span>
            {runtime && (
              <>
                <span className="text-white/20">|</span>
                <span>{runtime}</span>
              </>
            )}
            {year && (
              <>
                <span className="text-white/20">|</span>
                <span>{year}</span>
              </>
            )}
          </div>

          {genres.length > 0 && (
            <div className="flex flex-wrap md:gap-2.5 gap-1.5 pt-1">
              {genres.slice(0, 4).map((g: { id: number; name: string }) => (
                <span
                  key={g.id}
                  className="rounded-full border bg-card  px-3 py-1 text-xs  tracking-wider "
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body: fact sheet + tabbed content */}
      <div className="relative z-10 mx-auto mt-10 grid max-w-6xl gap-10 md:px-6 px-4 pb-20 md:mt-14 md:grid-cols-[220px_1fr]">
        <aside className="order-2 h-fit rounded-lg  bg-card p-5 md:order-1 md:sticky md:top-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider">
            Details
          </h2>
          <dl className="mt-4 flex flex-col gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-1">{data?.status ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Original language</dt>
              <dd className="mt-1 uppercase">{original_language}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Country</dt>
              <dd className="mt-1">{country}</dd>
            </div>
          </dl>
        </aside>

        <div className="order-1 flex flex-col gap-5 md:order-2">
          <div className="flex gap-7 border-b border-white/10 text-base">
            {(
              [
                { id: "overview", label: "Overview" },
                { id: "trailer", label: "Trailer" },
                { id: "download", label: "Download" },
                { id: "stream", label: "Stream" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "cursor-pointer border-b-2 md:pb-2.5 pb-1.5 transition-colors md:text-base text-sm",
                  tab === t.id
                    ? "border-red-600 text-foreground "
                    : "border-transparent text-muted-foreground hover:text-[#F5F1EA]/80",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-[200px]">
            {tab === "overview" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h1 className="text-sm text-muted-foreground">Overview</h1>
                  <p className="max-w-2xl md:text-base leading-relaxed text-sm">
                    {overview || "No overview available for this title yet."}
                  </p>
                </div>
                <div className="space-y-3">
                  <h1 className="text-sm text-muted-foreground">Casts</h1>
                  <div className="grid md:grid-cols-4 grid-cols-2 gap-3">
                    {cast?.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-col items-center md:p-4  p-2 bg-card rounded-md"
                      >
                        <img
                          className="md:max-w-25 max-w-18 aspect-square rounded-full object-cover border-2"
                          src={imagePath(c.profile_path, "w780")}
                          alt=""
                        />
                        <h3 className="md:text-sm text-xs text-muted-foreground mt-1.5 text-center p-2">
                          {c.name} as {c.character}
                        </h3>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {tab === "download" && (
              <div className="space-y-6">
                <h3 className="text-muted-foreground text-xs uppercase tracking-wide">
                  download
                </h3>

                {!sourceLoading && (
                  <div className="flex gap-2">
                    <Select
                      value={selectedDub}
                      onValueChange={(v) => setSelectedDub(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={dubs[0]?.name || ""} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {dubs?.map((s, i) => (
                            <SelectItem key={i} value={s.lang}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    {isTv && (
                      <>
                        <Select
                          value={String(selectedSeason)}
                          onValueChange={(v) => setSelectedSeason(Number(v))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Season" />
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

                        <Select
                          value={String(selectedEpisode)}
                          onValueChange={(v) => setSelectedEpisode(Number(v))}
                          disabled={episodeCount === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Episode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {episodeNumbers.map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  Episode {n}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-2 divide-y min-h-30 flex justify-center items-center flex-col">
                  {sourceLoading ? (
                    <div>
                      <Ring
                        size="40"
                        stroke="5"
                        bgOpacity="0"
                        speed="2"
                        color="white"
                      />
                    </div>
                  ) : !source?.links?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No download links available.
                    </p>
                  ) : (
                    source?.links?.map((link, index) => (
                      <div
                        key={index}
                        className="flex gap-2 w-full items-center justify-between rounded-sm py-4 px-2 transition hover:bg-card/50 hover:shadow-md"
                      >
                        {/* LEFT */}
                        <div className="flex items-center gap-4">
                          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Film size={18} />
                          </div>

                          <div>
                            <p className="text-sm font-medium line-clamp-1">
                              {title}-
                              {media_type === "tv" &&
                                `S${selectedSeason}E${selectedEpisode}`}{" "}
                              | {link.resolution}p
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {formatBytes(Number(link.size))} | {link.type}
                            </p>
                          </div>
                        </div>

                        {/* ACTION */}
                        <Button variant="secondary" asChild>
                          <Link
                            href={link.link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="hidden md:block">Download</span>{" "}
                            <Download />
                          </Link>
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <h3 className="text-muted-foreground text-xs uppercase tracking-wide">
                  Subtitles
                </h3>
                <div className="space-y-2 divide-y min-h-30 flex justify-center items-center flex-col">
                  {sourceLoading ? (
                    <div>
                      <Ring
                        size="40"
                        stroke="5"
                        bgOpacity="0"
                        speed="2"
                        color="white"
                      />
                    </div>
                  ) : !source?.subtitles?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No subtitle links available.
                    </p>
                  ) : (
                    source?.subtitles?.map((subtitle, index) => (
                      <div
                        key={index}
                        className="flex w-full items-center justify-between rounded-sm py-4 px-2 transition hover:bg-card/50 hover:shadow-md"
                      >
                        {/* LEFT */}
                        <div className="flex items-center gap-4">
                          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Languages size={18} />
                          </div>

                          <div>
                            <p className="text-sm font-medium">
                              {title}
                              {media_type === "tv" &&
                                `-S${selectedSeason}E${selectedEpisode}`}
                            </p>

                            <p className="text-xs uppercase text-muted-foreground">
                              {subtitle.display}
                            </p>
                          </div>
                        </div>

                        {/* ACTION */}
                        <Button variant="secondary" asChild>
                          <Link
                            href={subtitle.file}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="hidden md:block">Download</span>{" "}
                            <Download />
                          </Link>
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === "trailer" && (
              <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-md">
                {trailer ? (
                  <iframe
                    className="h-full w-full"
                    src={`https://www.youtube.com/embed/${trailer}`}
                    title={`${title} trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                    No trailer available yet.
                  </div>
                )}
              </div>
            )}
            {tab === "stream" && (
              <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-md">
                <iframe
                  className="h-full w-full"
                  src={`https://zxcstream.xyz/player/${media_type}/${id}`}
                  title={`${title} stream`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function formatBytes(bytes: number) {
  if (!bytes) return "Unknown";

  const units = ["B", "KB", "MB", "GB"];
  let i = 0;

  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }

  return `${bytes.toFixed(1)} ${units[i]}`;
}
