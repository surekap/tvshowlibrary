export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { gunzipSync } from "zlib";
import { db } from "@/lib/db";
import { trendsCache } from "@/lib/schema";
import { searchShows } from "@/lib/tvdb";
import { desc } from "drizzle-orm";

export interface TrendItem {
  rank: number;
  tmdbId: number;
  originalName: string;
  popularity: number;
  name: string;
  overview: string | null;
  posterUrl: string | null;
  status: string;
  network: string | null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TOP_N = 50;
// How many candidates to pull from TMDB export (we need extras since some won't be airing)
const CANDIDATES = 200;
const CONCURRENT = 8;

// Statuses that mean the show is currently airing
const AIRING_STATUSES = new Set([
  "continuing",
  "returning series",
  "upcoming",
  "pilot",
  "in production",
]);

function isAiring(status: string | undefined): boolean {
  if (!status) return false;
  return AIRING_STATUSES.has(status.toLowerCase());
}

function getExportUrl(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `https://files.tmdb.org/p/exports/tv_series_ids_${mm}_${dd}_${yyyy}.json.gz`;
}

type RawItem = { id: number; original_name: string; popularity: number };

async function downloadTopCandidates(): Promise<RawItem[]> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  let buf: Buffer | null = null;
  for (const date of [now, yesterday]) {
    const res = await fetch(getExportUrl(date), { cache: "no-store" });
    if (res.ok) { buf = Buffer.from(await res.arrayBuffer()); break; }
  }
  if (!buf) throw new Error("Could not download TMDB export");

  const text = gunzipSync(buf).toString("utf-8");
  const all: RawItem[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try { all.push(JSON.parse(line) as RawItem); } catch { /* skip */ }
  }
  all.sort((a, b) => b.popularity - a.popularity);
  return all.slice(0, CANDIDATES);
}

async function enrichItem(item: RawItem): Promise<TrendItem | null> {
  try {
    const results = await searchShows(item.original_name);
    if (!results.length) return null;

    const tmdbIdStr = String(item.id);

    // Prefer the result whose remote_ids includes the matching TMDB ID
    const match =
      results.find((r) =>
        r.remote_ids?.some(
          (rid) =>
            rid.sourceName?.toLowerCase() === "tmdb" && rid.id === tmdbIdStr
        )
      ) ?? results[0];

    if (!isAiring(match.status)) return null;

    return {
      rank: 0, // assigned after sorting
      tmdbId: item.id,
      originalName: item.original_name,
      popularity: Math.round(item.popularity * 10) / 10,
      name: match.name,
      overview: match.overview ?? null,
      posterUrl: match.image_url ?? null,
      status: match.status ?? "Continuing",
      network: match.network ?? null,
    };
  } catch {
    return null;
  }
}

async function buildTrends(): Promise<TrendItem[]> {
  const candidates = await downloadTopCandidates();
  const enriched: TrendItem[] = [];

  // Process in concurrent batches, stop early once we have TOP_N
  for (let i = 0; i < candidates.length && enriched.length < TOP_N; i += CONCURRENT) {
    const batch = candidates.slice(i, i + CONCURRENT);
    const results = await Promise.all(batch.map(enrichItem));
    for (const r of results) {
      if (r && enriched.length < TOP_N) enriched.push(r);
    }
    // Small pause between batches to respect TVDB rate limits
    if (i + CONCURRENT < candidates.length && enriched.length < TOP_N) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return enriched.map((item, i) => ({ ...item, rank: i + 1 }));
}

export async function GET() {
  try {
    // Check DB cache first
    const [cached] = await db
      .select()
      .from(trendsCache)
      .orderBy(desc(trendsCache.cachedAt))
      .limit(1);

    if (cached) {
      const age = Date.now() - new Date(cached.cachedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return NextResponse.json({
          trends: JSON.parse(cached.data) as TrendItem[],
          cachedAt: cached.cachedAt,
          fresh: false,
        });
      }
    }

    const trends = await buildTrends();

    await db.delete(trendsCache);
    await db.insert(trendsCache).values({ data: JSON.stringify(trends) });

    return NextResponse.json({ trends, cachedAt: new Date(), fresh: true });
  } catch (error) {
    console.error("GET /api/trends error:", error);
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
  }
}
