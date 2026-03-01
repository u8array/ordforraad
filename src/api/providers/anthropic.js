/**
 * Anthropic (Claude) provider.
 */

import { localeName, t } from '../../i18n/strings.js';
import { fetchWithTimeout, buildSystemPrompt, fetchActiveModel, parseJsonResponse } from './_helpers.js';

const ANTHROPIC_VERSION = '2023-06-01';

function anthropicHeaders(apiKey) {
  return {
    'Content-Type':      'application/json',
    'x-api-key':         apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  };
}

/** @param {import('../../config/configStorage.js').AppConfig} config */
export async function fetchModels(config) {
  const s = t(config.nativeLang);
  let resp;
  try {
    resp = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
      headers: anthropicHeaders(config.apiKey),
    });
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? s.timeout : s.unreachable);
  }
  if (!resp.ok) throw new Error(`Anthropic HTTP ${resp.status}: ${resp.statusText}`);
  const { data } = await resp.json();
  return (Array.isArray(data) ? data : []).map(m => m.id);
}

/**
 * @param {string} word
 * @param {string} context
 * @param {import('../../config/configStorage.js').AppConfig} config
 */
export async function fetchCardData(word, context, config) {
  const model  = config.model || await fetchActiveModel(fetchModels, config);
  const s      = t(config.nativeLang);
  const target = localeName(config.targetLang, 'Englisch');

  let response;
  try {
    response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: anthropicHeaders(config.apiKey),
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system:     buildSystemPrompt(config),
        messages: [
          { role: 'user', content: `${target} word: "${word}"\nContext: "${context}"` },
        ],
      }),
    });
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? s.timeout : s.unreachable);
  }

  if (!response.ok) throw new Error(`Anthropic HTTP ${response.status}: ${response.statusText}`);

  const payload = await response.json();
  const raw     = payload?.content?.[0]?.text ?? '';
  return parseJsonResponse(raw, config.nativeLang);
}
