import { useState, useEffect } from 'react';

export function ConnectionLost() {
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const res = await fetch('/api/vault/status', { method: 'GET', signal: AbortSignal.timeout(3000) });
        if (alive) setDisconnected(!res.ok);
      } catch {
        if (alive) setDisconnected(true);
      }
    }

    // Initial check after a short delay (gives server time to respond after load)
    const initial = setTimeout(check, 1500);
    const interval = setInterval(check, 4000);

    return () => {
      alive = false;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  if (!disconnected) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Connection lost</h2>
        <p className="text-sm text-gray-500 mb-4">
          The backend server is no longer reachable. This usually happens after a page refresh, which stops the app.
        </p>
        <p className="text-sm text-gray-500">
          Please restart the application to continue.
        </p>
      </div>
    </div>
  );
}
