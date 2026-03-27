"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TmdbShow, TrendItem, NewShowItem, TopRatedItem, RecommendedItem } from "@/lib/tmdb";
import ExternalLinks from "@/components/ExternalLinks";
import ShowPoster from "@/components/ShowPoster";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendsData {
  trending: TrendItem[];
  newShows: NewShowItem[];
  topRated: TopRatedItem[];
  cachedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RANK_COLORS: Record<number, string> = {
  1: "var(--rank-gold)",
  2: "var(--rank-silver)",
  3: "var(--rank-bronze)",
};

function getRankColor(rank: number): string {
  return RANK_COLORS[rank] ?? "var(--text-dim)";
}

function StarRating({ score }: { score: number }) {
  return (
    <span className="text-xs text-[var(--text-secondary)] tabular-nums">
      ★ {score.toFixed(1)}
    </span>
  );
}

// ─── Compact card (sidebar) ───────────────────────────────────────────────────

function CompactCard({
  show,
  subLabel,
}: {
  show: TmdbShow;
  subLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      {/* Poster */}
      <ShowPoster posterUrl={show.posterUrl} name={show.name} className="w-10 h-[60px]" sizes="40px" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate leading-tight">
          {show.name}
        </p>
        {subLabel && (
          <p className="text-[10px] text-[var(--text-dim)] truncate mt-0.5">
            {subLabel}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {show.genres[0] && (
            <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded truncate max-w-[80px]">
              {show.genres[0]}
            </span>
          )}
          <StarRating score={show.voteAverage} />
        </div>
      </div>

      {/* Track + links */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
        <Link
          href={`/browse?q=${encodeURIComponent(show.name)}`}
          className="text-[10px] font-medium text-[var(--accent-hover)] hover:text-[var(--accent)] hover:underline transition-colors"
        >
          + Track
        </Link>
        <ExternalLinks name={show.name} tmdbId={show.tmdbId} />
      </div>
    </div>
  );
}

// ─── Sidebar panel ────────────────────────────────────────────────────────────

function SidebarPanel({
  title,
  loading,
  error,
  children,
}: {
  title: string;
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-dim)] mb-3">
        {title}
      </h2>
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton w-10 h-14 rounded flex-shrink-0" />
              <div className="flex-1 space-y-1.5 py-1">
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-2.5 w-1/2 rounded" />
                <div className="skeleton h-2.5 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : (
        children
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [recommended, setRecommended] = useState<RecommendedItem[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [recommendedError, setRecommendedError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/trends", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(setTrendsData)
      .catch(() => setTrendsError("Failed to load trending shows."))
      .finally(() => setTrendsLoading(false));

    fetch("/api/trends/recommended", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) return { recommended: [] };
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => setRecommended(data.recommended ?? []))
      .catch(() => setRecommendedError("Failed to load recommendations."))
      .finally(() => setRecommendedLoading(false));
  }, []);

  const trending = trendsData?.trending ?? [];
  const maxPopularity = trending[0]?.popularity ?? 1;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-[var(--text-primary)]">Trending TV Shows</h1>
          <p className="section-subtitle">Ranked by TMDB weekly popularity</p>
        </div>
        {trendsData?.cachedAt && (
          <div className="text-right flex-shrink-0">
            <span className="text-xs text-[var(--text-dim)]">
              Updated{" "}
              {new Date(trendsData.cachedAt).toLocaleDateString("en-US", {
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

      {/* Main layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* ── Main column: Trending ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {trendsLoading ? (
            <div className="space-y-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="skeleton h-28 rounded-xl" />
              ))}
              <p className="text-center text-xs text-[var(--text-dim)] mt-4 animate-pulse">
                Loading trending data…
              </p>
            </div>
          ) : trendsError ? (
            <div className="text-center py-20">
              <p className="text-[var(--danger)]">{trendsError}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trending.map((item) => {
                const barWidth = (item.popularity / maxPopularity) * 100;
                const rankColor = getRankColor(item.rank);
                return (
                  <div
                    key={`${item.tmdbId}-${item.rank}`}
                    className="card relative overflow-hidden group"
                  >
                    {/* Popularity bar */}
                    <div
                      className="absolute inset-y-0 left-0 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity"
                      style={{ width: `${barWidth}%`, backgroundColor: rankColor }}
                    />
                    <div className="relative flex items-stretch">
                      {/* Poster */}
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
                      {/* Content */}
                      <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
                        {/* Rank */}
                        <div className="flex-shrink-0 w-7 text-center">
                          <span className="text-sm font-bold tabular-nums" style={{ color: rankColor }}>
                            {item.rank}
                          </span>
                        </div>
                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[var(--text-primary)] text-sm">
                              {item.name}
                            </span>
                            {item.genres[0] && (
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
                        {/* Score + track */}
                        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                          <StarRating score={item.voteAverage} />
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
                          <ExternalLinks name={item.name} tmdbId={item.tmdbId} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div className="w-full md:w-72 xl:w-80 flex-shrink-0 space-y-4">
          {/* New This Season */}
          <SidebarPanel
            title="New This Season"
            loading={trendsLoading}
            error={trendsError}
          >
            {(trendsData?.newShows ?? []).slice(0, 5).map((show) => (
              <CompactCard key={show.tmdbId} show={show} />
            ))}
          </SidebarPanel>

          {/* Picked for You */}
          <SidebarPanel
            title="Picked for You"
            loading={recommendedLoading}
            error={recommendedError}
          >
            {recommended.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)]">
                Add more shows to your library to get personalised recommendations.
              </p>
            ) : (
              recommended.slice(0, 5).map((show) => (
                <CompactCard
                  key={show.tmdbId}
                  show={show}
                  subLabel={`Because you watch ${show.becauseOf}`}
                />
              ))
            )}
          </SidebarPanel>

          {/* All-Time Best */}
          <SidebarPanel
            title="All-Time Best"
            loading={trendsLoading}
            error={trendsError}
          >
            {(trendsData?.topRated ?? []).slice(0, 5).map((show) => (
              <CompactCard key={show.tmdbId} show={show} />
            ))}
          </SidebarPanel>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--text-dim)]">
        Source: TMDB API · personalised recommendations based on your library
      </p>
    </div>
  );
}
