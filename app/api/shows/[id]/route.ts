export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { shows } from "@/lib/schema";

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
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid show ID" }, { status: 400 });
    }

    const existing = await db.query.shows.findFirst({
      where: and(eq(shows.id, id), eq(shows.userId, userId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    // Cascade delete handles episodes and watched_episodes
    await db.delete(shows).where(and(eq(shows.id, id), eq(shows.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/shows/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to remove show" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid show ID" }, { status: 400 });
    }

    const show = await db.query.shows.findFirst({
      where: and(eq(shows.id, id), eq(shows.userId, userId)),
      with: {
        episodes: {
          with: {
            watchedEpisodes: true,
          },
          orderBy: (episodes, { asc }) => [
            asc(episodes.seasonNumber),
            asc(episodes.episodeNumber),
          ],
        },
      },
    });

    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    return NextResponse.json({ show });
  } catch (error) {
    console.error("GET /api/shows/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch show" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid show ID" }, { status: 400 });
    }

    const body = await request.json();
    if (typeof body.archived !== "boolean") {
      return NextResponse.json({ error: "archived must be a boolean" }, { status: 400 });
    }

    const [updated] = await db
      .update(shows)
      .set({ archived: body.archived })
      .where(and(eq(shows.id, id), eq(shows.userId, userId)))
      .returning({ id: shows.id, archived: shows.archived });

    if (!updated) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    return NextResponse.json({ show: updated });
  } catch (error) {
    console.error("PATCH /api/shows/[id] error:", error);
    return NextResponse.json({ error: "Failed to update show" }, { status: 500 });
  }
}
