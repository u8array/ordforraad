/**
 * Shared helpers for all LLM providers.
 */

import { localeName, t } from '../../i18n/strings.js';

const FETCH_TIMEOUT_MS = 30_000;

/** Fetch with automatic timeout. */
export function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

/** Throws a localized error for common HTTP status codes. */
export function throwHttpError(provider, status, nativeLang) {
  const s = t(nativeLang);
  if (status === 401 || status === 403) throw new Error(s.invalidKey);
  if (status === 429)                   throw new Error(s.rateLimited);
  throw new Error(`${provider} HTTP ${status}`);
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
  "pronunciation": "IPA transcription with exactly one pair of brackets, e.g. [ˈhʉːnə]. Never use double brackets. No approximations.",
  "wordClass":     "Word class in ${target} with key inflection info (gender, plural, conjugation, etc.)",
  "grammar":       "Most important grammatical note in ${native} for correct usage – empty string if not applicable",
  "exampleDA":     "Natural example sentence in ${target} showing the word in context",
  "exampleDE":     "${native} translation of the example sentence",
  "memoryTip":     "Concrete memory aid in ${native} (mnemonic, word family, false friend, etc.)"
}`;
}

/**
 * Returns the first model from the provider's model list.
 * @param {Function} fetchModelsFn  the provider's fetchModels(config)
 * @param {import('../../config/configStorage.js').AppConfig} config
 * @returns {Promise<string>}
 */
export async function fetchActiveModel(fetchModelsFn, config) {
  const models = await fetchModelsFn(config);
  if (models.length === 0) throw new Error(t(config.nativeLang).noModel);
  return models[0];
}

/**
 * Robust JSON extraction from LLM output.
 * Strips markdown fences, JS comments, and extracts the first JSON object/array.
 */
export function parseJsonResponse(raw, nativeLang) {
  let clean = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();

  const objMatch = clean.match(/\{[\s\S]*\}/);
  const arrMatch = clean.match(/\[[\s\S]*\]/);

  if (objMatch && arrMatch) {
    clean = (objMatch.index ?? 0) < (arrMatch.index ?? 0)
      ? objMatch[0]
      : arrMatch[0];
  } else if (objMatch) {
    clean = objMatch[0];
  } else if (arrMatch) {
    clean = arrMatch[0];
  }

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(t(nativeLang).jsonError);
  }
}
