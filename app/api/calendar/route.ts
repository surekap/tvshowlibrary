export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { episodes, shows, watchedEpisodes } from "@/lib/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import { getShowColor } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query params are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch episodes in date range (or with null aired date for upcoming)
    const episodesInRange = await db
      .select({
        id: episodes.id,
        tvdbId: episodes.tvdbId,
        showId: episodes.showId,
        seasonNumber: episodes.seasonNumber,
        episodeNumber: episodes.episodeNumber,
        name: episodes.name,
        overview: episodes.overview,
        aired: episodes.aired,
        runtime: episodes.runtime,
        showName: shows.name,
        showPosterUrl: shows.posterUrl,
        watchedId: watchedEpisodes.id,
        watchedAt: watchedEpisodes.watchedAt,
      })
      .from(episodes)
      .innerJoin(shows, eq(episodes.showId, shows.id))
      .leftJoin(watchedEpisodes, eq(watchedEpisodes.episodeId, episodes.id))
      .where(
        and(
          gte(episodes.aired, start.slice(0, 10)),
          lte(episodes.aired, end.slice(0, 10))
        )
      );

    const events = episodesInRange.map((ep) => {
      const color = getShowColor(ep.showName);
      const s = String(ep.seasonNumber).padStart(2, "0");
      const e = String(ep.episodeNumber).padStart(2, "0");
      const code = `S${s}E${e}`;

      return {
        id: String(ep.id),
        tvdbId: ep.tvdbId,
        showId: ep.showId,
        showName: ep.showName,
        showPosterUrl: ep.showPosterUrl,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        code,
        name: ep.name,
        overview: ep.overview,
        aired: ep.aired,
        runtime: ep.runtime,
        watched: ep.watchedId !== null,
        watchedAt: ep.watchedAt,
        color,
        // FullCalendar event shape
        title: `${ep.showName} ${code}`,
        start: ep.aired ?? undefined,
        backgroundColor: color,
        borderColor: color,
        textColor: "#ffffff",
        classNames: ep.watchedId !== null ? ["watched-event"] : [],
      };
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/calendar error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}
