/**
 * LLM client factory.
 * Routes fetchModels / fetchCardData to the correct provider
 * based on config.provider.
 */

import * as lmStudioProvider  from './providers/lmStudio.js';
import * as openaiProvider     from './providers/openai.js';
import * as anthropicProvider  from './providers/anthropic.js';

/** @param {import('../config/configStorage.js').AppConfig} config */
function getProvider(config) {
  if (config.provider === 'openai')    return openaiProvider;
  if (config.provider === 'anthropic') return anthropicProvider;
  return lmStudioProvider;
}

/**
 * @param {import('../config/configStorage.js').AppConfig} config
 * @returns {Promise<string[]>}
 */
export function fetchModels(config) {
  return getProvider(config).fetchModels(config);
}

/**
 * @param {string} word
 * @param {string} context
 * @param {import('../config/configStorage.js').AppConfig} config
 * @returns {Promise<object>}
 */
export function fetchCardData(word, context, config) {
  return getProvider(config).fetchCardData(word, context, config);
}
