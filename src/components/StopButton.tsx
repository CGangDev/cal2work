import { useState, useEffect } from 'react';

// In production, API is on the same origin; in dev, Vite proxies /api to the proxy server
const PROXY = '';

export function StopButton() {
  const [state, setState] = useState<'idle' | 'stopping' | 'stopped' | 'unavailable'>('idle');

  // Auto-stop when the browser tab/window is closed
  useEffect(() => {
    function handleUnload() {
      // Use sendBeacon for reliable delivery during page unload
      navigator.sendBeacon(`${PROXY}/api/shutdown`);
    }
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

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
      className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50"
      title="Stop the app"
    >
      {state === 'stopping' ? 'Stopping…' : '⏻ Stop app'}
    </button>
  );
}
