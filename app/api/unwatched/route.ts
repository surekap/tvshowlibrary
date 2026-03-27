export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { episodes, shows, watchedEpisodes } from "@/lib/schema";
import { and, eq, isNull, lte, isNotNull, ne } from "drizzle-orm";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // All episodes with their show and watched status
    const rows = await db
      .select({
        episodeId: episodes.id,
        episodeTvdbId: episodes.tvdbId,
        seasonNumber: episodes.seasonNumber,
        episodeNumber: episodes.episodeNumber,
        name: episodes.name,
        overview: episodes.overview,
        aired: episodes.aired,
        runtime: episodes.runtime,
        showId: shows.id,
        showName: shows.name,
        showPosterUrl: shows.posterUrl,
        watchedId: watchedEpisodes.id,
      })
      .from(episodes)
      .innerJoin(shows, eq(episodes.showId, shows.id))
      .leftJoin(watchedEpisodes, eq(watchedEpisodes.episodeId, episodes.id))
      .where(
        and(
          isNull(watchedEpisodes.id),
          isNotNull(episodes.aired),
          lte(episodes.aired, new Date().toISOString().slice(0, 10)),
          eq(shows.userId, userId),
          ne(shows.archived, true)
        )
      );

    // Group by show
    const showMap = new Map<
      number,
      {
        showId: number;
        showName: string;
        showPosterUrl: string | null;
        episodes: typeof rows;
      }
    >();

    for (const row of rows) {
      if (!showMap.has(row.showId)) {
        showMap.set(row.showId, {
          showId: row.showId,
          showName: row.showName,
          showPosterUrl: row.showPosterUrl,
          episodes: [],
        });
      }
      showMap.get(row.showId)!.episodes.push(row);
    }

    // Sort episodes within each show by season then episode number
    const grouped = Array.from(showMap.values())
      .map((show) => ({
        ...show,
        episodes: show.episodes.sort(
          (a, b) =>
            a.seasonNumber - b.seasonNumber ||
            a.episodeNumber - b.episodeNumber
        ),
        unwatchedCount: show.episodes.length,
      }))
      .sort((a, b) => a.showName.localeCompare(b.showName));

    return NextResponse.json({ shows: grouped });
  } catch (error) {
    console.error("GET /api/unwatched error:", error);
    return NextResponse.json(
      { error: "Failed to fetch unwatched episodes" },
      { status: 500 }
    );
  }
}
