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
  const [error, setError] = useState<string | null>(null);
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
        setError("Failed to update watch status. Please try again.");
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-sm font-medium text-[var(--text-secondary)]">Episode Calendar</h1>
        <div className="flex items-center gap-3 text-xs text-[var(--text-dim)]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-[var(--accent)] inline-block" />
            Upcoming
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-[var(--accent)]/35 inline-block" />
            Watched
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/25 rounded-xl text-[var(--danger)] text-sm p-3 mb-3 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 font-medium hover:opacity-70">Dismiss</button>
        </div>
      )}

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
