/**
 * LM Studio provider (OpenAI-compatible local API).
 */

import { localeName, t } from '../../i18n/strings.js';
import { fetchWithTimeout, buildSystemPrompt, fetchActiveModel, parseJsonResponse } from './_helpers.js';

/** @param {import('../../config/configStorage.js').AppConfig} config */
export async function fetchModels(config) {
  const s = t(config.nativeLang);
  let resp;
  try {
    resp = await fetchWithTimeout(`${config.lmStudioUrl}/v1/models`);
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? s.timeout : s.unreachable);
  }
  if (!resp.ok) throw new Error(`LM Studio HTTP ${resp.status}`);
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
    response = await fetchWithTimeout(`${config.lmStudioUrl}/v1/chat/completions`, {
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

  if (!response.ok) throw new Error(`LM Studio HTTP ${response.status}: ${response.statusText}`);

  const payload = await response.json();
  const raw     = payload?.choices?.[0]?.message?.content ?? '';
  return parseJsonResponse(raw, config.nativeLang);
}
