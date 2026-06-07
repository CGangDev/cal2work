import { useState, useMemo, useEffect } from 'react';
import type { CalendarEvent, SelectedEvent } from './types';
import { parseIcsText } from './lib/parseIcs';
import { FileDropzone } from './components/FileDropzone';
import { CalendarView } from './components/CalendarView';
import { TimeframeFilter } from './components/TimeframeFilter';
import { SelectedEventsSidebar } from './components/SelectedEventsSidebar';
import { StopButton } from './components/StopButton';
import { VaultUnlockModal } from './components/VaultUnlockModal';
import { VaultCreateModal } from './components/VaultCreateModal';
import { VaultSettingsModal } from './components/VaultSettingsModal';

interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  hasIcloud: boolean;
  googleUrlCount: number;
  autoConnect: boolean;
}

interface VaultCredentials {
  icloud: { email: string; password: string } | null;
  google: string[];
  autoConnect: boolean;
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

function defaultRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear() + 1, now.getMonth() + 1, 0);
  return { start: toDateString(start), end: toDateString(end) };
}

export default function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<SelectedEvent[]>([]);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // Vault state
  const [vaultChecked, setVaultChecked] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showVaultSettings, setShowVaultSettings] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState<VaultCredentials | null>(null);
  const [autoConnecting, setAutoConnecting] = useState(false);

  // Check vault status on mount
  useEffect(() => {
    fetch('/api/vault/status')
      .then((r) => r.json())
      .then((status: VaultStatus) => {
        setVaultStatus(status);
        if (status.exists && !status.unlocked) {
          setShowUnlock(true);
        } else {
          setVaultChecked(true);
        }
      })
      .catch(() => {
        setVaultChecked(true);
      });
  }, []);

  async function handleVaultUnlocked(status: VaultStatus) {
    setVaultStatus(status);
    setShowUnlock(false);
    // Fetch credentials for pre-filling
    try {
      const res = await fetch('/api/vault/credentials', { method: 'POST' });
      if (res.ok) {
        const creds: VaultCredentials = await res.json();
        setSavedCredentials(creds);

        // Auto-connect if enabled
        if (creds.autoConnect && (creds.icloud || creds.google.length > 0)) {
          setAutoConnecting(true);
          const loadedEvents = await performAutoConnect(creds);
          if (loadedEvents.length > 0) {
            handleLoaded(loadedEvents);
          }
          setAutoConnecting(false);
        }
      }
    } catch { /* ignore */ }
    setVaultChecked(true);
  }

  async function performAutoConnect(creds: VaultCredentials): Promise<CalendarEvent[]> {
    const allEvents: CalendarEvent[] = [];
    const seen = new Set<string>();

    // Connect to iCloud
    if (creds.icloud) {
      try {
        const calRes = await fetch('/api/icloud/calendars', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: creds.icloud.email, password: creds.icloud.password }),
        });
        if (calRes.ok) {
          const { calendars } = await calRes.json();
          for (const cal of calendars) {
            const evRes = await fetch('/api/icloud/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: creds.icloud.email, password: creds.icloud.password, calendarUrls: [cal.url] }),
            });
            if (evRes.ok) {
              const { icsBlocks } = await evRes.json();
              for (const block of icsBlocks) {
                for (const ev of parseIcsText(block, cal.name)) {
                  if (!seen.has(ev.id)) { seen.add(ev.id); allEvents.push(ev); }
                }
              }
            }
          }
        }
      } catch { /* continue with Google */ }
    }

    // Connect to Google Calendar
    for (const url of creds.google) {
      try {
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
      } catch { /* continue */ }
    }

    return allEvents;
  }

  function handleVaultSkip() {
    setShowUnlock(false);
    setVaultChecked(true);
  }

  function handleShowCreate() {
    setShowUnlock(false);
    setShowCreate(true);
  }

  function handleVaultCreated() {
    setShowCreate(false);
    setVaultStatus({ exists: true, unlocked: true, hasIcloud: false, googleUrlCount: 0, autoConnect: false });
    setVaultChecked(true);
  }

  function handleCreateCancel() {
    setShowCreate(false);
    setVaultChecked(true);
  }

  function handleLoaded(loaded: CalendarEvent[]) {
    setEvents(loaded);
    setSelected([]);
    const range = defaultRange();
    setRangeStart(range.start);
    setRangeEnd(range.end);
    // Refresh vault status (vault may have been created during modal flow)
    fetch('/api/vault/status')
      .then((r) => r.json())
      .then((status: VaultStatus) => setVaultStatus(status))
      .catch(() => {});
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

  // Show vault modals before anything else
  if (showUnlock) {
    return <VaultUnlockModal onUnlocked={handleVaultUnlocked} onSkip={handleVaultSkip} onCreate={handleShowCreate} />;
  }
  if (showCreate) {
    return <VaultCreateModal onCreated={handleVaultCreated} onCancel={handleCreateCancel} />;
  }
  if (!vaultChecked || autoConnecting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-sm">{autoConnecting ? 'Connecting to saved calendars…' : ''}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <>
        <FileDropzone
          onLoaded={handleLoaded}
          savedCredentials={savedCredentials}
          vaultUnlocked={vaultStatus?.unlocked ?? false}
          onOpenVaultSettings={() => setShowVaultSettings(true)}
        />
        {showVaultSettings && (
          <VaultSettingsModal
            onClose={() => setShowVaultSettings(false)}
            onDeleted={() => { setVaultStatus(null); setSavedCredentials(null); setShowVaultSettings(false); }}
          />
        )}
      </>
    );
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
          {vaultStatus?.unlocked && (
            <button
              onClick={() => setShowVaultSettings(true)}
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
              title="Vault settings"
            >
              🔒 Vault
            </button>
          )}
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

      {showVaultSettings && (
        <VaultSettingsModal
          onClose={() => setShowVaultSettings(false)}
          onDeleted={() => { setVaultStatus(null); setSavedCredentials(null); setShowVaultSettings(false); }}
        />
      )}
    </div>
  );
}
