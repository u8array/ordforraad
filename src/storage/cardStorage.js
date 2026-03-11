/**
 * Card CRUD via chrome.storage.local.
 *
 * All functions are async and return Promises.
 * Cards are stored as an array under a single key.
 */

import { CARDS_KEY as STORAGE_KEY } from '../shared/storageKeys.js';

/** @returns {Promise<import('../shared/cardSchema.js').VocabCard[]>} */
export async function getAllCards() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
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

/** Replaces all stored cards at once (used by sync after merge). */
export async function replaceAllCards(cards) {
  await chrome.storage.local.set({ [STORAGE_KEY]: cards });
}

/** Deletes all stored cards. */
export async function clearAllCards() {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}
