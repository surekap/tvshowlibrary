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
      ? "text-[var(--status-continuing)]"
      : status === "Ended"
      ? "text-[var(--status-ended)]"
      : "text-[var(--text-dim)]";

  const statusDot =
    status === "Continuing"
      ? "bg-[var(--status-continuing)]"
      : status === "Ended"
      ? "bg-[var(--status-ended)]"
      : "bg-[var(--text-dim)]";

  return (
    <div className="flex gap-3.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-3.5 hover:border-[var(--border-hover)] transition-all duration-200 hover:shadow-card group">
      {/* Poster */}
      <div className="relative w-[52px] h-[78px] flex-shrink-0 rounded-lg overflow-hidden bg-[var(--bg-elevated)]">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="52px"
          />
        ) : (
          <div className="poster-placeholder w-full h-full">
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h3 className="font-display font-semibold text-[var(--text-primary)] text-sm leading-tight line-clamp-2">
            {name}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
            {year && (
              <span className="text-[11px] text-[var(--text-dim)]">{year}</span>
            )}
            {network && (
              <span className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-1.5 py-px rounded-md">
                {network}
              </span>
            )}
            {status && (
              <span className={`text-[11px] font-medium flex items-center gap-1 ${statusColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${statusDot}`} />
                {status}
              </span>
            )}
          </div>
          {overview && (
            <p className="text-[11.5px] text-[var(--text-dim)] line-clamp-2 leading-relaxed mt-1.5">
              {overview}
            </p>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="flex-shrink-0 flex items-start pt-0.5">
        {isTracked ? (
          <button
            onClick={() => onRemove(tvdbId)}
            disabled={isLoading}
            className="btn btn-danger"
          >
            {isLoading ? (
              <Spinner />
            ) : (
              <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            Remove
          </button>
        ) : (
          <button
            onClick={() => onAdd(tvdbId)}
            disabled={isLoading}
            className="btn btn-primary"
          >
            {isLoading ? (
              <Spinner />
            ) : (
              <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Track
          </button>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
