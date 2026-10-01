import { fetchWithTimeout } from "@/lib/fetch-timeout";
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
  pt: "pt-BR",
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
  { params }: { params: Promise<{ id: string; season: string }> },
) {
  const { id, season } = await params;
  const { searchParams } = new URL(req.url);
  const rawLanguage = searchParams.get("language") || "en-US";

  const language = VALID_LANGUAGE_VALUES.has(rawLanguage)
    ? rawLanguage
    : "en-US";

  // 1. Check cache first
  try {
    const { data: cached, error } = await supabase
      .from("tmdb_season_cache")
      .select("data")
      .eq("tmdb_id", id)
      .eq("season", season)
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
    console.warn("Supabase season cache read failed:", err);
  }

  // 2. Fetch fresh from TMDB
  const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=47a1a7df542d3d483227f758a7317dff&language=${encodeURIComponent(language)}`;

  const res = await fetchWithTimeout(url, { cache: "no-store" }, 8000);

  if (!res.ok) {
    return NextResponse.json(
      { message: "Failed to fetch season" },
      { status: res.status },
    );
  }

  const data = await res.json();

  const filtered = {
    id: data.id,
    season_number: data.season_number,
    name: data.name,
    overview: data.overview,
    air_date: data.air_date,
    poster_path: data.poster_path,
    episodes:
      data.episodes?.map((episode: any) => ({
        id: episode.id,
        episode_number: episode.episode_number,
        season_number: episode.season_number,
        name: episode.name,
        overview: episode.overview,
        runtime: episode.runtime,
        still_path: episode.still_path,
        air_date: episode.air_date,
        vote_average: episode.vote_average,
      })) ?? [],
  };

  // 3. Store in cache with 7-day expiry
  try {
    const { error } = await supabase.from("tmdb_season_cache").upsert(
      {
        tmdb_id: id,
        season,
        language,
        data: filtered,
        refreshed_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 7,
        ).toISOString(),
      },
      { onConflict: "tmdb_id,season,language" },
    );

    if (error) {
      throw error;
    }
  } catch (err) {
    console.warn("Supabase season cache write failed:", err);
  }

  return NextResponse.json({ ...filtered, cache: false });
}
