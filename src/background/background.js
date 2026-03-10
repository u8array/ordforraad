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

// Allow popup to read session storage (default: service worker only)
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

// ── Context menu ──────────────────────────────────────────────────────────────

async function registerContextMenu() {
  const config = await getConfig();
  const s      = t(config.nativeLang);
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id:       MENU_ID,
      title:    s.menu,
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

  // Track all concurrently loading words
  const { loadingWords = [] } = await chrome.storage.session.get('loadingWords');
  await chrome.storage.session.set({ loadingWords: [...loadingWords, word] });
  chrome.runtime.sendMessage({ type: 'CARD_LOADING', word }).catch(() => {});

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
    await chrome.storage.session.remove('lastError');
    chrome.action.setBadgeText({ text: '' });
    chrome.runtime.sendMessage({ type: 'CARD_ADDED', card, word }).catch(() => {});
    notify(s.notifOk, `„${word}" → ${card.translation}`);

  } catch (err) {
    const errorMsg = err.message ?? 'Unknown error.';
    chrome.runtime.sendMessage({ type: 'CARD_LOADING_DONE', word }).catch(() => {});
    chrome.runtime.sendMessage({ type: 'CARD_ERROR', word, error: errorMsg }).catch(() => {});
    await chrome.storage.session.set({ lastError: { word, error: errorMsg, time: Date.now() } });
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#e11d48' });
    console.error('[Ordforråd]', err);
    notify(s.notifErr, errorMsg);
  } finally {
    const { loadingWords = [] } = await chrome.storage.session.get('loadingWords');
    const idx = loadingWords.indexOf(word);
    if (idx !== -1) loadingWords.splice(idx, 1);
    await chrome.storage.session.set({ loadingWords });
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
