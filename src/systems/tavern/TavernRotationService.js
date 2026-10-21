import { RECRUITMENT_CONFIG } from '../../data/recruitment.js';
import { SPECIALTY_IDS } from '../../data/specialties.js';
import { createId } from '../../utils/id.js';
import { pick, randInt } from '../../utils/random.js';
import { firstNameOf, generateFighterNames } from '../generation/NameGenerator.js';
import { calculateFighterLevel, getStarRating } from '../fighters/ratings.js';
import { getNextEvent } from '../calendar/CalendarService.js';
import { generateTavernRecruit, starStepsInRange } from './TavernRecruitmentGenerationService.js';
import { getNextRotationStarRange } from './TavernUpgradeService.js';
import { TAVERN_LEVELS } from '../../data/tavern.js';
import { rollTavernTalent } from '../talents/TalentService.js';

// Rotation de la Taverne : QUAND l'offre change (création de la partie, puis l'événement
// hebdomadaire du calendrier, data/calendar.js). QUELLES recrues apparaissent dépend du
// niveau de la Taverne au moment de la rotation (TavernRecruitmentGenerationService).
// L'offre n'est jamais régénérée à l'ouverture de l'écran ni lors d'une amélioration.

/**
 * Prix d'une recrue (data/recruitment.js), calculé une seule fois, à son arrivée, d'après SES
 * ÉTOILES (le niveau de la Taverne n'y change rien) :
 *   - étoiles débloquées par une amélioration : prix fixe du barème RECRUITMENT_CONFIG.starPrices
 *     (2,5★ : 150, 3★ : 350, 3,5★ : 600, 4★ : 1 250 deniers) ;
 *   - étoiles proposées dès le départ (jusqu'à 2★) : (niveau (arrondi) ± 10) × 2 deniers (v1.1.8).
 */
export function computeRecruitPrice(fighter, rng = Math.random) {
  const fixed = getRecruitPriceForStars(getStarRating(calculateFighterLevel(fighter)));
  if (fixed !== null) return fixed;
  const { min, max } = RECRUITMENT_CONFIG.priceVariation;
  const price = (Math.round(calculateFighterLevel(fighter)) + randInt(rng, min, max)) * (RECRUITMENT_CONFIG.startingPriceFactor ?? 1);
  return Math.max(RECRUITMENT_CONFIG.minimumPrice, price);
}

/** Premier niveau de la Taverne dont la plage atteint `stars` (celui qui les rend accessibles). */
export function getUnlockLevelForStars(stars) {
  return TAVERN_LEVELS.find((level) => level.maxStars >= stars) ?? TAVERN_LEVELS[TAVERN_LEVELS.length - 1];
}

/**
 * Prix d'une recrue de `stars` étoiles : un montant, ou null quand il dépend de la valeur du
 * combattant (étoiles déjà proposées par la Taverne de départ, sans coût d'amélioration).
 */
export function getRecruitPriceForStars(stars) {
  const price = RECRUITMENT_CONFIG.starPrices[stars];
  return price === undefined ? null : Math.max(RECRUITMENT_CONFIG.minimumPrice, price);
}

/**
 * Barème des prix pour une plage d'étoiles ({ minStars, maxStars }) : [{ stars, price }], une
 * ligne par demi-étoile (price null : selon la valeur du combattant).
 */
export function getRecruitPriceTable(range) {
  return starStepsInRange(range).map((stars) => ({ stars, price: getRecruitPriceForStars(stars) }));
}

/**
 * Génère une nouvelle offre de recrues (remplace l'offre précédente ; les recrues ramenées
 * d'expédition restent). Renvoie les nouveaux candidats.
 */
export function generateRecruitmentPool(session, rng = Math.random) {
  const gifts = session.recruitment.candidates.filter((candidate) => candidate.gift);
  const usedFirstNames = new Set([...session.playerFighters, ...gifts.map((c) => c.fighter)].map((fighter) => firstNameOf(fighter.name)));
  const names = generateFighterNames(RECRUITMENT_CONFIG.poolSize, rng, usedFirstNames);
  const starRange = getNextRotationStarRange(session);
  const candidates = names.map((name) => {
    const fighter = generateTavernRecruit({ specialtyId: pick(rng, SPECIALTY_IDS), name, starRange, rng, day: session.calendar.currentDay });
    const candidate = { id: createId('recruit'), fighter, cost: computeRecruitPrice(fighter, rng) };
    // Talent éventuel (10 %), tiré une fois et enregistré avec la recrue (graine propre).
    rollTavernTalent(session, candidate);
    return candidate;
  });
  session.recruitment.setCandidates([...gifts, ...candidates], session.calendar.currentDay);
  session.markDirty();
  return candidates;
}

/** Rotation hebdomadaire : nouveaux combattants, anciens remplacés. Renvoie l'événement du carnet. */
export function rotateTavern(session, rng = Math.random) {
  const candidates = generateRecruitmentPool(session, rng);
  return { type: 'tavern.rotation', count: candidates.length };
}

/** Prochaine rotation : { day, inDays } (jour de jeu), ou null si aucune n'est planifiée. */
export function getNextRotation(session) {
  const event = getNextEvent(session.calendar, 'tavern');
  return event ? { day: event.day, inDays: event.day - session.calendar.currentDay } : null;
}
