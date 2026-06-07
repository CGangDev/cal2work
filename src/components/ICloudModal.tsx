import { useState } from 'react';
import type { CalendarEvent } from '../types';
import { parseIcsText } from '../lib/parseIcs';

// In production, API is on the same origin; in dev, Vite proxies /api to the proxy server
const PROXY = '';

interface Calendar {
  url: string;
  name: string;
}

type Step = 'credentials' | 'calendars' | 'loading-events';

interface Props {
  onLoaded: (events: CalendarEvent[]) => void;
  onClose: () => void;
  savedEmail?: string;
  savedPassword?: string;
  vaultUnlocked?: boolean;
}

export function ICloudModal({ onLoaded, onClose, savedEmail, savedPassword, vaultUnlocked }: Props) {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState(savedEmail ?? '');
  const [password, setPassword] = useState(savedPassword ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [saveToVault, setSaveToVault] = useState(false);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${PROXY}/api/icloud/calendars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Connection failed');
      setCalendars(data.calendars);
      setSelectedUrls(new Set(data.calendars.map((c: Calendar) => c.url)));
      setStep('calendars');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (selectedUrls.size === 0) return;
    setError(null);
    setStep('loading-events');
    try {
      const allEvents: CalendarEvent[] = [];
      const seen = new Set<string>();

      // Fetch each calendar individually so we can tag events with the calendar name
      for (const url of Array.from(selectedUrls)) {
        const calName = calendars.find((c) => c.url === url)?.name ?? '';
        const res = await fetch(`${PROXY}/api/icloud/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, calendarUrls: [url] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Failed to fetch events for ${calName}`);

        for (const block of data.icsBlocks as string[]) {
          for (const ev of parseIcsText(block, calName)) {
            if (!seen.has(ev.id)) {
              seen.add(ev.id);
              allEvents.push(ev);
            }
          }
        }
      }

      // Save to vault if requested
      if (saveToVault && vaultUnlocked) {
        fetch('/api/vault/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icloud: { email, password } }),
        }).catch(() => {}); // Best-effort, don't block the user
      }

      onLoaded(allEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
      setStep('calendars');
    }
  }

  function toggleCalendar(url: string) {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Connect to iCloud Calendar</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="p-5">
          {/* Step 1: Credentials */}
          {step === 'credentials' && (
            <form onSubmit={handleConnect} className="space-y-4">
              <p className="text-sm text-gray-500">
                Sign in with your Apple ID. You must use an{' '}
                <strong>app-specific password</strong> — not your regular Apple ID password.{' '}
                Generate one at{' '}
                <span className="font-mono text-xs bg-gray-100 px-1 rounded">appleid.apple.com</span>{' '}
                under Sign-In and Security → App-Specific Passwords.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Apple ID (email)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@icloud.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">App-specific password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
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
                  <span className="text-sm text-gray-600">Save credentials to vault</span>
                </label>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Connecting…' : 'Connect'}
              </button>
            </form>
          )}

          {/* Step 2: Select calendars */}
          {step === 'calendars' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Select the calendars to import.
              </p>

              <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {calendars.map((cal) => (
                  <label key={cal.url} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedUrls.has(cal.url)}
                      onChange={() => toggleCalendar(cal.url)}
                      className="rounded accent-blue-500"
                    />
                    <span className="text-sm text-gray-700">{cal.name}</span>
                  </label>
                ))}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('credentials')}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedUrls.size === 0}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
                >
                  Import {selectedUrls.size > 0 ? `${selectedUrls.size} calendar${selectedUrls.size > 1 ? 's' : ''}` : ''}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Loading events */}
          {step === 'loading-events' && (
            <div className="py-8 text-center space-y-3">
              <p className="text-gray-600 text-sm">Fetching events from iCloud…</p>
              <p className="text-gray-400 text-xs">This may take a moment for large calendars.</p>
              {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
