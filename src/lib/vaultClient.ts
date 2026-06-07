/**
 * Client-side vault helpers.
 */

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
}

export async function getVaultStatus(): Promise<VaultStatus> {
  const res = await fetch('/api/vault/status');
  return res.json();
}

export async function createVault(password: string): Promise<boolean> {
  const res = await fetch('/api/vault/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

export async function unlockVault(password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/vault/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json();
  return { ok: false, error: data.error ?? 'Failed to unlock vault' };
}

export async function saveToVault(data: {
  icloud?: { email: string; password: string } | null;
  google?: string[];
}): Promise<boolean> {
  const res = await fetch('/api/vault/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}
