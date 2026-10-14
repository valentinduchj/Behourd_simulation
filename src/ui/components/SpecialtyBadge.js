import { h } from '../../utils/dom.js';
import { ELITE_CONFIG } from '../../data/ratings.js';
import { gameState } from '../../state/gameState.js';
import { isElite } from '../../systems/rating/EliteService.js';

export function SpecialtyBadge(specialty) {
  if (!specialty) return h('span', { class: 'badge' }, 'Spécialité inconnue');
  return h(
    'span',
    { class: 'badge specialty-badge', style: { '--spec-color': specialty.color }, title: specialty.shortDescription },
    h('span', { class: 'specialty-icon', 'aria-hidden': 'true' }, specialty.icon),
    specialty.name,
  );
}

/**
 * Étiquette « Elite » (noire), affichée seulement si le combattant fait partie en ce moment des
 * 16 meilleurs des Ligues (EliteService) ; sinon rien (null). session : partie en cours par défaut.
 */
export function EliteBadge(fighter, session = gameState.session) {
  if (!isElite(session, fighter)) return null;
  return h('span', { class: 'badge elite-badge', title: `Elite : parmi les ${ELITE_CONFIG.count} meilleurs combattants des Ligues 1, 2 et 3` }, ELITE_CONFIG.label);
}

/** Étiquettes de classe d'un combattant : [Elite] [Classe], l'étiquette Elite à gauche de la classe. */
export function FighterClassTags(fighter, session = gameState.session) {
  return [EliteBadge(fighter, session), SpecialtyBadge(fighter.specialty)].filter(Boolean);
}
