/**
 * Client-side vault helpers for saving credentials.
 * Handles the case where the vault doesn't exist yet by prompting
 * the user to create one via window.prompt.
 */

export async function ensureVaultUnlocked(): Promise<boolean> {
  const statusRes = await fetch('/api/vault/status');
  const status = await statusRes.json();

  if (status.unlocked) return true;

  if (!status.exists) {
    // No vault — ask user to create one
    const password = window.prompt(
      'Create a vault password to save your credentials.\n' +
      'You\'ll need this password each time you launch the app.'
    );
    if (!password) return false;

    const confirm = window.prompt('Confirm your vault password:');
    if (confirm !== password) {
      window.alert('Passwords did not match. Credentials were not saved.');
      return false;
    }

    const createRes = await fetch('/api/vault/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return createRes.ok;
  }

  // Vault exists but is locked — ask for password
  const password = window.prompt('Enter your vault password to save credentials:');
  if (!password) return false;

  const unlockRes = await fetch('/api/vault/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!unlockRes.ok) {
    window.alert('Incorrect vault password. Credentials were not saved.');
    return false;
  }

  return true;
}

export async function saveCredentialsToVault(data: {
  icloud?: { email: string; password: string } | null;
  google?: string[];
}): Promise<void> {
  const ready = await ensureVaultUnlocked();
  if (!ready) return;

  await fetch('/api/vault/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
