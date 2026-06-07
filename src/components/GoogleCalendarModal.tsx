import { useState } from 'react';
import type { CalendarEvent } from '../types';
import { parseIcsText } from '../lib/parseIcs';

// In production, API is on the same origin; in dev, Vite proxies /api to the proxy server
const PROXY = '';

interface Props {
  onLoaded: (events: CalendarEvent[]) => void;
  onClose: () => void;
  savedUrls?: string[];
  vaultUnlocked?: boolean;
}

export function GoogleCalendarModal({ onLoaded, onClose, savedUrls, vaultUnlocked }: Props) {
  const [urls, setUrls] = useState<string[]>(savedUrls && savedUrls.length > 0 ? savedUrls : ['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveToVault, setSaveToVault] = useState(false);

  function setUrl(index: number, value: string) {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  }

  function addUrl() {
    setUrls((prev) => [...prev, '']);
  }

  function removeUrl(index: number) {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImport() {
    const validUrls = urls.map((u) => u.trim()).filter(Boolean);
    if (validUrls.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const allEvents: CalendarEvent[] = [];
      const seen = new Set<string>();

      for (const url of validUrls) {
        const res = await fetch(`${PROXY}/api/google/ical`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to fetch calendar');

        for (const ev of parseIcsText(data.icsText)) {
          if (!seen.has(ev.id)) {
            seen.add(ev.id);
            allEvents.push(ev);
          }
        }
      }

      if (allEvents.length === 0) {
        setError('No events found in the provided calendar URL(s).');
        return;
      }

      // Save to vault if requested
      if (saveToVault && vaultUnlocked) {
        fetch('/api/vault/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ google: validUrls }),
        }).catch(() => {});
      }

      onLoaded(allEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }

  const hasValidUrl = urls.some((u) => u.trim().length > 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Connect to Google Calendar</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-800">How to get your calendar URL</p>
            <ol className="text-sm text-blue-700 space-y-2">
              <li className="flex gap-2">
                <span className="font-bold shrink-0">1.</span>
                <span>Open <strong>Google Calendar</strong> and click the <strong>gear icon (⚙) → Settings</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold shrink-0">2.</span>
                <span>In the left sidebar under <strong>"Settings for my calendars"</strong>, click the name of the calendar you want</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold shrink-0">3.</span>
                <span>Scroll down to the <strong>"Integrate calendar"</strong> section</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold shrink-0">4.</span>
                <span>Find <strong>"Secret address in iCal format"</strong> and click the <strong>copy icon</strong> next to it</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold shrink-0">5.</span>
                <span>Paste the URL below. Add more URLs to import multiple calendars at once.</span>
              </li>
            </ol>
            <p className="text-xs text-blue-500 pt-1">
              Note: Google updates these feeds with up to a 24-hour delay. Recently added events may not appear immediately.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">iCal URL(s)</label>
            {urls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(i, e.target.value)}
                  placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                {urls.length > 1 && (
                  <button
                    onClick={() => removeUrl(i)}
                    className="text-gray-400 hover:text-gray-600 px-2 text-lg leading-none"
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addUrl}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              + Add another calendar
            </button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {vaultUnlocked && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveToVault}
                onChange={(e) => setSaveToVault(e.target.checked)}
                className="rounded accent-blue-500"
              />
              <span className="text-sm text-gray-600">Save URLs to vault</span>
            </label>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!hasValidUrl || loading}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
            >
              {loading ? 'Loading…' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
