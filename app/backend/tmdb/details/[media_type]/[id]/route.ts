import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL_TMDB!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_TMDB!,
);

const SUPPORTED_LANGUAGES: Record<string, string> = {
  xx: "en-US",
  ar: "ar-SA",
  be: "be-BY",
  bg: "bg-BG",
  bn: "bn-BD",
  ca: "ca-ES",
  cs: "cs-CZ",
  da: "da-DK",
  de: "de-DE",
  el: "el-GR",
  en: "en-US",
  eo: "eo-EO",
  es: "es-ES",
  eu: "eu-ES",
  fa: "fa-IR",
  fi: "fi-FI",
  fr: "fr-FR",
  ga: "ga-IE",
  gl: "gl-ES",
  he: "he-IL",
  hi: "hi-IN",
  hr: "hr-HR",
  hu: "hu-HU",
  id: "id-ID",
  it: "it-IT",
  ja: "ja-JP",
  ka: "ka-GE",
  kk: "kk-KZ",
  kn: "kn-IN",
  ko: "ko-KR",
  lt: "lt-LT",
  lv: "lv-LV",
  ml: "ml-IN",
  ms: "ms-MY",
  nb: "nb-NO",
  nl: "nl-NL",
  no: "no-NO",
  pa: "pa-IN",
  pl: "pl-PL",
  pt: "pt-BR", // TMDB defaults pt to Brazil
  ro: "ro-RO",
  ru: "ru-RU",
  sk: "sk-SK",
  sl: "sl-SI",
  sq: "sq-AL",
  sr: "sr-RS",
  sv: "sv-SE",
  ta: "ta-IN",
  te: "te-IN",
  th: "th-TH",
  tl: "tl-PH",
  tr: "tr-TR",
  uk: "uk-UA",
  ur: "ur-PK",
  vi: "vi-VN",
  zh: "zh-CN",
  zu: "zu-ZA",
};

const VALID_LANGUAGE_VALUES = new Set(Object.values(SUPPORTED_LANGUAGES));

export async function GET(
  req: Request,
  { params }: { params: Promise<{ media_type: string; id: string }> },
) {
  const { media_type, id } = await params;
  const { searchParams } = new URL(req.url);
  const rawLanguage = searchParams.get("language") || "en-US";

  // must exactly match one of our canonical supported values, otherwise fallback to en-US
  const language = VALID_LANGUAGE_VALUES.has(rawLanguage)
    ? rawLanguage
    : "en-US";
  const langCode = language.split("-")[0];

  // 1. Check cache first
  try {
    const { data: cached, error } = await supabase
      .from("tmdb_details_cache")
      .select("data")
      .eq("tmdb_id", id)
      .eq("media_type", media_type)
      .eq("language", language)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (cached) {
      return NextResponse.json({ ...cached.data, cache: true });
    }
  } catch (err) {
    console.warn("Supabase cache read failed:", err);
    // Continue to TMDB
  }

  // 2. Fetch fresh from TMDB
  const url = `https://api.themoviedb.org/3/${media_type}/${id}?api_key=47a1a7df542d3d483227f758a7317dff&language=${encodeURIComponent(language)}&append_to_response=videos,credits,images,external_ids&include_image_language=${langCode},en,null`;

  const res = await fetch(url, { cache: "no-store" });

  if (res.status === 404) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch TMDB" },
      { status: 502 },
    );
  }
  const data = await res.json();

  if (!data.id) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const filtered = {
    id: data.id,
    title: data.title || data.name,
    overview: data.overview,
    release_date: data.release_date || data.first_air_date,
    last_air_date: data.last_air_date || null,
    runtime: data.runtime || data.episode_run_time?.[0],
    rating: data.vote_average,
    genres: data.genres,
    status: data.status,
    poster_path: data.poster_path,
    tagline: data.tagline || null,
    imdb_id: data.external_ids?.imdb_id ?? null,
    country:
      data.production_countries?.[0]?.iso_3166_1 || // movies
      data.origin_country?.[0] || // tv shows
      null,
    original_language: data.original_language,
    trailer:
      data.videos?.results?.find(
        (v: any) =>
          v.site === "YouTube" && v.type === "Trailer" && v.iso_639_1 === "en",
      )?.key ??
      data.videos?.results?.find(
        (v: any) => v.site === "YouTube" && v.iso_639_1 === "en",
      )?.key ??
      data.videos?.results?.[0]?.key ??
      null,
    cast: data.credits?.cast?.slice(0, 5).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profile_path: c.profile_path,
    })),

    backdrop_paths: data.images?.backdrops
      ?.filter((f: any) => f.iso_639_1 === null)
      .slice(0, 3)
      .map((f: any) => f.file_path),

    logo_paths: data.images?.logos
      ?.filter(
        (f: any) =>
          f.iso_639_1 === langCode ||
          f.iso_639_1 === "en" ||
          f.iso_639_1 === null,
      )
      .slice(0, 1)
      .map((f: any) => f.file_path),

    seasons:
      media_type === "tv"
        ? (data.seasons
            ?.filter((s: any) => s.season_number > 0)
            .map((s: any) => ({
              season_number: s.season_number,
              name: s.name,
              episode_count: s.episode_count,
            })) ?? [])
        : [],
  };

  try {
    const { error } = await supabase.from("tmdb_details_cache").upsert(
      {
        tmdb_id: id,
        media_type,
        language,
        data: filtered,
        refreshed_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 7,
        ).toISOString(),
      },
      { onConflict: "tmdb_id,media_type,language" },
    );

    if (error) {
      throw error;
    }
  } catch (err) {
    console.warn("Supabase cache write failed:", err);
  }

  return NextResponse.json({ ...filtered, cache: false });
}
