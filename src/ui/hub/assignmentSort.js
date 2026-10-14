import { STAT_DEFINITIONS } from '../../data/stats.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';

// Tri du tableau « Affectations » du Centre (présentation seulement : l'ordre de l'effectif
// n'est pas modifié). Un clic sur un en-tête trie par cette colonne ; un second clic inverse.
// Colonnes de texte : A → Z d'abord ; colonnes chiffrées : de la plus haute valeur à la plus basse.
// Le tri choisi est gardé le temps de la partie (jours qui passent, affectations).

const byText = (value) => ({ type: 'text', value });
const byNumber = (value) => ({ type: 'number', value });

export const ASSIGNMENT_SORT_COLUMNS = Object.freeze([
  { key: 'name', label: 'Combattant', ...byText((f) => f.name) },
  { key: 'specialty', label: 'Spécialité', ...byText((f) => f.specialty?.name ?? '') },
  { key: 'level', label: 'Niveau', ...byNumber((f) => calculateFighterLevel(f)) },
  ...STAT_DEFINITIONS.map((def) => ({ key: def.id, label: def.short, title: def.label, ...byNumber((f) => f.stats[def.id] ?? def.base ?? 0) })),
]);

const COLUMNS_BY_KEY = new Map(ASSIGNMENT_SORT_COLUMNS.map((column) => [column.key, column]));
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

let current = { key: null, direction: null };

/** Tri en cours : { key, direction: 'asc' | 'desc' } (key null : ordre de l'effectif). */
export function getAssignmentSort() {
  return { ...current };
}

/** Clic sur une colonne : tri par cette colonne, ou inversion si elle est déjà triée. */
export function toggleAssignmentSort(key) {
  const column = COLUMNS_BY_KEY.get(key);
  if (!column) return getAssignmentSort();
  if (current.key === key) current = { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  else current = { key, direction: column.type === 'text' ? 'asc' : 'desc' };
  return getAssignmentSort();
}

export function resetAssignmentSort() {
  current = { key: null, direction: null };
}

/** Combattants triés (copie) ; à égalité, par nom. */
export function sortFighters(fighters, { key, direction } = current) {
  const column = COLUMNS_BY_KEY.get(key);
  if (!column) return [...fighters];
  const sign = direction === 'desc' ? -1 : 1;
  const compare = column.type === 'text'
    ? (a, b) => collator.compare(column.value(a), column.value(b))
    : (a, b) => column.value(a) - column.value(b);
  return [...fighters].sort((a, b) => sign * compare(a, b) || collator.compare(a.name, b.name));
}
