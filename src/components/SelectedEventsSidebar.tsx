import type { CalendarEvent, SelectedEvent } from '../types';
import { exportToIcs } from '../lib/exportIcs';

interface Props {
  events: CalendarEvent[];
  selected: SelectedEvent[];
  onToggleDetails: (id: string) => void;
  onRemove: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(d: Date, allDay: boolean): string {
  if (allDay) return 'All day';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function SelectedEventsSidebar({
  events,
  selected,
  onToggleDetails,
  onRemove,
  onSelectAll,
  onClearAll,
}: Props) {
  const selectedIds = new Set(selected.map((s) => s.id));
  const selectedEvents = events.filter((e) => selectedIds.has(e.id));
  const detailCount = selected.filter((s) => s.includeDetails).length;

  function handleExport() {
    exportToIcs(events, selected);
  }

  return (
    <aside className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-800">Selected Events</h2>
          <span className="text-sm text-gray-400">{selected.length} selected</span>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={onSelectAll}
            className="text-xs text-blue-600 hover:underline"
          >
            Select all visible
          </button>
          <span className="text-gray-300">·</span>
          <button
            onClick={onClearAll}
            className="text-xs text-gray-400 hover:underline"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedEvents.length === 0 ? (
          <p className="text-gray-400 text-sm text-center mt-8 px-4">
            Click events on the calendar to select them for export.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {selectedEvents.map((event) => {
              const sel = selected.find((s) => s.id === event.id)!;
              return (
                <li key={event.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{event.title || '(no title)'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(event.start)}
                        {!event.allDay && ` · ${formatTime(event.start, event.allDay)}`}
                      </p>
                      {event.calendarName && (
                        <p className="text-xs text-gray-300 truncate">{event.calendarName}</p>
                      )}
                    </div>
                    <button
                      onClick={() => onRemove(event.id)}
                      className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5"
                      title="Remove from selection"
                    >
                      ✕
                    </button>
                  </div>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sel.includeDetails}
                      onChange={() => onToggleDetails(event.id)}
                      className="rounded accent-blue-500"
                    />
                    <span className="text-xs text-gray-600">Include details</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 space-y-2">
        {selected.length > 0 && (
          <p className="text-xs text-gray-400 text-center">
            {detailCount} with details · {selected.length - detailCount} anonymized
          </p>
        )}
        <button
          onClick={handleExport}
          disabled={selected.length === 0}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Export {selected.length > 0 ? `${selected.length} event${selected.length > 1 ? 's' : ''}` : 'events'} →
        </button>
      </div>
    </aside>
  );
}
