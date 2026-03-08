/**
 * Popup controller
 */

import { getAllCards, deleteCard }           from '../storage/cardStorage.js';
import { exportToApkg }                     from '../export/ankiExporter.js';
import { getConfig, saveConfig, LANGUAGES } from '../config/configStorage.js';
import { fetchModels }                      from '../api/llmClient.js';
import { t, localeName, cardCount }         from '../i18n/strings.js';

// ── DOM references ────────────────────────────────────────────────────────────

const elLoading       = document.getElementById('state-loading');
const elEmpty         = document.getElementById('state-empty');
const elList          = document.getElementById('card-list');
const elCount         = document.getElementById('card-count');
const elExport        = document.getElementById('btn-export');
const elToast         = document.getElementById('toast');
const elBtnSettings   = document.getElementById('btn-settings');
const elSettings      = document.getElementById('settings-panel');
const elSelModel      = document.getElementById('sel-model');
const elBtnFetch      = document.getElementById('btn-fetch-models');
const elInpUrl        = document.getElementById('inp-url');
const elSelTarget     = document.getElementById('sel-target');
const elSelNative     = document.getElementById('sel-native');
const elBtnSave       = document.getElementById('btn-save-config');
const elSelProvider   = document.getElementById('sel-provider');
const elRowUrl        = document.getElementById('row-url');
const elRowApiKey     = document.getElementById('row-apikey');
const elInpApiKey     = document.getElementById('inp-apikey');

// Currently loaded strings (set after config is loaded)
let currentStrings = t('Deutsch');

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const config = await getConfig();
  currentStrings = t(config.nativeLang);
  applyI18n(currentStrings);
  populateLanguageSelects(config.nativeLang);
  applyConfig(config);
  try {
    render(await getAllCards());
  } catch (err) {
    showToast(`${currentStrings.storageErr}: ${err.message}`, true);
  }

  // Check if a card is currently loading (popup opened after CARD_LOADING was sent)
  const { loadingWord } = await chrome.storage.session.get('loadingWord');
  if (loadingWord) showSkeleton(loadingWord);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'CARD_LOADING')      showSkeleton(msg.word);
    if (msg.type === 'CARD_LOADING_DONE') removeSkeleton();
    if (msg.type === 'CARD_ADDED') {
      removeSkeleton();
      getAllCards().then(render).catch(err => showToast(`${currentStrings.error}: ${err.message}`, true));
    }
  });
}

// ── i18n ─────────────────────────────────────────────────────────────────────

/** Populates all [data-i18n] and [data-i18n-title] elements. */
function applyI18n(s) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (s[key] != null) el.textContent = s[key];
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (s[key] != null) el.title = s[key];
  });
}

// ── Language ───────────────────────────────────────────────────────────────────

/** Populates both language dropdowns with localized display names. */
function populateLanguageSelects(nativeLangKey) {
  [elSelTarget, elSelNative].forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '';
    for (const lang of LANGUAGES) {
      sel.appendChild(new Option(localeName(lang, nativeLangKey), lang));
    }
    if (current) sel.value = current;
  });
}

const API_KEY_PLACEHOLDER = {
  openai:    'sk-…',
  anthropic: 'sk-ant-…',
  google:    'AIza…',
};

function applyProviderRows(provider) {
  elRowUrl.hidden    = provider !== 'lmstudio';
  elRowApiKey.hidden = provider === 'lmstudio';
  elInpApiKey.placeholder = API_KEY_PLACEHOLDER[provider] ?? 'API-Key';
}

function applyConfig(config) {
  elSelTarget.value   = config.targetLang;
  elSelNative.value   = config.nativeLang;
  elInpUrl.value      = config.lmStudioUrl;
  elSelProvider.value = config.provider ?? 'lmstudio';
  elInpApiKey.value   = config.apiKeys?.[elSelProvider.value] ?? '';
  applyProviderRows(elSelProvider.value);
  if (config.model) {
    if (![...elSelModel.options].some(o => o.value === config.model))
      elSelModel.appendChild(new Option(config.model, config.model));
    elSelModel.value = config.model;
  }
}

// ── Model dropdown ────────────────────────────────────────────────────────────

let _modelListToken = 0;

async function loadModelList() {
  const token = ++_modelListToken;
  elBtnFetch.textContent = '…';
  elBtnFetch.disabled    = true;
  elSelModel.innerHTML   = '';
  try {
    const stored = await getConfig();
    if (token !== _modelListToken) return;
    const provider = elSelProvider.value;
    const config = {
      ...stored,
      provider,
      lmStudioUrl: elInpUrl.value.trim() || stored.lmStudioUrl,
      apiKey:      elInpApiKey.value.trim() || stored.apiKeys?.[provider] || '',
    };
    const models = await fetchModels(config);
    if (token !== _modelListToken) return;
    models.forEach(id => elSelModel.appendChild(new Option(id, id)));
    elSelModel.value = models.includes(stored.model) ? stored.model : (models[0] ?? '');
    if (!models.length) showToast(currentStrings.noModel, true);
  } catch (err) {
    if (token !== _modelListToken) return;
    showToast(err.message, true);
  } finally {
    if (token === _modelListToken) {
      elBtnFetch.textContent = '↻';
      elBtnFetch.disabled    = false;
    }
  }
}

async function handleProviderChange() {
  applyProviderRows(elSelProvider.value);
  const config = await getConfig();
  elInpApiKey.value = config.apiKeys?.[elSelProvider.value] ?? '';
  loadModelList();
}

// ── Settings events ───────────────────────────────────────────────────────────

elBtnSettings.addEventListener('click', () => {
  const opening = elSettings.hidden;
  elSettings.hidden = !opening;
  if (opening) loadModelList();
});

elBtnFetch.addEventListener('click', () => loadModelList());
elSelProvider.addEventListener('change', handleProviderChange);

elBtnSave.addEventListener('click', async () => {
  const stored = await getConfig();
  const provider = elSelProvider.value;
  const updatedKeys = { ...stored.apiKeys };
  const keyValue = elInpApiKey.value.trim();
  if (keyValue) {
    updatedKeys[provider] = keyValue;
  } else {
    delete updatedKeys[provider];
  }
  const newConfig = {
    model:       elSelModel.value,
    targetLang:  elSelTarget.value,
    nativeLang:  elSelNative.value,
    lmStudioUrl: elInpUrl.value.trim() || 'http://localhost:1234',
    provider,
    apiKeys:     updatedKeys,
  };
  await saveConfig(newConfig);

  // Update UI language immediately if nativeLang changed
  currentStrings = t(newConfig.nativeLang);
  applyI18n(currentStrings);
  populateLanguageSelects(newConfig.nativeLang);

  // Notify background to re-register context menu
  chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' }).catch(() => {});

  elSettings.hidden = true;
  showToast(currentStrings.saved);
});

// ── Render ────────────────────────────────────────────────────────────────────

function render(cards) {
  elLoading.hidden = true;
  elCount.textContent = cardCount(cards.length, currentStrings);
  elExport.disabled   = cards.length === 0;

  if (!cards.length) {
    elEmpty.hidden = false;
    elList.hidden  = true;
    elList.innerHTML = '';
    return;
  }
  elEmpty.hidden = true;
  elList.hidden  = false;
  elList.innerHTML = '';
  [...cards].sort((a, b) => b.createdAt - a.createdAt).forEach(c => elList.appendChild(buildCard(c)));
}

function buildCard(card) {
  const s  = currentStrings;
  const li = document.createElement('li');
  li.className  = 'bg-white dark:bg-[#292a2d] rounded-xl border border-slate-200 dark:border-[#3c4043] shadow-sm overflow-hidden';
  li.dataset.id = card.id;

  li.innerHTML = `
    <div class="border-l-4 border-rose-400 px-3.5 py-3 space-y-2">

      <div class="flex items-baseline gap-2">
        <span class="text-slate-900 dark:text-[#e8eaed] font-bold text-[15px] leading-snug grow">${esc(card.word)}</span>
        <span class="text-[10px] text-slate-400 dark:text-[#9aa0a6] truncate max-w-[140px] text-right" title="${esc(card.wordClass)}">${esc(card.wordClass)}</span>
        <button class="btn-delete text-slate-300 dark:text-[#5f6368] hover:text-rose-400 transition-colors text-sm leading-none shrink-0 cursor-pointer"
          data-id="${esc(card.id)}" title="${esc(s.delete)}">✕</button>
      </div>

      <div>
        <div class="text-slate-800 dark:text-[#bdc1c6] font-semibold text-sm">${esc(card.translation)}</div>
        <div class="text-[11px] text-slate-400 dark:text-[#9aa0a6] italic">${esc(card.pronunciation)}</div>
      </div>

      ${card.exampleDA ? `
      <div class="pl-2.5 border-l-2 border-slate-100 dark:border-[#3c4043] space-y-0.5">
        <div class="text-[11px] text-slate-600 dark:text-[#bdc1c6] italic">${esc(card.exampleDA)}</div>
        <div class="text-[11px] text-slate-400 dark:text-[#9aa0a6]">${esc(card.exampleDE)}</div>
      </div>` : ''}

      ${card.memoryTip ? `
      <div class="text-[11px] bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-700/40 rounded-lg px-2.5 py-1.5 text-amber-800 dark:text-amber-300">
        💡 ${esc(card.memoryTip)}
      </div>` : ''}

    </div>
  `;

  li.querySelector('.btn-delete').addEventListener('click', () => handleDelete(card.id));
  return li;
}

// ── Skeleton loading ─────────────────────────────────────────────────────────

function showSkeleton(word) {
  removeSkeleton();
  const li = document.createElement('li');
  li.dataset.skeleton = '';
  li.className = 'bg-white dark:bg-[#292a2d] rounded-xl border border-slate-200 dark:border-[#3c4043] shadow-sm overflow-hidden';
  li.innerHTML = `
    <div class="border-l-4 border-slate-300 dark:border-slate-600 px-3.5 py-3 space-y-2">
      <div class="flex items-baseline gap-2">
        <span class="text-slate-900 dark:text-[#e8eaed] font-bold text-[15px]">${esc(word)}</span>
        <span class="h-3 w-16 bg-slate-200 dark:bg-[#3c4043] rounded animate-pulse"></span>
      </div>
      <div class="space-y-1.5">
        <div class="h-4 w-32 bg-slate-200 dark:bg-[#3c4043] rounded animate-pulse"></div>
        <div class="h-3 w-20 bg-slate-100 dark:bg-[#3c4043] rounded animate-pulse"></div>
      </div>
      <div class="pl-2.5 border-l-2 border-slate-100 dark:border-[#3c4043] space-y-1">
        <div class="h-3 w-48 bg-slate-100 dark:bg-[#3c4043] rounded animate-pulse"></div>
        <div class="h-3 w-40 bg-slate-100 dark:bg-[#3c4043] rounded animate-pulse"></div>
      </div>
    </div>
  `;
  elEmpty.hidden = true;
  elList.hidden  = false;
  elList.prepend(li);
}

function removeSkeleton() {
  elList.querySelector('[data-skeleton]')?.remove();
}

// ── Card events ───────────────────────────────────────────────────────────────

elExport.addEventListener('click', handleExport);

async function handleDelete(id) {
  await deleteCard(id);
  try {
    render(await getAllCards());
  } catch (err) {
    showToast(`${currentStrings.storageErr}: ${err.message}`, true);
  }
}

async function handleExport() {
  elExport.disabled    = true;
  elExport.textContent = currentStrings.exporting;
  try {
    const [cards, config] = await Promise.all([getAllCards(), getConfig()]);
    const blob  = await exportToApkg(cards, config);
    const url   = URL.createObjectURL(blob);
    const a     = Object.assign(document.createElement('a'), { href: url, download: `ordforraad-${dateSuffix()}.apkg` });
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${cardCount(cards.length, currentStrings)} ${currentStrings.exported}`);
  } catch (err) {
    console.error('[Ordforråd Export]', err);
    showToast(`${currentStrings.error}: ${err.message}`, true);
  } finally {
    elExport.textContent = currentStrings.export;
    elExport.disabled    = false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function dateSuffix() { return new Date().toISOString().slice(0, 10); }

function showToast(msg, isError = false) {
  elToast.textContent = msg;
  elToast.className   = [
    'fixed bottom-3 left-1/2 -translate-x-1/2 text-white text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap z-50',
    isError ? 'bg-rose-600' : 'bg-slate-800',
  ].join(' ');
  elToast.hidden = false;
  setTimeout(() => { elToast.hidden = true; }, 3000);
}

init();
