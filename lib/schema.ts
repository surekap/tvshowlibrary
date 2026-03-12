import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const episodes = pgTable("episodes", {
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
});

export const watchedEpisodes = pgTable("watched_episodes", {
  id: serial("id").primaryKey(),
  episodeId: integer("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  watchedAt: timestamp("watched_at").defaultNow().notNull(),
});

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
export type WatchedEpisode = typeof watchedEpisodes.$inferSelect;
export type NewWatchedEpisode = typeof watchedEpisodes.$inferInsert;
