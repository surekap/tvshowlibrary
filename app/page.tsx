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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Episode Calendar</h1>
          <p className="text-sm text-gray-400 mt-1">
            Track and discover upcoming episodes from your watchlist
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-500 opacity-100 inline-block" />
            Upcoming
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-500 opacity-50 inline-block" />
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
