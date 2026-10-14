import { LEVEL_STAT_IDS } from '../../data/stats.js';
import { RATING_CONFIG } from '../../data/ratings.js';
import { getStat } from '../fighters/stats.js';

// Source UNIQUE de vérité des niveaux et des étoiles : combattants du joueur, combattants
// de l'IA, club du joueur et clubs de l'IA passent tous par ces fonctions.
//
//   attributs → niveau du combattant → étoiles du combattant
//   8 meilleurs niveaux → niveau du club → étoiles du club
//
// Rien de tout cela n'est enregistré : niveaux et étoiles sont recalculés à chaque
// lecture depuis les données sources (attributs, scores, effectifs). Les valeurs
// numériques sont internes : le joueur ne voit que des étoiles.

/**
 * Niveau d'un combattant, entre 0 et 100, non arrondi :
 * - la moyenne de ses 4 attributs (Lutte, Force d'arme d'hast, Percussion, Endurance),
 *   sans les PV ni la fatigue ;
 * - pour un combattant d'un club de l'IA défini par un `score` (data/leagues/*.json),
 *   ce score tient lieu de niveau.
 */
export function calculateFighterLevel(fighter) {
  if (typeof fighter.score === 'number') return fighter.score;
  if (!LEVEL_STAT_IDS.length) return 0;
  const total = LEVEL_STAT_IDS.reduce((sum, statId) => sum + getStat(fighter, statId), 0);
  return total / LEVEL_STAT_IDS.length;
}

/** Les N meilleurs combattants, triés par niveau décroissant : [{ fighter, level }]. */
export function selectTopFighters(fighters, count = RATING_CONFIG.clubTopCount) {
  return [...fighters]
    .map((fighter) => ({ fighter, level: calculateFighterLevel(fighter) }))
    .sort((a, b) => b.level - a.level)
    .slice(0, count);
}

/**
 * Niveau d'un club : moyenne des niveaux de ses N meilleurs combattants (N = 8).
 * Avec moins de N combattants, la moyenne porte sur ceux disponibles.
 */
export function calculateClubLevel(fighters) {
  const top = selectTopFighters(fighters);
  if (!top.length) return 0;
  return top.reduce((sum, entry) => sum + entry.level, 0) / top.length;
}

/** Niveau (0–100) → étoiles (0, 0,5, 1 … 5), selon le barème de data/ratings.js. */
export function getStarRating(level) {
  for (const band of RATING_CONFIG.starScale) {
    if (level <= band.max) return band.stars;
  }
  return RATING_CONFIG.maxStars;
}
