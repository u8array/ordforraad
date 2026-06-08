/** AnkiConnect client. Requires the AnkiConnect add-on (2055492929) running in Anki desktop. */

import { TAG, buildModelParts, cardToFieldMap } from './ankiModel.js';

const ENDPOINT             = 'http://127.0.0.1:8765';
const VERSION              = 6;
const AVAILABILITY_TIMEOUT = 1000;

async function invoke(action, params = {}, { signal } = {}) {
  const res = await fetch(ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, version: VERSION, params }),
    signal,
  });
  if (!res.ok) throw new Error(`AnkiConnect HTTP ${res.status}`);
  const { result, error } = await res.json();
  if (error) throw new Error(error);
  return result;
}

/** Short timeout so the popup doesn't hang on a closed port. */
export async function isAvailable() {
  const signal = AbortSignal.timeout(AVAILABILITY_TIMEOUT);
  try {
    await invoke('version', {}, { signal });
    return true;
  } catch (err) {
    console.debug('[AnkiConnect] not available:', err.message);
    return false;
  }
}

export async function addCards(cards, targetLang, nativeLang) {
  const parts = buildModelParts(targetLang, nativeLang);

  await ensureModel(parts);
  await invoke('createDeck', { deck: parts.deck });

  const notes = cards.map(card => ({
    deckName:  parts.deck,
    modelName: parts.model,
    fields:    cardToFieldMap(card, parts.schema),
    options:   { allowDuplicate: false, duplicateScope: 'deck' },
    tags:      [TAG],
  }));

  const results = await invoke('addNotes', { notes });
  if (!Array.isArray(results)) throw new Error('Unexpected response from AnkiConnect');

  // Custom model + validated fields → null entries can only be duplicates.
  const added      = results.filter(id => id !== null).length;
  const duplicates = results.length - added;
  return { added, duplicates };
}

// Existing-model template/CSS sync runs once per popup session.
// Legacy migration (e.g. old 'Beispiel DA' field): rename manually in Anki or delete the model.
const syncedThisSession = new Set();

async function ensureModel(parts) {
  try {
    await invoke('createModel', {
      modelName:     parts.model,
      inOrderFields: parts.fieldNames,
      css:           parts.css,
      isCloze:       false,
      cardTemplates: [{ Name: parts.templateName, Front: parts.qfmt, Back: parts.afmt }],
    });
    syncedThisSession.add(parts.model);
    return;
  } catch (err) {
    if (!/already exists/i.test(err.message)) throw err;
  }
  if (syncedThisSession.has(parts.model)) return;

  await invoke('updateModelTemplates', {
    model: {
      name: parts.model,
      templates: { [parts.templateName]: { Front: parts.qfmt, Back: parts.afmt } },
    },
  });
  await invoke('updateModelStyling', {
    model: { name: parts.model, css: parts.css },
  });
  syncedThisSession.add(parts.model);
}
