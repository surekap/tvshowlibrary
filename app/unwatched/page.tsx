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
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [collapsedShows, setCollapsedShows] = useState<Set<number>>(new Set());
  const [statusMessage, setStatusMessage] = useState("");

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

  const markWatched = useCallback(async (episodeId: number, episodeName: string) => {
    setPendingIds((prev) => new Set(prev).add(episodeId));
    setWatchedIds((prev) => new Set(prev).add(episodeId));
    setStatusMessage(`Marked "${episodeName}" as watched`);
    try {
      const res = await fetch(`/api/episodes/${episodeId}/watch`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setWatchedIds((prev) => {
        const next = new Set(prev);
        next.delete(episodeId);
        return next;
      });
      setStatusMessage(`Failed to mark "${episodeName}" as watched`);
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
        <div className="flex gap-3 mb-8 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton w-20 h-28 rounded-xl flex-shrink-0" />
          ))}
        </div>
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
        <p className="text-[var(--danger)] mb-4">{error}</p>
        <button onClick={load} className="text-[var(--accent)] hover:text-[var(--accent-hover)] hover:underline text-sm transition-colors">
          Try again
        </button>
      </div>
    );
  }

  if (visibleShows.length === 0 && query === "") {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="font-extrabold text-[var(--text-primary)]">Unwatched</h1>
          <p className="section-subtitle">Episodes waiting to be watched</p>
        </div>
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-4 bg-[var(--watched-dim)] rounded-full flex items-center justify-center border border-[var(--watched)]/25">
            <svg aria-hidden="true" className="w-10 h-10 text-[var(--watched)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">You&apos;re all caught up!</h3>
          <p className="text-sm text-[var(--text-dim)] mt-2 mb-6">
            Every episode watched. Enjoy the break — or find your next binge.
          </p>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Find Something New
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Screen reader status announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {statusMessage}
      </div>

      {/* Page header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-extrabold text-[var(--text-primary)]">Unwatched</h1>
          <p className="section-subtitle">
            {totalUnwatched} episode{totalUnwatched !== 1 ? "s" : ""} across{" "}
            {visibleShows.length} show{visibleShows.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <label htmlFor="unwatched-search" className="sr-only">Filter shows</label>
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <svg aria-hidden="true" className="w-4 h-4 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          id="unwatched-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter shows…"
          className="search-input pl-10 pr-9 py-2.5"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                setCollapsedShows((prev) => {
                  const next = new Set(prev);
                  next.delete(show.showId);
                  return next;
                });
              }}
              className="flex-shrink-0 relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:rounded-xl"
              aria-label={`${show.showName} — ${show.visibleEpisodes.length} unwatched`}
            >
              <div className="relative w-20 h-28 rounded-xl overflow-hidden bg-[var(--bg-elevated)] ring-2 ring-transparent group-hover:ring-white/20 transition-all">
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>
              <div
                aria-hidden="true"
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
              className="card overflow-hidden scroll-mt-24"
            >
              {/* Show header */}
              <button
                onClick={() => toggleCollapse(show.showId)}
                aria-expanded={!isCollapsed}
                aria-controls={`episodes-${show.showId}`}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-elevated)]/40 transition-colors text-left"
              >
                <div className="relative w-9 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--bg-elevated)]">
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
                  <Link
                    href={`/shows/${show.showId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-[var(--text-primary)] text-sm hover:text-[var(--accent-hover)] transition-colors"
                  >
                    {show.showName}
                  </Link>
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
                  aria-hidden="true"
                  className={`w-4 h-4 text-[var(--text-dim)] flex-shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
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
              <div
                id={`episodes-${show.showId}`}
                hidden={isCollapsed}
                className="divide-y divide-[var(--border)]/40"
              >
                {show.visibleEpisodes.map((ep) => {
                  const isPending = pendingIds.has(ep.episodeId);
                  const epName = ep.name ?? `Episode ${ep.episodeNumber}`;

                  return (
                    <div
                      key={ep.episodeId}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-elevated)]/30 transition-colors group/ep"
                    >
                      {/* Watch button */}
                      <button
                        onClick={() => markWatched(ep.episodeId, epName)}
                        disabled={isPending}
                        aria-label={`Mark "${epName}" as watched`}
                        className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-hover)] text-[var(--text-secondary)] hover:bg-[var(--watched-dim)] hover:border-[var(--watched)]/40 hover:text-[var(--watched)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPending ? (
                          <svg aria-hidden="true" className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <span>Watched</span>
                      </button>

                      {/* Episode code */}
                      <span className="ep-code flex-shrink-0 w-14">
                        {formatEpisodeCode(ep.seasonNumber, ep.episodeNumber)}
                      </span>

                      {/* Episode name */}
                      <span className="flex-1 text-sm text-[var(--text-primary)] min-w-0 truncate">
                        {epName}
                      </span>

                      {/* Air date + runtime */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {ep.aired && (
                          <span className="text-xs text-[var(--text-secondary)] hidden sm:block">
                            {formatAirDate(ep.aired)}
                          </span>
                        )}
                        {ep.runtime && (
                          <span className="text-xs text-[var(--text-dim)]">{ep.runtime}m</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {query && visibleShows.length === 0 && (
        <p className="text-center text-[var(--text-dim)] py-12 text-sm">
          No shows matching &ldquo;{query}&rdquo;
        </p>
      )}
    </div>
  );
}
