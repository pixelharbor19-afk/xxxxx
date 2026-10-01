import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL_SEGMENTS!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_SEGMENTS!,
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const imdbId = searchParams.get("imdbId");
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");
  const tmdbId = searchParams.get("tmdbId");

  if (!imdbId || !season || !episode) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // 1. Check cache
  const { data: cached } = await supabase
    .from("segments_cache")
    .select("data")
    .eq("imdb_id", imdbId)
    .eq("season", Number(season))
    .eq("episode", Number(episode))
    .single();

  if (cached) return NextResponse.json(cached.data);

  // 2. Fetch upstream
  try {
    const res = await fetchWithTimeout(
      `https://api.introdb.app/segments?imdb_id=${imdbId}&season=${season}&episode=${episode}&segment_type=intro`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://introdb.app",
          Origin: "https://introdb.app",
        },
      },
      8000,
    );

    const data = await res.json();

    // 3. Insert only if not exists
    if (data.intro || data.outro || data.recap) {
      await supabase.from("segments_cache").insert({
        imdb_id: imdbId,
        season: Number(season),
        episode: Number(episode),
        tmdb_id: tmdbId,
        data,
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch segments" },
      { status: 500 },
    );
  }
}
