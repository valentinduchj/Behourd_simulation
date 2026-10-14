import { h } from '../../utils/dom.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { FighterSprite } from './FighterSprite.js';
import { SpecialtyBadge, FighterClassTags } from './SpecialtyBadge.js';
import { StatList } from './StatList.js';
import { FighterStars } from './Rating.js';
import { FighterName } from './CaptainCrown.js';
import { fatigueLevelClass, fatigueText } from '../../systems/fighters/FatigueService.js';

/**
 * Carte sélectionnable d'un combattant du joueur (sélection pour un combat).
 * Affiche toutes ses informations, fatigue mise en avant.
 * `unavailable` : raison d'indisponibilité (ex. étude au Scriptorium) — carte grisée, non
 * sélectionnable (sauf pour la retirer si elle l'était déjà) ; null : disponible.
 */
export function PickCard(fighter, team, { selected = false, disabled = false, onToggle, unavailable = null } = {}) {
  const fatigue = fighter.stats.fatigue ?? 0;
  const fatigueLevel = fatigueLevelClass(fighter, fatigue);
  const blocked = (disabled || Boolean(unavailable)) && !selected;
  const toggle = () => { if (!blocked) onToggle?.(fighter); };
  return h(
    'article',
    {
      class: `pick-card ${selected ? 'is-selected' : ''} ${blocked ? 'is-disabled' : ''} ${unavailable ? 'is-unavailable' : ''}`.trim().replace(/\s+/g, ' '),
      role: 'checkbox',
      tabindex: blocked ? '-1' : '0',
      'aria-checked': String(selected),
      'aria-disabled': blocked ? 'true' : null,
      'aria-label': `${fighter.name}, fatigue ${fatigue}${unavailable ? `, ${unavailable}` : ''}`,
      title: unavailable,
      style: { '--spec-color': fighter.specialty?.color },
      onclick: toggle,
      onkeydown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      },
    },
    h('span', { class: 'pick-check', 'aria-hidden': 'true' }, selected ? '✔' : ''),
    h(
      'div',
      { class: 'fighter-card-head' },
      FighterSprite(fighter, { size: 52, team }),
      h(
        'div',
        { class: 'fighter-card-identity' },
        h('h4', { class: 'fighter-name' }, FighterName(fighter)),
        h('div', { class: 'fighter-card-tags' }, ...FighterClassTags(fighter), FighterStars(calculateFighterLevel(fighter))),
      ),
    ),
    unavailable
      ? h('p', { class: 'pick-unavailable' }, '📜 En étude au Scriptorium')
      : h('p', { class: `pick-fatigue ${fatigueLevel}` }, fatigueText(fighter, fatigue)),
    StatList(fighter, { compact: true }),
  );
}
