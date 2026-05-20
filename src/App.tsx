import { useState, useMemo } from 'react';
import type { CalendarEvent, SelectedEvent } from './types';
import { FileDropzone } from './components/FileDropzone';
import { CalendarView } from './components/CalendarView';
import { TimeframeFilter } from './components/TimeframeFilter';
import { SelectedEventsSidebar } from './components/SelectedEventsSidebar';
import { StopButton } from './components/StopButton';

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

function defaultRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear() + 1, now.getMonth() + 1, 0); // last day of same month next year
  return { start: toDateString(start), end: toDateString(end) };
}

export default function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<SelectedEvent[]>([]);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  function handleLoaded(loaded: CalendarEvent[]) {
    setEvents(loaded);
    setSelected([]);
    const range = defaultRange();
    setRangeStart(range.start);
    setRangeEnd(range.end);
  }

  const visibleEvents = useMemo(() => {
    if (!rangeStart && !rangeEnd) return events;
    const start = rangeStart ? new Date(rangeStart).getTime() : -Infinity;
    const end = rangeEnd ? new Date(rangeEnd + 'T23:59:59').getTime() : Infinity;
    return events.filter((e) => e.start.getTime() >= start && e.start.getTime() <= end);
  }, [events, rangeStart, rangeEnd]);

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected]
  );

  function handleEventClick(id: string) {
    setSelected((prev) => {
      if (prev.some((s) => s.id === id)) {
        return prev.filter((s) => s.id !== id);
      }
      return [...prev, { id, includeDetails: true }];
    });
  }

  function handleToggleDetails(id: string) {
    setSelected((prev) =>
      prev.map((s) => s.id === id ? { ...s, includeDetails: !s.includeDetails } : s)
    );
  }

  function handleRemove(id: string) {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSelectAll() {
    const existing = new Set(selected.map((s) => s.id));
    const toAdd = visibleEvents
      .filter((e) => !existing.has(e.id))
      .map((e) => ({ id: e.id, includeDetails: true }));
    setSelected((prev) => [...prev, ...toAdd]);
  }

  function handleClearAll() {
    setSelected([]);
  }

  function handleRangeChange(start: string, end: string) {
    setRangeStart(start);
    setRangeEnd(end);
    const startMs = start ? new Date(start).getTime() : -Infinity;
    const endMs = end ? new Date(end + 'T23:59:59').getTime() : Infinity;
    const visibleSet = new Set(
      events
        .filter((e) => e.start.getTime() >= startMs && e.start.getTime() <= endMs)
        .map((e) => e.id)
    );
    setSelected((prev) => prev.filter((s) => visibleSet.has(s.id)));
  }

  if (events.length === 0) {
    return <FileDropzone onLoaded={handleLoaded} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 gap-4">
        <button
          onClick={() => { setEvents([]); setSelected([]); }}
          className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1.5 flex-shrink-0"
        >
          ← Open file
        </button>

        <TimeframeFilter
          start={rangeStart}
          end={rangeEnd}
          onChange={handleRangeChange}
        />

        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="text-sm text-gray-400">
            {visibleEvents.length} event{visibleEvents.length !== 1 ? 's' : ''}
          </span>
          <StopButton />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <CalendarView
          events={visibleEvents}
          selectedIds={selectedIds}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onEventClick={handleEventClick}
        />
        <SelectedEventsSidebar
          events={events}
          selected={selected}
          onToggleDetails={handleToggleDetails}
          onRemove={handleRemove}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
        />
      </div>
    </div>
  );
}
