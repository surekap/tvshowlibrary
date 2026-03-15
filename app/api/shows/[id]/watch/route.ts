export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { episodes, watchedEpisodes } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";

// POST /api/shows/[id]/watch  — bulk mark episodes watched/unwatched
// Body: { episodeIds: number[], watched: boolean }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    if (!Array.isArray(episodeIds) || episodeIds.length === 0) {
      return NextResponse.json(
        { error: "episodeIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Verify all episodes belong to this show
    const validEpisodes = await db
      .select({ id: episodes.id })
      .from(episodes)
      .where(eq(episodes.showId, showId));

    const validIds = new Set(validEpisodes.map((e) => e.id));
    const filteredIds = episodeIds.filter((id) => validIds.has(id));

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
          .values(toInsert.map((episodeId) => ({ episodeId })))
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
