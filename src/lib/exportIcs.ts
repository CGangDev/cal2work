import type { CalendarEvent, SelectedEvent } from '../types';

function formatDateTime(date: Date, allDay: boolean): string {
  if (allDay) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function dtstamp(): string {
  return formatDateTime(new Date(), false);
}

function buildAnonymousVEvent(event: CalendarEvent): string {
  const start = formatDateTime(event.start, event.allDay);
  const end = formatDateTime(event.end, event.allDay);
  const dtType = event.allDay ? 'DATE' : 'DATE-TIME';

  return [
    'BEGIN:VEVENT',
    `UID:${event.id}`,
    `DTSTAMP:${dtstamp()}`,
    `DTSTART;VALUE=${dtType}:${start}`,
    `DTEND;VALUE=${dtType}:${end}`,
    'SUMMARY:event',
    'END:VEVENT',
  ].join('\r\n');
}

function stripXAppleProperties(raw: string): string {
  // iCalendar lines may be folded — continuation lines start with a space or tab.
  // Track whether we're inside a filtered property's (possibly folded) value.
  const lines = raw.split(/\r?\n/);
  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const isContinuation = /^[ \t]/.test(line);
    if (isContinuation) {
      if (!skipping) result.push(line);
      continue;
    }
    skipping = /^X-APPLE-/i.test(line);
    if (!skipping) result.push(line);
  }

  return result.join('\r\n');
}

function buildFullVEvent(event: CalendarEvent): string {
  // Rebuild from raw to preserve recurrence rules, timezone info, etc.
  // Strip Apple-proprietary extension properties and refresh DTSTAMP.
  let raw = stripXAppleProperties(event.rawVEvent);

  // Replace or insert DTSTAMP
  if (/^DTSTAMP:/m.test(raw)) {
    raw = raw.replace(/^DTSTAMP:.*$/m, `DTSTAMP:${dtstamp()}`);
  } else {
    raw = raw.replace('BEGIN:VEVENT\r\n', `BEGIN:VEVENT\r\nDTSTAMP:${dtstamp()}\r\n`);
    raw = raw.replace('BEGIN:VEVENT\n', `BEGIN:VEVENT\nDTSTAMP:${dtstamp()}\n`);
  }

  return raw.trim();
}

export function exportToIcs(
  events: CalendarEvent[],
  selected: SelectedEvent[]
): void {
  const selectedMap = new Map(selected.map((s) => [s.id, s]));

  const vevents = events
    .filter((e) => selectedMap.has(e.id))
    .map((e) => {
      const sel = selectedMap.get(e.id)!;
      return sel.includeDetails ? buildFullVEvent(e) : buildAnonymousVEvent(e);
    });

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calendar Sync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'export.ics';
  a.click();
  URL.revokeObjectURL(url);
}
