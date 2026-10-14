import { h } from '../../utils/dom.js';
import { FighterSprite } from './FighterSprite.js';
import { SpecialtyBadge, FighterClassTags } from './SpecialtyBadge.js';
import { FighterStars } from './Rating.js';
import { FighterName } from './CaptainCrown.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { fatigueLevelClass, fatigueText } from '../../systems/fighters/FatigueService.js';

// Carte compacte d'un combattant pendant le placement dans la Lice : la même pour nos combattants
// (colonne de gauche, cliquable) et pour les adversaires (colonne de droite, information seule).
// Présentation uniquement : l'écran fournit l'état et l'action.
//
//   side   'own' | 'enemy'
//   state  'available' (à placer) | 'selected' (en cours de placement) | 'placed' | 'waiting'
//          (tour de l'adversaire) ; 'last' pour l'adversaire qui vient d'être placé

function cardBody(fighter, { session, team, fatigue, statusText, effects = [], colorIntensity = 1 }) {
  return [
    FighterSprite(fighter, { size: 34, team, colorIntensity }),
    h(
      'span',
      { class: 'pfc-main' },
      h('span', { class: 'pfc-name placement-who' }, FighterName(fighter, { session }),
        ...effects.map((effect) => h('span', { class: 'effect-pill', title: effect.long }, effect.short))),
      h('span', { class: 'pfc-tags' }, ...FighterClassTags(fighter, session), FighterStars(calculateFighterLevel(fighter))),
      h(
        'span',
        { class: 'pfc-foot' },
        h('span', { class: `pick-fatigue placement-fatigue ${fatigueLevelClass(fighter, fatigue)}`, style: { '--fatigue': `${Math.min(100, Math.max(0, fatigue))}%` } }, fatigueText(fighter, fatigue)),
        h('span', { class: 'pfc-status muted' }, statusText),
      ),
    ),
  ];
}

/** Notre combattant : bouton (choisir qui placer), verrouillé une fois posé. */
export function PlacementFighterCard(fighter, { side = 'own', state = 'available', onSelect = null, ...rest }) {
  if (side === 'enemy') {
    return h(
      'li',
      {
        class: `placement-card placement-enemy ${state === 'placed' || state === 'last' ? 'is-placed' : ''} ${state === 'last' ? 'is-last' : ''}`.trim(),
        'data-fighter-id': fighter.id,
      },
      ...cardBody(fighter, rest),
    );
  }
  const locked = state === 'placed';
  return h('li', {}, h(
    'button',
    {
      type: 'button',
      class: `placement-card placement-item ${state === 'selected' ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`.trim(),
      'data-fighter-id': fighter.id,
      disabled: locked || state === 'waiting',
      'aria-pressed': String(state === 'selected'),
      onclick: () => onSelect?.(fighter.id),
    },
    ...cardBody(fighter, rest),
  ));
}
