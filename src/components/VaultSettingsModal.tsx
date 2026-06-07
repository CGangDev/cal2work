import { useState, useEffect } from 'react';

interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  hasIcloud: boolean;
  googleUrlCount: number;
  autoConnect: boolean;
}

interface Props {
  onClose: () => void;
  onDeleted: () => void;
}

export function VaultSettingsModal({ onClose, onDeleted }: Props) {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch('/api/vault/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function handleToggleAutoConnect() {
    if (!status) return;
    const newValue = !status.autoConnect;
    const res = await fetch('/api/vault/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoConnect: newValue }),
    });
    if (res.ok) {
      setStatus({ ...status, autoConnect: newValue });
    }
  }

  async function handleClearIcloud() {
    const res = await fetch('/api/vault/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icloud: null }),
    });
    if (res.ok && status) {
      setStatus({ ...status, hasIcloud: false });
      setMessage('iCloud credentials cleared.');
    }
  }

  async function handleClearGoogle() {
    const res = await fetch('/api/vault/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ google: [] }),
    });
    if (res.ok && status) {
      setStatus({ ...status, googleUrlCount: 0 });
      setMessage('Google Calendar URLs cleared.');
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    const res = await fetch('/api/vault/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    if (res.ok) {
      setMessage('Password changed successfully.');
      setShowChangePassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to change password.');
    }
  }

  async function handleDelete() {
    const res = await fetch('/api/vault', { method: 'DELETE' });
    if (res.ok) {
      onDeleted();
    }
  }

  if (!status) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Vault Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stored credentials summary */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Stored credentials</h3>

            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-700">iCloud</p>
                <p className="text-xs text-gray-400">{status.hasIcloud ? 'Email & password saved' : 'Not saved'}</p>
              </div>
              {status.hasIcloud && (
                <button onClick={handleClearIcloud} className="text-xs text-red-500 hover:text-red-700">Clear</button>
              )}
            </div>

            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-700">Google Calendar</p>
                <p className="text-xs text-gray-400">
                  {status.googleUrlCount > 0 ? `${status.googleUrlCount} URL${status.googleUrlCount > 1 ? 's' : ''} saved` : 'Not saved'}
                </p>
              </div>
              {status.googleUrlCount > 0 && (
                <button onClick={handleClearGoogle} className="text-xs text-red-500 hover:text-red-700">Clear</button>
              )}
            </div>
          </div>

          {/* Auto-connect toggle */}
          <label className="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p className="text-sm text-gray-700">Auto-connect on unlock</p>
              <p className="text-xs text-gray-400">Skip the connection modals and load events automatically</p>
            </div>
            <input
              type="checkbox"
              checked={status.autoConnect}
              onChange={handleToggleAutoConnect}
              className="rounded accent-blue-500"
            />
          </label>

          {/* Messages */}
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Change password */}
          {!showChangePassword ? (
            <button
              onClick={() => setShowChangePassword(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Change vault password
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3 border border-gray-100 rounded-xl p-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Current password</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm new password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  Change
                </button>
              </div>
            </form>
          )}

          {/* Delete vault */}
          <div className="pt-3 border-t border-gray-100">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Delete vault and all stored credentials
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-red-600">This will permanently delete the vault file and all stored credentials. This cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                  >
                    Delete vault
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
