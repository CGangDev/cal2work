import { useState } from 'react';

interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  hasIcloud: boolean;
  googleUrlCount: number;
  autoConnect: boolean;
}

interface Props {
  onUnlocked: (status: VaultStatus) => void;
  onSkip: () => void;
  onCreate: () => void;
}

export function VaultUnlockModal({ onUnlocked, onSkip, onCreate }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/vault/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to unlock vault');
      onUnlocked(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Unlock Saved Credentials</h2>
          <p className="text-sm text-gray-500 mb-5">
            Enter your vault password to load saved iCloud and Google Calendar credentials.
          </p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vault password</label>
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your vault password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Unlocking…' : 'Unlock'}
            </button>
          </form>

          <div className="mt-4 flex gap-3">
            <button
              onClick={onSkip}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={onCreate}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
            >
              New vault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
