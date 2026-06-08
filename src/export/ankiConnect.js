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
  const parts     = buildModelParts(targetLang, nativeLang);
  const modelName = await ensureModel(parts);
  await invoke('createDeck', { deck: parts.deck });

  const notes = cards.map(card => ({
    deckName:  parts.deck,
    modelName,
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

// Fork to "name (2)" when an incompatible legacy model squats the base name.
const resolvedNames = new Map();

// Safety bound — 9 collisions is far beyond any realistic legacy state.
const MAX_NAME_COLLISIONS = 10;

async function ensureModel(parts) {
  const baseName = parts.model;
  const cached   = resolvedNames.get(baseName);
  if (cached) return cached;

  for (let i = 0; i < MAX_NAME_COLLISIONS; i++) {
    const name = i === 0 ? baseName : `${baseName} (${i + 1})`;

    if (await tryCreateModel(parts, name)) {
      resolvedNames.set(baseName, name);
      return name;
    }
    if (await isCompatible(name, parts.fieldNames)) {
      await syncTemplatesAndCss(parts, name);
      resolvedNames.set(baseName, name);
      return name;
    }
  }
  throw new Error(`Could not allocate a free model name for "${baseName}"`);
}

async function tryCreateModel(parts, name) {
  try {
    await invoke('createModel', {
      modelName:     name,
      inOrderFields: parts.fieldNames,
      css:           parts.css,
      isCloze:       false,
      cardTemplates: [{ Name: parts.templateName, Front: parts.qfmt, Back: parts.afmt }],
    });
    return true;
  } catch (err) {
    if (/already exists/i.test(err.message)) return false;
    throw err;
  }
}

async function isCompatible(name, expectedFields) {
  const actual = await invoke('modelFieldNames', { modelName: name });
  return actual.length === expectedFields.length
      && actual.every((f, i) => f === expectedFields[i]);
}

async function syncTemplatesAndCss(parts, name) {
  await invoke('updateModelTemplates', {
    model: {
      name,
      templates: { [parts.templateName]: { Front: parts.qfmt, Back: parts.afmt } },
    },
  });
  await invoke('updateModelStyling', { model: { name, css: parts.css } });
}
