/**
 * @typedef {Object} VocabCard
 * @property {string}  id          UUID
 * @property {string}  word        The vocabulary word (original spelling)
 * @property {string}  context     Sentence/context from the source page
 * @property {string}  sourceUrl   URL of the source page
 * @property {string}  translation Native-language translation
 * @property {string}  pronunciationPhonetic transcription (IPA / simplified)
 * @property {string}  wordClass   Word class + inflection info in the target language
 * @property {string}  grammar     Grammar note in native language
 * @property {string}  exampleDA   Example sentence in target language
 * @property {string}  exampleDE   Native-language translation of the example sentence
 * @property {string}  memoryTip   Memory tip in native language
 * @property {number}  createdAt   Unix timestamp (ms)
 */

/**
 * Creates a new VocabCard from the LLM response object.
 *
 * @param {string} word
 * @param {string} context
 * @param {string} sourceUrl
 * @param {object} llmData Validated JSON from the LLM
 * @returns {VocabCard}
 */
export function createCard(word, context, sourceUrl, llmData) {
  return {
    id:           crypto.randomUUID(),
    word:         word.trim(),
    context:      context.trim(),
    sourceUrl,
    translation:  llmData.translation  ?? '',
    pronunciation: llmData.pronunciation ?? '',
    wordClass:    llmData.wordClass    ?? '',
    grammar:      llmData.grammar      ?? '',
    exampleDA:    llmData.exampleDA    ?? '',
    exampleDE:    llmData.exampleDE    ?? '',
    memoryTip:    llmData.memoryTip    ?? '',
    createdAt:    Date.now(),
  };
}

/**
 * Minimal runtime validation of the LLM JSON.
 * Throws if required fields are missing.
 *
 * @param {unknown} data
 * @returns {object}
 */
export function validateLlmData(data) {
  const required = ['translation', 'pronunciation', 'wordClass', 'grammar',
                    'exampleDA', 'exampleDE', 'memoryTip'];
  for (const key of required) {
    if (typeof data[key] !== 'string') {
      throw new Error(`LLM response: field "${key}" is missing or not a string.`);
    }
  }
  return data;
}
