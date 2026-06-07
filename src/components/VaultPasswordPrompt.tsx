import { useState } from 'react';

interface Props {
  mode: 'create' | 'unlock';
  onSubmit: (password: string) => void;
  onCancel: () => void;
  error?: string | null;
}

export function VaultPasswordPrompt({ mode, onSubmit, onCancel, error }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'create') {
      if (password.length < 4) {
        setLocalError('Password must be at least 4 characters.');
        return;
      }
      if (password !== confirm) {
        setLocalError('Passwords do not match.');
        return;
      }
    }
    setLocalError(null);
    onSubmit(password);
  }

  const title = mode === 'create' ? 'Create Vault Password' : 'Unlock Vault';
  const description = mode === 'create'
    ? 'Choose a password to encrypt your saved credentials. You\'ll need this each time you launch the app.'
    : 'Enter your vault password to save credentials.';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="p-5">
          <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-4">{description}</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'create' ? 'Choose a password' : 'Enter vault password'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {mode === 'create' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            )}

            {(localError || error) && (
              <p className="text-sm text-red-500">{localError || error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                {mode === 'create' ? 'Create' : 'Unlock'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
