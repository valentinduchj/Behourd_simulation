// Langues du jeu (v0.79) : français (langue d'écriture du jeu), anglais, espagnol.
//
// Le jeu reste écrit en français. Une couche de traduction remplace, à l'affichage, chaque texte
// français par sa traduction (dictionnaires src/i18n/en.js et src/i18n/es.js) :
//   - interface HTML : nœuds de texte et attributs (title, aria-label, placeholder, alt), suivis
//     par un MutationObserver (installDomTranslation) ;
//   - texte dessiné sur les cartes (canvas : étiquettes des lieux, noms, dégâts…) ;
//   - textes enrichis de l'Almanach, traduits avant d'être découpés en morceaux.
// Les noms propres (combattants, clubs, villes, châteaux, titres des musiques…) ne figurent pas
// dans les dictionnaires : ils restent tels quels.
//
// Dictionnaire : { « texte français » : « traduction » }. Une phrase à trous s'écrit avec {0},
// {1}… (dans l'ordre du code) ; la traduction place les trous où il faut, et peut écrire
// {1?texte si non vide:texte sinon} (pluriels, accords : « {0} fighter{1?s:} »).

export const LANGUAGES = Object.freeze([
  Object.freeze({ id: 'fr', label: 'Français', htmlLang: 'fr', locale: 'fr-FR' }),
  Object.freeze({ id: 'en', label: 'English', htmlLang: 'en', locale: 'en-GB' }),
  Object.freeze({ id: 'es', label: 'Español', htmlLang: 'es', locale: 'es-ES' }),
]);
export const DEFAULT_LANGUAGE = 'fr';
const STORAGE_KEY = 'behourd.language';

let current = DEFAULT_LANGUAGE;
let exact = new Map(); // texte français → traduction
let patterns = []; // phrases à trous : { regex, order, target, literal, anchor, weak }
const cache = new Map();

export function getLanguage() {
  return current;
}

export function getLanguageInfo(id = current) {
  return LANGUAGES.find((language) => language.id === id) ?? LANGUAGES[0];
}

/** Paramètres régionaux des nombres et des dates (« 1 250 » / « 1,250 » / « 1.250 »). */
export function currentLocale() {
  return getLanguageInfo().locale;
}

/** Langue enregistrée (français par défaut). */
export function readStoredLanguage() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return LANGUAGES.some((language) => language.id === stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function storeLanguage(id) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, id);
  } catch { /* stockage indisponible : la langue vaut pour cette visite */ }
}

const LOADERS = Object.freeze({
  en: () => import('./en.js'),
  es: () => import('./es.js'),
});

/**
 * Active une langue (charge son dictionnaire) et l'enregistre. Renvoie la langue active.
 * `dictionary` : dictionnaire fourni directement (tests).
 */
export async function setLanguage(id, { store = true, dictionary = null } = {}) {
  const language = LANGUAGES.some((l) => l.id === id) ? id : DEFAULT_LANGUAGE;
  const strings = dictionary ?? (language === DEFAULT_LANGUAGE ? {} : (await LOADERS[language]()).STRINGS);
  loadDictionary(strings);
  current = language;
  if (store) storeLanguage(language);
  if (globalThis.document?.documentElement) document.documentElement.lang = getLanguageInfo().htmlLang;
  return current;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LETTERS = /\p{L}/gu;

function loadDictionary(strings) {
  exact = new Map();
  patterns = [];
  cache.clear();
  for (const [source, target] of Object.entries(strings ?? {})) {
    if (typeof target !== 'string' || !target) continue;
    if (!/\{\d+\}/.test(source)) {
      exact.set(source, target);
      continue;
    }
    const pieces = source.split(/\{(\d+)\}/);
    // pieces : [littéral, n°, littéral, n°, …]
    let regex = '^';
    const order = [];
    for (let i = 0; i < pieces.length; i++) {
      if (i % 2 === 0) regex += escapeRegex(pieces[i]);
      else {
        // Deux trous séparés par un simple espace (« {0} {1} le combat ») : le premier prend le
        // plus possible (un nom de club), le second le dernier mot (un verbe).
        const next = pieces[i + 1] ?? '';
        const after = pieces[i + 3] ?? '';
        regex += /^\s+$/.test(next) && /\p{L}/u.test(after) ? '([\\s\\S]*)' : '([\\s\\S]*?)';
        order.push(Number(pieces[i]));
      }
    }
    regex += '$';
    const literalText = pieces.filter((_, i) => i % 2 === 0).join('');
    const letters = (literalText.match(LETTERS) ?? []).length;
    // Une phrase à trous sans aucune lettre (« {0} · {1} ») attraperait n'importe quoi : ignorée.
    if (letters < 1) continue;
    const anchor = pieces.filter((_, i) => i % 2 === 0).sort((a, b) => b.length - a.length)[0];
    // « Faible » : peu de texte fixe (« {0} sur {1} ») ; elle n'est essayée qu'en dernier.
    patterns.push({ regex: new RegExp(regex), order, target, literal: literalText.length, anchor, weak: letters < 5, joins: literalText.includes(' · ') });
  }
  // Les plus précises d'abord.
  patterns.sort((a, b) => b.literal - a.literal);
}

/** Remplit une traduction à trous : {n} et {n?si non vide:sinon}. */
function fill(target, values) {
  return target
    .replace(/\{(\d+)\?([^:{}]*):([^{}]*)\}/g, (_, n, yes, no) => (values[Number(n)] ? yes : no))
    .replace(/\{(\d+)\}/g, (_, n) => values[Number(n)] ?? '');
}

// Un morceau resté en français (plusieurs mots, signes du français) : une phrase à trous qui
// l'aurait capturé ne correspond pas vraiment, on essaie autre chose.
const FRENCH_HINT = /[èêàùûôîçœâ]|(^|[\s’'])(le|la|les|des|du|une|est|pour|avec|sur|dans|aux|au|et|ou|ne|pas|son|sa|ses|vos|votre|il|elle)(?=[\s’',.]|$)/i;
const FRENCH_HINTS = new RegExp(FRENCH_HINT.source, 'gi');
const looksFrench = (text) => text.trim().split(/\s+/).length >= 5 && (text.match(FRENCH_HINTS) ?? []).length >= 2;

function applyPattern(pattern, text, depth) {
  if (pattern.anchor && !text.includes(pattern.anchor)) return null;
  const match = pattern.regex.exec(text);
  if (!match) return null;
  const values = [];
  for (let i = 0; i < pattern.order.length; i++) {
    const raw = match[i + 1];
    // Un trou qui avale un « · » relie en fait deux textes assemblés par le code : pas ce modèle.
    if (!pattern.joins && raw.includes(' · ')) return null;
    const translated = depth < 4 ? translateText(raw, depth + 1) : raw;
    if (translated === raw && looksFrench(raw)) return null;
    values[pattern.order[i]] = translated;
  }
  return fill(pattern.target, values);
}

function translateCore(text, depth, { weak = false, exactOnly = false } = {}) {
  if (exact.has(text)) return exact.get(text);
  if (exactOnly) return null;
  for (const pattern of patterns) {
    if (pattern.weak !== weak) continue;
    const result = applyPattern(pattern, text, depth);
    if (result !== null) return result;
  }
  return null;
}

// Morceaux assemblés par le code : séparés un par un (et le mot de liaison traduit).
const SEPARATORS = Object.freeze([
  [' · ', null], [' — ', null], [' – ', null], [' | ', null], ['\n', null],
  [' : ', { en: ': ', es: ': ' }], [' ; ', { en: '; ', es: '; ' }], [', ', null],
  [' et ', { en: ' and ', es: ' y ' }], [' ou ', { en: ' or ', es: ' o ' }],
]);
// Bords : icônes, flèches, puces, ponctuation, espaces (tout sauf lettres et chiffres).
const EDGE = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u;
// « Texte (précision) » : les deux parties traduites séparément.
const PARENS = /^([\s\S]+?) \(([^()]+)\)$/;

// Petite étiquette devant le texte : « (HAS) frappe à 2 cases… ».
const TAG_PREFIX = /^(\s*\([^()]{1,8}\)\s+)([\s\S]+)$/;

function tryEdges(text, depth, options) {
  const tagged = TAG_PREFIX.exec(text);
  if (tagged) {
    const rest = translateCore(tagged[2], depth, options) ?? tryEdges(tagged[2], depth, options);
    if (rest !== null) return tagged[1] + rest;
  }
  const edge = EDGE.exec(text);
  if (!edge || !(edge[1] || edge[3]) || !edge[2]) return null;
  // D'abord sans l'icône de tête seulement (la ponctuation finale fait souvent partie du texte).
  if (edge[1] && edge[3]) {
    const withEnd = translateCore(edge[2] + edge[3], depth, options);
    if (withEnd !== null) return edge[1] + withEnd;
  }
  const inner = translateCore(edge[2], depth, options);
  return inner === null ? null : edge[1] + inner + edge[3];
}

/** Français restant dans un texte (pour choisir le meilleur découpage). */
function frenchLeft(text) {
  return (text.match(FRENCH_HINTS) ?? []).length;
}

/**
 * Traduction d'un texte français dans la langue active (le texte lui-même s'il est inconnu :
 * nom propre, nombre, texte déjà traduit). Ordre : texte exact, phrases à trous, bords retirés,
 * morceaux séparés, parenthèses, puis les phrases à trous « faibles ».
 */
export function translateText(text, depth = 0) {
  if (current === DEFAULT_LANGUAGE || typeof text !== 'string' || !text) return text;
  const cached = cache.get(text);
  if (cached !== undefined) return cached;
  // Le texte exact (icônes de bord comprises ou non) passe avant les phrases à trous.
  let result = translateCore(text, depth, { exactOnly: true }) ?? tryEdges(text, depth, { exactOnly: true })
    ?? translateCore(text, depth) ?? tryEdges(text, depth);
  if (result === null && depth < 6) {
    // Texte assemblé par le code : plusieurs découpages possibles (phrases accolées, « Étiquette :
    // suite », séparateurs) ; on garde celui qui laisse le moins de français.
    const candidates = [];
    const sentences = text.split(/(?<=[.!?…])\s+(?=\p{Lu})/u);
    if (sentences.length > 1) candidates.push(sentences.map((sentence) => translateText(sentence, depth + 1)).join(' '));
    const labelled = /^([^:]{1,40}) : ([\s\S]+)$/.exec(text);
    if (labelled) candidates.push(`${translateText(labelled[1], depth + 1)}${current === 'fr' ? ' : ' : ': '}${translateText(labelled[2], depth + 1)}`);
    for (const [separator, joiners] of SEPARATORS) {
      if (!text.includes(separator)) continue;
      const parts = text.split(separator);
      const translated = parts.map((part) => translateText(part, depth + 1));
      // Un nom propre qui contient « et » (« La Rose et le Fer ») n'est pas coupé pour rien.
      if (translated.some((part, i) => part !== parts[i])) candidates.push(translated.join(joiners?.[current] ?? separator));
    }
    // Score : français restant d'abord, puis mots laissés tels quels.
    const words = (value) => value.split(/\s+/).map((word) => word.replace(/[^\p{L}]/gu, '')).filter(Boolean);
    const sourceWords = new Set(words(text));
    const score = (candidate) => frenchLeft(candidate) * 100 + words(candidate).filter((word) => sourceWords.has(word)).length;
    let best = null;
    for (const candidate of candidates) {
      if (candidate === text) continue;
      if (best === null || score(candidate) < score(best)) best = candidate;
    }
    result = best;
  }
  if (result === null && depth < 6) {
    const parens = PARENS.exec(text);
    if (parens) {
      const head = translateText(parens[1], depth + 1);
      const inner = translateText(parens[2], depth + 1);
      if (head !== parens[1] || inner !== parens[2]) result = `${head} (${inner})`;
    }
  }
  if (result === null) result = translateCore(text, depth, { weak: true }) ?? tryEdges(text, depth, { weak: true });
  if (result === null) result = text;
  if (cache.size > 20000) cache.clear();
  cache.set(text, result);
  return result;
}

/** Raccourci : t('Texte français') → texte de la langue active. */
export const t = translateText;

// --- Interface HTML ---------------------------------------------------------------------

const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt'];
const written = new WeakMap(); // nœud → texte que nous y avons écrit (pour ne pas le retraduire)
let observer = null;

function translateNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentNode;
    if (!parent || parent.nodeName === 'SCRIPT' || parent.nodeName === 'STYLE' || parent.closest?.('[data-no-translate]')) return;
    const value = node.data;
    if (written.get(node) === value || !/\p{L}/u.test(value)) return;
    const next = translateText(value);
    if (next !== value) {
      written.set(node, next);
      node.data = next;
    }
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  // data-no-translate : sous-arbre laissé tel quel (saisie du joueur, noms…).
  if (node.hasAttribute?.('data-no-translate') || node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE') return;
  if (node.nodeType === Node.ELEMENT_NODE) translateAttributes(node);
  for (const child of node.childNodes) translateNode(child);
}

function translateAttributes(element) {
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute?.(name);
    if (!value || !/\p{L}/u.test(value)) continue;
    const next = translateText(value);
    if (next !== value) element.setAttribute(name, next);
  }
}

/**
 * Traduit tout ce qui apparaît dans la page (et ce qui y apparaîtra) dans la langue active.
 * Sans effet en français.
 */
export function installDomTranslation(root = globalThis.document?.body) {
  if (!root || observer) return;
  observer = new MutationObserver((mutations) => {
    if (current === DEFAULT_LANGUAGE) return;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') translateNode(mutation.target);
      else if (mutation.type === 'attributes') translateAttributes(mutation.target);
      else for (const node of mutation.addedNodes) translateNode(node);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
  if (current !== DEFAULT_LANGUAGE) translateNode(root);
}

let originalTitle = null;

/** Retraduit toute la page (changement de langue) et le titre de l'onglet. */
export function translateDocument(root = globalThis.document?.body) {
  if (root && current !== DEFAULT_LANGUAGE) translateNode(root);
  if (globalThis.document) {
    originalTitle ??= document.title;
    document.title = translateText(originalTitle);
  }
}

// --- Texte dessiné sur les cartes (canvas) -------------------------------------------------

let canvasPatched = false;

/** Les étiquettes dessinées (fillText / strokeText / measureText) passent par la traduction. */
export function installCanvasTranslation() {
  const proto = globalThis.CanvasRenderingContext2D?.prototype;
  if (!proto || canvasPatched) return;
  canvasPatched = true;
  for (const method of ['fillText', 'strokeText', 'measureText']) {
    const original = proto[method];
    proto[method] = function translated(text, ...rest) {
      return original.call(this, current === DEFAULT_LANGUAGE || typeof text !== 'string' ? text : translateText(text), ...rest);
    };
  }
}
