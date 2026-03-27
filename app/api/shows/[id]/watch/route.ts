export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { episodes, shows, watchedEpisodes } from "@/lib/schema";

// POST /api/shows/[id]/watch  — bulk mark episodes watched/unwatched
// Body: { episodeIds: number[], watched: boolean }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const showId = parseInt(idStr, 10);
    if (isNaN(showId)) {
      return NextResponse.json({ error: "Invalid show ID" }, { status: 400 });
    }

    const body = await request.json();
    const { episodeIds, watched } = body as {
      episodeIds: number[];
      watched: boolean;
    };

    const show = await db.query.shows.findFirst({
      where: and(eq(shows.id, showId), eq(shows.userId, userId)),
    });

    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    if (!Array.isArray(episodeIds) || episodeIds.length === 0) {
      return NextResponse.json(
        { error: "episodeIds must be a non-empty array" },
        { status: 400 }
      );
    }

    const validatedIds = (episodeIds as unknown[]).filter(
      (id): id is number => Number.isInteger(id) && (id as number) > 0
    );

    if (validatedIds.length === 0) {
      return NextResponse.json(
        { error: "episodeIds must contain positive integers" },
        { status: 400 }
      );
    }

    if (validatedIds.length > 1000) {
      return NextResponse.json(
        { error: "episodeIds must not exceed 1000 entries" },
        { status: 400 }
      );
    }

    if (typeof watched !== "boolean") {
      return NextResponse.json(
        { error: "watched must be a boolean" },
        { status: 400 }
      );
    }

    // Verify all episodes belong to this show
    const validEpisodes = await db
      .select({ id: episodes.id })
      .from(episodes)
      .where(eq(episodes.showId, showId));

    const validShowEpisodeIds = new Set(validEpisodes.map((e) => e.id));
    const filteredIds = validatedIds.filter((id) => validShowEpisodeIds.has(id));

    if (filteredIds.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    if (watched) {
      // Get already-watched so we don't duplicate
      const alreadyWatched = await db
        .select({ episodeId: watchedEpisodes.episodeId })
        .from(watchedEpisodes)
        .where(inArray(watchedEpisodes.episodeId, filteredIds));

      const alreadyWatchedSet = new Set(alreadyWatched.map((w) => w.episodeId));
      const toInsert = filteredIds.filter((id) => !alreadyWatchedSet.has(id));

      if (toInsert.length > 0) {
        await db
          .insert(watchedEpisodes)
          .values(toInsert.map((episodeId) => ({ episodeId, userId })))
          .onConflictDoNothing();
      }
    } else {
      await db
        .delete(watchedEpisodes)
        .where(inArray(watchedEpisodes.episodeId, filteredIds));
    }

    return NextResponse.json({ updated: filteredIds.length });
  } catch (error) {
    console.error("POST /api/shows/[id]/watch error:", error);
    return NextResponse.json(
      { error: "Failed to update watch status" },
      { status: 500 }
    );
  }
}
