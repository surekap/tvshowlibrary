"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { formatAirDate } from "@/lib/utils";

export interface CalendarEvent {
  id: string;
  tvdbId: number;
  showId: number;
  showName: string;
  showPosterUrl: string | null;
  seasonNumber: number;
  episodeNumber: number;
  code: string;
  name: string | null;
  overview: string | null;
  aired: string | null;
  runtime: number | null;
  watched: boolean;
  watchedAt: string | null;
  color: string;
  title: string;
  start?: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  classNames: string[];
}

interface EpisodeModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
  onToggleWatch: (event: CalendarEvent) => void;
  isUpdating: boolean;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function EpisodeModal({
  event,
  onClose,
  onToggleWatch,
  isUpdating,
}: EpisodeModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Focus trap: auto-focus first element, cycle Tab/Shift+Tab within panel
  useEffect(() => {
    if (!event) return;
    const panel = panelRef.current;
    if (!panel) return;

    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Defer so the panel is fully painted
    const timer = setTimeout(() => getFocusable()[0]?.focus(), 10);

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleTab);
    };
  }, [event]);

  // Prevent body scroll while open
  useEffect(() => {
    if (event) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [event]);

  if (!event) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 modal-backdrop"
      onClick={handleBackdropClick}
    >
      {/* Sheet on mobile, centered card on sm+ */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="episode-modal-title"
        className="modal-panel w-full sm:max-w-md fade-up"
      >
        {/* Color accent bar */}
        <div className="h-1 w-full" style={{ backgroundColor: event.color }} />

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start gap-3 mb-4">
            {/* Poster */}
            {event.showPosterUrl && (
              <div className="relative w-11 h-[66px] rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-overlay)]">
                <Image
                  src={event.showPosterUrl}
                  alt={event.showName}
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              </div>
            )}

            {/* Title block */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-0.5 truncate">
                {event.showName}
              </p>
              <h2
                id="episode-modal-title"
                className="font-display text-base font-bold text-[var(--text-primary)] leading-snug"
              >
                {event.name || `Episode ${event.episodeNumber}`}
              </h2>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--bg-overlay)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-hover)] transition-all ml-1"
              aria-label="Close"
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Meta chips */}
          <div className="flex items-center flex-wrap gap-2 mb-4">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold text-white"
              style={{ backgroundColor: event.color + "cc" }}
            >
              {event.code}
            </span>
            {event.aired && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                <svg aria-hidden="true" className="w-3 h-3 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatAirDate(event.aired)}
              </span>
            )}
            {!event.aired && (
              <span className="text-xs text-[var(--text-dim)] italic">Airdate TBA</span>
            )}
            {event.runtime && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                <svg aria-hidden="true" className="w-3 h-3 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {event.runtime}m
              </span>
            )}
          </div>

          {/* Overview */}
          <div className="mb-5 min-h-[3rem]">
            {event.overview ? (
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {event.overview}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-dim)] italic">
                No overview available.
              </p>
            )}
          </div>

          {/* Watched info */}
          {event.watched && event.watchedAt && (
            <div className="flex items-center gap-1.5 mb-3 text-xs text-[var(--watched)] bg-[var(--watched-dim)] border border-[var(--watched)]/20 rounded-lg px-3 py-2">
              <svg aria-hidden="true" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Watched on{" "}
              {new Date(event.watchedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          )}

          {/* Toggle button */}
          <button
            onClick={() => onToggleWatch(event)}
            disabled={isUpdating}
            aria-busy={isUpdating}
            className={`w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              event.watched
                ? "bg-[var(--bg-overlay)] hover:bg-[var(--border-hover)] text-[var(--text-secondary)]"
                : "text-white hover:brightness-110"
            }`}
            style={!event.watched ? { backgroundColor: event.color } : undefined}
          >
            {isUpdating ? (
              <svg aria-hidden="true" className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : event.watched ? (
              <>
                <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Mark as Unwatched
              </>
            ) : (
              <>
                <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Mark as Watched
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
