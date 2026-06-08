/** Configuration: language settings, default values, persistence. */

import { SUPPORTED_LANGS } from '../i18n/strings.js';

const CONFIG_KEY = 'user_config';

/** All selectable languages (IETF codes). */
export const LANGUAGES = SUPPORTED_LANGS;

/**
 * @typedef {Object} AppConfig
 * @property {string} targetLang   IETF code of the language being learned (e.g. "da")
 * @property {string} nativeLang   IETF code of the learner's native language (e.g. "de")
 * @property {string} model        LLM model ID (empty = auto-select first available)
 * @property {string} lmStudioUrl  Base URL of LM Studio (e.g. "http://localhost:1234")
 * @property {string} provider     Active provider: 'lmstudio' | 'openai' | 'anthropic' | 'google'
 * @property {Object<string,string>} apiKeys  Per-provider API keys
 * @property {string} apiKey       (computed) API key for the active provider
 */

/** @type {AppConfig} */
export const DEFAULT_CONFIG = {
  targetLang:  'es',
  nativeLang:  'en',
  model:       '',
  lmStudioUrl: 'http://localhost:1234',
  provider:    'lmstudio',
  apiKeys:     {},
};

// Legacy German-string language identifiers → IETF codes. Only used to
// migrate config saved by versions before the code-based identity refactor.
const LEGACY_LANG_KEYS = {
  'Arabisch':              'ar',
  'Chinesisch (Mandarin)': 'zh',
  'Dänisch':               'da',
  'Deutsch':               'de',
  'Englisch':              'en',
  'Finnisch':              'fi',
  'Französisch':           'fr',
  'Griechisch':            'el',
  'Isländisch':            'is',
  'Italienisch':           'it',
  'Japanisch':             'ja',
  'Koreanisch':            'ko',
  'Niederländisch':        'nl',
  'Norwegisch (Bokmål)':   'nb',
  'Polnisch':              'pl',
  'Portugiesisch':         'pt',
  'Russisch':              'ru',
  'Schwedisch':            'sv',
  'Spanisch':              'es',
  'Tschechisch':           'cs',
  'Türkisch':              'tr',
  'Ungarisch':             'hu',
};

// Browser locales not directly present in LANGUAGES map to a close variant.
const LOCALE_ALIASES = { no: 'nb', nn: 'nb' };

/** Detects the native language from the browser locale; falls back to English. */
function detectNativeLang() {
  const locale = chrome.i18n.getUILanguage?.() ?? navigator.language ?? 'en';
  const raw    = locale.split('-')[0].toLowerCase();
  const code   = LOCALE_ALIASES[raw] ?? raw;
  return LANGUAGES.includes(code) ? code : 'en';
}

/** Reads the raw persisted config (no computed fields). Migrates legacy keys. */
async function getRawConfig() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  const saved  = result[CONFIG_KEY];

  const defaults = { ...DEFAULT_CONFIG, nativeLang: detectNativeLang() };
  const raw      = { ...defaults, ...(saved ?? {}) };

  let dirty = false;

  // Migrate German-string language identifiers from older versions.
  if (LEGACY_LANG_KEYS[raw.targetLang]) {
    raw.targetLang = LEGACY_LANG_KEYS[raw.targetLang];
    dirty = true;
  }
  if (LEGACY_LANG_KEYS[raw.nativeLang]) {
    raw.nativeLang = LEGACY_LANG_KEYS[raw.nativeLang];
    dirty = true;
  }

  // Migrate legacy single apiKey into apiKeys map.
  if (typeof raw.apiKey === 'string' && raw.apiKey) {
    raw.apiKeys = { ...raw.apiKeys, [raw.provider]: raw.apiKey };
    delete raw.apiKey;
    dirty = true;
  }
  if (dirty) await chrome.storage.local.set({ [CONFIG_KEY]: raw });

  delete raw.apiKey;
  return raw;
}

/**
 * Reads the stored configuration. Missing fields are filled with
 * DEFAULT_CONFIG. Adds computed `apiKey` for the active provider.
 */
export async function getConfig() {
  const raw = await getRawConfig();
  return { ...raw, apiKey: raw.apiKeys?.[raw.provider] ?? '' };
}

export async function saveConfig(config) {
  const current = await getRawConfig();
  await chrome.storage.local.set({ [CONFIG_KEY]: { ...current, ...config } });
}
