/**
 * Encrypted credential vault.
 *
 * Stores iCloud credentials and Google Calendar URLs in an AES-256-GCM
 * encrypted file. The encryption key is derived from a user-chosen password
 * via PBKDF2-SHA512 (600,000 iterations). No machine-specific data is used,
 * making the vault portable across devices.
 *
 * File format:
 *   [2 bytes: version 0x01 0x00]
 *   [32 bytes: PBKDF2 salt]
 *   [12 bytes: AES-GCM IV]
 *   [16 bytes: GCM auth tag]
 *   [remaining: ciphertext]
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const VERSION = Buffer.from([0x01, 0x00]);
const SALT_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32; // AES-256
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_DIGEST = 'sha512';

// ── Vault file location ─────────────────────────────────────────────────────

function getVaultDir() {
  const platform = process.platform;
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'cal2work');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'cal2work');
  } else {
    // Linux and others: XDG_CONFIG_HOME or ~/.config
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'cal2work');
  }
}

function getVaultPath() {
  return path.join(getVaultDir(), 'credentials.enc');
}

// ── Crypto helpers ──────────────────────────────────────────────────────────

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, PBKDF2_DIGEST);
}

function encrypt(plaintext, password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([VERSION, salt, iv, tag, encrypted]);
}

function decrypt(buffer, password) {
  if (buffer.length < 2 + SALT_LEN + IV_LEN + TAG_LEN + 1) {
    throw new Error('Vault file is corrupted or too short.');
  }

  const version = buffer.subarray(0, 2);
  if (version[0] !== 0x01 || version[1] !== 0x00) {
    throw new Error(`Unsupported vault version: ${version[0]}.${version[1]}`);
  }

  let offset = 2;
  const salt = buffer.subarray(offset, offset + SALT_LEN); offset += SALT_LEN;
  const iv = buffer.subarray(offset, offset + IV_LEN); offset += IV_LEN;
  const tag = buffer.subarray(offset, offset + TAG_LEN); offset += TAG_LEN;
  const ciphertext = buffer.subarray(offset);

  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Incorrect vault password.');
  }
}

// ── Vault class ─────────────────────────────────────────────────────────────

export class Vault {
  constructor() {
    this._data = null; // Decrypted credentials (in memory while unlocked)
    this._password = null; // Current vault password (in memory while unlocked)
  }

  get isUnlocked() {
    return this._data !== null;
  }

  get exists() {
    return existsSync(getVaultPath());
  }

  get data() {
    return this._data;
  }

  /** Create a new vault with the given password. */
  create(password) {
    if (!password || password.length < 1) {
      throw new Error('Password is required.');
    }
    this._data = { icloud: null, google: [], settings: { autoConnect: false } };
    this._password = password;
    this._save();
  }

  /** Unlock an existing vault. */
  unlock(password) {
    const vaultPath = getVaultPath();
    if (!fs.existsSync(vaultPath)) {
      throw new Error('No vault file found.');
    }
    const buffer = fs.readFileSync(vaultPath);
    const json = decrypt(buffer, password);
    this._data = JSON.parse(json);
    this._password = password;
  }

  /** Lock the vault (clear from memory). */
  lock() {
    this._data = null;
    this._password = null;
  }

  /** Save iCloud credentials. */
  saveIcloud(email, password) {
    this._ensureUnlocked();
    this._data.icloud = { email, password };
    this._save();
  }

  /** Save Google Calendar URLs. */
  saveGoogle(urls) {
    this._ensureUnlocked();
    this._data.google = urls;
    this._save();
  }

  /** Set the auto-connect preference. */
  setAutoConnect(enabled) {
    this._ensureUnlocked();
    if (!this._data.settings) this._data.settings = {};
    this._data.settings.autoConnect = enabled;
    this._save();
  }

  /** Clear iCloud credentials. */
  clearIcloud() {
    this._ensureUnlocked();
    this._data.icloud = null;
    this._save();
  }

  /** Clear Google Calendar URLs. */
  clearGoogle() {
    this._ensureUnlocked();
    this._data.google = [];
    this._save();
  }

  /** Change the vault password (re-encrypts the file). */
  changePassword(oldPassword, newPassword) {
    if (!this.exists) throw new Error('No vault file found.');
    // Verify old password by decrypting
    const buffer = fs.readFileSync(getVaultPath());
    const json = decrypt(buffer, oldPassword);
    // Re-encrypt with new password
    this._data = JSON.parse(json);
    this._password = newPassword;
    this._save();
  }

  /** Delete the vault file entirely. */
  delete() {
    const vaultPath = getVaultPath();
    if (fs.existsSync(vaultPath)) {
      fs.unlinkSync(vaultPath);
    }
    this._data = null;
    this._password = null;
  }

  /** Get metadata about stored credentials (no secrets exposed). */
  getStatus() {
    return {
      exists: this.exists,
      unlocked: this.isUnlocked,
      hasIcloud: this.isUnlocked && this._data?.icloud !== null,
      googleUrlCount: this.isUnlocked ? (this._data?.google?.length ?? 0) : 0,
      autoConnect: this.isUnlocked ? (this._data?.settings?.autoConnect ?? false) : false,
    };
  }

  /** Get stored credentials (only when unlocked). */
  getCredentials() {
    this._ensureUnlocked();
    return {
      icloud: this._data.icloud, // { email, password } or null
      google: this._data.google || [], // array of URLs
      autoConnect: this._data?.settings?.autoConnect ?? false,
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _ensureUnlocked() {
    if (!this.isUnlocked) throw new Error('Vault is locked.');
  }

  _save() {
    const vaultDir = getVaultDir();
    if (!fs.existsSync(vaultDir)) {
      fs.mkdirSync(vaultDir, { recursive: true });
    }
    const json = JSON.stringify(this._data);
    const buffer = encrypt(json, this._password);
    fs.writeFileSync(getVaultPath(), buffer);
  }
}

function existsSync(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
