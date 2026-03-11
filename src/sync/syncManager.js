/**
 * Sync manager – orchestrates card synchronisation across storage strategies.
 *
 * Strategy pattern: additional providers (OneDrive, iCloud, …) can be added
 * by implementing load() / save() and wiring them up here.
 *
 * Merge rule: union by card.id; higher createdAt wins on conflict.
 */

import * as gdrive                         from './strategies/gdrive.js';
import { getAllCards, replaceAllCards }    from '../storage/cardStorage.js';
import { SYNC_KEY }                           from '../shared/storageKeys.js';

/** @type {Record<string, { load: () => Promise<any[]>, save: (cards: any[]) => Promise<void> }>} */
const STRATEGIES = {
  gdrive,
};

// ── Config helpers ────────────────────────────────────────────────────────────

/** @returns {Promise<{ provider: string, lastSync: number|null }>} */
async function getSyncConfig() {
  const result = await chrome.storage.local.get(SYNC_KEY);
  return result[SYNC_KEY] ?? { provider: 'local', lastSync: null };
}

/** @param {{ provider?: string, lastSync?: number|null }} patch */
async function setSyncConfig(patch) {
  const current = await getSyncConfig();
  await chrome.storage.local.set({ [SYNC_KEY]: { ...current, ...patch } });
}

// ── Merge ─────────────────────────────────────────────────────────────────────

function mergeCards(a, b) {
  const map = new Map();
  [...a, ...b].forEach(card => {
    const existing = map.get(card.id);
    if (!existing || card.createdAt > existing.createdAt) map.set(card.id, card);
  });
  return [...map.values()];
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns current sync state. */
export async function getSyncState() {
  return getSyncConfig();
}

/**
 * Called on popup init.
 * If Drive sync is active: loads remote cards, merges with local, saves both.
 * Returns merged cards or null if sync is disabled.
 */
export async function initSync() {
  const config   = await getSyncConfig();
  const strategy = STRATEGIES[config.provider];
  if (!strategy) return null;

  const [local, remote] = await Promise.all([getAllCards(), strategy.load()]);
  const merged = mergeCards(local, remote);
  await replaceAllCards(merged);
  await strategy.save(merged);
  await setSyncConfig({ lastSync: Date.now() });
  return merged;
}

/**
 * Called after every card change.
 * Pushes current local cards to the active remote strategy.
 */
export async function pushSync() {
  const config   = await getSyncConfig();
  const strategy = STRATEGIES[config.provider];
  if (!strategy) return;
  const cards = await getAllCards();
  await strategy.save(cards);
  await setSyncConfig({ lastSync: Date.now() });
}

/** Connects Google Drive (interactive OAuth) and runs initial sync. */
export async function connectDrive() {
  await gdrive.connect();
  await setSyncConfig({ provider: 'gdrive', lastSync: null });
  return initSync();
}

/** Disconnects Google Drive and resets to local-only. */
export async function disconnectDrive() {
  await gdrive.disconnect();
  await setSyncConfig({ provider: 'local', lastSync: null });
}
