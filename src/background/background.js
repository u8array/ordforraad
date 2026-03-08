/**
 * Service Worker (background)
 *
 * Responsibilities:
 *  - Register context menu (localised via nativeLang)
 *  - On click: fetch context from tab → call LLM → save card
 *  - Notify popup about new card
 *  - Notify user via browser notification
 */

import { fetchCardData }               from '../api/llmClient.js';
import { fetchPronunciation }          from '../api/pronunciation.js';
import { saveCard }                    from '../storage/cardStorage.js';
import { createCard, validateLlmData } from '../shared/cardSchema.js';
import { getConfig }                   from '../config/configStorage.js';
import { t }                           from '../i18n/strings.js';

const MENU_ID = 'ordforrad_add';

// ── Context menu ──────────────────────────────────────────────────────────────

async function registerContextMenu() {
  const config = await getConfig();
  const s      = t(config.nativeLang);
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id:       MENU_ID,
      title:    `📖 ${s.menu}`,
      contexts: ['selection'],
    });
  });
}

// MV3 service worker can be terminated at any time → re-register on every startup
chrome.runtime.onInstalled.addListener(registerContextMenu);
chrome.runtime.onStartup.addListener(registerContextMenu);

// Re-register context menu when settings are saved
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SETTINGS_CHANGED') registerContextMenu();
});

// ── Context menu handler ───────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const word = info.selectionText?.trim();
  if (!word) return;

  const context = await extractContext(tab.id, word);
  const config  = await getConfig().catch(() => null);
  const s       = t(config?.nativeLang ?? 'Deutsch');

  try {
    const raw  = await fetchCardData(word, context, config);
    const data = validateLlmData(raw);

    // Wiktionary IPA override (falls back to LLM pronunciation)
    const wiktIpa = await fetchPronunciation(word, config.targetLang).catch(() => null);
    if (wiktIpa) data.pronunciation = wiktIpa;

    const card = createCard(word, context, tab.url ?? '', data);

    await saveCard(card);
    chrome.runtime.sendMessage({ type: 'CARD_ADDED', card }).catch(() => {});
    notify(s.notifOk, `„${word}" → ${card.translation}`);

  } catch (err) {
    console.error('[Ordforråd]', err);
    notify(s.notifErr, err.message ?? 'Unknown error.');
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function extractContext(tabId, word) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selectedWord) => {
        const sel = window.getSelection();
        if (!sel?.rangeCount) return '';
        const text      = sel.getRangeAt(0).startContainer?.textContent ?? '';
        const sentences = text.split(/(?<=[.!?»"'])\s+/);
        const match     = sentences.find(s => s.includes(selectedWord));
        return (match ?? text).trim().substring(0, 400);
      },
      args: [word],
    });
    return result ?? '';
  } catch {
    return '';
  }
}

function notify(title, message) {
  chrome.notifications.create({
    type:    'basic',
    iconUrl: '/icons/icon48.png',
    title,
    message,
  });
}
