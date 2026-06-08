/** Card CRUD via chrome.storage.local. Cards are stored as one array under STORAGE_KEY. */

const STORAGE_KEY = 'vocab_cards';

/** @returns {Promise<import('../shared/cardSchema.js').VocabCard[]>} */
export async function getAllCards() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const cards  = result[STORAGE_KEY] ?? [];
  if (!cards.some(needsLegacyRename)) return cards;
  const migrated = cards.map(renameLegacyExampleFields);
  await chrome.storage.local.set({ [STORAGE_KEY]: migrated });
  return migrated;
}

function needsLegacyRename(card) {
  return 'exampleDA' in card || 'exampleDE' in card;
}

function renameLegacyExampleFields(card) {
  const { exampleDA, exampleDE, ...rest } = card;
  return {
    ...rest,
    exampleTarget: card.exampleTarget ?? exampleDA ?? '',
    exampleNative: card.exampleNative ?? exampleDE ?? '',
  };
}

/**
 * Saves a card (insert or update by id).
 * @param {import('../shared/cardSchema.js').VocabCard} card
 */
export async function saveCard(card) {
  const cards  = await getAllCards();
  const index  = cards.findIndex(c => c.id === card.id);

  if (index !== -1) {
    cards[index] = card;          // update
  } else {
    cards.push(card);             // insert
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: cards });
}

/**
 * Deletes a card by id.
 * @param {string} id
 */
export async function deleteCard(id) {
  const cards    = await getAllCards();
  const filtered = cards.filter(c => c.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

/** Deletes all stored cards. */
export async function clearAllCards() {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}
