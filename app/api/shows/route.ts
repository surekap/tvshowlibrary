export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { shows, episodes, watchedEpisodes } from "@/lib/schema";
import { getShow, getEpisodes } from "@/lib/tvdb";
import { findByTvdbId, getShowTmdbDetails } from "@/lib/tmdb";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // COUNT aggregates — much faster than loading all episode rows
    const rows = await db
      .select({
        id: shows.id,
        tvdbId: shows.tvdbId,
        name: shows.name,
        overview: shows.overview,
        posterUrl: shows.posterUrl,
        status: shows.status,
        network: shows.network,
        archived: shows.archived,
        tmdbId: shows.tmdbId,
        imdbId: shows.imdbId,
        tmdbRating: shows.tmdbRating,
        createdAt: shows.createdAt,
        totalEpisodes: sql<number>`count(distinct ${episodes.id})`.as("total_episodes"),
        watchedCount: sql<number>`count(distinct ${watchedEpisodes.id})`.as("watched_count"),
      })
      .from(shows)
      .leftJoin(episodes, eq(episodes.showId, shows.id))
      .leftJoin(watchedEpisodes, eq(watchedEpisodes.episodeId, episodes.id))
      .where(eq(shows.userId, userId))
      .groupBy(shows.id)
      .orderBy(shows.name);

    return NextResponse.json({ shows: rows });
  } catch (error) {
    console.error("GET /api/shows error:", error);
    return NextResponse.json({ error: "Failed to fetch shows" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tvdbId } = body;

    if (!tvdbId || typeof tvdbId !== "number") {
      return NextResponse.json(
        { error: "tvdbId is required and must be a number" },
        { status: 400 }
      );
    }

    const existing = await db.query.shows.findFirst({
      where: and(eq(shows.userId, userId), eq(shows.tvdbId, tvdbId)),
    });

    if (existing) {
      return NextResponse.json({ error: "Show already in watchlist" }, { status: 409 });
    }

    const tvdbShow = await getShow(tvdbId);
    if (!tvdbShow) {
      return NextResponse.json({ error: "Show not found on TVDB" }, { status: 404 });
    }

    const [newShow] = await db
      .insert(shows)
      .values({
        userId,
        tvdbId: tvdbShow.id,
        name: tvdbShow.name,
        overview: tvdbShow.overview ?? null,
        posterUrl: tvdbShow.image ?? null,
        status: tvdbShow.status?.name ?? null,
        network: tvdbShow.originalNetwork?.name ?? null,
      })
      .returning();

    const tvdbEpisodes = await getEpisodes(tvdbId);
    if (tvdbEpisodes.length > 0) {
      const valid = tvdbEpisodes.filter(
        (ep) => ep.id && typeof ep.seasonNumber === "number" && typeof ep.number === "number"
      );
      for (let i = 0; i < valid.length; i += 100) {
        await db.insert(episodes).values(
          valid.slice(i, i + 100).map((ep) => ({
            tvdbId: ep.id,
            showId: newShow.id,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.number,
            name: ep.name ?? null,
            overview: ep.overview ?? null,
            aired: ep.aired ?? null,
            runtime: ep.runtime ?? null,
          }))
        ).onConflictDoNothing();
      }
    }

    // Fetch TMDB details (non-critical — don't fail the request if this errors)
    try {
      const tmdbId = await findByTvdbId(tvdbShow.id);
      if (tmdbId !== null) {
        const { imdbId, voteAverage } = await getShowTmdbDetails(tmdbId);
        await db.update(shows).set({ tmdbId, imdbId, tmdbRating: voteAverage || null }).where(eq(shows.id, newShow.id));
      }
    } catch (e) {
      console.warn("Failed to fetch TMDB details for show:", e);
    }

    return NextResponse.json({ show: newShow }, { status: 201 });
  } catch (error) {
    console.error("POST /api/shows error:", error);
    return NextResponse.json({ error: "Failed to add show" }, { status: 500 });
  }
}
