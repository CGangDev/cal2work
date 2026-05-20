import ICAL from 'ical.js';
import type { CalendarEvent } from '../types';

function parseVEvents(icsText: string, calendarName?: string): CalendarEvent[] {
  let parsed: unknown[];
  try {
    parsed = ICAL.parse(icsText);
  } catch {
    console.warn('Failed to parse ics content', calendarName);
    return [];
  }

  const root = new ICAL.Component(parsed as unknown[]);
  const vevents = root.getAllSubcomponents('vevent');
  const events: CalendarEvent[] = [];

  for (const vevent of vevents) {
    try {
      const event = new ICAL.Event(vevent);

      const startDate = event.startDate?.toJSDate() ?? new Date();
      const endDate = event.endDate?.toJSDate() ?? startDate;
      const isAllDay = event.startDate?.isDate ?? false;

      const uid = event.uid || crypto.randomUUID();
      const summary = event.summary || '';

      const organizer = vevent.getFirstPropertyValue('organizer') as string | null;
      const attendeeProps = vevent.getAllProperties('attendee');
      const attendees = attendeeProps.map((p) => {
        const cn = p.getParameter('cn');
        const val = p.getFirstValue() as string;
        return cn || val || '';
      }).filter(Boolean);

      events.push({
        id: uid,
        title: summary,
        start: startDate,
        end: endDate,
        allDay: isAllDay,
        description: (vevent.getFirstPropertyValue('description') as string | null) ?? undefined,
        location: (vevent.getFirstPropertyValue('location') as string | null) ?? undefined,
        organizer: organizer ?? undefined,
        attendees,
        calendarName,
        rawVEvent: vevent.toString(),
      });
    } catch (err) {
      console.warn('Skipping malformed VEVENT:', err);
    }
  }

  return events;
}

export function parseIcsText(text: string, calendarName?: string): CalendarEvent[] {
  return parseVEvents(text, calendarName);
}

export async function parseIcsFile(file: File): Promise<CalendarEvent[]> {
  const text = await file.text();
  return parseVEvents(text, file.name.replace(/\.ics$/i, ''));
}

export async function parseIcbuDirectory(files: FileList): Promise<CalendarEvent[]> {
  const icsFiles = Array.from(files).filter((f) =>
    f.name.toLowerCase().endsWith('.ics')
  );

  const results = await Promise.all(
    icsFiles.map(async (f) => {
      const text = await f.text();
      // .icbu paths look like: CalendarName.icbu/Events/uid.ics
      const pathParts = f.webkitRelativePath?.split('/') ?? [];
      const calendarName = pathParts.length > 1
        ? pathParts[0].replace(/\.icbu$/i, '')
        : f.name.replace(/\.ics$/i, '');
      return parseVEvents(text, calendarName);
    })
  );

  const all = results.flat();

  // Deduplicate by UID — same event may appear in multiple ics files
  const seen = new Set<string>();
  return all.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}
