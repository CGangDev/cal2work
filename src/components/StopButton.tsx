import { useState } from 'react';

// In production, API is on the same origin; in dev, Vite proxies /api to the proxy server
const PROXY = '';

export function StopButton() {
  const [state, setState] = useState<'idle' | 'stopping' | 'stopped' | 'unavailable'>('idle');

  async function handleStop() {
    setState('stopping');
    try {
      await fetch(`${PROXY}/api/shutdown`, { method: 'POST' });
    } catch {
      // Expected — server shuts down before or during response
    }
    setState('stopped');
  }

  if (state === 'stopped') {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
        <div className="text-4xl mb-4">✓</div>
        <p className="text-gray-800 font-medium text-lg mb-1">App stopped</p>
        <p className="text-gray-400 text-sm">You can close this tab.</p>
      </div>
    );
  }

  if (state === 'unavailable') {
    return (
      <span className="text-xs text-gray-400">
        Close the terminal window to stop
      </span>
    );
  }

  return (
    <button
      onClick={handleStop}
      disabled={state === 'stopping'}
      className="text-sm text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
      title="Stop the app"
    >
      {state === 'stopping' ? 'Stopping…' : 'Stop app'}
    </button>
  );
}
