"use client";

import { useCallback, useRef, useState, MutableRefObject } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { EventClickArg, DatesSetArg, EventContentArg, EventSourceFuncArg, EventInput } from "@fullcalendar/core";
import type { CalendarEvent } from "@/components/EpisodeModal";

interface CalendarViewProps {
  onEventClick: (event: CalendarEvent) => void;
  refreshRef: MutableRefObject<() => void>;
}

export default function CalendarView({
  onEventClick,
  refreshRef,
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (
      info: EventSourceFuncArg,
      successCallback: (events: EventInput[]) => void,
      failureCallback: (error: Error) => void
    ) => {
      try {
        const res = await fetch(
          `/api/calendar?start=${info.startStr}&end=${info.endStr}`
        );
        if (!res.ok) throw new Error("Failed to fetch calendar events");
        const data = await res.json();
        successCallback(data.events ?? []);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        failureCallback(error);
        setCalendarError("Failed to load episodes. Check your connection and try refreshing.");
      }
    },
    []
  );

  // Expose a refresh function to the parent
  const handleDatesSet = useCallback(
    (_arg: DatesSetArg) => {
      setCalendarError(null);
      refreshRef.current = () => {
        calendarRef.current?.getApi().refetchEvents();
      };
    },
    [refreshRef]
  );

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const eventData = arg.event.extendedProps as Omit<
        CalendarEvent,
        "title" | "start" | "backgroundColor" | "borderColor" | "textColor" | "classNames"
      >;
      const calEvent: CalendarEvent = {
        ...eventData,
        id: arg.event.id,
        title: arg.event.title,
        start: arg.event.startStr,
        backgroundColor: arg.event.backgroundColor,
        borderColor: arg.event.borderColor,
        textColor: arg.event.textColor ?? "#ffffff",
        classNames: (arg.event.classNames ?? []) as string[],
      };
      onEventClick(calEvent);
    },
    [onEventClick]
  );

  const renderEventContent = useCallback((arg: EventContentArg) => {
    return (
      <div
        className="px-1.5 py-0.5 rounded text-xs font-medium truncate w-full"
        style={{ color: arg.event.textColor ?? "#fff" }}
        title={arg.event.title}
      >
        {arg.event.title}
      </div>
    );
  }, []);

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-3 sm:p-4 overflow-hidden">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,listWeek",
        }}
        events={fetchEvents}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        eventContent={renderEventContent}
        height="auto"
        aspectRatio={1.8}
        eventDisplay="block"
        dayMaxEvents={3}
        moreLinkClassNames="text-[var(--accent-hover)] hover:text-[var(--accent)] text-xs font-medium"
        nowIndicator
        buttonText={{
          today: "Today",
          month: "Month",
          listWeek: "List",
        }}
        views={{
          listWeek: {
            buttonText: "List",
            listDayFormat: { weekday: "long", month: "short", day: "numeric" },
          },
        }}
        noEventsContent={() => (
          <div className="text-center py-12 text-[var(--text-dim)]">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="font-medium text-[var(--text-secondary)] text-sm">Nothing airing this period</p>
            <p className="text-xs mt-1 text-[var(--text-dim)]">
              <a href="/browse" className="text-[var(--accent-hover)] hover:underline">Add more shows</a>{" "}
              to fill your calendar
            </p>
          </div>
        )}
      />
      {calendarError && (
        <div className="mt-3 p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/25 rounded-xl text-[var(--danger)] text-sm text-center">
          {calendarError}
        </div>
      )}
    </div>
  );
}
