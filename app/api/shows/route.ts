export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shows, episodes, watchedEpisodes } from "@/lib/schema";
import { getShow, getEpisodes } from "@/lib/tvdb";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
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
        createdAt: shows.createdAt,
        totalEpisodes: sql<number>`count(distinct ${episodes.id})`.as("total_episodes"),
        watchedCount: sql<number>`count(distinct ${watchedEpisodes.id})`.as("watched_count"),
      })
      .from(shows)
      .leftJoin(episodes, eq(episodes.showId, shows.id))
      .leftJoin(watchedEpisodes, eq(watchedEpisodes.episodeId, episodes.id))
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
    const body = await request.json();
    const { tvdbId } = body;

    if (!tvdbId || typeof tvdbId !== "number") {
      return NextResponse.json(
        { error: "tvdbId is required and must be a number" },
        { status: 400 }
      );
    }

    const existing = await db.query.shows.findFirst({
      where: eq(shows.tvdbId, tvdbId),
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

    return NextResponse.json({ show: newShow }, { status: 201 });
  } catch (error) {
    console.error("POST /api/shows error:", error);
    return NextResponse.json({ error: "Failed to add show" }, { status: 500 });
  }
}
