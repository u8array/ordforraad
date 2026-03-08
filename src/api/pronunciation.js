/**
 * Wiktionary IPA-Lookup
 *
 * Tries en.wiktionary.org first; returns null if no IPA found
 * (caller falls back to LLM pronunciation).
 */

import { LANG_CODE } from '../i18n/strings.js';

const WIKT_API = 'https://en.wiktionary.org/w/api.php';

/** ISO language code → Wiktionary section heading */
const CODE_TO_HEADING = {
  ar: 'Arabic',
  zh: 'Chinese',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  fi: 'Finnish',
  fr: 'French',
  de: 'German',
  el: 'Greek',
  hu: 'Hungarian',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  nb: 'Norwegian Bokmål',
  pl: 'Polish',
  pt: 'Portuguese',
  ru: 'Russian',
  es: 'Spanish',
  sv: 'Swedish',
  tr: 'Turkish',
};

/**
 * Fetch IPA pronunciation from Wiktionary.
 * @param {string} word
 * @param {string} targetLang  German config key, e.g. "Dänisch"
 * @returns {Promise<string|null>}  e.g. "[ˈhunə]" or null
 */
export async function fetchPronunciation(word, targetLang) {
  const code    = LANG_CODE[targetLang];
  const heading = code && CODE_TO_HEADING[code];
  if (!heading) return null;

  const section = await fetchLangSection(word, heading);
  if (!section) return null;

  const ipa = extractIpa(section);
  if (ipa) return ipa;

  // Inflected forms (e.g. "embedsmænd") have no IPA — follow base form link
  const base = extractBaseForm(section, code);
  if (!base || base === word) return null;

  const baseSection = await fetchLangSection(base, heading);
  return baseSection ? extractIpa(baseSection) : null;
}

/** Fetches the wikitext for a specific language section from Wiktionary. */
async function fetchLangSection(word, heading) {
  const url  = `${WIKT_API}?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&origin=*`;
  const resp = await fetch(url);
  if (!resp.ok) return null;

  const json     = await resp.json();
  const wikitext = json?.parse?.wikitext?.['*'] ?? '';
  if (!wikitext) return null;

  const sectionRegex = new RegExp(
    `==${escapeRegex(heading)}==([\\s\\S]*?)(?=\\n==[^=]|$)`
  );
  return wikitext.match(sectionRegex)?.[1] ?? null;
}

/** Extracts IPA from a language section (phonetic preferred over phonemic). */
function extractIpa(section) {
  const ipaBracket = section.match(/\{\{IPA\|[^}]*?\[([^\]]+)\]/);
  if (ipaBracket) return `[${ipaBracket[1]}]`;

  const ipaSlash = section.match(/\{\{IPA\|[^}]*?\/([^/]+)\//);
  if (ipaSlash) return `/${ipaSlash[1]}/`;

  const bare = section.match(/\[([^\[\]]*[ˈˌːʰðθʃʒŋ][^\[\]]*)\]/);
  if (bare) return `[${bare[1]}]`;

  return null;
}

/** Extracts base/lemma form from {{infl of}} or {{inflection of}} templates. */
function extractBaseForm(section, langCode) {
  const m = section.match(
    /\{\{(?:infl of|inflection of)\|([^|]+)\|([^|}]+)/
  );
  return (m && m[1] === langCode) ? m[2] : null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
