/**
 * Google Gemini provider.
 */

import { localeName, t } from '../../i18n/strings.js';
import { fetchWithTimeout, buildSystemPrompt, fetchActiveModel, parseJsonResponse, throwHttpError } from './_helpers.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite-preview';

/** @param {import('../../config/configStorage.js').AppConfig} config */
export async function fetchModels(config) {
  const s = t(config.nativeLang);
  let resp;
  try {
    resp = await fetchWithTimeout(`${GEMINI_BASE}/models?key=${config.apiKey}`);
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? s.timeout : s.unreachable);
  }
  if (!resp.ok) throwHttpError('Google', resp.status, config.nativeLang);
  const { models } = await resp.json();
  return (Array.isArray(models) ? models : [])
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''));
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

  const body = {
    contents: [
      { role: 'user', parts: [{ text: `${target} word: "${word}"\nContext: "${context}"` }] },
    ],
    systemInstruction: { parts: [{ text: buildSystemPrompt(config) }] },
    generationConfig: {
      temperature:    0.3,
      maxOutputTokens: 1024,
    },
  };

  let response;
  try {
    response = await fetchWithTimeout(
      `${GEMINI_BASE}/models/${model}:generateContent?key=${config.apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      },
    );
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? s.timeout : s.unreachable);
  }

  if (!response.ok) throwHttpError('Google', response.status, config.nativeLang);

  const payload = await response.json();
  const raw     = payload?.candidates?.[0]?.content?.parts
    ?.map(p => p.text).join('') ?? '';
  console.debug('[Ordforråd Google] raw response:', raw);
  return parseJsonResponse(raw, config.nativeLang);
}
