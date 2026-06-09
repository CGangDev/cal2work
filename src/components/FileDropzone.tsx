import { useRef, useState, type DragEvent } from 'react';
import type { CalendarEvent } from '../types';
import { parseIcsFile, parseIcbuDirectory, parseIcsText } from '../lib/parseIcs';
import { ICloudModal } from './ICloudModal';
import { GoogleCalendarModal } from './GoogleCalendarModal';
import { StopButton } from './StopButton';

interface VaultCredentials {
  icloud: { email: string; password: string } | null;
  google: string[];
  autoConnect: boolean;
}

interface Props {
  onLoaded: (events: CalendarEvent[]) => void;
  savedCredentials?: VaultCredentials | null;
  vaultUnlocked?: boolean;
  onOpenVaultSettings?: () => void;
  onModalClosed?: () => void;
}

export function FileDropzone({ onLoaded, savedCredentials, vaultUnlocked, onOpenVaultSettings, onModalClosed }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showICloud, setShowICloud] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);
  const [connectingBoth, setConnectingBoth] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  async function handleIcsFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const events = await parseIcsFile(file);
      if (events.length === 0) setError('No events found in file.');
      else onLoaded(events);
    } catch {
      setError('Failed to parse file. Make sure it is a valid .ics file.');
    } finally {
      setLoading(false);
    }
  }

  async function handleIcbuFiles(files: FileList) {
    setLoading(true);
    setError(null);
    try {
      const events = await parseIcbuDirectory(files);
      if (events.length === 0) setError('No events found in backup.');
      else onLoaded(events);
    } catch {
      setError('Failed to parse backup. Make sure it is a valid .icbu directory.');
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const items = Array.from(e.dataTransfer.items);

    // Check for directory entry
    const dirEntry = items.find(
      (item) => item.kind === 'file' && (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.()?.isDirectory
    );

    if (dirEntry) {
      // Directory drop — use FileList from files
      if (e.dataTransfer.files.length > 0) {
        handleIcbuFiles(e.dataTransfer.files);
      }
      return;
    }

    const file = e.dataTransfer.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.ics')) {
      handleIcsFile(file);
    } else {
      setError('Please drop a .ics file or an .icbu folder.');
    }
  }

  async function handleConnectBoth() {
    if (!savedCredentials) return;
    setConnectingBoth(true);
    setError(null);
    const allEvents: CalendarEvent[] = [];
    const seen = new Set<string>();

    try {
      // iCloud
      if (savedCredentials.icloud) {
        const calRes = await fetch('/api/icloud/calendars', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: savedCredentials.icloud.email, password: savedCredentials.icloud.password }),
        });
        if (calRes.ok) {
          const { calendars } = await calRes.json();
          for (const cal of calendars as { url: string; name: string }[]) {
            const evRes = await fetch('/api/icloud/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: savedCredentials.icloud.email, password: savedCredentials.icloud.password, calendarUrls: [cal.url] }),
            });
            if (evRes.ok) {
              const { icsBlocks } = await evRes.json();
              for (const block of icsBlocks as string[]) {
                for (const ev of parseIcsText(block, cal.name)) {
                  if (!seen.has(ev.id)) { seen.add(ev.id); allEvents.push(ev); }
                }
              }
            }
          }
        }
      }

      // Google
      for (const url of savedCredentials.google) {
        const res = await fetch('/api/google/ical', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (res.ok) {
          const { icsText } = await res.json();
          for (const ev of parseIcsText(icsText)) {
            if (!seen.has(ev.id)) { seen.add(ev.id); allEvents.push(ev); }
          }
        }
      }

      if (allEvents.length === 0) {
        setError('No events found from saved credentials.');
      } else {
        onLoaded(allEvents);
      }
    } catch {
      setError('Failed to connect. Try connecting individually.');
    } finally {
      setConnectingBoth(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
        <div className="w-full max-w-lg">
          <h1 className="text-3xl font-semibold text-gray-800 mb-2 text-center">Cal2Work</h1>
          <p className="text-gray-500 text-center mb-8">
            Open an Apple .ics file, .icbu backup, or connect to iCloud or Google Calendar directly.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
              dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-5xl mb-4">📅</div>
            <p className="text-gray-700 font-medium mb-1">Drop a .ics file here</p>
            <p className="text-gray-400 text-sm">or click to browse</p>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Open .ics file
            </button>
            <button
              onClick={() => dirRef.current?.click()}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Open .icbu backup
            </button>
          </div>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-50 px-3 text-xs text-gray-400">or</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowICloud(true)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                savedCredentials?.icloud
                  ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              iCloud Calendar
            </button>
            <button
              onClick={() => setShowGoogle(true)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                savedCredentials?.google && savedCredentials.google.length > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Google Calendar
            </button>
          </div>

          {savedCredentials?.icloud && savedCredentials.google.length > 0 && (
            <button
              onClick={handleConnectBoth}
              disabled={connectingBoth}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {connectingBoth ? 'Connecting…' : 'Connect to both (saved credentials)'}
            </button>
          )}

          {loading && (
            <p className="text-center text-blue-600 mt-4 text-sm">Parsing calendar data…</p>
          )}
          {error && (
            <p className="text-center text-red-500 mt-4 text-sm">{error}</p>
          )}

          <div className="mt-8 text-center flex items-center justify-center gap-4">
            {(vaultUnlocked || savedCredentials) && onOpenVaultSettings && (
              <button
                onClick={onOpenVaultSettings}
                className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
                title="Vault settings"
              >
                🔒 Vault
              </button>
            )}
            <StopButton />
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileRef}
          type="file"
          accept=".ics"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleIcsFile(f);
            e.target.value = '';
          }}
        />
        <input
          ref={dirRef}
          type="file"
          // @ts-expect-error webkitdirectory is non-standard
          webkitdirectory=""
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleIcbuFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {showICloud && (
        <ICloudModal
          onLoaded={(events) => { setShowICloud(false); onLoaded(events); }}
          onClose={() => { setShowICloud(false); onModalClosed?.(); }}
          savedEmail={savedCredentials?.icloud?.email}
          savedPassword={savedCredentials?.icloud?.password}
        />
      )}

      {showGoogle && (
        <GoogleCalendarModal
          onLoaded={(events) => { setShowGoogle(false); onLoaded(events); }}
          onClose={() => { setShowGoogle(false); onModalClosed?.(); }}
          savedUrls={savedCredentials?.google}
        />
      )}
    </>
  );
}
