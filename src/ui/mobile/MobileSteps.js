import { h } from '../../utils/dom.js';
import { isMobileLayout } from './mobileLayout.js';

// Entrée en jeu, interface mobile (v0.84) : les trois étapes de la création, rappelées en bas à
// gauche (Terre, Blason, Capitaine). null hors de l'interface mobile.

const STEPS = ['Terre', 'Blason', 'Capitaine'];

export function MobileSteps(current) {
  if (!isMobileLayout()) return null;
  return h('ol', { class: 'm-steps', 'aria-label': 'Étapes' }, STEPS.map((label, i) => h(
    'li',
    { class: `m-step ${i + 1 === current ? 'is-current' : ''} ${i + 1 < current ? 'is-done' : ''}`.replace(/\s+/g, ' ').trim(), 'aria-current': i + 1 === current ? 'step' : null },
    `${i + 1} · ${label}`,
  )));
}
