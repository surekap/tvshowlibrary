"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { getShowColor, formatEpisodeCode, formatAirDate } from "@/lib/utils";

interface Episode {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string | null;
  overview: string | null;
  aired: string | null;
  runtime: number | null;
  watchedEpisodes: { id: number; watchedAt: string }[];
}

interface Show {
  id: number;
  tvdbId: number;
  name: string;
  overview: string | null;
  posterUrl: string | null;
  status: string | null;
  network: string | null;
  archived: boolean;
  episodes: Episode[];
}

type SeasonMap = Map<number, Episode[]>;

export default function ShowDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [show, setShow] = useState<Show | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track which episodes are watched locally for instant UI feedback
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  // Track pending operations to show loading state
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  // Collapsed seasons
  const [collapsedSeasons, setCollapsedSeasons] = useState<Set<number>>(
    new Set()
  );
  const [archived, setArchived] = useState(false);
  const [archivePending, setArchivePending] = useState(false);

  const loadShow = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shows/${id}`);
      if (!res.ok) throw new Error("Show not found");
      const data = await res.json();
      setShow(data.show);
      setArchived(data.show.archived ?? false);
      // Seed watched state from DB
      const watched = new Set<number>();
      for (const ep of data.show.episodes as Episode[]) {
        if (ep.watchedEpisodes.length > 0) watched.add(ep.id);
      }
      setWatchedIds(watched);
    } catch (err) {
      setError("Failed to load show.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadShow();
  }, [loadShow]);

  // --- Watch helpers ---

  const bulkUpdate = useCallback(
    async (episodeIds: number[], watched: boolean, pendingKey: string) => {
      setPendingIds((prev) => new Set(prev).add(pendingKey));
      // Optimistic update
      setWatchedIds((prev) => {
        const next = new Set(prev);
        if (watched) episodeIds.forEach((id) => next.add(id));
        else episodeIds.forEach((id) => next.delete(id));
        return next;
      });
      try {
        const res = await fetch(`/api/shows/${id}/watch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodeIds, watched }),
        });
        if (!res.ok) throw new Error("Failed to update");
      } catch {
        // Revert on failure
        setWatchedIds((prev) => {
          const next = new Set(prev);
          if (watched) episodeIds.forEach((id) => next.delete(id));
          else episodeIds.forEach((id) => next.add(id));
          return next;
        });
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(pendingKey);
          return next;
        });
      }
    },
    [id]
  );

  const toggleEpisode = useCallback(
    (ep: Episode) => {
      const isWatched = watchedIds.has(ep.id);
      bulkUpdate([ep.id], !isWatched, `ep-${ep.id}`);
    },
    [watchedIds, bulkUpdate]
  );

  const toggleSeason = useCallback(
    (seasonNumber: number, episodes: Episode[]) => {
      const today = new Date().toISOString().slice(0, 10);
      const airedIds = episodes
        .filter((e) => e.aired && e.aired <= today)
        .map((e) => e.id);
      const allWatched = airedIds.every((id) => watchedIds.has(id));
      // When unwatching, include all (even unaired) so they can be cleared
      const ids = allWatched ? episodes.map((e) => e.id) : airedIds;
      if (ids.length === 0) return;
      bulkUpdate(ids, !allWatched, `season-${seasonNumber}`);
    },
    [watchedIds, bulkUpdate]
  );

  const toggleShow = useCallback(() => {
    if (!show) return;
    const today = new Date().toISOString().slice(0, 10);
    const airedIds = show.episodes
      .filter((e) => e.aired && e.aired <= today)
      .map((e) => e.id);
    const allWatched = airedIds.every((id) => watchedIds.has(id));
    // When unwatching, include all episodes so nothing is left marked
    const ids = allWatched ? show.episodes.map((e) => e.id) : airedIds;
    if (ids.length === 0) return;
    bulkUpdate(ids, !allWatched, "show");
  }, [show, watchedIds, bulkUpdate]);

  const toggleArchive = useCallback(async () => {
    if (!show) return;
    const newArchived = !archived;
    setArchivePending(true);
    setArchived(newArchived);
    try {
      const res = await fetch(`/api/shows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: newArchived }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch {
      setArchived(!newArchived);
    } finally {
      setArchivePending(false);
    }
  }, [show, archived, id]);

  const toggleSeasonCollapsed = (seasonNumber: number) => {
    setCollapsedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(seasonNumber)) next.delete(seasonNumber);
      else next.add(seasonNumber);
      return next;
    });
  };

  // --- Derived data ---

  const seasons: SeasonMap = new Map();
  if (show) {
    for (const ep of show.episodes) {
      if (!seasons.has(ep.seasonNumber)) seasons.set(ep.seasonNumber, []);
      seasons.get(ep.seasonNumber)!.push(ep);
    }
  }
  const sortedSeasons = Array.from(seasons.entries()).sort(([a], [b]) => a - b);

  const today = new Date().toISOString().slice(0, 10);
  const totalEpisodes = show?.episodes.length ?? 0;
  const airedEpisodes = show?.episodes.filter((e) => e.aired && e.aired <= today) ?? [];
  const watchedCount = show
    ? show.episodes.filter((e) => watchedIds.has(e.id)).length
    : 0;
  const progress =
    totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  // "All watched" means all *aired* episodes are watched
  const allWatched =
    airedEpisodes.length > 0 && airedEpisodes.every((e) => watchedIds.has(e.id));

  const color = show ? getShowColor(show.name) : "#6366f1";

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="skeleton h-8 w-48 mb-6 rounded-lg" />
        <div className="skeleton h-64 rounded-xl mb-6" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-red-400 mb-4">{error ?? "Show not found"}</p>
        <Link
          href="/shows"
          className="text-indigo-400 hover:underline text-sm"
        >
          ← Back to My Shows
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/shows"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        My Shows
      </Link>

      {/* Show header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
        <div className="h-1 w-full" style={{ backgroundColor: color }} />
        <div className="p-5 flex gap-5">
          {/* Poster */}
          <div className="relative w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
            {show.posterUrl ? (
              <Image
                src={show.posterUrl}
                alt={show.name}
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white leading-tight">{show.name}</h1>
              {archived && (
                <span className="text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                  Archived
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5 mb-3">
              {show.network && (
                <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                  {show.network}
                </span>
              )}
              {show.status && (
                <span
                  className={`text-xs font-medium ${
                    show.status === "Continuing"
                      ? "text-green-400"
                      : show.status === "Ended"
                      ? "text-red-400"
                      : "text-gray-500"
                  }`}
                >
                  {show.status}
                </span>
              )}
              <span className="text-xs text-gray-500">
                {sortedSeasons.length} season{sortedSeasons.length !== 1 ? "s" : ""}
              </span>
            </div>

            {show.overview && (
              <p className="text-sm text-gray-400 leading-relaxed line-clamp-3 mb-3">
                {show.overview}
              </p>
            )}

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">
                  {watchedCount} / {totalEpisodes} episodes watched
                </span>
                <span className="text-xs font-semibold" style={{ color }}>
                  {progress}%
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-full">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: color }}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex flex-col gap-2 justify-start pt-1">
            <button
              onClick={toggleShow}
              disabled={pendingIds.has("show")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                allWatched
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  : "text-white hover:opacity-90"
              }`}
              style={!allWatched ? { backgroundColor: color } : undefined}
            >
              {pendingIds.has("show") ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : allWatched ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {allWatched ? "Mark All Unwatched" : "Mark All Watched"}
            </button>
            <button
              onClick={toggleArchive}
              disabled={archivePending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200"
            >
              {archivePending ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              )}
              {archived ? "Unarchive" : "Archive"}
            </button>
          </div>
        </div>
      </div>

      {/* Seasons */}
      <div className="space-y-3">
        {sortedSeasons.map(([seasonNumber, episodes]) => {
          const seasonIds = episodes.map((e) => e.id);
          const seasonAiredIds = episodes
            .filter((e) => e.aired && e.aired <= today)
            .map((e) => e.id);
          const seasonWatchedCount = seasonIds.filter((id) =>
            watchedIds.has(id)
          ).length;
          // Button state based on aired episodes only
          const seasonAllWatched =
            seasonAiredIds.length > 0 &&
            seasonAiredIds.every((id) => watchedIds.has(id));
          const seasonProgress =
            seasonIds.length > 0
              ? Math.round((seasonWatchedCount / seasonIds.length) * 100)
              : 0;
          const isCollapsed = collapsedSeasons.has(seasonNumber);
          const seasonPendingKey = `season-${seasonNumber}`;

          return (
            <div
              key={seasonNumber}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              {/* Season header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60">
                {/* Collapse toggle */}
                <button
                  onClick={() => toggleSeasonCollapsed(seasonNumber)}
                  className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                  aria-label={isCollapsed ? "Expand season" : "Collapse season"}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <button
                  onClick={() => toggleSeasonCollapsed(seasonNumber)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <span className="font-semibold text-white text-sm">
                    {seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`}
                  </span>
                  <span className="text-xs text-gray-500">
                    {seasonWatchedCount}/{seasonIds.length} watched
                  </span>
                  {/* Season progress bar */}
                  <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${seasonProgress}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </button>

                {/* Mark season button */}
                <button
                  onClick={() => toggleSeason(seasonNumber, episodes)}
                  disabled={pendingIds.has(seasonPendingKey)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                    seasonAllWatched
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-400"
                      : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                  }`}
                >
                  {pendingIds.has(seasonPendingKey) ? (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : seasonAllWatched ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {seasonAllWatched ? "Unwatch Season" : "Watch Season"}
                </button>
              </div>

              {/* Episodes list */}
              {!isCollapsed && (
                <div className="divide-y divide-gray-800/40">
                  {episodes.map((ep) => {
                    const isWatched = watchedIds.has(ep.id);
                    const isPending = pendingIds.has(`ep-${ep.id}`);

                    return (
                      <div
                        key={ep.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40 transition-colors ${
                          isWatched ? "opacity-60" : ""
                        }`}
                      >
                        {/* Watch checkbox */}
                        <button
                          onClick={() => toggleEpisode(ep)}
                          disabled={isPending}
                          className="flex-shrink-0 disabled:cursor-not-allowed"
                          aria-label={
                            isWatched ? "Mark as unwatched" : "Mark as watched"
                          }
                        >
                          {isPending ? (
                            <svg className="w-5 h-5 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : isWatched ? (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: color }}
                            >
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-700 hover:border-gray-500 transition-colors" />
                          )}
                        </button>

                        {/* Episode code */}
                        <span className="text-xs font-mono text-gray-500 flex-shrink-0 w-14">
                          {formatEpisodeCode(ep.seasonNumber, ep.episodeNumber)}
                        </span>

                        {/* Episode name */}
                        <span
                          className={`flex-1 text-sm min-w-0 truncate ${
                            isWatched
                              ? "line-through text-gray-500"
                              : "text-gray-200"
                          }`}
                        >
                          {ep.name ?? `Episode ${ep.episodeNumber}`}
                        </span>

                        {/* Air date */}
                        {ep.aired && (
                          <span className="text-xs text-gray-600 flex-shrink-0 hidden sm:block">
                            {formatAirDate(ep.aired)}
                          </span>
                        )}

                        {/* Runtime */}
                        {ep.runtime && (
                          <span className="text-xs text-gray-600 flex-shrink-0">
                            {ep.runtime}m
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
