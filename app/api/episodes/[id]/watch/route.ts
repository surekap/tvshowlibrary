export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { episodes, shows, watchedEpisodes } from "@/lib/schema";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const episodeId = parseInt(idStr, 10);

    if (isNaN(episodeId)) {
      return NextResponse.json(
        { error: "Invalid episode ID" },
        { status: 400 }
      );
    }

    // Verify episode exists
    const [episode] = await db
      .select({ id: episodes.id })
      .from(episodes)
      .innerJoin(shows, eq(shows.id, episodes.showId))
      .where(and(eq(episodes.id, episodeId), eq(shows.userId, userId)))
      .limit(1);

    if (!episode) {
      return NextResponse.json(
        { error: "Episode not found" },
        { status: 404 }
      );
    }

    // Check if already watched
    const existing = await db.query.watchedEpisodes.findFirst({
      where: eq(watchedEpisodes.episodeId, episodeId),
    });

    if (existing) {
      return NextResponse.json({ watched: existing });
    }

    const [watched] = await db
      .insert(watchedEpisodes)
      .values({ episodeId, userId })
      .returning();

    return NextResponse.json({ watched }, { status: 201 });
  } catch (error) {
    console.error("POST /api/episodes/[id]/watch error:", error);
    return NextResponse.json(
      { error: "Failed to mark episode as watched" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const episodeId = parseInt(idStr, 10);

    if (isNaN(episodeId)) {
      return NextResponse.json(
        { error: "Invalid episode ID" },
        { status: 400 }
      );
    }

    const [episode] = await db
      .select({ id: episodes.id })
      .from(episodes)
      .innerJoin(shows, eq(shows.id, episodes.showId))
      .where(and(eq(episodes.id, episodeId), eq(shows.userId, userId)))
      .limit(1);

    if (!episode) {
      return NextResponse.json(
        { error: "Episode not found" },
        { status: 404 }
      );
    }

    await db
      .delete(watchedEpisodes)
      .where(eq(watchedEpisodes.episodeId, episodeId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/episodes/[id]/watch error:", error);
    return NextResponse.json(
      { error: "Failed to unmark episode as watched" },
      { status: 500 }
    );
  }
}
