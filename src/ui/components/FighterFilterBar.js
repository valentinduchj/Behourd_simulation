import { h } from '../../utils/dom.js';
import {
  DEFAULT_FIGHTER_FILTER, getClassFilterOptions, getSortFilterOptions, isDefaultFilter,
} from '../../systems/fighters/FighterListFilter.js';

/**
 * Barre de filtres d'une liste de combattants : classe, tri, réinitialisation, et le compte des
 * combattants affichés. `onChange(filter)` reçoit le nouveau filtre ; la liste est réorganisée
 * par l'écran (FighterListFilter.organizeFighters), la sélection n'est jamais touchée.
 *   fatigue   proposer les tris par fatigue (pertinents avant un combat)
 *   shown     nombre de combattants correspondant au filtre ; total : effectif complet
 */
export function FighterFilterBar(filter, onChange, { fatigue = true, shown = null, total = null } = {}) {
  const current = { ...DEFAULT_FIGHTER_FILTER, ...filter };
  const select = (label, options, value, key) => h(
    'label',
    { class: 'fighter-filter-field' },
    h('span', { class: 'fighter-filter-label' }, label),
    h('select', {
      class: `select select-sm fighter-filter-${key}`,
      onchange: (event) => onChange({ ...current, [key]: event.target.value }),
    }, options.map((option) => h('option', { value: option.id, selected: option.id === value }, option.label))),
  );
  const filtered = !isDefaultFilter(current);
  return h(
    'div',
    { class: `fighter-filter-bar ${filtered ? 'is-filtered' : ''}`.trim(), role: 'group', 'aria-label': 'Filtrer et trier les combattants' },
    select('Classe', getClassFilterOptions(), current.classId, 'classId'),
    select('Trier par', getSortFilterOptions({ fatigue }), current.sortId, 'sortId'),
    h('button', {
      type: 'button', class: 'btn btn-sm fighter-filter-reset', disabled: !filtered,
      onclick: () => onChange({ ...DEFAULT_FIGHTER_FILTER }),
    }, 'Réinitialiser'),
    shown !== null && total !== null && filtered
      ? h('span', { class: 'fighter-filter-count muted' }, `${shown} affiché${shown > 1 ? 's' : ''} sur ${total}`)
      : null,
  );
}

/** Marque une carte sélectionnée qui ne correspond pas au filtre actif (« hors filtre »). */
export function markOutsideFilter(card) {
  card.classList.add('is-outside-filter');
  card.append(h('span', { class: 'pick-outside-badge', title: 'Sélectionné, mais hors du filtre actif' }, 'hors filtre'));
  return card;
}
