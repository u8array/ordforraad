/**
 * Configuration – language settings.
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
 * @property {string} provider     Active provider: 'lmstudio' | 'openai' | 'anthropic'
 * @property {string} apiKey       API key for OpenAI / Anthropic
 */

/** @type {AppConfig} */
export const DEFAULT_CONFIG = {
  targetLang:  'Dänisch',
  nativeLang:  'Deutsch',
  model:       '',
  lmStudioUrl: 'http://localhost:1234',
  provider:    'lmstudio',
  apiKey:      '',
};

/**
 * Reads the stored configuration.
 * Missing fields are filled with DEFAULT_CONFIG.
 * @returns {Promise<AppConfig>}
 */
export async function getConfig() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  return { ...DEFAULT_CONFIG, ...(result[CONFIG_KEY] ?? {}) };
}

/**
 * Saves the configuration.
 * @param {Partial<AppConfig>} config
 */
export async function saveConfig(config) {
  const current = await getConfig();
  await chrome.storage.local.set({ [CONFIG_KEY]: { ...current, ...config } });
}
