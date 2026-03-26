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
        if (!Array.isArray(payload)) {
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
