export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchedEpisodes, episodes } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const episodeId = parseInt(params.id, 10);

    if (isNaN(episodeId)) {
      return NextResponse.json(
        { error: "Invalid episode ID" },
        { status: 400 }
      );
    }

    // Verify episode exists
    const episode = await db.query.episodes.findFirst({
      where: eq(episodes.id, episodeId),
    });

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
      .values({ episodeId })
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
  { params }: { params: { id: string } }
) {
  try {
    const episodeId = parseInt(params.id, 10);

    if (isNaN(episodeId)) {
      return NextResponse.json(
        { error: "Invalid episode ID" },
        { status: 400 }
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
