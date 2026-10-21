import { HOME_REWARD_BY_LICE_LEVEL, HOME_REWARD_CURRENCY, MATCH_LOCATIONS } from '../../data/homeAway.js';
import { addResource } from '../economy/wallet.js';
import { getLiceLevel } from '../lice/LiceUpgradeService.js';
import { randInt } from '../../utils/random.js';
import { homeRewardMultiplier, homeWinBonus, awayWinBonus } from '../talents/TalentEffects.js';

// Récompense d'une victoire de Ligue à domicile (HomeRewardManager) : deniers tirés selon le
// niveau de la lice du joueur (data/homeAway.js). Aucune valeur ici ; un nouveau niveau de lice
// s'ajoute dans la table sans toucher à ce service ni à la résolution du combat.

/**
 * Fourchette { min, max } du niveau de lice `level` : son entrée, sinon celle du plus haut
 * niveau défini en dessous ; null si aucune.
 */
export function getHomeRewardRange(level, table = HOME_REWARD_BY_LICE_LEVEL) {
  const levels = Object.keys(table).map(Number).filter((l) => l <= level).sort((a, b) => b - a);
  return levels.length ? table[levels[0]] : null;
}

/** Montant d'une victoire à domicile (0 : extérieur, défaite ou aucune fourchette). */
export function computeHomeReward({ location, won, liceLevel }, rng = Math.random, table = HOME_REWARD_BY_LICE_LEVEL) {
  if (location !== MATCH_LOCATIONS.HOME || !won) return 0;
  const range = getHomeRewardRange(liceLevel, table);
  return range ? randInt(rng, range.min, range.max) : 0;
}

/**
 * Verse la récompense d'un match de Ligue du joueur ; renvoie le montant (0 si rien).
 * Talents : Trésorier du roi (recette multipliée), Héros local (deniers en plus pour chacun de
 * ceux qui ont combattu, `participants`).
 */
export function awardHomeReward(session, { location, won, participants = [] }, rng = Math.random) {
  const base = computeHomeReward({ location, won, liceLevel: getLiceLevel(session) }, rng);
  // Quêteur (v1.2) : une victoire à l'extérieur rapporte aussi, à ceux qui y ont combattu.
  const awayBonus = won && location === MATCH_LOCATIONS.AWAY ? awayWinBonus(participants) : 0;
  const amount = base > 0 ? Math.round(base * homeRewardMultiplier(session)) + homeWinBonus(participants) : awayBonus;
  if (amount > 0) addResource(session, HOME_REWARD_CURRENCY, amount);
  return amount;
}
