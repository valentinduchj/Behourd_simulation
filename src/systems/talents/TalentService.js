import { TALENTS, TALENT_RARITIES, TALENT_RULES, TALENT_UNRANKED_STYLE } from '../../data/talents.js';
import { createRng } from '../../utils/random.js';
import { BASE_RARITY_ODDS } from '../../data/scriptorium.js';

// Talents des combattants — logique centralisée, sans interface (catalogue : data/talents.js).
//
// Un combattant porte la liste de ses talents RÉVÉLÉS (fighter.talents : identifiants, deux au plus,
// sans doublon : [premier, second], TALENT_RULES.maxPerFighter). L'état
// « en étude » n'est jamais un talent : il vient des études du Scriptorium (StudyService).
// Seuls les combattants du joueur et les recrues de la Taverne peuvent avoir un talent ; ceux
// des clubs de l'IA n'en ont jamais, ni par tirage ni par une interface.

const TALENTS_BY_ID = new Map(TALENTS.map((talent) => [talent.id, talent]));

export function listTalents() {
  return TALENTS;
}

export function getTalent(talentId) {
  return TALENTS_BY_ID.get(talentId) ?? null;
}

/** Famille d'un talent (ou null : pas encore décidée). */
export function getTalentRarity(talent) {
  return talent?.rarity ? TALENT_RARITIES[talent.rarity] ?? null : null;
}

/** Couleurs de l'étiquette d'un talent : celles de sa famille, sinon le style neutre. */
export function getTalentStyle(talent) {
  return getTalentRarity(talent) ?? TALENT_UNRANKED_STYLE;
}

/**
 * Le combattant peut-il avoir un talent ? Combattant du joueur, ou recrue de la Taverne (sans
 * équipe). Un combattant d'un club de l'IA : jamais.
 */
export function canHaveTalents(session, fighter) {
  if (!fighter) return false;
  if (fighter.teamId === null || fighter.teamId === undefined) return true;
  return Boolean(session?.player) && fighter.teamId === session.player.teamId;
}

/** Talents révélés d'un combattant (définitions du catalogue, identifiants inconnus ignorés). */
export function getFighterTalents(session, fighter) {
  if (!canHaveTalents(session, fighter)) return [];
  return (fighter.talents ?? []).map(getTalent).filter(Boolean);
}

export function hasTalent(session, fighter) {
  return getFighterTalents(session, fighter).length > 0;
}

/** Le combattant peut-il encore recevoir un talent (place libre, combattant autorisé) ? */
export function canReceiveTalent(session, fighter) {
  return canHaveTalents(session, fighter) && getFighterTalents(session, fighter).length < TALENT_RULES.maxPerFighter;
}

/** Tirage pondéré dans une liste (poids `weight`). */
function weighted(pool, rng) {
  if (!pool.length) return null;
  const total = pool.reduce((sum, talent) => sum + talent.weight, 0);
  let roll = rng() * total;
  return pool.find((talent) => (roll -= talent.weight) < 0) ?? pool[pool.length - 1];
}

/** Talent tiré parmi ceux d'une source ('tavern', 'study'), selon leurs poids (`exclude` : identifiants écartés). */
export function rollTalent(source, rng = Math.random, { exclude = [] } = {}) {
  return weighted(TALENTS.filter((talent) => talent.sources.includes(source) && talent.weight > 0 && !exclude.includes(talent.id)), rng);
}

/** Famille tirée selon des chances { common, rare, epic } (total : 1). */
export function rollRarity(odds, rng = Math.random) {
  let roll = rng();
  const entries = Object.entries(odds);
  for (const [rarity, chance] of entries) {
    roll -= chance;
    if (roll < 0) return rarity;
  }
  return entries[entries.length - 1][0];
}

/**
 * Talent d'une famille, pour une source. Si la famille n'a encore aucun talent (catalogue en
 * construction), repli sur les talents de la source dont la famille n'est pas encore décidée,
 * puis sur tous ceux de la source. Renvoie { talent, fallback } (fallback : repli utilisé).
 * `exclude` : identifiants jamais tirés (le talent que le combattant garde : pas de doublon).
 */
export function pickTalentOfRarity(source, rarity, rng = Math.random, { exclude = [] } = {}) {
  const ofSource = TALENTS.filter((talent) => talent.sources.includes(source) && talent.weight > 0 && !exclude.includes(talent.id));
  const exact = weighted(ofSource.filter((talent) => talent.rarity === rarity), rng);
  if (exact) return { talent: exact, fallback: false };
  const unranked = weighted(ofSource.filter((talent) => !talent.rarity), rng);
  return { talent: unranked ?? weighted(ofSource, rng), fallback: true };
}

/**
 * Révélation d'un talent selon des chances de familles : famille tirée, puis talent de cette
 * famille. Renvoie { rarity, talent, fallback }. `exclude` : voir pickTalentOfRarity.
 */
export function rollTalentWithOdds(source, odds, rng = Math.random, { exclude = [] } = {}) {
  const rarity = rollRarity(odds, rng);
  return { rarity, ...pickTalentOfRarity(source, rarity, rng, { exclude }) };
}

/**
 * Place un talent sur un combattant. `slot` : 0 (premier) ou 1 (second) — le talent de cette
 * place est REMPLACÉ ; null : ajouté à la première place libre. Refusé : combattant de l'IA,
 * talent inconnu, plus de place (sans `slot`), talent déjà porté à l'autre place. Renvoie le
 * talent ou null.
 */
export function setFighterTalentAt(session, fighter, talentId, slot = null) {
  const talent = getTalent(talentId);
  if (!talent || !canHaveTalents(session, fighter)) return null;
  const talents = [...(fighter.talents ?? [])].filter((id) => getTalent(id));
  if (slot === null || slot >= talents.length) {
    if (talents.includes(talent.id) || talents.length >= TALENT_RULES.maxPerFighter) return null;
    talents.push(talent.id);
  } else {
    if (talents.some((id, index) => index !== slot && id === talent.id)) return null;
    talents[slot] = talent.id;
  }
  fighter.talents = talents;
  return talent;
}

/** Attribue un talent à un combattant qui a encore une place libre (sinon refusé). Renvoie le talent ou null. */
export function grantTalent(session, fighter, talentId) {
  if (!canReceiveTalent(session, fighter)) return null;
  return setFighterTalentAt(session, fighter, talentId, null);
}

/**
 * Talent éventuel d'une recrue de la Taverne : un tirage à TALENT_RULES.tavernChance, fait UNE
 * fois à sa génération et enregistré avec elle. Le tirage a sa propre graine (l'identifiant de la
 * candidature) : il ne change rien aux autres tirages de la rotation. Renvoie le talent ou null.
 */
export function rollTavernTalent(session, candidate, { rng = createRng(`talent:${candidate.id}`), chance = TALENT_RULES.tavernChance } = {}) {
  if (rng() >= chance) return null;
  // Famille tirée selon les chances de base (sans artefact : 80 / 19 / 1 %), puis un talent d'elle.
  const { talent } = rollTalentWithOdds('tavern', BASE_RARITY_ODDS, rng);
  return talent ? grantTalent(session, candidate.fighter, talent.id) : null;
}
