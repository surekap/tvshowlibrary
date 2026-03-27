import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  index,
  primaryKey,
  uniqueIndex,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    providerPk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => ({
    tokenPk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  })
);

export const shows = pgTable("shows", {
  id: serial("id").primaryKey(),
  // Kept nullable during migration so the existing single-user dataset can be
  // adopted by the first authenticated account without truncating data.
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  tvdbId: integer("tvdb_id").notNull(),
  name: text("name").notNull(),
  overview: text("overview"),
  posterUrl: text("poster_url"),
  status: text("status"),
  network: text("network"),
  archived: boolean("archived").default(false).notNull(),
  tmdbId: integer("tmdb_id"),
  imdbId: text("imdb_id"),
  tmdbRating: real("tmdb_rating"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index("shows_user_id_idx").on(t.userId),
  userTvdbUniqueIdx: uniqueIndex("shows_user_tvdb_id_idx").on(t.userId, t.tvdbId),
}));

export const episodes = pgTable(
  "episodes",
  {
    id: serial("id").primaryKey(),
    tvdbId: integer("tvdb_id").notNull(),
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
    showTvdbUniqueIdx: uniqueIndex("episodes_show_tvdb_id_idx").on(
      t.showId,
      t.tvdbId
    ),
  })
);

export const watchedEpisodes = pgTable(
  "watched_episodes",
  {
    id: serial("id").primaryKey(),
    // userId mirrors the ownership already implied via episodes→shows→userId,
    // but storing it directly prevents any future query from accidentally
    // skipping the join and leaking cross-user watch history.
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    episodeId: integer("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    watchedAt: timestamp("watched_at").defaultNow().notNull(),
  },
  (t) => ({
    episodeIdIdx: index("watched_episodes_episode_id_idx").on(t.episodeId),
    userIdIdx: index("watched_episodes_user_id_idx").on(t.userId),
    episodeIdUniqueIdx: uniqueIndex("watched_episodes_episode_id_uq").on(
      t.episodeId
    ),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  shows: many(shows),
  accounts: many(accounts),
  sessions: many(sessions),
  watchedEpisodes: many(watchedEpisodes),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const showsRelations = relations(shows, ({ one, many }) => ({
  episodes: many(episodes),
  user: one(users, {
    fields: [shows.userId],
    references: [users.id],
  }),
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
    user: one(users, {
      fields: [watchedEpisodes.userId],
      references: [users.id],
    }),
  })
);

export type Show = typeof shows.$inferSelect;
export type NewShow = typeof shows.$inferInsert;
export type Episode = typeof episodes.$inferSelect;
export type NewEpisode = typeof episodes.$inferInsert;
export const trendsCache = pgTable("trends_cache", {
  id: serial("id").primaryKey(),
  data: text("data").notNull(), // JSON: { trending, newShows, topRated }
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
});

export const recommendationsCache = pgTable("recommendations_cache", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  data: text("data").notNull(), // JSON array of RecommendedItem
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index("recommendations_cache_user_id_idx").on(t.userId),
}));

export type WatchedEpisode = typeof watchedEpisodes.$inferSelect;
export type NewWatchedEpisode = typeof watchedEpisodes.$inferInsert;
