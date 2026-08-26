export type TmdbDetailsResponse = {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  last_air_date: string | null;
  runtime: number;
  rating: number;
  status: string;
  country: string | null;
  original_language: string;
  tagline: string | null;
  genres: Genre[];
  imdb_id: string | null;
  seasons: SeasonsType[];
  poster_path: string;
  backdrop_paths: string[];
  logo_paths: string[];
  trailer: string | null;
  cast: CastMember[];
  cache: boolean;
};

export type SeasonsType = {
  season_number: number;
  name: string;
  episode_count: number;
};

export type Genre = {
  id: number;
  name: string;
};

export type CastMember = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
};
