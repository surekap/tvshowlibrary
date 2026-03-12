export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shows, episodes } from "@/lib/schema";
import { getShow, getEpisodes } from "@/lib/tvdb";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const allShows = await db.query.shows.findMany({
      orderBy: (shows, { asc }) => [asc(shows.name)],
      with: {
        episodes: {
          with: {
            watchedEpisodes: true,
          },
        },
      },
    });

    const formatted = allShows.map((show) => {
      const totalEpisodes = show.episodes.length;
      const watchedCount = show.episodes.filter(
        (ep) => ep.watchedEpisodes.length > 0
      ).length;

      return {
        id: show.id,
        tvdbId: show.tvdbId,
        name: show.name,
        overview: show.overview,
        posterUrl: show.posterUrl,
        status: show.status,
        network: show.network,
        createdAt: show.createdAt,
        totalEpisodes,
        watchedCount,
      };
    });

    return NextResponse.json({ shows: formatted });
  } catch (error) {
    console.error("GET /api/shows error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shows" },
      { status: 500 }
    );
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

    // Check if show already exists
    const existing = await db.query.shows.findFirst({
      where: eq(shows.tvdbId, tvdbId),
    });

    if (existing) {
      return NextResponse.json(
        { error: "Show already in watchlist" },
        { status: 409 }
      );
    }

    // Fetch show details from TVDB
    const tvdbShow = await getShow(tvdbId);
    if (!tvdbShow) {
      return NextResponse.json(
        { error: "Show not found on TVDB" },
        { status: 404 }
      );
    }

    // Determine poster URL
    let posterUrl: string | null = null;
    if (tvdbShow.image) {
      posterUrl = tvdbShow.image;
    }

    // Insert show into DB
    const [newShow] = await db
      .insert(shows)
      .values({
        tvdbId: tvdbShow.id,
        name: tvdbShow.name,
        overview: tvdbShow.overview ?? null,
        posterUrl,
        status: tvdbShow.status?.name ?? null,
        network: tvdbShow.originalNetwork?.name ?? null,
      })
      .returning();

    // Fetch all episodes
    const tvdbEpisodes = await getEpisodes(tvdbId);

    if (tvdbEpisodes.length > 0) {
      // Filter valid episodes (must have season and episode number)
      const validEpisodes = tvdbEpisodes.filter(
        (ep) =>
          ep.id &&
          typeof ep.seasonNumber === "number" &&
          typeof ep.number === "number"
      );

      // Insert episodes in batches of 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < validEpisodes.length; i += BATCH_SIZE) {
        const batch = validEpisodes.slice(i, i + BATCH_SIZE);
        await db.insert(episodes).values(
          batch.map((ep) => ({
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
    return NextResponse.json(
      { error: "Failed to add show" },
      { status: 500 }
    );
  }
}
