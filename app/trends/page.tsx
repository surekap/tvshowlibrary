"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { TrendItem } from "@/app/api/trends/route";

export default function TrendsPage() {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/trends", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        setTrends(data.trends ?? []);
        setCachedAt(data.cachedAt ?? null);
      })
      .catch(() => setError("Failed to load trending shows."))
      .finally(() => setIsLoading(false));
  }, []);

  const maxPopularity = trends[0]?.popularity ?? 1;

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
        <p className="text-center text-xs text-gray-600 mt-6 animate-pulse">
          Downloading and analysing trending data… this may take a moment on first load.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trending TV Shows</h1>
          <p className="text-sm text-gray-400 mt-1">
            Currently airing · ranked by TMDB daily popularity score
          </p>
        </div>
        {cachedAt && (
          <div className="text-right flex-shrink-0 ml-4">
            <span className="text-xs text-gray-600">
              Updated{" "}
              {new Date(cachedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <p className="text-xs text-gray-700 mt-0.5">refreshes every 24h</p>
          </div>
        )}
      </div>

      {/* List */}
      <div className="space-y-2">
        {trends.map((item) => {
          const barWidth = (item.popularity / maxPopularity) * 100;
          const rankColor =
            item.rank === 1 ? "#f59e0b" :
            item.rank === 2 ? "#9ca3af" :
            item.rank === 3 ? "#b45309" :
            "#4b5563";

          return (
            <div
              key={`${item.tmdbId}-${item.rank}`}
              className="relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors group"
            >
              {/* Popularity bar background */}
              <div
                className="absolute inset-y-0 left-0 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity"
                style={{ width: `${barWidth}%`, backgroundColor: rankColor }}
              />

              <div className="relative flex items-stretch gap-0">
                {/* Poster */}
                <div className="relative w-16 sm:w-20 flex-shrink-0 bg-gray-800">
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
                      <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-7 text-center">
                    {item.rank <= 3 ? (
                      <span className="text-xl leading-none">
                        {item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : "🥉"}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-gray-600 tabular-nums">
                        {item.rank}
                      </span>
                    )}
                  </div>

                  {/* Name + meta + overview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">
                        {item.name}
                      </span>
                      {item.network && (
                        <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded hidden sm:inline">
                          {item.network}
                        </span>
                      )}
                      <span className="text-xs text-green-500 font-medium hidden sm:inline">
                        {item.status}
                      </span>
                    </div>
                    {item.overview && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed hidden sm:block">
                        {item.overview}
                      </p>
                    )}
                  </div>

                  {/* Popularity */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <span className="text-xs font-mono text-gray-400 tabular-nums">
                      {item.popularity.toLocaleString()}
                    </span>
                    <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden hidden sm:block">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barWidth}%`, backgroundColor: rankColor }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-gray-700">
        Source: TMDB daily series export · enriched via TVDB · currently airing only
      </p>
    </div>
  );
}
