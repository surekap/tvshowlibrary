import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const shows = pgTable("shows", {
  id: serial("id").primaryKey(),
  tvdbId: integer("tvdb_id").unique().notNull(),
  name: text("name").notNull(),
  overview: text("overview"),
  posterUrl: text("poster_url"),
  status: text("status"),
  network: text("network"),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const episodes = pgTable(
  "episodes",
  {
    id: serial("id").primaryKey(),
    tvdbId: integer("tvdb_id").unique().notNull(),
    showId: integer("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    seasonNumber: integer("season_number").notNull(),
    episodeNumber: integer("episode_number").notNull(),
    name: text("name"),
    overview: text("overview"),
    aired: text("aired"),
    runtime: integer("runtime"),
  },
  (t) => ({
    showIdIdx: index("episodes_show_id_idx").on(t.showId),
    airedIdx: index("episodes_aired_idx").on(t.aired),
  })
);

export const watchedEpisodes = pgTable(
  "watched_episodes",
  {
    id: serial("id").primaryKey(),
    episodeId: integer("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    watchedAt: timestamp("watched_at").defaultNow().notNull(),
  },
  (t) => ({
    episodeIdIdx: index("watched_episodes_episode_id_idx").on(t.episodeId),
  })
);

// Relations
export const showsRelations = relations(shows, ({ many }) => ({
  episodes: many(episodes),
}));

export const episodesRelations = relations(episodes, ({ one, many }) => ({
  show: one(shows, {
    fields: [episodes.showId],
    references: [shows.id],
  }),
  watchedEpisodes: many(watchedEpisodes),
}));

export const watchedEpisodesRelations = relations(
  watchedEpisodes,
  ({ one }) => ({
    episode: one(episodes, {
      fields: [watchedEpisodes.episodeId],
      references: [episodes.id],
    }),
  })
);

export type Show = typeof shows.$inferSelect;
export type NewShow = typeof shows.$inferInsert;
export type Episode = typeof episodes.$inferSelect;
export type NewEpisode = typeof episodes.$inferInsert;
export const trendsCache = pgTable("trends_cache", {
  id: serial("id").primaryKey(),
  data: text("data").notNull(), // JSON array of top trending shows
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
});

export type WatchedEpisode = typeof watchedEpisodes.$inferSelect;
export type NewWatchedEpisode = typeof watchedEpisodes.$inferInsert;
