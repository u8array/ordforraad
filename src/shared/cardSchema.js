/**
 * @typedef {Object} VocabCard
 * @property {string}  id              UUID
 * @property {string}  word            The vocabulary word (original spelling)
 * @property {string}  context         Sentence/context from the source page
 * @property {string}  sourceUrl       URL of the source page
 * @property {string}  translation     Native-language translation
 * @property {string}  pronunciation   Phonetic transcription (IPA / simplified)
 * @property {boolean} pronunciationFromLookup  True if pronunciation came from Wiktionary
 * @property {string}  wordClass       Word class + inflection info in target language
 * @property {string}  grammar         Grammar note in native language
 * @property {string}  exampleTarget   Example sentence in the target language
 * @property {string}  exampleNative   Native-language translation of the example
 * @property {string}  memoryTip       Memory tip in native language
 * @property {number}  createdAt       Unix timestamp (ms)
 */

/** Card fields populated from the LLM response, in canonical order. */
export const LLM_FIELDS = [
  'translation', 'pronunciation', 'wordClass', 'grammar',
  'exampleTarget', 'exampleNative', 'memoryTip',
];

/**
 * Creates a new VocabCard from the LLM response object.
 * @param {string}  word
 * @param {string}  context
 * @param {string}  sourceUrl
 * @param {object}  llmData
 * @param {boolean} [pronunciationFromLookup=false]
 * @returns {VocabCard}
 */
export function createCard(word, context, sourceUrl, llmData, pronunciationFromLookup = false) {
  const llmFields = Object.fromEntries(LLM_FIELDS.map(k => [k, llmData[k] ?? '']));
  return {
    id:      crypto.randomUUID(),
    word:    word.trim(),
    context: context.trim(),
    sourceUrl,
    ...llmFields,
    pronunciationFromLookup,
    createdAt: Date.now(),
  };
}

/** Throws if a required LLM field is missing or not a string. */
export function validateLlmData(data) {
  for (const key of LLM_FIELDS) {
    if (typeof data[key] !== 'string') {
      throw new Error(`LLM response: field "${key}" is missing or not a string.`);
    }
  }
  return data;
}
