import { TAVERN_CONFIG, TAVERN_LEVELS } from '../../data/tavern.js';

// Lecture de la configuration des niveaux de la Taverne (data/tavern.js). Rien d'autre ne
// connaît les coûts ni les plages d'étoiles.

export const MAX_TAVERN_LEVEL = TAVERN_LEVELS.at(-1).level;

/** Définition d'un niveau ({ level, cost, minStars, maxStars }), bornée aux niveaux connus. */
export function getTavernLevelDef(level) {
  const wanted = Math.max(TAVERN_LEVELS[0].level, Math.min(MAX_TAVERN_LEVEL, Math.floor(Number(level) || TAVERN_CONFIG.startLevel)));
  return TAVERN_LEVELS.find((def) => def.level === wanted) ?? TAVERN_LEVELS[0];
}

/** Plage d'étoiles d'un niveau : { minStars, maxStars }. */
export function getStarRangeForLevel(level) {
  const { minStars, maxStars } = getTavernLevelDef(level);
  return { minStars, maxStars };
}

/** « 1,5★ » — étoiles d'une plage, en toutes lettres pour les textes. */
export function formatStarCount(stars) {
  return `${String(stars).replace('.', ',')}★`;
}

/** « entre 1,5★ et 2,5★ ». */
export function formatStarRange({ minStars, maxStars }) {
  return `entre ${formatStarCount(minStars)} et ${formatStarCount(maxStars)}`;
}

/**
 * Barème des prix en toutes lettres ([{ stars, price }], price null : selon sa valeur) :
 * « jusqu’à 2★, selon sa valeur ; 2,5★ : 150 deniers ; 3★ : 350 deniers ».
 */
export function formatPriceTable(table, formatDeniers = (n) => `${n} deniers`) {
  const byValue = table.filter((row) => row.price === null);
  const fixed = table.filter((row) => row.price !== null);
  const parts = [];
  if (byValue.length) parts.push(`jusqu’à ${formatStarCount(byValue.at(-1).stars)}, selon sa valeur`);
  for (const row of fixed) parts.push(`${formatStarCount(row.stars)} : ${formatDeniers(row.price)}`);
  return parts.join(' ; ');
}
