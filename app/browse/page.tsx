"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ShowCard from "@/components/ShowCard";

interface SearchResult {
  tvdbId: number;
  name: string;
  overview: string | null;
  posterUrl: string | null;
  status: string | null;
  network: string | null;
  year: string | null;
}

interface TrackedShow {
  id: number;
  tvdbId: number;
  name: string;
}

export default function BrowsePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [trackedShows, setTrackedShows] = useState<TrackedShow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load tracked shows on mount
  useEffect(() => {
    fetch("/api/shows")
      .then((r) => r.json())
      .then((data) => setTrackedShows(data.shows ?? []))
      .catch(console.error);
  }, []);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (err) {
      setError("Failed to search. Please try again.");
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleAdd = async (tvdbId: number) => {
    setLoadingIds((prev) => new Set(prev).add(tvdbId));
    try {
      const res = await fetch("/api/shows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tvdbId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add show");
      }

      const data = await res.json();
      setTrackedShows((prev) => [
        ...prev,
        { id: data.show.id, tvdbId: data.show.tvdbId, name: data.show.name },
      ]);
    } catch (err) {
      console.error("Add show error:", err);
      alert(err instanceof Error ? err.message : "Failed to add show");
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(tvdbId);
        return next;
      });
    }
  };

  const handleRemove = async (tvdbId: number) => {
    const show = trackedShows.find((s) => s.tvdbId === tvdbId);
    if (!show) return;

    setLoadingIds((prev) => new Set(prev).add(tvdbId));
    try {
      const res = await fetch(`/api/shows/${show.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove show");

      setTrackedShows((prev) => prev.filter((s) => s.tvdbId !== tvdbId));
    } catch (err) {
      console.error("Remove show error:", err);
      alert("Failed to remove show");
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(tvdbId);
        return next;
      });
    }
  };

  const trackedTvdbIds = new Set(trackedShows.map((s) => s.tvdbId));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display font-bold text-[var(--text-primary)]">Browse Shows</h1>
        <p className="section-subtitle">Search and add shows to your watchlist</p>
      </div>

      {/* Search input */}
      <div className="relative mb-5">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          {isSearching ? (
            <svg className="w-4 h-4 text-[var(--text-secondary)] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="Search TV shows…"
          className="search-input"
          autoFocus
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setHasSearched(false); }}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Result count */}
      {hasSearched && !isSearching && (
        <p className="mb-3 text-xs text-[var(--text-dim)]">
          {results.length === 0
            ? `No results for "${query}"`
            : `${results.length} result${results.length !== 1 ? "s" : ""}`}
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2.5">
          {results.map((show) => (
            <ShowCard
              key={show.tvdbId}
              tvdbId={show.tvdbId}
              name={show.name}
              overview={show.overview}
              posterUrl={show.posterUrl}
              status={show.status}
              network={show.network}
              year={show.year}
              isTracked={trackedTvdbIds.has(show.tvdbId)}
              isLoading={loadingIds.has(show.tvdbId)}
              onAdd={handleAdd}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Empty / prompt state */}
      {!hasSearched && (
        <div className="text-center py-20 text-[var(--text-dim)]">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="font-display font-semibold text-[var(--text-secondary)] text-base">Find your next show</p>
          <p className="text-sm mt-1">Start typing to search the TVDB catalogue</p>
        </div>
      )}
    </div>
  );
}
