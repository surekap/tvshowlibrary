export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shows } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid show ID" }, { status: 400 });
    }

    const existing = await db.query.shows.findFirst({
      where: eq(shows.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    // Cascade delete handles episodes and watched_episodes
    await db.delete(shows).where(eq(shows.id, id));

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
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid show ID" }, { status: 400 });
    }

    const show = await db.query.shows.findFirst({
      where: eq(shows.id, id),
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
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
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
      .where(eq(shows.id, id))
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
