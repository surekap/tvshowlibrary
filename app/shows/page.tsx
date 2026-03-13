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
  const [statusFilter, setStatusFilter] = useState<"all" | "Continuing" | "Ended">("all");
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
    setRemovingIds((prev) => new Set(prev).add(show.id));
    try {
      const res = await fetch(`/api/shows/${show.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove show");
      setShows((prev) => prev.filter((s) => s.id !== show.id));
    } catch {
      setError("Failed to remove show. Please try again.");
    } finally {
      setRemovingIds((prev) => { const n = new Set(prev); n.delete(show.id); return n; });
    }
  };

  const handleToggleArchive = async (show: TrackedShow) => {
    setArchivingIds((prev) => new Set(prev).add(show.id));
    setShows((prev) => prev.map((s) => s.id === show.id ? { ...s, archived: !s.archived } : s));
    try {
      const res = await fetch(`/api/shows/${show.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !show.archived }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setShows((prev) => prev.map((s) => s.id === show.id ? { ...s, archived: show.archived } : s));
      setError("Failed to update show.");
    } finally {
      setArchivingIds((prev) => { const n = new Set(prev); n.delete(show.id); return n; });
    }
  };

  const q = query.toLowerCase();
  const activeShows = shows.filter((s) => {
    if (s.archived) return false;
    if (!s.name.toLowerCase().includes(q)) return false;
    if (statusFilter === "all") return true;
    return s.status === statusFilter;
  });
  const archivedShows = shows.filter((s) => s.archived && s.name.toLowerCase().includes(q));
  const totalActive = shows.filter((s) => !s.archived).length;
  const totalArchived = shows.filter((s) => s.archived).length;

  // Status filter counts (ignoring statusFilter, just query)
  const countAll = shows.filter((s) => !s.archived && s.name.toLowerCase().includes(q)).length;
  const countContinuing = shows.filter((s) => !s.archived && s.name.toLowerCase().includes(q) && s.status === "Continuing").length;
  const countEnded = shows.filter((s) => !s.archived && s.name.toLowerCase().includes(q) && s.status === "Ended").length;

  // Alphabetical grouping
  const groupedShows = activeShows.reduce((groups, show) => {
    const first = show.name[0]?.toUpperCase() ?? "#";
    const key = /[A-Z]/.test(first) ? first : "#";
    if (!groups[key]) groups[key] = [];
    groups[key].push(show);
    return groups;
  }, {} as Record<string, typeof activeShows>);

  const sortedLetters = Object.keys(groupedShows).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="font-extrabold text-[var(--text-primary)]">My Shows</h1>
          <p className="section-subtitle">Your tracked TV shows</p>
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
          <h1 className="font-extrabold text-[var(--text-primary)]">My Shows</h1>
          <p className="section-subtitle">
            {totalActive} active{totalArchived > 0 ? ` · ${totalArchived} archived` : ""}
          </p>
        </div>
        <Link
          href="/browse"
          className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Shows
        </Link>
      </div>

      {/* Search */}
      {shows.length > 0 && (
        <div className="relative mb-4">
          <label htmlFor="shows-search" className="sr-only">Filter shows</label>
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg aria-hidden="true" className="w-4 h-4 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            id="shows-search"
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
      )}

      {/* Status filter tabs */}
      {shows.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setStatusFilter("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
            }`}
          >
            All
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === "all" ? "bg-white/20" : "bg-[var(--bg-base)]"}`}>
              {countAll}
            </span>
          </button>
          {countContinuing > 0 && (
            <button
              onClick={() => setStatusFilter("Continuing")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === "Continuing"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
              }`}
            >
              Continuing
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === "Continuing" ? "bg-white/20" : "bg-[var(--bg-base)]"}`}>
                {countContinuing}
              </span>
            </button>
          )}
          {countEnded > 0 && (
            <button
              onClick={() => setStatusFilter("Ended")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === "Ended"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
              }`}
            >
              Ended
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === "Ended" ? "bg-white/20" : "bg-[var(--bg-base)]"}`}>
                {countEnded}
              </span>
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/25 rounded-xl text-[var(--danger)] text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="flex-shrink-0 text-[var(--danger)] hover:opacity-70 transition-opacity"
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Empty state */}
      {shows.length === 0 && !error && (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-4 bg-[var(--accent-dim)] rounded-full flex items-center justify-center border border-[var(--accent)]/25">
            <svg aria-hidden="true" className="w-10 h-10 text-[var(--accent-hover)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Nothing tracked yet</h3>
          <p className="text-sm text-[var(--text-dim)] mt-2 mb-6">Start with something you&apos;re already watching, or discover something new.</p>
          <Link href="/browse" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors">
            Browse Shows
          </Link>
        </div>
      )}

      {/* Active shows */}
      {activeShows.length > 0 && (
        query ? (
          // Flat grid when searching
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
        ) : (
          // Alphabetical grouping when not searching
          <>
            {sortedLetters.length > 1 && (
              <div className="flex gap-1 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                {sortedLetters.map((letter) => (
                  <button
                    key={letter}
                    onClick={() => {
                      const el = document.getElementById(`letter-group-${letter}`);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="flex-shrink-0 w-7 h-7 rounded-md text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-6">
              {sortedLetters.map((letter) => (
                <div key={letter} id={`letter-group-${letter}`} className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold text-[var(--text-dim)] tracking-widest uppercase">{letter}</span>
                    <div className="flex-1 h-px bg-[var(--border)]" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedShows[letter].map((show) => (
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
                </div>
              ))}
            </div>
          </>
        )
      )}

      {activeShows.length === 0 && statusFilter !== "all" && (
        <div className="text-center py-12">
          <p className="text-[var(--text-dim)] text-sm mb-3">No {statusFilter.toLowerCase()} shows</p>
          <button
            onClick={() => setStatusFilter("all")}
            className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
          >
            Show all shows
          </button>
        </div>
      )}

      {query && activeShows.length === 0 && statusFilter === "all" && archivedShows.length === 0 && (
        <p className="text-center text-[var(--text-dim)] py-12 text-sm">No shows matching &ldquo;{query}&rdquo;</p>
      )}

      {/* Archived section */}
      {totalArchived > 0 && (
        <div className="mt-10">
          <button
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            aria-controls="archived-shows-grid"
            className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4"
          >
            <svg aria-hidden="true" className={`w-4 h-4 transition-transform ${showArchived ? "" : "-rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Archived
            <span className="text-xs text-[var(--text-dim)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-full">{totalArchived}</span>
          </button>

          <div
            id="archived-shows-grid"
            hidden={!showArchived}
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3"
          >
            {archivedShows.map((show) => (
              <ArchivedItem
                key={show.id}
                show={show}
                isArchiving={archivingIds.has(show.id)}
                onToggleArchive={handleToggleArchive}
              />
            ))}
          </div>
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
  const [confirmRemove, setConfirmRemove] = useState(false);
  const color = getShowColor(show.name);
  const progress = show.totalEpisodes > 0 ? Math.round((show.watchedCount / show.totalEpisodes) * 100) : 0;
  const statusColor =
    show.status === "Continuing" ? "text-[var(--status-continuing)]"
    : show.status === "Ended"    ? "text-[var(--status-ended)]"
    : "text-[var(--text-dim)]";

  return (
    <div className="card overflow-hidden group">
      <div className="h-1 w-full" style={{ backgroundColor: color }} />
      <div className="p-4">
        <Link href={`/shows/${show.id}`} className="flex gap-3 hover:opacity-90 transition-opacity">
          <div className="relative w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--bg-elevated)]">
            {show.posterUrl ? (
              <Image src={show.posterUrl} alt={show.name} fill className="object-cover" sizes="56px" />
            ) : (
              <div className="poster-placeholder w-full h-full">
                <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[var(--text-primary)] text-sm leading-tight line-clamp-2 group-hover:text-[var(--accent-hover)] transition-colors">{show.name}</h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {show.network && (
                <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
                  {show.network}
                </span>
              )}
              {show.status && (
                <span className={`text-xs font-medium ${statusColor}`}>{show.status}</span>
              )}
            </div>
          </div>
        </Link>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--text-secondary)]">Progress</span>
            {progress === 100 ? (
              <span className="flex items-center gap-1 text-xs font-medium text-[var(--watched)]">
                <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Complete
              </span>
            ) : (
              <span className="text-xs font-medium text-[var(--text-primary)]">{show.watchedCount} / {show.totalEpisodes} watched</span>
            )}
          </div>
          <div className="progress-track" style={{ height: '6px' }}>
            <div className="progress-fill" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? "var(--watched)" : color }} />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onToggleArchive(show)}
            disabled={isArchiving}
            aria-label={`Archive ${show.name}`}
            className="flex-1 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--warn)] hover:bg-[var(--warn)]/10 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-transparent hover:border-[var(--warn)]/25 disabled:opacity-50"
          >
            {isArchiving ? (
              <svg aria-hidden="true" className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            )}
            Archive
          </button>

          {confirmRemove ? (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/8">
              <span className="text-xs text-[var(--text-secondary)]">Remove?</span>
              <button
                onClick={() => { onRemove(show); setConfirmRemove(false); }}
                disabled={isRemoving}
                className="text-xs font-medium text-[var(--danger)] hover:opacity-80 px-1.5 py-0.5 rounded border border-[var(--danger)]/40 hover:bg-[var(--danger)]/10 transition-all disabled:opacity-50"
              >
                Remove
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-1.5 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              disabled={isRemoving}
              className="flex-1 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-transparent hover:border-[var(--danger)]/30 disabled:opacity-50"
            >
              {isRemoving ? (
                <svg aria-hidden="true" className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              ) : (
                <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              Remove
            </button>
          )}
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
        <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-elevated)] ring-1 ring-[var(--border)] group-hover:ring-[var(--border-hover)] transition-all">
          {show.posterUrl ? (
            <Image src={show.posterUrl} alt={show.name} fill className="object-cover opacity-60 group-hover:opacity-80 transition-opacity" sizes="120px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--text-dim)] text-center px-1 leading-tight">
              {show.name.slice(0, 3)}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <p className="absolute bottom-1.5 inset-x-1.5 text-[10px] font-medium text-white/80 leading-tight text-center line-clamp-2">{show.name}</p>
        </div>
      </Link>
      <button
        onClick={() => onToggleArchive(show)}
        disabled={isArchiving}
        aria-label={`Unarchive ${show.name}`}
        className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/60 hover:bg-[var(--warn)]/80 rounded-full flex items-center justify-center transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"
      >
        {isArchiving ? (
          <svg aria-hidden="true" className="w-3 h-3 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        ) : (
          <svg aria-hidden="true" className="w-3 h-3 text-[var(--warn)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        )}
      </button>
    </div>
  );
}
