import { getLiceDecoration, listRandomDecorations } from '../../data/liceDecorations.js';
import { QUEEN_COMBAT } from '../../data/calendar.js';
import { QUEEN_COMBAT_CONFIG } from '../../data/queenCombat.js';
import { MATCH_LOCATIONS } from '../../data/homeAway.js';
import { getLiceArenaDecoration, getLiceSpectatorBonus } from '../../systems/lice/LiceService.js';
import { hashString } from '../../utils/random.js';

// Terrain d'un combat (CombatArenaManager) — présentation seulement, sans effet sur le combat :
//   Combat de la Reine         → sa lice dédiée (règle actuelle, indépendante du domicile) ;
//   Ligue, à domicile (HOME)   → la lice du joueur (LiceService.getLiceArenaDecoration) ;
//   Ligue, à l'extérieur (AWAY) et combats sans lieu → un décor ordinaire tiré de façon stable.

/**
 * Décor tiré (de façon stable) pour un combat ordinaire, selon les fréquences `weight`
 * des décors. Les décors réservés (ex. lice des Combats de la Reine) n'en font pas partie.
 */
export function chooseLiceDecoration(seed, decorations = listRandomDecorations()) {
  const total = decorations.reduce((sum, decoration) => sum + (decoration.weight ?? 1), 0);
  let roll = hashString(`decor:${seed}`) % total;
  return decorations.find((decoration) => (roll -= decoration.weight ?? 1) < 0) ?? decorations[0];
}

/** Décor du combat. decorationId : imposé (aperçu du Module Admin). */
export function selectArenaDecoration(session, { kind = null, location = null, seed, decorationId = null }) {
  if (decorationId) return getLiceDecoration(decorationId);
  if (kind === QUEEN_COMBAT) return getLiceDecoration(QUEEN_COMBAT_CONFIG.arenaDecorationId);
  if (location === MATCH_LOCATIONS.HOME && session) return getLiceArenaDecoration(session);
  return chooseLiceDecoration(seed);
}

/** Bonus d'affluence de la lice où se joue le combat : celle du joueur à domicile, aucun sinon. */
export function selectVenueBonus(session, { kind = null, location = null }) {
  return kind !== QUEEN_COMBAT && location === MATCH_LOCATIONS.HOME && session ? getLiceSpectatorBonus(session) : null;
}
