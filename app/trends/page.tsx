"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TrendItem, NewShowItem, TopRatedItem, TrendsPayload } from "@/app/api/trends/route";

const RANK_COLORS: Record<number, string> = {
  1: "var(--rank-gold)",
  2: "var(--rank-silver)",
  3: "var(--rank-bronze)",
};

function getRankColor(rank: number): string {
  return RANK_COLORS[rank] ?? "var(--text-dim)";
}

type Tab = "trending" | "newShows" | "topRated";

const TAB_LABELS: Record<Tab, string> = {
  trending: "Trending",
  newShows: "New Shows",
  topRated: "Top Rated",
};

export default function TrendsPage() {
  const [payload, setPayload] = useState<TrendsPayload | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("trending");

  useEffect(() => {
    fetch("/api/trends", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        setPayload({
          trending: data.trending ?? [],
          newShows: data.newShows ?? [],
          topRated: data.topRated ?? [],
        });
        setCachedAt(data.cachedAt ?? null);
      })
      .catch(() => setError("Failed to load trending shows."))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="skeleton h-8 w-56 rounded-lg mb-2" />
          <div className="skeleton h-4 w-80 rounded" />
        </div>
        <div className="space-y-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
        <p className="text-center text-xs text-[var(--text-dim)] mt-6 animate-pulse">
          Loading trending data…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  const trendingItems = payload?.trending ?? [];
  const maxPopularity = trendingItems[0]?.popularity ?? 1;

  function renderTrendItem(item: TrendItem) {
    const barWidth = (item.popularity / maxPopularity) * 100;
    const rankColor = getRankColor(item.rank);

    return (
      <div
        key={`${item.tmdbId}-${item.rank}`}
        className="card relative overflow-hidden group"
      >
        <div
          className="absolute inset-y-0 left-0 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity"
          style={{ width: `${barWidth}%`, backgroundColor: rankColor }}
        />
        <div className="relative flex items-stretch">
          <div className="relative w-16 sm:w-20 flex-shrink-0 bg-[var(--bg-elevated)]">
            {item.posterUrl ? (
              <Image
                src={item.posterUrl}
                alt={item.name}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="w-full h-full min-h-[7rem] flex items-center justify-center">
                <svg aria-hidden="true" className="w-6 h-6 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
            <div className="flex-shrink-0 w-7 text-center">
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: rankColor }}
              >
                {item.rank}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[var(--text-primary)] text-sm">
                  {item.name}
                </span>
                {item.genres?.length > 0 && (
                  <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded hidden sm:inline">
                    {item.genres[0]}
                  </span>
                )}
              </div>
              {item.overview && (
                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed hidden sm:block">
                  {item.overview}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
              <span className="text-xs font-mono text-[var(--text-secondary)] tabular-nums">
                {item.popularity.toLocaleString()}
              </span>
              <div className="w-16 h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden hidden sm:block">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${barWidth}%`, backgroundColor: rankColor }}
                />
              </div>
              <Link
                href={`/browse?q=${encodeURIComponent(item.name)}`}
                className="text-[10px] font-medium text-[var(--accent-hover)] hover:text-[var(--accent)] hover:underline transition-colors whitespace-nowrap"
              >
                + Track
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderShowItem(item: NewShowItem | TopRatedItem, index: number) {
    const rankColor = getRankColor(index + 1);
    const barWidth = (item.popularity / (payload?.trending[0]?.popularity ?? item.popularity)) * 100;

    return (
      <div
        key={item.tmdbId}
        className="card relative overflow-hidden group"
      >
        <div
          className="absolute inset-y-0 left-0 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity"
          style={{ width: `${Math.min(barWidth, 100)}%`, backgroundColor: rankColor }}
        />
        <div className="relative flex items-stretch">
          <div className="relative w-16 sm:w-20 flex-shrink-0 bg-[var(--bg-elevated)]">
            {item.posterUrl ? (
              <Image
                src={item.posterUrl}
                alt={item.name}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="w-full h-full min-h-[7rem] flex items-center justify-center">
                <svg aria-hidden="true" className="w-6 h-6 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
            <div className="flex-shrink-0 w-7 text-center">
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: rankColor }}
              >
                {index + 1}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[var(--text-primary)] text-sm">
                  {item.name}
                </span>
                {item.genres?.length > 0 && (
                  <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded hidden sm:inline">
                    {item.genres[0]}
                  </span>
                )}
                {"firstAirDate" in item && item.firstAirDate && (
                  <span className="text-xs text-[var(--text-dim)] hidden sm:inline">
                    {item.firstAirDate}
                  </span>
                )}
                {"voteAverage" in item && item.voteAverage > 0 && (
                  <span className="text-xs text-[var(--status-continuing)] font-medium hidden sm:inline">
                    ★ {item.voteAverage}
                  </span>
                )}
              </div>
              {item.overview && (
                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed hidden sm:block">
                  {item.overview}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
              <Link
                href={`/browse?q=${encodeURIComponent(item.name)}`}
                className="text-[10px] font-medium text-[var(--accent-hover)] hover:text-[var(--accent)] hover:underline transition-colors whitespace-nowrap"
              >
                + Track
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-[var(--text-primary)]">Trending TV Shows</h1>
          <p className="section-subtitle">Powered by TMDB · updated every 24h</p>
        </div>
        {cachedAt && (
          <div className="text-right flex-shrink-0">
            <span className="text-xs text-[var(--text-dim)]">
              Updated{" "}
              {new Date(cachedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <p className="text-xs text-[var(--text-dim)]/60 mt-0.5">refreshes every 24h</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {activeTab === "trending" && trendingItems.map(renderTrendItem)}
        {activeTab === "newShows" && (payload?.newShows ?? []).map((item, i) => renderShowItem(item, i))}
        {activeTab === "topRated" && (payload?.topRated ?? []).map((item, i) => renderShowItem(item, i))}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--text-dim)]">
        Source: TMDB API
      </p>
    </div>
  );
}
