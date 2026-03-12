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
  archived: boolean;
  createdAt: string;
  totalEpisodes: number;
  watchedCount: number;
}

export default function ShowsPage() {
  const [shows, setShows] = useState<TrackedShow[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const [archivingIds, setArchivingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const loadShows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shows", { cache: "no-store" });
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

  useEffect(() => { loadShows(); }, [loadShows]);

  const handleRemove = async (show: TrackedShow) => {
    if (!confirm(`Remove "${show.name}" from your watchlist? This will delete all episode data.`)) return;
    setRemovingIds((prev) => new Set(prev).add(show.id));
    try {
      const res = await fetch(`/api/shows/${show.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove show");
      setShows((prev) => prev.filter((s) => s.id !== show.id));
    } catch {
      alert("Failed to remove show. Please try again.");
    } finally {
      setRemovingIds((prev) => { const n = new Set(prev); n.delete(show.id); return n; });
    }
  };

  const handleToggleArchive = async (show: TrackedShow) => {
    setArchivingIds((prev) => new Set(prev).add(show.id));
    // Optimistic update
    setShows((prev) => prev.map((s) => s.id === show.id ? { ...s, archived: !s.archived } : s));
    try {
      const res = await fetch(`/api/shows/${show.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !show.archived }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert
      setShows((prev) => prev.map((s) => s.id === show.id ? { ...s, archived: show.archived } : s));
      alert("Failed to update show.");
    } finally {
      setArchivingIds((prev) => { const n = new Set(prev); n.delete(show.id); return n; });
    }
  };

  const q = query.toLowerCase();
  const activeShows = shows.filter((s) => !s.archived && s.name.toLowerCase().includes(q));
  const archivedShows = shows.filter((s) => s.archived && s.name.toLowerCase().includes(q));
  const totalActive = shows.filter((s) => !s.archived).length;
  const totalArchived = shows.filter((s) => s.archived).length;

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">My Shows</h1>
          <p className="text-sm text-gray-400 mt-1">Your tracked TV shows</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton rounded-xl h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Shows</h1>
          <p className="text-sm text-gray-400 mt-1">
            {totalActive} active{totalArchived > 0 ? ` · ${totalArchived} archived` : ""}
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

      {/* Search */}
      {shows.length > 0 && (
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
            <button onClick={() => setQuery("")} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Empty state */}
      {shows.length === 0 && !error && (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-900 rounded-full flex items-center justify-center border border-gray-800">
            <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-400">No shows in your watchlist</h3>
          <p className="text-sm text-gray-600 mt-2 mb-6">Search for shows and add them to start tracking episodes</p>
          <Link href="/browse" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            Browse Shows
          </Link>
        </div>
      )}

      {/* Active shows */}
      {activeShows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeShows.map((show) => (
            <ShowItem
              key={show.id}
              show={show}
              isRemoving={removingIds.has(show.id)}
              isArchiving={archivingIds.has(show.id)}
              onRemove={handleRemove}
              onToggleArchive={handleToggleArchive}
            />
          ))}
        </div>
      )}

      {query && activeShows.length === 0 && archivedShows.length === 0 && (
        <p className="text-center text-gray-500 py-12 text-sm">No shows matching &ldquo;{query}&rdquo;</p>
      )}

      {/* Archived section */}
      {totalArchived > 0 && (
        <div className="mt-10">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors mb-4"
          >
            <svg className={`w-4 h-4 transition-transform ${showArchived ? "" : "-rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Archived
            <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full">{totalArchived}</span>
          </button>

          {showArchived && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
              {archivedShows.map((show) => (
                <ArchivedItem
                  key={show.id}
                  show={show}
                  isArchiving={archivingIds.has(show.id)}
                  onToggleArchive={handleToggleArchive}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShowItem({
  show, isRemoving, isArchiving, onRemove, onToggleArchive,
}: {
  show: TrackedShow;
  isRemoving: boolean;
  isArchiving: boolean;
  onRemove: (show: TrackedShow) => void;
  onToggleArchive: (show: TrackedShow) => void;
}) {
  const color = getShowColor(show.name);
  const progress = show.totalEpisodes > 0 ? Math.round((show.watchedCount / show.totalEpisodes) * 100) : 0;
  const statusColor = show.status === "Continuing" ? "text-green-400" : show.status === "Ended" ? "text-red-400" : "text-gray-500";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all group">
      <div className="h-1 w-full" style={{ backgroundColor: color }} />
      <div className="p-4">
        <Link href={`/shows/${show.id}`} className="flex gap-3 hover:opacity-90 transition-opacity">
          <div className="relative w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
            {show.posterUrl ? (
              <Image src={show.posterUrl} alt={show.name} fill className="object-cover" sizes="56px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 group-hover:text-indigo-300 transition-colors">{show.name}</h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {show.network && <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{show.network}</span>}
              {show.status && <span className={`text-xs font-medium ${statusColor}`}>{show.status}</span>}
            </div>
          </div>
        </Link>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">Progress</span>
            <span className="text-xs font-medium text-gray-300">{show.watchedCount} / {show.totalEpisodes} watched</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: color }} />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-600">{show.totalEpisodes} episodes total</span>
            <span className="text-xs font-medium" style={{ color }}>{progress}%</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onToggleArchive(show)}
            disabled={isArchiving}
            title="Archive show"
            className="flex-1 py-1.5 text-xs font-medium text-gray-500 hover:text-amber-400 hover:bg-amber-900/20 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-transparent hover:border-amber-900/40 disabled:opacity-50"
          >
            {isArchiving ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            )}
            Archive
          </button>
          <button
            onClick={() => onRemove(show)}
            disabled={isRemoving}
            title="Remove show"
            className="flex-1 py-1.5 text-xs font-medium text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-transparent hover:border-red-900/50 disabled:opacity-50"
          >
            {isRemoving ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function ArchivedItem({
  show, isArchiving, onToggleArchive,
}: {
  show: TrackedShow;
  isArchiving: boolean;
  onToggleArchive: (show: TrackedShow) => void;
}) {
  return (
    <div className="group relative">
      <Link href={`/shows/${show.id}`}>
        <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-gray-800 ring-1 ring-gray-800 group-hover:ring-gray-600 transition-all">
          {show.posterUrl ? (
            <Image src={show.posterUrl} alt={show.name} fill className="object-cover opacity-60 group-hover:opacity-80 transition-opacity" sizes="120px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-600 text-center px-1 leading-tight">
              {show.name.slice(0, 3)}
            </div>
          )}
          {/* Gradient + name overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <p className="absolute bottom-1.5 inset-x-1.5 text-[10px] font-medium text-white/80 leading-tight text-center line-clamp-2">{show.name}</p>
        </div>
      </Link>
      {/* Unarchive button */}
      <button
        onClick={() => onToggleArchive(show)}
        disabled={isArchiving}
        title="Unarchive"
        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-amber-900/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
      >
        {isArchiving ? (
          <svg className="w-3 h-3 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        ) : (
          <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        )}
      </button>
    </div>
  );
}
