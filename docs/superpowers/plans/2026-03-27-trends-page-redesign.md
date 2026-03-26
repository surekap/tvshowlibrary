# Trends Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the slow TMDB-export-based trends page with a four-section page (Trending, New Shows, Recommended, Top Rated) powered by the TMDB REST API, with a side-by-side desktop layout.

**Architecture:** A new `lib/tmdb.ts` client handles all TMDB calls. `/api/trends` returns the three global sections (cached 24h, shared across users). A new `/api/trends/recommended` route returns personalized recommendations (cached 12h per user). The page fetches both in parallel and renders each section independently.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM (Neon HTTP), TMDB REST API v3, Tailwind CSS

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/tmdb.ts` | Create | TMDB API client — all fetch functions + shared types |
| `lib/schema.ts` | Modify | Add `recommendationsCache` table |
| `app/api/trends/route.ts` | Rewrite | Use TMDB API; return `{ trending, newShows, topRated }` |
| `app/api/trends/recommended/route.ts` | Create | Per-user recommendations, cached 12h |
| `app/trends/page.tsx` | Rewrite | New layout: main trending column + three sidebar panels |
| `.env.example` | Modify | Add `TMDB_API_KEY` and `TMDB_READ_TOKEN` |

---

## Task 1: Add TMDB environment variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update `.env.example`**

Open `.env.example` and add after `TVDB_API_KEY`:

```
TMDB_API_KEY=your_tmdb_api_key
TMDB_READ_TOKEN=your_tmdb_read_access_token
```

- [ ] **Step 2: Add to `.env.local`**

Add to your local `.env.local` (not committed):
```
TMDB_API_KEY=94bec1a926e5478f2d76a698eec492be
TMDB_READ_TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5NGJlYzFhOTI2ZTU0NzhmMmQ3NmE2OThlZWM0OTJiZSIsIm5iZiI6MTMyODc0MDI2MC4wLCJzdWIiOiI0ZjMyZjdhNDc2MGVlMzMxMWQwMDA0NGIiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.kD_gOv-rcdlFkhVfhvMkAtpIE0wsbPLR8Tw77c_wy0Y
```

- [ ] **Step 3: Verify env vars are accessible**

Run:
```bash
node --env-file=.env.local -e "console.log(!!process.env.TMDB_READ_TOKEN)"
```
Expected output: `true`

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: add TMDB env vars to example"
```

---

## Task 2: Add `recommendationsCache` table to schema

**Files:**
- Modify: `lib/schema.ts`

- [ ] **Step 1: Add the table definition**

In `lib/schema.ts`, after the `trendsCache` table definition (around line 181), add:

```ts
export const recommendationsCache = pgTable("recommendations_cache", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  data: text("data").notNull(), // JSON array of RecommendedItem
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index("recommendations_cache_user_id_idx").on(t.userId),
}));
```

- [ ] **Step 2: Push schema to database**

```bash
npm run db:push
```

Expected output ends with: `[✓] Changes applied` or `[i] No changes detected`

- [ ] **Step 3: Verify table exists**

```bash
node --env-file=.env.local -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT table_name FROM information_schema.tables WHERE table_name = 'recommendations_cache'\`
  .then(r => console.log(r.length ? 'table exists' : 'table missing'));
"
```
Expected: `table exists`

- [ ] **Step 4: Commit**

```bash
git add lib/schema.ts
git commit -m "feat: add recommendationsCache table"
```

---

## Task 3: Create `lib/tmdb.ts`

**Files:**
- Create: `lib/tmdb.ts`

- [ ] **Step 1: Create the file**

Create `lib/tmdb.ts` with the full content below:

```ts
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
    { count: number; show: TmdbListResult; becauseOf: string }
  >();

  // Process in batches of 10 concurrent requests
  for (let i = 0; i < tmdbIds.length; i += 10) {
    const batch = tmdbIds.slice(i, i + 10);
    const results = await Promise.all(
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

    for (const { sourceId, results } of results) {
      for (const show of results) {
        if (excludeIds.has(show.id)) continue;
        const existing = scores.get(show.id);
        if (existing) {
          existing.count++;
        } else {
          scores.set(show.id, {
            count: 1,
            show,
            becauseOf: libraryNames.get(sourceId) ?? "your library",
          });
        }
      }
    }
  }

  return Array.from(scores.values())
    .sort(
      (a, b) =>
        b.count - a.count || b.show.popularity - a.show.popularity
    )
    .slice(0, 20)
    .map(({ show, count, becauseOf }) => ({
      ...mapToTmdbShow(show),
      becauseOf,
      score: count,
    }));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no output (zero errors)

- [ ] **Step 3: Smoke-test the TMDB client**

```bash
node --env-file=.env.local --import tsx/esm -e "
import { getTrending } from './lib/tmdb.ts';
getTrending().then(r => console.log('trending count:', r.length, 'first:', r[0]?.name));
"
```
Expected: `trending count: 20 first: <some show name>`

- [ ] **Step 4: Commit**

```bash
git add lib/tmdb.ts
git commit -m "feat: add TMDB API client"
```

---

## Task 4: Rewrite `/api/trends/route.ts`

**Files:**
- Rewrite: `app/api/trends/route.ts`

The route now calls three TMDB functions in parallel and caches the combined result. Response shape changes from `{ trends: TrendItem[] }` to `{ trending, newShows, topRated, cachedAt, fresh }`.

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `app/api/trends/route.ts` with:

```ts
export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { trendsCache } from "@/lib/schema";
import { getTrending, getNewShows, getTopRated } from "@/lib/tmdb";
import type { TrendItem, NewShowItem, TopRatedItem } from "@/lib/tmdb";

export type { TrendItem, NewShowItem, TopRatedItem };

export interface TrendsPayload {
  trending: TrendItem[];
  newShows: NewShowItem[];
  topRated: TopRatedItem[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function buildTrendsPayload(): Promise<TrendsPayload> {
  const [trending, newShows, topRated] = await Promise.all([
    getTrending(),
    getNewShows(),
    getTopRated(),
  ]);
  return { trending, newShows, topRated };
}

export async function GET() {
  try {
    // No auth required — global data, same for all users
    const [cached] = await db
      .select()
      .from(trendsCache)
      .orderBy(desc(trendsCache.cachedAt))
      .limit(1);

    if (cached) {
      const age = Date.now() - new Date(cached.cachedAt).getTime();
      if (age < CACHE_TTL_MS) {
        const payload = JSON.parse(cached.data) as TrendsPayload;
        // Guard against old cache format (flat TrendItem array from previous implementation)
        if (Array.isArray(payload)) {
          // Stale format — fall through to rebuild
        } else {
          return NextResponse.json({
            ...payload,
            cachedAt: cached.cachedAt,
            fresh: false,
          });
        }
      }
    }

    const payload = await buildTrendsPayload();

    await db.delete(trendsCache);
    await db.insert(trendsCache).values({ data: JSON.stringify(payload) });

    return NextResponse.json({
      ...payload,
      cachedAt: new Date(),
      fresh: true,
    });
  } catch (error) {
    console.error("GET /api/trends error:", error);
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no output

- [ ] **Step 3: Test the endpoint manually**

Start the dev server (`npm run dev -- -p 3002`), then:
```bash
curl -s http://localhost:3002/api/trends | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
console.log('trending:', d.trending?.length, 'newShows:', d.newShows?.length, 'topRated:', d.topRated?.length);
"
```
Expected: `trending: 20 newShows: 20 topRated: 20`

- [ ] **Step 4: Commit**

```bash
git add app/api/trends/route.ts
git commit -m "feat: rewrite trends route to use TMDB API directly"
```

---

## Task 5: Create `/api/trends/recommended/route.ts`

**Files:**
- Create: `app/api/trends/recommended/route.ts`

- [ ] **Step 1: Create the file**

Create `app/api/trends/recommended/route.ts`:

```ts
export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { shows, recommendationsCache } from "@/lib/schema";
import {
  findByTvdbId,
  getRecommendations,
} from "@/lib/tmdb";
import type { RecommendedItem } from "@/lib/tmdb";

export type { RecommendedItem };

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check per-user cache
    const [cached] = await db
      .select()
      .from(recommendationsCache)
      .where(eq(recommendationsCache.userId, userId))
      .orderBy(desc(recommendationsCache.cachedAt))
      .limit(1);

    if (cached) {
      const age = Date.now() - new Date(cached.cachedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return NextResponse.json({
          recommended: JSON.parse(cached.data) as RecommendedItem[],
          cachedAt: cached.cachedAt,
        });
      }
    }

    // Load user's library
    const libraryShows = await db
      .select({ id: shows.id, name: shows.name, tvdbId: shows.tvdbId })
      .from(shows)
      .where(eq(shows.userId, userId));

    if (libraryShows.length === 0) {
      return NextResponse.json({ recommended: [], cachedAt: new Date() });
    }

    // Resolve TVDB IDs → TMDB IDs in batches of 10
    const resolved: Array<{ tmdbId: number; name: string }> = [];
    for (let i = 0; i < libraryShows.length; i += 10) {
      const batch = libraryShows.slice(i, i + 10);
      const tmdbIds = await Promise.all(
        batch.map((s) => findByTvdbId(s.tvdbId))
      );
      for (let j = 0; j < batch.length; j++) {
        const tmdbId = tmdbIds[j];
        if (tmdbId !== null) {
          resolved.push({ tmdbId, name: batch[j].name });
        }
      }
    }

    if (resolved.length === 0) {
      return NextResponse.json({ recommended: [], cachedAt: new Date() });
    }

    const tmdbIds = resolved.map((r) => r.tmdbId);
    const libraryNames = new Map(resolved.map((r) => [r.tmdbId, r.name]));
    const excludeIds = new Set(tmdbIds);

    const recommended = await getRecommendations(tmdbIds, libraryNames, excludeIds);

    // Save to per-user cache (delete old entry first)
    await db
      .delete(recommendationsCache)
      .where(eq(recommendationsCache.userId, userId));
    await db.insert(recommendationsCache).values({
      userId,
      data: JSON.stringify(recommended),
    });

    return NextResponse.json({ recommended, cachedAt: new Date() });
  } catch (error) {
    console.error("GET /api/trends/recommended error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no output

- [ ] **Step 3: Test the endpoint**

With the dev server running and while logged in:
```bash
curl -s -H "Cookie: <your session cookie>" http://localhost:3002/api/trends/recommended | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
console.log('recommended:', d.recommended?.length, 'first:', d.recommended?.[0]?.name, 'because:', d.recommended?.[0]?.becauseOf);
"
```
Expected: `recommended: <number> first: <show name> because: <library show name>`

Or open http://localhost:3002/api/trends/recommended in the browser while logged in.

- [ ] **Step 4: Commit**

```bash
git add app/api/trends/recommended/route.ts
git commit -m "feat: add personalized recommendations route"
```

---

## Task 6: Rewrite `app/trends/page.tsx`

**Files:**
- Rewrite: `app/trends/page.tsx`

New layout: main column (trending ranked list) + right sidebar (New Shows, Picked for You, All-Time Best). Both fetches happen in parallel on mount.

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `app/trends/page.tsx` with:

```tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TrendItem, NewShowItem, TopRatedItem, RecommendedItem, TmdbShow } from "@/lib/tmdb";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendsData {
  trending: TrendItem[];
  newShows: NewShowItem[];
  topRated: TopRatedItem[];
  cachedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RANK_COLORS: Record<number, string> = {
  1: "var(--rank-gold)",
  2: "var(--rank-silver)",
  3: "var(--rank-bronze)",
};

function getRankColor(rank: number): string {
  return RANK_COLORS[rank] ?? "var(--text-dim)";
}

function StarRating({ score }: { score: number }) {
  return (
    <span className="text-xs text-[var(--text-secondary)] tabular-nums">
      ★ {score.toFixed(1)}
    </span>
  );
}

// ─── Compact card (sidebar) ───────────────────────────────────────────────────

function CompactCard({
  show,
  subLabel,
}: {
  show: TmdbShow;
  subLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      {/* Poster */}
      <div className="relative w-10 h-14 flex-shrink-0 bg-[var(--bg-elevated)] rounded overflow-hidden">
        {show.posterUrl ? (
          <Image
            src={show.posterUrl}
            alt={show.name}
            fill
            className="object-cover"
            sizes="40px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg aria-hidden="true" className="w-4 h-4 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate leading-tight">
          {show.name}
        </p>
        {subLabel && (
          <p className="text-[10px] text-[var(--text-dim)] truncate mt-0.5">
            {subLabel}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {show.genres[0] && (
            <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded truncate max-w-[80px]">
              {show.genres[0]}
            </span>
          )}
          <StarRating score={show.voteAverage} />
        </div>
      </div>

      {/* Track */}
      <Link
        href={`/browse?q=${encodeURIComponent(show.name)}`}
        className="flex-shrink-0 text-[10px] font-medium text-[var(--accent-hover)] hover:text-[var(--accent)] hover:underline transition-colors"
      >
        + Track
      </Link>
    </div>
  );
}

// ─── Sidebar panel ────────────────────────────────────────────────────────────

function SidebarPanel({
  title,
  loading,
  error,
  children,
}: {
  title: string;
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-dim)] mb-3">
        {title}
      </h2>
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton w-10 h-14 rounded flex-shrink-0" />
              <div className="flex-1 space-y-1.5 py-1">
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-2.5 w-1/2 rounded" />
                <div className="skeleton h-2.5 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : (
        children
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [recommended, setRecommended] = useState<RecommendedItem[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [recommendedError, setRecommendedError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/trends", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(setTrendsData)
      .catch(() => setTrendsError("Failed to load trending shows."))
      .finally(() => setTrendsLoading(false));

    fetch("/api/trends/recommended", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then((data) => setRecommended(data.recommended ?? []))
      .catch(() => setRecommendedError("Failed to load recommendations."))
      .finally(() => setRecommendedLoading(false));
  }, []);

  const trending = trendsData?.trending ?? [];
  const maxPopularity = trending[0]?.popularity ?? 1;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-[var(--text-primary)]">Trending TV Shows</h1>
          <p className="section-subtitle">Ranked by TMDB weekly popularity</p>
        </div>
        {trendsData?.cachedAt && (
          <div className="text-right flex-shrink-0">
            <span className="text-xs text-[var(--text-dim)]">
              Updated{" "}
              {new Date(trendsData.cachedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <p className="text-xs text-[var(--text-dim)]/60 mt-0.5">refreshes every 24h</p>
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Main column: Trending ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {trendsLoading ? (
            <div className="space-y-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="skeleton h-28 rounded-xl" />
              ))}
              <p className="text-center text-xs text-[var(--text-dim)] mt-4 animate-pulse">
                Loading trending data…
              </p>
            </div>
          ) : trendsError ? (
            <div className="text-center py-20">
              <p className="text-[var(--danger)]">{trendsError}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trending.map((item) => {
                const barWidth = (item.popularity / maxPopularity) * 100;
                const rankColor = getRankColor(item.rank);
                return (
                  <div
                    key={`${item.tmdbId}-${item.rank}`}
                    className="card relative overflow-hidden group"
                  >
                    {/* Popularity bar */}
                    <div
                      className="absolute inset-y-0 left-0 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity"
                      style={{ width: `${barWidth}%`, backgroundColor: rankColor }}
                    />
                    <div className="relative flex items-stretch">
                      {/* Poster */}
                      <div className="relative w-16 sm:w-20 flex-shrink-0 bg-[var(--bg-elevated)]">
                        {item.posterUrl ? (
                          <Image
                            src={item.posterUrl}
                            alt={item.name}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        ) : (
                          <div className="w-full h-full min-h-[7rem] flex items-center justify-center">
                            <svg aria-hidden="true" className="w-6 h-6 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
                        {/* Rank */}
                        <div className="flex-shrink-0 w-7 text-center">
                          <span className="text-sm font-bold tabular-nums" style={{ color: rankColor }}>
                            {item.rank}
                          </span>
                        </div>
                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[var(--text-primary)] text-sm">
                              {item.name}
                            </span>
                            {item.genres[0] && (
                              <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded hidden sm:inline">
                                {item.genres[0]}
                              </span>
                            )}
                          </div>
                          {item.overview && (
                            <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed hidden sm:block">
                              {item.overview}
                            </p>
                          )}
                        </div>
                        {/* Score + track */}
                        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                          <StarRating score={item.voteAverage} />
                          <div className="w-16 h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${barWidth}%`, backgroundColor: rankColor }}
                            />
                          </div>
                          <Link
                            href={`/browse?q=${encodeURIComponent(item.name)}`}
                            className="text-[10px] font-medium text-[var(--accent-hover)] hover:text-[var(--accent)] hover:underline transition-colors whitespace-nowrap"
                          >
                            + Track
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
          {/* New This Season */}
          <SidebarPanel
            title="New This Season"
            loading={trendsLoading}
            error={trendsError}
          >
            {(trendsData?.newShows ?? []).slice(0, 5).map((show) => (
              <CompactCard
                key={show.tmdbId}
                show={show}
                subLabel={
                  show.firstAirDate
                    ? `Premiered ${new Date(show.firstAirDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                    : undefined
                }
              />
            ))}
          </SidebarPanel>

          {/* Picked for You */}
          <SidebarPanel
            title="Picked for You"
            loading={recommendedLoading}
            error={recommendedError}
          >
            {recommended.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)]">
                Add more shows to your library to get personalised recommendations.
              </p>
            ) : (
              recommended.slice(0, 5).map((show) => (
                <CompactCard
                  key={show.tmdbId}
                  show={show}
                  subLabel={`Because you watch ${show.becauseOf}`}
                />
              ))
            )}
          </SidebarPanel>

          {/* All-Time Best */}
          <SidebarPanel
            title="All-Time Best"
            loading={trendsLoading}
            error={trendsError}
          >
            {(trendsData?.topRated ?? []).slice(0, 5).map((show) => (
              <CompactCard key={show.tmdbId} show={show} />
            ))}
          </SidebarPanel>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--text-dim)]">
        Source: TMDB API · personalised recommendations based on your library
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no output

- [ ] **Step 3: Add TMDB poster domain to next.config.mjs**

Open `next.config.mjs` and add `image.tmdb.org` to `remotePatterns`:

```js
remotePatterns: [
  {
    protocol: "https",
    hostname: "artworks.thetvdb.com",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "*.thetvdb.com",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "image.tmdb.org",
    pathname: "/**",
  },
],
```

- [ ] **Step 4: Verify the page loads**

With dev server running, open http://localhost:3002/trends while logged in.

Verify:
- Trending column shows 20 ranked shows with posters and star ratings
- "New This Season" sidebar panel shows 5 shows with premiere dates
- "Picked for You" shows 5 recommendations with "Because you watch X" labels
- "All-Time Best" shows 5 top-rated shows
- On mobile (resize browser), all four sections stack vertically

- [ ] **Step 5: Commit**

```bash
git add app/trends/page.tsx next.config.mjs
git commit -m "feat: redesign trends page with four sections and sidebar layout"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Best new shows → `getNewShows()` + "New This Season" panel
- ✅ Recommended shows based on library → `getRecommendations()` + "Picked for You" panel
- ✅ Top shows / trending → `getTrending()` + main column + "All-Time Best" panel
- ✅ TMDB API integration → `lib/tmdb.ts`
- ✅ JustWatch dropped in favour of TMDB Watch Providers (deferred to out-of-scope)
- ✅ `recommendationsCache` table → Task 2
- ✅ Two routes (`/api/trends`, `/api/trends/recommended`) → Tasks 4 and 5
- ✅ Side-by-side desktop, stacked mobile → Task 6
- ✅ `becauseOf` label on recommendations → `getRecommendations()` + `CompactCard`
- ✅ Old trendsCache format guard (flat array) → Task 4 route handles it

**Type consistency check:**
- `TmdbShow` defined in `lib/tmdb.ts`, used in `CompactCard` prop → ✅
- `TrendItem`, `NewShowItem`, `TopRatedItem`, `RecommendedItem` all extend `TmdbShow` → ✅
- `TrendsData` interface in page matches route response shape → ✅
- `recommendationsCache` imported in Task 5 route — must be exported from `lib/schema.ts` (added in Task 2) → ✅

**Placeholder scan:** None found.
