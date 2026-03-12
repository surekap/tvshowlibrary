"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CalendarEvent } from "@/components/EpisodeModal";

// Dynamically import FullCalendar to avoid SSR issues
const FullCalendarWrapper = dynamic(
  () => import("@/components/CalendarView"),
  { ssr: false, loading: () => <CalendarSkeleton /> }
);

const EpisodeModal = dynamic(() => import("@/components/EpisodeModal"), {
  ssr: false,
});

function CalendarSkeleton() {
  return (
    <div className="skeleton rounded-xl h-[600px] w-full" />
  );
}

export default function CalendarPage() {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  // Used to force CalendarView to refresh after a watch toggle
  const refreshRef = useRef<() => void>(() => {});

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleToggleWatch = useCallback(
    async (event: CalendarEvent) => {
      setIsUpdating(true);
      try {
        if (event.watched) {
          await fetch(`/api/episodes/${event.id}/watch`, { method: "DELETE" });
        } else {
          await fetch(`/api/episodes/${event.id}/watch`, { method: "POST" });
        }
        // Update local state
        setSelectedEvent((prev) =>
          prev ? { ...prev, watched: !prev.watched, watchedAt: !event.watched ? new Date().toISOString() : null } : null
        );
        // Refresh calendar events
        refreshRef.current();
      } catch (error) {
        console.error("Failed to toggle watch status:", error);
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-[var(--text-primary)]">Episode Calendar</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            All upcoming episodes from your watchlist
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3 text-xs text-[var(--text-dim)] bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
            Upcoming
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/35 inline-block" />
            Watched
          </span>
        </div>
      </div>

      <FullCalendarWrapper
        onEventClick={handleEventClick}
        refreshRef={refreshRef}
      />

      <EpisodeModal
        event={selectedEvent}
        onClose={handleClose}
        onToggleWatch={handleToggleWatch}
        isUpdating={isUpdating}
      />
    </div>
  );
}
