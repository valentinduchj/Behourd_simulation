import { h } from '../../utils/dom.js';
import { isCaptain } from '../../systems/roster/CaptainService.js';

/** Couronne du capitaine : élément distinct, placé à droite du nom (le nom n'est pas modifié). */
export function CaptainCrown() {
  return h('span', { class: 'captain-crown', role: 'img', 'aria-label': 'Capitaine', title: 'Capitaine' }, '👑');
}

/**
 * Nom d'un combattant suivi de la couronne s'il est capitaine. Même affichage pour le
 * joueur et les clubs de l'IA. `session` : nécessaire pour les clubs de l'IA dont la
 * partie a désigné un nouveau capitaine (sinon, le statut du combattant fait foi).
 */
export function FighterName(fighter, { session = null, tag = 'span', className = '' } = {}) {
  return h(
    tag,
    { class: `fighter-name-line ${className}`.trim() },
    h('span', { class: 'fighter-name-text' }, fighter.name),
    isCaptain(session, fighter) ? CaptainCrown() : null,
  );
}
