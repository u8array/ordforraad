/**
 * LM Studio API Client
 * Communicates with the local OpenAI-compatible API.
 *
 * Supported LM Studio endpoints (all active simultaneously):
 *   GET  /v1/models            – list loaded models          ← used
 *   POST /v1/chat/completions  – chat completion             ← used
 *   POST /v1/completions       – Legacy completions
 *   POST /v1/embeddings        – Embeddings
 *   POST /v1/responses         – OpenAI Responses API
 *   POST /v1/messages          – Anthropic-kompatibel
 *   (plus /api/v1/... native LM Studio Endpoints)
 */

import { localeName, t } from '../i18n/strings.js';

const FETCH_TIMEOUT_MS = 30_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch with automatic timeout. */
function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function completionsUrl(config) { return `${config.lmStudioUrl}/v1/chat/completions`; }
function modelsUrl(config)      { return `${config.lmStudioUrl}/v1/models`; }

// ── Model discovery ───────────────────────────────────────────────────────────

/**
 * Queries LM Studio for all loaded models.
 * @param {import('../config/configStorage.js').AppConfig} config
 * @returns {Promise<string[]>}  Array von Modell-IDs
 * @throws {Error} Wenn LM Studio nicht erreichbar ist
 */
export async function fetchModels(config) {
  const s = t(config.nativeLang);
  let resp;
  try {
    resp = await fetchWithTimeout(modelsUrl(config));
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? s.timeout : s.unreachable);
  }
  if (!resp.ok) throw new Error(`LM Studio HTTP ${resp.status}`);
  const { data } = await resp.json();
  return (Array.isArray(data) ? data : []).map(m => m.id);
}

/**
 * Returns the ID of the currently active model.
 * The first model in the list is the loaded one.
 * @param {import('../config/configStorage.js').AppConfig} config
 * @returns {Promise<string>}
 * @throws {Error} Wenn kein Modell geladen ist
 */
async function fetchActiveModel(config) {
  const models = await fetchModels(config);
  if (models.length === 0) {
    throw new Error(t(config.nativeLang).noModel);
  }
  return models[0];
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt({ targetLang, nativeLang }) {
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

// ── Main API call ─────────────────────────────────────────────────────────────

/**
 * Sends a word + context to LM Studio and returns the parsed JSON.
 *
 * @param {string} word
 * @param {string} context
 * @param {import('../config/configStorage.js').AppConfig} config
 * @returns {Promise<object>}
 * @throws {Error}
 */
export async function fetchCardData(word, context, config) {
  const model = config.model || await fetchActiveModel(config);

  const s = t(config.nativeLang);
  const target = localeName(config.targetLang, 'Englisch');

  let response;
  try {
    response = await fetchWithTimeout(completionsUrl(config), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(config) },
          { role: 'user',   content: `${target} word: "${word}"\nContext: "${context}"` },
        ],
        temperature: 0.3,
        max_tokens:  1024,
      }),
    });
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? s.timeout : s.unreachable);
  }

  if (!response.ok) {
    throw new Error(`LM Studio HTTP ${response.status}: ${response.statusText}`);
  }

  const payload = await response.json();
  const raw     = payload?.choices?.[0]?.message?.content ?? '';

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/,        '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(s.jsonError);
  }
}
