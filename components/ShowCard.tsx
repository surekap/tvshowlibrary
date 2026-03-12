"use client";

import Image from "next/image";

interface ShowCardProps {
  tvdbId: number;
  name: string;
  overview?: string | null;
  posterUrl?: string | null;
  status?: string | null;
  network?: string | null;
  year?: string | null;
  isTracked: boolean;
  isLoading: boolean;
  onAdd: (tvdbId: number) => void;
  onRemove: (tvdbId: number) => void;
}

export default function ShowCard({
  tvdbId,
  name,
  overview,
  posterUrl,
  status,
  network,
  year,
  isTracked,
  isLoading,
  onAdd,
  onRemove,
}: ShowCardProps) {
  const statusColor =
    status === "Continuing"
      ? "text-green-400"
      : status === "Ended"
      ? "text-red-400"
      : "text-gray-400";

  return (
    <div className="flex gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
      {/* Poster */}
      <div className="relative w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-600"
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
        <h3 className="font-semibold text-white truncate">{name}</h3>

        <div className="flex flex-wrap items-center gap-2 mt-1 mb-2">
          {year && <span className="text-xs text-gray-400">{year}</span>}
          {network && (
            <span className="text-xs text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
              {network}
            </span>
          )}
          {status && (
            <span className={`text-xs font-medium ${statusColor}`}>
              {status}
            </span>
          )}
        </div>

        {overview && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {overview}
          </p>
        )}
      </div>

      {/* Action button */}
      <div className="flex-shrink-0 flex items-start">
        {isTracked ? (
          <button
            onClick={() => onRemove(tvdbId)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/30 text-red-400 border border-red-800/50 hover:bg-red-900/50 hover:border-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            Remove
          </button>
        ) : (
          <button
            onClick={() => onAdd(tvdbId)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Add
          </button>
        )}
      </div>
    </div>
  );
}
