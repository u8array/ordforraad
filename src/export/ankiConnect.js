/**
 * AnkiConnect client (https://foosoft.net/projects/anki-connect/)
 *
 * Requires the AnkiConnect add-on (code 2055492929) installed in Anki desktop.
 * Anki must be running for any of these calls to succeed.
 */

const URL     = 'http://127.0.0.1:8765';
const VERSION = 6;
const DECK    = 'Ordforråd';
const MODEL   = 'Basic';
const TAG     = 'ordforraad';

// ── Core ──────────────────────────────────────────────────────────────────────

async function invoke(action, params = {}) {
  const res = await fetch(URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, version: VERSION, params }),
  });
  if (!res.ok) throw new Error(`AnkiConnect HTTP ${res.status}`);
  const { result, error } = await res.json();
  if (error) throw new Error(error);
  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns true if AnkiConnect is reachable. */
export async function isAvailable() {
  try {
    await invoke('version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Adds an array of VocabCards to the Ordforråd deck.
 * Skips duplicates silently (duplicate = same Front field).
 * @param {import('../shared/cardSchema.js').VocabCard[]} cards
 * @returns {Promise<{ added: number, skipped: number }>}
 */
export async function addCards(cards) {
  await invoke('createDeck', { deck: DECK });

  const notes = cards.map(card => ({
    deckName:  DECK,
    modelName: MODEL,
    fields:    { Front: buildFront(card), Back: buildBack(card) },
    options:   { allowDuplicate: false, duplicateScope: 'deck' },
    tags:      [TAG],
  }));

  const results = await invoke('addNotes', { notes });
  if (!Array.isArray(results)) throw new Error('Unexpected response from AnkiConnect');
  const added   = results.filter(id => id !== null).length;
  return { added, skipped: results.length - added };
}

// ── Card formatting ───────────────────────────────────────────────────────────

function buildFront(card) {
  let html = `<b>${esc(card.word)}</b>`;
  if (card.pronunciation) html += `<br><span style="color:#888">${esc(card.pronunciation)}</span>`;
  return html;
}

function buildBack(card) {
  let html = `<b>${esc(card.translation)}</b>`;
  if (card.wordClass) html += ` <span style="color:#888">(${esc(card.wordClass)})</span>`;
  if (card.grammar)   html += `<br><small style="color:#aaa">${esc(card.grammar)}</small>`;
  if (card.exampleDA) {
    html += `<hr style="margin:6px 0"><i>${esc(card.exampleDA)}</i>`;
    if (card.exampleDE) html += `<br><span style="color:#888">${esc(card.exampleDE)}</span>`;
  }
  if (card.memoryTip) html += `<hr style="margin:6px 0">💡 ${esc(card.memoryTip)}`;
  return html;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
