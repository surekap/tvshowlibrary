import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../lib/schema";
import { shows, episodes, watchedEpisodes, users } from "../lib/schema";

const TVDB_BASE_URL = "https://api4.thetvdb.com/v4";
let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${TVDB_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: process.env.TVDB_API_KEY }),
  });
  if (!res.ok) throw new Error(`TVDB auth failed: ${res.status}`);
  const data = await res.json() as { data: { token: string } };
  cachedToken = data.data.token;
  return cachedToken;
}

async function tvdbFetch(path: string): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${TVDB_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`TVDB ${path} → ${res.status}`);
  return res.json();
}

async function getShowDetails(tvdbId: number) {
  const data = await tvdbFetch(`/series/${tvdbId}/extended`) as {
    data?: {
      id: number; name: string; overview?: string; image?: string;
      status?: { name: string }; originalNetwork?: { name: string };
    };
  };
  return data.data ?? null;
}

async function getAllEpisodes(tvdbId: number) {
  type Ep = { id: number; seasonNumber: number; number: number; name?: string; overview?: string; aired?: string; runtime?: number };
  const all: Ep[] = [];
  let page = 0;
  while (true) {
    const data = await tvdbFetch(`/series/${tvdbId}/episodes/default?page=${page}`) as { data?: { episodes?: Ep[] } };
    const eps = data.data?.episodes;
    if (!eps || eps.length === 0) break;
    all.push(...eps);
    if (eps.length < 100) break;
    page++;
  }
  return all;
}

async function main() {
  const ownerEmail = process.env.ARCHIVED_IMPORT_USER_EMAIL;
  if (!ownerEmail) {
    throw new Error("ARCHIVED_IMPORT_USER_EMAIL is required");
  }

  const archived: { name: string; tvdb_id: number }[] = JSON.parse(
    readFileSync(join(process.cwd(), "archived_shows.json"), "utf-8")
  );

  const sql = neon(process.env.DATABASE_URL!, { fetchOptions: { cache: "no-store" } });
  const db = drizzle(sql, { schema });
  const owner = await db.query.users.findFirst({
    where: eq(users.email, ownerEmail),
  });

  if (!owner) {
    throw new Error(`No user found for ${ownerEmail}`);
  }

  let added = 0, skipped = 0;
  const failed: string[] = [];

  for (let i = 0; i < archived.length; i++) {
    const item = archived[i];
    process.stdout.write(`[${i + 1}/${archived.length}] ${item.name} ... `);

    try {
      const existing = await db.query.shows.findFirst({
        where: (table, { and, eq }) =>
          and(eq(table.userId, owner.id), eq(table.tvdbId, item.tvdb_id)),
      });

      let showId: number;

      if (existing) {
        process.stdout.write("exists, ");
        showId = existing.id;
        skipped++;
      } else {
        const tvdbShow = await getShowDetails(item.tvdb_id);
        if (!tvdbShow) { process.stdout.write("not found on TVDB\n"); failed.push(item.name); continue; }

        const [newShow] = await db.insert(shows).values({
          userId: owner.id,
          tvdbId: tvdbShow.id, name: tvdbShow.name,
          overview: tvdbShow.overview ?? null, posterUrl: tvdbShow.image ?? null,
          status: tvdbShow.status?.name ?? null, network: tvdbShow.originalNetwork?.name ?? null,
        }).returning();
        showId = newShow.id;

        const tvdbEps = await getAllEpisodes(item.tvdb_id);
        const valid = tvdbEps.filter(e => e.id && typeof e.seasonNumber === "number" && typeof e.number === "number");

        for (let b = 0; b < valid.length; b += 100) {
          await db.insert(episodes).values(
            valid.slice(b, b + 100).map(ep => ({
              tvdbId: ep.id, showId,
              seasonNumber: ep.seasonNumber, episodeNumber: ep.number,
              name: ep.name ?? null, overview: ep.overview ?? null,
              aired: ep.aired ?? null, runtime: ep.runtime ?? null,
            }))
          ).onConflictDoNothing();
        }
        process.stdout.write(`added (${valid.length} eps), `);
        added++;
      }

      // Mark all episodes watched
      const showEps = await db.select({ id: episodes.id }).from(episodes).where(eq(episodes.showId, showId));
      if (showEps.length > 0) {
        const epIds = showEps.map(e => e.id);
        const already = await db.select({ episodeId: watchedEpisodes.episodeId }).from(watchedEpisodes).where(inArray(watchedEpisodes.episodeId, epIds));
        const alreadySet = new Set(already.map(w => w.episodeId));
        const toWatch = epIds.filter(id => !alreadySet.has(id));
        for (let b = 0; b < toWatch.length; b += 100) {
          await db.insert(watchedEpisodes).values(toWatch.slice(b, b + 100).map(episodeId => ({ episodeId }))).onConflictDoNothing();
        }
        process.stdout.write(`✓ watched ${toWatch.length} new eps\n`);
      } else {
        process.stdout.write("✓ no episodes\n");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`ERROR: ${msg}\n`);
      failed.push(item.name);
    }

    await new Promise(r => setTimeout(r, 250));
  }

  console.log("\n=== Done ===");
  console.log(`Added:   ${added}`);
  console.log(`Already existed: ${skipped}`);
  if (failed.length > 0) console.log(`Failed:\n  ${failed.join("\n  ")}`);
}

main().catch(err => { console.error(err); process.exit(1); });
