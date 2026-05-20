export interface CalendarEvent {
  id: string;           // UID
  title: string;        // SUMMARY
  start: Date;
  end: Date;
  allDay: boolean;
  description?: string;
  location?: string;
  organizer?: string;
  attendees: string[];
  calendarName?: string;
  rawVEvent: string;    // original VEVENT text for faithful export
}

export interface SelectedEvent {
  id: string;
  includeDetails: boolean;
}

export type ViewMode = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listMonth';
