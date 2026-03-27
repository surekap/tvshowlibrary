const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w300";

// TMDB genre ID → name map for TV (stable, rarely changes)
const TMDB_GENRES: Record<number, string> = {
  10759: "Action & Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  10762: "Kids",
  9648: "Mystery",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  37: "Western",
};

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function tmdbFetch(path: string): Promise<unknown> {
  const res = await fetch(`${TMDB_BASE}${path}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TMDB ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function buildPosterUrl(path: string | null): string | null {
  return path ? `${POSTER_BASE}${path}` : null;
}

// ─── Shared types ────────────────────────────────────────────────────────────

export interface TmdbShow {
  tmdbId: number;
  name: string;
  overview: string | null;
  posterUrl: string | null;
  genres: string[];
  voteAverage: number;
  popularity: number;
}

export interface TrendItem extends TmdbShow {
  rank: number;
  originalName: string;
}

export interface NewShowItem extends TmdbShow {
  firstAirDate: string | null;
}

export type TopRatedItem = TmdbShow;

export interface RecommendedItem extends TmdbShow {
  becauseOf: string; // name of the user's library show that triggered this
  score: number;     // how many library shows recommended this
}

// ─── Internal TMDB response shapes ───────────────────────────────────────────

interface TmdbListResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  genre_ids: number[];
  vote_average: number;
  popularity: number;
  first_air_date?: string;
}

interface TmdbListResponse {
  results: TmdbListResult[];
}

interface TmdbFindResponse {
  tv_results: Array<{ id: number; name: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapToTmdbShow(item: TmdbListResult): TmdbShow {
  return {
    tmdbId: item.id,
    name: item.name,
    overview: item.overview || null,
    posterUrl: buildPosterUrl(item.poster_path),
    genres: item.genre_ids
      .map((id) => TMDB_GENRES[id])
      .filter((g): g is string => Boolean(g)),
    voteAverage: Math.round(item.vote_average * 10) / 10,
    popularity: Math.round(item.popularity * 10) / 10,
  };
}

// ─── Public API functions ─────────────────────────────────────────────────────

export async function getTrending(): Promise<TrendItem[]> {
  const data = (await tmdbFetch(
    "/trending/tv/week?language=en-US"
  )) as TmdbListResponse;
  return data.results.map((item, i) => ({
    ...mapToTmdbShow(item),
    rank: i + 1,
    originalName: item.original_name,
  }));
}

export async function getNewShows(): Promise<NewShowItem[]> {
  const fourMonthsAgo = new Date();
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
  const dateStr = fourMonthsAgo.toISOString().split("T")[0];
  const data = (await tmdbFetch(
    `/discover/tv?sort_by=popularity.desc&first_air_date.gte=${dateStr}&vote_count.gte=20&language=en-US`
  )) as TmdbListResponse;
  return data.results.slice(0, 20).map((item) => ({
    ...mapToTmdbShow(item),
    firstAirDate: item.first_air_date ?? null,
  }));
}

export async function getTopRated(): Promise<TopRatedItem[]> {
  const data = (await tmdbFetch(
    "/tv/top_rated?language=en-US"
  )) as TmdbListResponse;
  return data.results.slice(0, 20).map(mapToTmdbShow);
}

/** Resolves a TVDB series ID to a TMDB ID. Returns null if not found. */
export async function findByTvdbId(tvdbId: number): Promise<number | null> {
  try {
    const data = (await tmdbFetch(
      `/find/${tvdbId}?external_source=tvdb_id`
    )) as TmdbFindResponse;
    return data.tv_results[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches recommendations for each TMDB ID in `tmdbIds`, aggregates by
 * frequency, and returns deduplicated results sorted by score desc then
 * popularity desc.
 *
 * @param tmdbIds       TMDB IDs of shows in the user's library
 * @param libraryNames  Map of tmdbId → show name (used for becauseOf label)
 * @param excludeIds    Set of TMDB IDs to exclude (already in user's library)
 */
export async function getRecommendations(
  tmdbIds: number[],
  libraryNames: Map<number, string>,
  excludeIds: Set<number>
): Promise<RecommendedItem[]> {
  const scores = new Map<
    number,
    { show: TmdbListResult; sourceCounts: Map<number, number> }
  >();

  // Process in batches of 10 concurrent requests
  for (let i = 0; i < tmdbIds.length; i += 10) {
    const batch = tmdbIds.slice(i, i + 10);
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        try {
          const data = (await tmdbFetch(
            `/tv/${id}/recommendations?language=en-US`
          )) as TmdbListResponse;
          return { sourceId: id, results: data.results };
        } catch {
          return { sourceId: id, results: [] as TmdbListResult[] };
        }
      })
    );

    for (const { sourceId, results } of batchResults) {
      for (const show of results) {
        if (excludeIds.has(show.id)) continue;
        const existing = scores.get(show.id);
        if (existing) {
          existing.sourceCounts.set(sourceId, (existing.sourceCounts.get(sourceId) ?? 0) + 1);
        } else {
          scores.set(show.id, {
            show,
            sourceCounts: new Map([[sourceId, 1]]),
          });
        }
      }
    }
  }

  return Array.from(scores.values())
    .map(({ show, sourceCounts }) => {
      const count = Array.from(sourceCounts.values()).reduce((a, b) => a + b, 0);
      // Pick the library show that most frequently triggered this recommendation
      const topSourceId = Array.from(sourceCounts.entries()).sort(([, a], [, b]) => b - a)[0][0];
      const becauseOf = libraryNames.get(topSourceId) ?? "your library";
      return { show, count, becauseOf };
    })
    .sort((a, b) => b.count - a.count || b.show.popularity - a.show.popularity)
    .slice(0, 20)
    .map(({ show, count, becauseOf }) => ({
      ...mapToTmdbShow(show),
      becauseOf,
      score: count,
    }));
}
