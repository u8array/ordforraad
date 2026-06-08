/** Shared Anki model definition for both .apkg exporter and AnkiConnect client. */

import { t, localeName } from '../i18n/strings.js';

// Order is the schema — defines field order in Anki and index in the .apkg flds string.
const SCHEMA_PROPS = [
  { prop: 'word',          i18nKey: 'word' },
  { prop: 'translation',   i18nKey: 'translation' },
  { prop: 'pronunciation', i18nKey: 'pronunciation' },
  { prop: 'wordClass',     i18nKey: 'wordClass' },
  { prop: 'grammar',       i18nKey: 'grammar' },
  { prop: 'exampleDA',     i18nKey: 'exampleTarget' },
  { prop: 'exampleDE',     i18nKey: 'exampleNative' },
  { prop: 'memoryTip',     i18nKey: 'memoryTip' },
  { prop: 'context',       i18nKey: 'context' },
];

// Anki's template parser breaks on these chars in field names.
const FORBIDDEN_FIELD_CHARS = /[{}":]/;

function validateFieldNames(names) {
  const seen = new Set();
  for (const name of names) {
    if (!name) throw new Error('Anki field name is empty');
    if (FORBIDDEN_FIELD_CHARS.test(name)) {
      throw new Error(`Anki field name "${name}" contains a forbidden character ({, }, ", :)`);
    }
    if (seen.has(name)) throw new Error(`Duplicate Anki field name: "${name}"`);
    seen.add(name);
  }
}

function renderTemplates(f) {
  const qfmt = `<div class="word">{{${f.word}}}</div>
{{#${f.context}}}<div class="context">„{{${f.context}}}"</div>{{/${f.context}}}`;

  const afmt = `{{FrontSide}}
<hr id="answer">
<div class="translation">{{${f.translation}}}</div>
{{#${f.pronunciation}}}<div class="pronunciation">[{{${f.pronunciation}}}]</div>{{/${f.pronunciation}}}
{{#${f.wordClass}}}<div class="word-class">{{${f.wordClass}}}</div>{{/${f.wordClass}}}
{{#${f.grammar}}}<div class="grammar">📝 {{${f.grammar}}}</div>{{/${f.grammar}}}
{{#${f.exampleTarget}}}
<div class="examples">
  <div class="ex-target"><em>{{${f.exampleTarget}}}</em></div>
  {{#${f.exampleNative}}}<div class="ex-native">{{${f.exampleNative}}}</div>{{/${f.exampleNative}}}
</div>
{{/${f.exampleTarget}}}
{{#${f.memoryTip}}}<div class="tip">💡 {{${f.memoryTip}}}</div>{{/${f.memoryTip}}}`;

  return { qfmt, afmt };
}

const CSS = `\
.card { font-family: Arial, sans-serif; font-size: 16px; text-align: left; color: #1a1a2e; }
.word { font-size: 2em; font-weight: bold; color: #c30000; margin-bottom: 6px; }
.context { color: #666; font-style: italic; margin-bottom: 12px; font-size: 0.9em; }
.translation { font-size: 1.4em; font-weight: bold; margin-bottom: 4px; }
.pronunciation { color: #555; font-style: italic; margin-bottom: 8px; }
.word-class { background: #f0f4f8; padding: 3px 8px; border-radius: 4px;
              margin-bottom: 6px; font-size: 0.85em; display: inline-block; }
.grammar { color: #444; margin-bottom: 10px; font-size: 0.9em; }
.examples { border-left: 3px solid #c30000; padding-left: 12px; margin-bottom: 10px; }
.ex-target { font-style: italic; margin-bottom: 3px; }
.ex-native { color: #555; }
.tip { background: #fffde7; border: 1px solid #f9a825; padding: 8px;
       border-radius: 4px; font-size: 0.9em; }`;

export const TAG = 'ordforraad';

const partsCache = new Map();

/** Switching nativeLang yields a new model — old ones stay side-by-side. */
export function buildModelParts(targetLang, nativeLang) {
  const cacheKey = `${targetLang}|${nativeLang}`;
  const hit      = partsCache.get(cacheKey);
  if (hit) return hit;

  const strings = t(nativeLang);
  const f       = strings.anki?.fields;
  if (!f) throw new Error(`Missing 'anki.fields' i18n block for ${nativeLang}`);

  const schema = SCHEMA_PROPS.map(({ prop, i18nKey }) => {
    const name = f[i18nKey];
    if (name == null) throw new Error(`Missing 'anki.fields.${i18nKey}' i18n value for ${nativeLang}`);
    return { name, prop };
  });
  const fieldNames = schema.map(s => s.name);
  validateFieldNames(fieldNames);

  const langLabel = localeName(targetLang, nativeLang);
  const parts = {
    schema,
    fieldNames,
    templateName: strings.anki.templateName,
    css:          CSS,
    deck:         `Ordforråd::${langLabel}`,
    model:        `Ordforråd – ${langLabel}`,
    ...renderTemplates(f),
  };
  partsCache.set(cacheKey, parts);
  return parts;
}

export function cardToFieldValues(card, schema) {
  return schema.map(s => card[s.prop] ?? '');
}

export function cardToFieldMap(card, schema) {
  return Object.fromEntries(schema.map(s => [s.name, card[s.prop] ?? '']));
}
