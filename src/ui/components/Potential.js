import { h } from '../../utils/dom.js';
import { POTENTIAL_CONFIG } from '../../data/fighterProfile.js';
import { getPotential } from '../../systems/fighters/PotentialService.js';

/**
 * Potentiel d'un combattant : jauge de 3 flammes, les flammes obtenues allumées
 * (0 : aucune flamme allumée). Aucune règle ici : la valeur vient de PotentialService.
 */
export function PotentialFlames(fighter, { className = '' } = {}) {
  const potential = getPotential(fighter);
  const max = POTENTIAL_CONFIG.max;
  return h(
    'span',
    {
      class: `potential-flames ${className}`.trim(), role: 'img', 'data-potential': String(potential),
      'aria-label': `Potentiel : ${potential ? `${potential} flamme${potential > 1 ? 's' : ''}` : 'aucune flamme'} sur ${max}`,
    },
    Array.from({ length: max }, (_, i) => h('span', { class: `flame ${i < potential ? 'is-lit' : ''}`.trim(), 'aria-hidden': 'true' }, '🔥')),
  );
}

/**
 * Plafond de progression des compétences, fixé par le potentiel : libellé (« élevé »…), affiché à
 * côté des flammes, jamais le chiffre. Valeurs : data/fighterProfile.js (skillCaps, skillCapLabels).
 */
export function PotentialCap(fighter) {
  const potential = getPotential(fighter);
  const label = POTENTIAL_CONFIG.skillCapLabels[potential] ?? '';
  return h(
    'span',
    { class: 'potential-cap', title: 'Ses compétences ne progressent plus au-delà de ce plafond (zone hachurée des barres). Il suit le potentiel.' },
    '· plafond ',
    h('span', { class: 'potential-cap-label' }, label),
  );
}

/** « 21 ans » (ou rien si l'âge n'est pas défini). */
export function formatAge(age) {
  return age === null || age === undefined ? '' : `${age} ans`;
}
