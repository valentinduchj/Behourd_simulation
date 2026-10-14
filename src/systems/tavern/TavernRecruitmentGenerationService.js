import { TAVERN_CONFIG } from '../../data/tavern.js';
import { RATING_CONFIG } from '../../data/ratings.js';
import { LEVEL_STAT_IDS, getStatDefinition } from '../../data/stats.js';
import { pick, randInt } from '../../utils/random.js';
import { generateFighter } from '../generation/FighterGenerator.js';
import { calculateFighterLevel, getStarRating } from '../fighters/ratings.js';

// Génération des recrues de la Taverne selon une plage d'étoiles (niveau de la Taverne).
// Le niveau et les étoiles passent par le système central (RatingService) : la recrue a
// toujours, réellement, un nombre d'étoiles compris dans la plage demandée.

/** Valeurs d'étoiles (par demi-étoile) comprises dans [minStars, maxStars], d'après le barème. */
export function starStepsInRange({ minStars, maxStars }) {
  return RATING_CONFIG.starScale.map((band) => band.stars).filter((stars) => stars >= minStars && stars <= maxStars);
}

/**
 * Tranche de niveau d'un nombre d'étoiles : ]low, high] (barème de data/ratings.js).
 * Ex. 1★ : ]10, 16].
 */
export function levelBandForStars(stars) {
  const scale = RATING_CONFIG.starScale;
  const index = scale.findIndex((band) => band.stars === stars);
  if (index < 0) throw new Error(`Aucune tranche de niveau pour ${stars} étoiles.`);
  return { low: index === 0 ? -0.25 : scale[index - 1].max, high: scale[index].max };
}

/**
 * Compétences de niveau dont la moyenne vaut exactement `total / n` : réparties également,
 * puis quelques échanges aléatoires entre deux compétences (la somme ne change pas).
 */
export function spreadSkills(total, rng = Math.random, { spread = TAVERN_CONFIG.statSpread, shuffles = TAVERN_CONFIG.statShuffles } = {}) {
  const ids = LEVEL_STAT_IDS;
  const base = Math.floor(total / ids.length);
  const values = ids.map((_, i) => base + (i < total - base * ids.length ? 1 : 0));
  for (let k = 0; k < shuffles; k++) {
    const from = randInt(rng, 0, ids.length - 1);
    const to = (from + randInt(rng, 1, ids.length - 1)) % ids.length;
    const maxFrom = values[from] - getStatDefinition(ids[from]).min;
    const maxTo = getStatDefinition(ids[to]).max - values[to];
    const amount = Math.min(randInt(rng, 0, spread), maxFrom, maxTo);
    values[from] -= amount;
    values[to] += amount;
  }
  return Object.fromEntries(ids.map((id, i) => [id, values[i]]));
}

/**
 * Recrue de la Taverne dont les étoiles tombent dans `starRange` ({ minStars, maxStars }) :
 * étoiles tirées parmi la plage, niveau tiré dans leur tranche, compétences réparties
 * autour. Le reste (nom, sprite, âge, potentiel, PV, fatigue) suit la génération habituelle.
 */
export function generateTavernRecruit({ specialtyId, name, starRange, rng = Math.random, day = 1 }) {
  const fighter = generateFighter({ specialtyId, name, rng, day });
  const steps = starStepsInRange(starRange);
  if (!steps.length) return fighter;
  const stars = pick(rng, steps);
  const { low, high } = levelBandForStars(stars);
  const n = LEVEL_STAT_IDS.length;
  // Niveau = somme / n : on tire une somme dont la moyenne tombe dans ]low, high].
  const total = randInt(rng, Math.floor(low * n) + 1, Math.floor(high * n));
  Object.assign(fighter.stats, spreadSkills(total, rng));
  // Garde-fou : le système central d'étoiles fait foi.
  const rating = getStarRating(calculateFighterLevel(fighter));
  if (rating < starRange.minStars || rating > starRange.maxStars) throw new Error(`Recrue hors plage : ${rating}★`);
  return fighter;
}
