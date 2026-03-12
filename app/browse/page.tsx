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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Browse Shows</h1>
        <p className="text-sm text-gray-400 mt-1">
          Search for TV shows and add them to your watchlist
        </p>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          {isSearching ? (
            <svg
              className="w-4 h-4 text-gray-400 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="Search TV shows..."
          className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          autoFocus
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setHasSearched(false);
            }}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {hasSearched && !isSearching && (
        <div className="mb-2 text-xs text-gray-500">
          {results.length === 0
            ? `No results for "${query}"`
            : `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
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

      {/* Empty state — not yet searched */}
      {!hasSearched && (
        <div className="text-center py-16 text-gray-600">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-800"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="font-medium text-gray-500 text-lg">Search for a show</p>
          <p className="text-sm mt-1 text-gray-600">
            Start typing to search millions of shows from TVDB
          </p>
        </div>
      )}
    </div>
  );
}
