"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { getShowColor } from "@/lib/utils";

interface TrackedShow {
  id: number;
  tvdbId: number;
  name: string;
  overview: string | null;
  posterUrl: string | null;
  status: string | null;
  network: string | null;
  createdAt: string;
  totalEpisodes: number;
  watchedCount: number;
}

export default function ShowsPage() {
  const [shows, setShows] = useState<TrackedShow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadShows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shows");
      if (!res.ok) throw new Error("Failed to load shows");
      const data = await res.json();
      setShows(data.shows ?? []);
    } catch (err) {
      setError("Failed to load your shows. Please refresh the page.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShows();
  }, [loadShows]);

  const handleRemove = async (show: TrackedShow) => {
    if (
      !confirm(
        `Remove "${show.name}" from your watchlist? This will delete all episode data.`
      )
    ) {
      return;
    }

    setRemovingIds((prev) => new Set(prev).add(show.id));
    try {
      const res = await fetch(`/api/shows/${show.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove show");
      setShows((prev) => prev.filter((s) => s.id !== show.id));
    } catch (err) {
      console.error("Remove error:", err);
      alert("Failed to remove show. Please try again.");
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(show.id);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">My Shows</h1>
          <p className="text-sm text-gray-400 mt-1">Your tracked TV shows</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton rounded-xl h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Shows</h1>
          <p className="text-sm text-gray-400 mt-1">
            {shows.length === 0
              ? "No shows tracked yet"
              : `${shows.length} show${shows.length !== 1 ? "s" : ""} tracked`}
          </p>
        </div>
        <Link
          href="/browse"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Shows
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {shows.length === 0 && !error ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-900 rounded-full flex items-center justify-center border border-gray-800">
            <svg
              className="w-10 h-10 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-400">
            No shows in your watchlist
          </h3>
          <p className="text-sm text-gray-600 mt-2 mb-6">
            Search for shows and add them to start tracking episodes
          </p>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Browse Shows
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shows.map((show) => (
            <ShowItem
              key={show.id}
              show={show}
              isRemoving={removingIds.has(show.id)}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ShowItem({
  show,
  isRemoving,
  onRemove,
}: {
  show: TrackedShow;
  isRemoving: boolean;
  onRemove: (show: TrackedShow) => void;
}) {
  const color = getShowColor(show.name);
  const progress =
    show.totalEpisodes > 0
      ? Math.round((show.watchedCount / show.totalEpisodes) * 100)
      : 0;

  const statusColor =
    show.status === "Continuing"
      ? "text-green-400"
      : show.status === "Ended"
      ? "text-red-400"
      : "text-gray-500";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all group">
      {/* Color accent top bar */}
      <div className="h-1 w-full" style={{ backgroundColor: color }} />

      <div className="p-4">
        <div className="flex gap-3">
          {/* Poster */}
          <div className="relative w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
            {show.posterUrl ? (
              <Image
                src={show.posterUrl}
                alt={show.name}
                fill
                className="object-cover"
                sizes="56px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2">
              {show.name}
            </h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {show.network && (
                <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                  {show.network}
                </span>
              )}
              {show.status && (
                <span className={`text-xs font-medium ${statusColor}`}>
                  {show.status}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress section */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">Progress</span>
            <span className="text-xs font-medium text-gray-300">
              {show.watchedCount} / {show.totalEpisodes} watched
            </span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-600">
              {show.totalEpisodes} episodes total
            </span>
            <span className="text-xs font-medium" style={{ color }}>
              {progress}%
            </span>
          </div>
        </div>

        {/* Remove button */}
        <button
          onClick={() => onRemove(show)}
          disabled={isRemoving}
          className="mt-3 w-full py-1.5 text-xs font-medium text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-transparent hover:border-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRemoving ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Removing...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove from watchlist
            </>
          )}
        </button>
      </div>
    </div>
  );
}
