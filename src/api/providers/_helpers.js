/**
 * Shared helpers for all LLM providers.
 */

import { localeName, t } from '../../i18n/strings.js';

export const FETCH_TIMEOUT_MS = 30_000;

/** Fetch with automatic timeout. */
export function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

/** Builds the system prompt (identical across all providers). */
export function buildSystemPrompt({ targetLang, nativeLang }) {
  // Use English language names → best LLM reliability
  const target = localeName(targetLang, 'Englisch');
  const native = localeName(nativeLang, 'Englisch');

  return `\
You are a language expert helping to build ${target} vocabulary for a ${native}-speaking learner.

Respond ONLY with a valid JSON object. No markdown, no explanation outside the JSON.

The JSON must contain exactly these fields:
{
  "translation":   "Precise ${native} translation (multiple meanings separated by semicolons if applicable)",
  "pronunciation": "Phonetic transcription in IPA or simplified for ${native} speakers",
  "wordClass":     "Word class in ${target} with key inflection info (gender, plural, conjugation, etc.)",
  "grammar":       "Most important grammatical note in ${native} for correct usage – empty string if not applicable",
  "exampleDA":     "Natural example sentence in ${target} showing the word in context",
  "exampleDE":     "${native} translation of the example sentence",
  "memoryTip":     "Concrete memory aid in ${native} (mnemonic, word family, false friend, etc.)"
}`;
}

/**
 * Returns the first model from the provider's model list.
 * @param {Function} fetchModelsFn  – the provider's fetchModels(config)
 * @param {import('../../config/configStorage.js').AppConfig} config
 * @returns {Promise<string>}
 */
export async function fetchActiveModel(fetchModelsFn, config) {
  const models = await fetchModelsFn(config);
  if (models.length === 0) throw new Error(t(config.nativeLang).noModel);
  return models[0];
}

/** Strips optional markdown code fences and parses JSON. */
export function parseJsonResponse(raw, nativeLang) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(t(nativeLang).jsonError);
  }
}
