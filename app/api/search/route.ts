export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { searchShows } from "@/lib/tvdb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchShows(query.trim());

    const formatted = results.slice(0, 20).map((show) => ({
      tvdbId: parseInt(show.tvdb_id, 10),
      name: show.name,
      overview: show.overview ?? null,
      posterUrl: show.image_url ?? null,
      status: show.status ?? null,
      network: show.network ?? null,
      year: show.year ?? show.first_air_time?.slice(0, 4) ?? null,
    }));

    return NextResponse.json({ results: formatted });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search shows" },
      { status: 500 }
    );
  }
}
