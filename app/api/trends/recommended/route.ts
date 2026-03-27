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
