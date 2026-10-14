import { calculateClubLevel, calculateFighterLevel, getStarRating, selectTopFighters } from '../rating/RatingService.js';

// Effectif et niveau d'un club (joueur ou IA), toujours lus depuis la partie en cours :
// la note d'un club n'est jamais enregistrée, elle suit son effectif actuel.

export function getClubFighters(session, clubId) {
  return session.getFightersOfTeam(clubId);
}

/** Les N combattants les plus forts (niveau numérique), du plus fort au plus faible. */
export function getStrongestFighters(session, clubId, count) {
  return selectTopFighters(getClubFighters(session, clubId), count).map((entry) => entry.fighter);
}

/**
 * Combattant le plus faible, d'après le niveau numérique (jamais les étoiles, les PV ou
 * la fatigue). À égalité de niveau, le plus ancien dans l'effectif.
 */
export function getWeakestFighter(session, clubId) {
  const fighters = getClubFighters(session, clubId);
  let weakest = null;
  let weakestLevel = Infinity;
  for (const fighter of fighters) {
    const level = calculateFighterLevel(fighter);
    if (level < weakestLevel) {
      weakest = fighter;
      weakestLevel = level;
    }
  }
  return weakest;
}

/** Niveau actuel du club (8 meilleurs) et ses étoiles, recalculés à partir de l'effectif. */
export function recalculateLevel(session, clubId) {
  const level = calculateClubLevel(getClubFighters(session, clubId));
  return { level, stars: getStarRating(level) };
}
