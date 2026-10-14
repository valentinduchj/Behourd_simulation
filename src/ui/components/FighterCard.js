import { h } from '../../utils/dom.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { FighterSprite } from './FighterSprite.js';
import { SpecialtyBadge, FighterClassTags } from './SpecialtyBadge.js';
import { StatList } from './StatList.js';
import { ActivityChip } from './ActivitySelect.js';
import { FighterStars } from './Rating.js';
import { FighterName } from './CaptainCrown.js';
import { TalentBadges } from './TalentBadge.js';

export function FighterCard(fighter, team, { onOpen } = {}) {
  const open = () => onOpen?.(fighter);
  return h(
    'article',
    {
      class: 'fighter-card',
      tabindex: '0',
      role: 'button',
      'aria-label': `Ouvrir la fiche de ${fighter.name}`,
      style: { '--spec-color': fighter.specialty?.color },
      onclick: open,
      onkeydown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      },
    },
    h(
      'div',
      { class: 'fighter-card-head' },
      FighterSprite(fighter, { size: 60, team }),
      h(
        'div',
        { class: 'fighter-card-identity' },
        h('h4', { class: 'fighter-name' }, FighterName(fighter)),
        h('div', { class: 'fighter-card-tags' }, ...FighterClassTags(fighter), FighterStars(calculateFighterLevel(fighter))),
      ),
    ),
    StatList(fighter, { compact: true }),
    // État actuel (activité, repos, étude), puis le talent révélé à sa droite (aucun sinon).
    h('div', { class: 'fighter-card-footer' }, ActivityChip(fighter), ...TalentBadges(fighter)),
  );
}
