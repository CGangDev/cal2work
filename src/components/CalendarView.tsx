import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventContentArg } from '@fullcalendar/core';
import type { CalendarEvent } from '../types';

interface Props {
  events: CalendarEvent[];
  selectedIds: Set<string>;
  rangeStart: string;
  rangeEnd: string;
  onEventClick: (id: string) => void;
}

function renderEventContent(info: EventContentArg, selectedIds: Set<string>) {
  const isSelected = selectedIds.has(info.event.id);
  return (
    <div
      className={`px-1 py-0.5 rounded text-xs font-medium truncate w-full ${
        isSelected
          ? 'bg-blue-600 text-white ring-2 ring-blue-300'
          : 'bg-blue-100 text-blue-900'
      }`}
    >
      {info.timeText && <span className="mr-1 opacity-70">{info.timeText}</span>}
      {info.event.title || '(no title)'}
    </div>
  );
}

export function CalendarView({ events, selectedIds, rangeStart, rangeEnd, onEventClick }: Props) {
  const fcEvents = events.map((e) => ({
    id: e.id,
    title: e.title || '(no title)',
    start: e.start,
    end: e.end,
    allDay: e.allDay,
  }));

  const validRange = rangeStart && rangeEnd
    ? { start: rangeStart, end: rangeEnd }
    : undefined;

  const initialDate = rangeStart || undefined;

  function handleClick(info: EventClickArg) {
    onEventClick(info.event.id);
  }

  return (
    <div className="flex-1 min-w-0 overflow-hidden p-4">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={initialDate}
        validRange={validRange}
        events={fcEvents}
        eventClick={handleClick}
        eventContent={(info) => renderEventContent(info, selectedIds)}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
        }}
        height="100%"
        eventDisplay="block"
        dayMaxEvents={4}
      />
    </div>
  );
}
