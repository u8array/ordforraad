/**
 * Configuration: language settings.
 *
 * Single source of truth for supported languages
 * and default values.
 */

const CONFIG_KEY = 'user_config';

/** All selectable languages (alphabetical). */
export const LANGUAGES = [
  'Arabisch',
  'Chinesisch (Mandarin)',
  'Dänisch',
  'Deutsch',
  'Englisch',
  'Finnisch',
  'Französisch',
  'Griechisch',
  'Isländisch',
  'Italienisch',
  'Japanisch',
  'Koreanisch',
  'Niederländisch',
  'Norwegisch (Bokmål)',
  'Polnisch',
  'Portugiesisch',
  'Russisch',
  'Schwedisch',
  'Spanisch',
  'Tschechisch',
  'Türkisch',
  'Ungarisch',
];

/**
 * @typedef {Object} AppConfig
 * @property {string} targetLang   Language being learned (e.g. "Dänisch")
 * @property {string} nativeLang   Learner's native language (e.g. "Deutsch")
 * @property {string} model        LLM model ID (empty = auto-select first available)
 * @property {string} lmStudioUrl  Base URL of LM Studio (e.g. "http://localhost:1234")
 * @property {string} provider     Active provider: 'lmstudio' | 'openai' | 'anthropic' | 'google'
 * @property {Object<string,string>} apiKeys  Per-provider API keys
 * @property {string} apiKey       (computed) API key for the active provider
 */

/** @type {AppConfig} */
export const DEFAULT_CONFIG = {
  targetLang:  'Dänisch',
  nativeLang:  'Deutsch',
  model:       '',
  lmStudioUrl: 'http://localhost:1234',
  provider:    'lmstudio',
  apiKeys:     {},
};

/**
 * Reads the stored configuration.
 * Missing fields are filled with DEFAULT_CONFIG.
 * @returns {Promise<AppConfig>}
 */
export async function getConfig() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  const raw = { ...DEFAULT_CONFIG, ...(result[CONFIG_KEY] ?? {}) };

  // Migration: move legacy single apiKey into apiKeys map
  if (raw.apiKey && !raw.apiKeys?.[raw.provider]) {
    raw.apiKeys = { ...raw.apiKeys, [raw.provider]: raw.apiKey };
    delete raw.apiKey;
    await chrome.storage.local.set({ [CONFIG_KEY]: raw });
  }

  // Computed: resolve active provider's key
  raw.apiKey = raw.apiKeys?.[raw.provider] ?? '';
  return raw;
}

/**
 * Saves the configuration.
 * @param {Partial<AppConfig>} config
 */
export async function saveConfig(config) {
  const current = await getConfig();
  await chrome.storage.local.set({ [CONFIG_KEY]: { ...current, ...config } });
}
