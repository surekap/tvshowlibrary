# Trends Page Redesign

**Date:** 2026-03-27
**Status:** Approved

## Goal

Replace the current single-section trends page (TMDB daily export + TVDB enrichment) with a four-section page powered by the TMDB API directly. Sections: Trending This Week, New This Season, Picked for You (personalized), All-Time Best.

---

## Architecture

### New file: `lib/tmdb.ts`

Typed TMDB API client. All calls use the `TMDB_READ_TOKEN` bearer token from env. Base URL: `https://api.themoviedb.org/3`.

Functions:

| Function | Endpoint | Notes |
|---|---|---|
| `getTrending()` | `GET /trending/tv/week` | Returns top 20 |
| `getNewShows()` | `GET /discover/tv?sort_by=popularity.desc&first_air_date.gte=<4 months ago>&vote_count.gte=20` | Recently premiered only, filters noise |
| `getTopRated()` | `GET /tv/top_rated` | Returns top 20 |
| `getRecommendations(tmdbIds)` | `GET /tv/{id}/recommendations` per ID | Aggregated, deduplicated, sorted by frequency then popularity |
| `findByTvdbId(tvdbId)` | `GET /find/{tvdbId}?external_source=tvdb_id` | Converts TVDB ID → TMDB ID |

TMDB returns posters, overviews, genres, ratings, and networks directly — TVDB enrichment is no longer needed for the trends page.

Poster URLs are constructed as: `https://image.tmdb.org/t/p/w300{poster_path}`

### API Routes

**`GET /api/trends`** (modified)
- Checks `trendsCache` DB table; serves cached data if age < 24h
- On miss: calls `getTrending()`, `getNewShows()`, `getTopRated()` in parallel
- Stores result as `{ trending: TrendItem[], newShows: NewShowItem[], topRated: TopRatedItem[] }`
- Response shape changes from flat `TrendItem[]` to the above object — existing cache rows are invalidated on first hit (stale row deleted, fresh data stored)
- No auth required for this route (data is global, not user-specific)

**`GET /api/trends/recommended`** (new)
- Requires auth (returns 401 if unauthenticated)
- Loads user's shows from DB (name + tvdbId)
- Calls `findByTvdbId()` for each show to resolve TMDB IDs (batched, 10 concurrent; works for typical library sizes of 10–200 shows)
- Calls `getRecommendations()` with resolved TMDB IDs
- Filters out shows already in the user's library
- Attaches a `becauseOf: string` label (name of the user's show that most frequently triggered this recommendation)
- Checks `recommendationsCache` table; serves if age < 12h
- Stores result per user

### Schema additions (`lib/schema.ts`)

```
recommendationsCache:
  id          serial PK
  userId      text NOT NULL references users(id) ON DELETE CASCADE
  data        text NOT NULL  -- JSON array of RecommendedItem
  cachedAt    timestamp DEFAULT NOW()

Index: recommendationsCache_userId_idx on (userId)
```

The existing `trendsCache` table is reused as-is; only the JSON shape stored in `data` changes.

---

## Data Types

```ts
// lib/tmdb.ts exports

interface TmdbShow {
  tmdbId: number
  name: string
  overview: string | null
  posterUrl: string | null
  genres: string[]
  voteAverage: number      // 0–10
  popularity: number
}

// /api/trends response
interface TrendsResponse {
  trending:  TrendItem[]        // existing type, extended with voteAverage + genres
  newShows:  NewShowItem[]      // TmdbShow + firstAirDate
  topRated:  TopRatedItem[]     // TmdbShow
  cachedAt:  string
}

// /api/trends/recommended response
interface RecommendedItem extends TmdbShow {
  becauseOf: string             // e.g. "Severance"
  score: number                 // how many library shows recommended this
}
```

---

## UI Layout

### Desktop (md+): side-by-side

```
┌─────────────────────────────┬──────────────────────┐
│  Trending This Week         │  New This Season      │
│  (ranked list, 20 items)    │  (5 compact cards)    │
│  — same style as today —    ├──────────────────────┤
│                             │  Picked for You       │
│                             │  (5 compact cards)    │
│                             │  "because you watch X"│
│                             ├──────────────────────┤
│                             │  All-Time Best        │
│                             │  (5 compact cards)    │
└─────────────────────────────┴──────────────────────┘
```

### Mobile: stacked vertically in order
Trending → New This Season → Picked for You → All-Time Best

### Compact card (sidebar panels)

Each card shows: poster thumbnail (40×60px), show name, primary genre, TMDB rating (★ score), `+ Track` link. "Picked for You" cards add a `"Because you watch {X}"` sub-label in dimmed text.

### Loading behaviour

- `/api/trends` and `/api/trends/recommended` are fetched in parallel on mount
- Trending, New, Top Rated render when `/api/trends` resolves
- Recommended renders when `/api/trends/recommended` resolves
- Each section shows a skeleton while its data is pending
- Each section shows an inline error state independently (one failure does not block others)

---

## Environment Variables

Add to `.env.local` and `.env.example`:
```
TMDB_API_KEY=...
TMDB_READ_TOKEN=...
```

---

## What Changes vs Today

| Today | After |
|---|---|
| Downloads ~10MB TMDB gzip export | Direct TMDB API calls (fast) |
| Enriches via TVDB search (slow, rate-limited) | TMDB provides all metadata directly |
| Single "Trending" section | Four sections |
| No personalization | "Picked for You" based on library |
| `trendsCache` stores flat `TrendItem[]` | Stores `{ trending, newShows, topRated }` |
| maxDuration = 60s | Should be well under 10s |

---

## Out of Scope

- JustWatch streaming availability (TMDB Watch Providers not included in this redesign)
- New seasons / returning shows section (user selected "new series only")
- Infinite scroll or pagination within sections
