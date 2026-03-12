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

export default function EpisodeModal({
  event,
  onClose,
  onToggleWatch,
  isUpdating,
}: EpisodeModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (event) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [event]);

  if (!event) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header with show color accent */}
        <div
          className="h-1 w-full"
          style={{ backgroundColor: event.color }}
        />

        <div className="p-6">
          {/* Close button */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {event.showPosterUrl && (
                <div className="relative w-12 h-16 rounded overflow-hidden flex-shrink-0 bg-gray-800">
                  <Image
                    src={event.showPosterUrl}
                    alt={event.showName}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  {event.showName}
                </p>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {event.name || `Episode ${event.episodeNumber}`}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 transition-colors ml-2 flex-shrink-0"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Episode details */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: event.color }}
            >
              {event.code}
            </span>
            {event.aired && (
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatAirDate(event.aired)}
              </span>
            )}
            {!event.aired && (
              <span className="text-sm text-gray-500 italic">Airdate TBA</span>
            )}
            {event.runtime && (
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {event.runtime}m
              </span>
            )}
          </div>

          {/* Overview */}
          {event.overview ? (
            <p className="text-sm text-gray-300 leading-relaxed mb-6">
              {event.overview}
            </p>
          ) : (
            <p className="text-sm text-gray-600 italic mb-6">
              No overview available.
            </p>
          )}

          {/* Watch status */}
          {event.watched && event.watchedAt && (
            <p className="text-xs text-gray-500 mb-3">
              Watched on{" "}
              {new Date(event.watchedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}

          {/* Toggle watch button */}
          <button
            onClick={() => onToggleWatch(event)}
            disabled={isUpdating}
            className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
              event.watched
                ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                : "text-white hover:opacity-90"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            style={
              !event.watched
                ? { backgroundColor: event.color }
                : undefined
            }
          >
            {isUpdating ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : event.watched ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Mark as Unwatched
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
