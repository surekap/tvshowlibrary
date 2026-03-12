"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { getShowColor, formatEpisodeCode, formatAirDate } from "@/lib/utils";

interface UnwatchedEpisode {
  episodeId: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string | null;
  overview: string | null;
  aired: string | null;
  runtime: number | null;
}

interface UnwatchedShow {
  showId: number;
  showName: string;
  showPosterUrl: string | null;
  unwatchedCount: number;
  episodes: UnwatchedEpisode[];
}

export default function UnwatchedPage() {
  const [shows, setShows] = useState<UnwatchedShow[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track which episodes have been optimistically marked watched
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [collapsedShows, setCollapsedShows] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/unwatched", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setShows(data.shows ?? []);
      setWatchedIds(new Set());
    } catch {
      setError("Failed to load unwatched episodes.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markWatched = useCallback(async (episodeId: number) => {
    setPendingIds((prev) => new Set(prev).add(episodeId));
    setWatchedIds((prev) => new Set(prev).add(episodeId));
    try {
      const res = await fetch(`/api/episodes/${episodeId}/watch`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Revert
      setWatchedIds((prev) => {
        const next = new Set(prev);
        next.delete(episodeId);
        return next;
      });
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(episodeId);
        return next;
      });
    }
  }, []);

  const toggleCollapse = (showId: number) => {
    setCollapsedShows((prev) => {
      const next = new Set(prev);
      if (next.has(showId)) next.delete(showId);
      else next.add(showId);
      return next;
    });
  };

  // Compute visible (not yet marked watched in this session) counts, then apply search filter
  const visibleShows = shows
    .map((show) => ({
      ...show,
      visibleEpisodes: show.episodes.filter((ep) => !watchedIds.has(ep.episodeId)),
    }))
    .filter((show) => show.visibleEpisodes.length > 0)
    .filter((show) =>
      query === "" || show.showName.toLowerCase().includes(query.toLowerCase())
    );

  const totalUnwatched = visibleShows.reduce(
    (sum, s) => sum + s.visibleEpisodes.length,
    0
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="skeleton h-8 w-48 rounded-lg mb-2" />
          <div className="skeleton h-4 w-64 rounded" />
        </div>
        {/* Poster strip skeleton */}
        <div className="flex gap-3 mb-8 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton w-20 h-28 rounded-xl flex-shrink-0" />
          ))}
        </div>
        {/* List skeleton */}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={load}
          className="text-indigo-400 hover:underline text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (visibleShows.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Unwatched</h1>
          <p className="text-sm text-gray-400 mt-1">Episodes waiting to be watched</p>
        </div>
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-900 rounded-full flex items-center justify-center border border-gray-800">
            <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-400">All caught up!</h3>
          <p className="text-sm text-gray-600 mt-2 mb-6">
            No unwatched episodes. Add more shows to keep tracking.
          </p>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Browse Shows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Unwatched</h1>
          <p className="text-sm text-gray-400 mt-1">
            {totalUnwatched} episode{totalUnwatched !== 1 ? "s" : ""} across{" "}
            {visibleShows.length} show{visibleShows.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter shows…"
          className="w-full pl-10 pr-9 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Summary strip — posters with badge */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {visibleShows.map((show) => {
          const color = getShowColor(show.showName);
          return (
            <button
              key={show.showId}
              onClick={() => {
                const el = document.getElementById(`show-${show.showId}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                // Expand if collapsed
                setCollapsedShows((prev) => {
                  const next = new Set(prev);
                  next.delete(show.showId);
                  return next;
                });
              }}
              className="flex-shrink-0 relative group focus:outline-none"
              title={show.showName}
            >
              <div className="relative w-20 h-28 rounded-xl overflow-hidden bg-gray-800 ring-2 ring-transparent group-hover:ring-white/20 transition-all">
                {show.showPosterUrl ? (
                  <Image
                    src={show.showPosterUrl}
                    alt={show.showName}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-xs font-bold text-white text-center px-1 leading-tight"
                    style={{ backgroundColor: color }}
                  >
                    {show.showName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>
              {/* Badge */}
              <div
                className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-lg px-1"
                style={{ backgroundColor: color }}
              >
                {show.visibleEpisodes.length}
              </div>
            </button>
          );
        })}
      </div>

      {/* Episodes grouped by show */}
      <div className="space-y-4">
        {visibleShows.map((show) => {
          const color = getShowColor(show.showName);
          const isCollapsed = collapsedShows.has(show.showId);

          return (
            <div
              key={show.showId}
              id={`show-${show.showId}`}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden scroll-mt-24"
            >
              {/* Show header */}
              <button
                onClick={() => toggleCollapse(show.showId)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40 transition-colors text-left"
              >
                {/* Mini poster */}
                <div className="relative w-9 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
                  {show.showPosterUrl ? (
                    <Image
                      src={show.showPosterUrl}
                      alt={show.showName}
                      fill
                      className="object-cover"
                      sizes="36px"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {show.showName.slice(0, 1)}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white text-sm">
                    {show.showName}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: color }}
                    >
                      {show.visibleEpisodes.length} unwatched
                    </span>
                  </div>
                </div>

                <svg
                  className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Accent line */}
              <div className="h-px mx-4" style={{ backgroundColor: color + "40" }} />

              {/* Episode list */}
              {!isCollapsed && (
                <div className="divide-y divide-gray-800/40">
                  {show.visibleEpisodes.map((ep) => {
                    const isPending = pendingIds.has(ep.episodeId);

                    return (
                      <div
                        key={ep.episodeId}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/30 transition-colors group/ep"
                      >
                        {/* Watch button */}
                        <button
                          onClick={() => markWatched(ep.episodeId)}
                          disabled={isPending}
                          className="flex-shrink-0 disabled:cursor-not-allowed"
                          aria-label="Mark as watched"
                        >
                          {isPending ? (
                            <svg className="w-5 h-5 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <div
                              className="w-5 h-5 rounded-full border-2 border-gray-700 group-hover/ep:border-gray-400 transition-colors flex items-center justify-center"
                              style={{ "--hover-color": color } as React.CSSProperties}
                            >
                              {/* Checkmark appears on hover */}
                              <svg
                                className="w-3 h-3 text-gray-600 opacity-0 group-hover/ep:opacity-100 transition-opacity"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>

                        {/* Episode code */}
                        <span className="text-xs font-mono text-gray-500 flex-shrink-0 w-14">
                          {formatEpisodeCode(ep.seasonNumber, ep.episodeNumber)}
                        </span>

                        {/* Episode name */}
                        <span className="flex-1 text-sm text-gray-200 min-w-0 truncate">
                          {ep.name ?? `Episode ${ep.episodeNumber}`}
                        </span>

                        {/* Air date */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {ep.aired && (
                            <span className="text-xs text-gray-500 hidden sm:block">
                              {formatAirDate(ep.aired)}
                            </span>
                          )}
                          {ep.runtime && (
                            <span className="text-xs text-gray-600">{ep.runtime}m</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {query && visibleShows.length === 0 && (
        <p className="text-center text-gray-500 py-12 text-sm">No shows matching &ldquo;{query}&rdquo;</p>
      )}
    </div>
  );
}
