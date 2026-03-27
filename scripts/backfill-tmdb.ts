/**
 * Backfills tmdbId, imdbId, and tmdbRating for all shows that don't have them yet.
 * Run with: node --env-file=.env.local ./node_modules/.bin/tsx scripts/backfill-tmdb.ts
 */

import { isNull, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { shows } from "../lib/schema";
import { findByTvdbId, getShowTmdbDetails } from "../lib/tmdb";

async function main() {
  const pending = await db
    .select({ id: shows.id, tvdbId: shows.tvdbId, name: shows.name })
    .from(shows)
    .where(isNull(shows.tmdbId));

  console.log(`Found ${pending.length} shows without TMDB data\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const show of pending) {
    try {
      const tmdbId = await findByTvdbId(show.tvdbId);
      if (!tmdbId) {
        console.log(`  [skip]  ${show.name} — not found on TMDB`);
        skipped++;
        continue;
      }

      const { imdbId, voteAverage } = await getShowTmdbDetails(tmdbId);
      await db
        .update(shows)
        .set({ tmdbId, imdbId, tmdbRating: voteAverage > 0 ? voteAverage : null })
        .where(eq(shows.id, show.id));

      console.log(
        `  [ok]    ${show.name} → tmdb=${tmdbId} imdb=${imdbId ?? "—"} ★${voteAverage.toFixed(1)}`
      );
      updated++;

      // 100 ms pause between shows to stay well within TMDB rate limits
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.error(`  [fail]  ${show.name}:`, err);
      failed++;
    }
  }

  console.log(`\nDone — updated: ${updated}  skipped: ${skipped}  failed: ${failed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
