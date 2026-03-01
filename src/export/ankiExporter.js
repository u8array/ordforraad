/**
 * Anki Exporter
 *
 * Creates a .apkg file (ZIP with SQLite database in Anki2 format).
 *
 * Requires as globals (loaded via <script> in popup.html):
 *   - sql.js  → `initSqlJs`  (libs/sql-wasm.js)
 *   - JSZip   → `JSZip`      (libs/jszip.min.js)
 *   WASM file: libs/sql-wasm.wasm, located via chrome.runtime.getURL
 *
 * Anki2-Format-Referenz:
 *   https://github.com/ankidroid/Anki-Android/wiki/Database-Structure
 */

// ── IDs ───────────────────────────────────────────────────────────────────────

/**
 * Derives two stable, distinct integer IDs from the language pair.
 * Uses djb2 hash → range 1_000_000_000–1_999_999_999 (Anki-safe).
 * @param {string} targetLang
 * @param {string} nativeLang
 * @returns {{ deckId: number, modelId: number }}
 */
function langPairIds(targetLang, nativeLang) {
  const str = `${targetLang}::${nativeLang}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  const base = 1_000_000_000 + (h % 900_000_000);
  return { deckId: base, modelId: base + 1 };
}

// ── Anki model (card template) ────────────────────────────────────────────────

/**
 * Returns the Anki model JSON (as a JS object, serialized later).
 * Fields:  0 Word | 1 Translation | 2 Pronunciation | 3 Word class
 *          4 Grammar | 5 Example (target) | 6 Example (native) | 7 Memory tip | 8 Context
 */
function buildModel(nowSec, modelId, targetLang) {
  const fields = [
    'Wort', 'Übersetzung', 'Aussprache', 'Wortklasse',
    'Grammatik', 'Beispiel DA', 'Beispiel DE', 'Merktipp', 'Kontext',
  ].map((name, ord) => ({
    name, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [],
  }));

  const qfmt = `\
<div class="da-word">{{Wort}}</div>
{{#Kontext}}<div class="context">„{{Kontext}}"</div>{{/Kontext}}`;

  const afmt = `\
{{FrontSide}}
<hr id="answer">
<div class="translation">{{Übersetzung}}</div>
<div class="pronunciation">[{{Aussprache}}]</div>
<div class="word-class">{{Wortklasse}}</div>
{{#Grammatik}}<div class="grammar">📝 {{Grammatik}}</div>{{/Grammatik}}
<div class="examples">
  <div class="ex-da">🇩🇰 <em>{{Beispiel DA}}</em></div>
  <div class="ex-de">🇩🇪 {{Beispiel DE}}</div>
</div>
{{#Merktipp}}<div class="tip">💡 {{Merktipp}}</div>{{/Merktipp}}`;

  const css = `\
.card { font-family: Arial, sans-serif; font-size: 16px; text-align: left; color: #1a1a2e; }
.da-word { font-size: 2em; font-weight: bold; color: #c30000; margin-bottom: 6px; }
.context { color: #666; font-style: italic; margin-bottom: 12px; font-size: 0.9em; }
.translation { font-size: 1.4em; font-weight: bold; margin-bottom: 4px; }
.pronunciation { color: #555; font-style: italic; margin-bottom: 8px; }
.word-class { background: #f0f4f8; padding: 3px 8px; border-radius: 4px;
              margin-bottom: 6px; font-size: 0.85em; display: inline-block; }
.grammar { color: #444; margin-bottom: 10px; font-size: 0.9em; }
.examples { border-left: 3px solid #c30000; padding-left: 12px; margin-bottom: 10px; }
.ex-da { font-style: italic; margin-bottom: 3px; }
.ex-de { color: #555; }
.tip { background: #fffde7; border: 1px solid #f9a825; padding: 8px;
       border-radius: 4px; font-size: 0.9em; }`;

  return {
    [modelId]: {
      id:      modelId,
      name:    `Ordforråd – ${targetLang}`,
      type:    0,
      mod:     nowSec,
      usn:     -1,
      sortf:   0,
      did:     null,
      flds:    fields,
      tmpls: [{
        name:  'Karte 1',
        ord:   0,
        qfmt,
        afmt,
        bqfmt: '',
        bafmt: '',
        did:   null,
        bfont: '',
        bsize: 0,
      }],
      css,
      latexPre:  '\\documentclass[12pt]{article}\n\\pagestyle{empty}\n\\begin{document}\n',
      latexPost: '\\end{document}',
      tags:  [],
      vers:  [],
    },
  };
}

function buildDecks(nowSec, deckId, targetLang) {
  return {
    1: {
      id: 1, name: 'Default', conf: 1, desc: '', dyn: 0,
      collapsed: false, browserCollapsed: true,
      extendNew: 0, extendRev: 50,
      mod: nowSec, usn: -1,
      newToday: [0,0], revToday: [0,0], lrnToday: [0,0], timeToday: [0,0],
    },
    [deckId]: {
      id: deckId, name: `Ordforråd::${targetLang}`, conf: 1, desc: '', dyn: 0,
      collapsed: false, browserCollapsed: true,
      extendNew: 0, extendRev: 50,
      mod: nowSec, usn: -1,
      newToday: [0,0], revToday: [0,0], lrnToday: [0,0], timeToday: [0,0],
    },
  };
}

const DCONF = {
  1: {
    id: 1, name: 'Default', replayq: true, timer: 0, maxTaken: 60,
    usn: 0, mod: 0, autoplay: true,
    lapse: { leechFails: 8, minInt: 1, delays: [10], leechAction: 0, mult: 0 },
    rev:   { perDay: 200, ease4: 1.3, fuzz: 0.05, minSpace: 1,
             ivlFct: 1, maxIvl: 36500, bury: true, hardFactor: 1.2 },
    new:   { perDay: 20, delays: [1,10], separate: true, ints: [1,4,7],
             initialFactor: 2500, bury: true, order: 1 },
  },
};

// ── Anki2 schema ──────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE col (
  id    INTEGER PRIMARY KEY,
  crt   INTEGER NOT NULL,
  mod   INTEGER NOT NULL,
  scm   INTEGER NOT NULL,
  ver   INTEGER NOT NULL,
  dty   INTEGER NOT NULL,
  usn   INTEGER NOT NULL,
  ls    INTEGER NOT NULL,
  conf  TEXT    NOT NULL,
  models TEXT   NOT NULL,
  decks TEXT    NOT NULL,
  dconf TEXT    NOT NULL,
  tags  TEXT    NOT NULL
);
CREATE TABLE notes (
  id    INTEGER PRIMARY KEY,
  guid  TEXT    NOT NULL,
  mid   INTEGER NOT NULL,
  mod   INTEGER NOT NULL,
  usn   INTEGER NOT NULL,
  tags  TEXT    NOT NULL,
  flds  TEXT    NOT NULL,
  sfld  INTEGER NOT NULL,
  csum  INTEGER NOT NULL,
  flags INTEGER NOT NULL,
  data  TEXT    NOT NULL
);
CREATE TABLE cards (
  id     INTEGER PRIMARY KEY,
  nid    INTEGER NOT NULL,
  did    INTEGER NOT NULL,
  ord    INTEGER NOT NULL,
  mod    INTEGER NOT NULL,
  usn    INTEGER NOT NULL,
  type   INTEGER NOT NULL,
  queue  INTEGER NOT NULL,
  due    INTEGER NOT NULL,
  ivl    INTEGER NOT NULL,
  factor INTEGER NOT NULL,
  reps   INTEGER NOT NULL,
  lapses INTEGER NOT NULL,
  left   INTEGER NOT NULL,
  odue   INTEGER NOT NULL,
  odid   INTEGER NOT NULL,
  flags  INTEGER NOT NULL,
  data   TEXT    NOT NULL
);
CREATE TABLE revlog (
  id      INTEGER PRIMARY KEY,
  cid     INTEGER NOT NULL,
  usn     INTEGER NOT NULL,
  ease    INTEGER NOT NULL,
  ivl     INTEGER NOT NULL,
  lastIvl INTEGER NOT NULL,
  factor  INTEGER NOT NULL,
  time    INTEGER NOT NULL,
  type    INTEGER NOT NULL
);
CREATE TABLE graves (
  usn  INTEGER NOT NULL,
  oid  INTEGER NOT NULL,
  type INTEGER NOT NULL
);
CREATE INDEX ix_notes_usn   ON notes (usn);
CREATE INDEX ix_cards_usn   ON cards (usn);
CREATE INDEX ix_revlog_usn  ON revlog (usn);
CREATE INDEX ix_cards_nid   ON cards (nid);
CREATE INDEX ix_cards_sched ON cards (did, queue, due);
CREATE INDEX ix_revlog_cid  ON revlog (cid);
CREATE INDEX ix_notes_csum  ON notes (csum);
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Computes the Anki field checksum (first 8 hex chars of SHA-1 → integer). */
async function fieldChecksum(text) {
  const buf  = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  const hex  = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  return parseInt(hex.slice(0, 8), 16);
}

/** Generates a 10-character GUID for Anki notes. */
function generateGuid() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)))
    .map(b => chars[b % chars.length])
    .join('');
}

// ── Main export function ───────────────────────────────────────────────────────

/**
 * Exports an array of VocabCards as a .apkg Blob.
 *
 * Requires `initSqlJs` and `JSZip` to be available as globals
 * (loaded via <script> tags in popup.html).
 *
 * @param {import('../shared/cardSchema.js').VocabCard[]} cards
 * @param {import('../config/configStorage.js').AppConfig} config
 * @returns {Promise<Blob>}  .apkg Blob ready for download
 */
export async function exportToApkg(cards, config) {
  if (cards.length === 0) throw new Error('No cards to export.');

  const { deckId, modelId } = langPairIds(config.targetLang, config.nativeLang);

  // initialise sql.js – WASM is stored locally in libs/
  const SQL = await initSqlJs({
    locateFile: f => chrome.runtime.getURL(`libs/${f}`),
  });

  const db      = new SQL.Database();
  const nowMs   = Date.now();
  const nowSec  = Math.floor(nowMs / 1000);

  // create schema
  db.run(SCHEMA_SQL);

  // insert col row
  db.run(
    'INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [
      1, nowSec, nowMs, nowMs, 11, 0, 0, 0,
      JSON.stringify({ nextPos: 1, estTimes: true, activeDecks: [1],
                       sortType: 'noteFld', timeLim: 0, sortBackwards: false,
                       addToCur: true, curDeck: deckId, newBury: true,
                       newSpread: 0, dueCounts: true,
                       curModel: String(modelId), collapseTime: 1200 }),
      JSON.stringify(buildModel(nowSec, modelId, config.targetLang)),
      JSON.stringify(buildDecks(nowSec, deckId, config.targetLang)),
      JSON.stringify(DCONF),
      '{}',
    ],
  );

  // insert notes + cards
  for (let i = 0; i < cards.length; i++) {
    const card   = cards[i];
    const noteId = card.createdAt + i;          // ms timestamp, unique via index offset
    const cardId = card.createdAt + i + 1;      // must differ from noteId

    // \x1f = ASCII Unit Separator – Anki's internal field delimiter
    const flds = [
      card.word, card.translation, card.pronunciation, card.wordClass,
      card.grammar, card.exampleDA, card.exampleDE, card.memoryTip, card.context,
    ].join('\x1f');

    const csum = await fieldChecksum(card.word);

    db.run(
      'INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [noteId, generateGuid(), modelId, nowSec, -1, '', flds, card.word, csum, 0, ''],
    );

    db.run(
      'INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [cardId, noteId, deckId, 0, nowSec, -1, 0, 0, i + 1, 0, 0, 0, 0, 0, 0, 0, 0, ''],
    );
  }

  // export SQLite data
  const dbData = db.export();          // Uint8Array
  db.close();

  // .apkg = ZIP of collection.anki2 + media
  const zip = new JSZip();
  zip.file('collection.anki2', dbData);
  zip.file('media', '{}');

  return zip.generateAsync({
    type:               'blob',
    mimeType:           'application/zip',
    compression:        'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
