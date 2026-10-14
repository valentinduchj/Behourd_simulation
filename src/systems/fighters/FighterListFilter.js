import { SPECIALTIES, SPECIALTY_IDS } from '../../data/specialties.js';
import { calculateFighterLevel } from './ratings.js';

// Filtres et tris d'une liste de combattants (sélection d'un combat, éditeur d'équipe).
// Ils ORGANISENT seulement l'affichage : la sélection n'est jamais modifiée. Aucune règle
// propre : niveau (RatingService), potentiel et fatigue sont lus sur le combattant.
//
// Filtre : { classId: 'all' | id de spécialité, sortId: 'roster' | id de FIGHTER_SORTS }.

export const ALL_CLASSES = 'all';
export const ROSTER_ORDER = 'roster';
export const DEFAULT_FIGHTER_FILTER = Object.freeze({ classId: ALL_CLASSES, sortId: ROSTER_ORDER });

const byName = (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
const fatigueOf = (fighter) => fighter.stats?.fatigue ?? 0;
// Un combattant sans potentiel connu passe après les autres (tri décroissant).
const potentialOf = (fighter) => (typeof fighter.potential === 'number' ? fighter.potential : -1);

/** Tris proposés ; `fatigue` : critère d'état, masqué là où il n'est pas pertinent (éditeur d'équipe). */
export const FIGHTER_SORTS = Object.freeze([
  Object.freeze({ id: 'levelDesc', label: 'Niveau décroissant', compare: (a, b) => calculateFighterLevel(b) - calculateFighterLevel(a) }),
  Object.freeze({ id: 'levelAsc', label: 'Niveau croissant', compare: (a, b) => calculateFighterLevel(a) - calculateFighterLevel(b) }),
  Object.freeze({ id: 'name', label: 'Nom (A → Z)', compare: byName }),
  Object.freeze({ id: 'potentialDesc', label: 'Potentiel décroissant', compare: (a, b) => potentialOf(b) - potentialOf(a) }),
  Object.freeze({ id: 'fatigueAsc', label: 'Fatigue croissante', fatigue: true, compare: (a, b) => fatigueOf(a) - fatigueOf(b) }),
  Object.freeze({ id: 'fatigueDesc', label: 'Fatigue décroissante', fatigue: true, compare: (a, b) => fatigueOf(b) - fatigueOf(a) }),
]);

/** Options de classe : « Toutes les classes », puis chaque spécialité du jeu (au pluriel). */
export function getClassFilterOptions() {
  return [{ id: ALL_CLASSES, label: 'Toutes les classes' }, ...SPECIALTY_IDS.map((id) => ({ id, label: SPECIALTIES[id].pluralName ?? SPECIALTIES[id].name }))];
}

/** Options de tri d'un écran : l'ordre de la compagnie, puis les tris (sans la fatigue si `fatigue: false`). */
export function getSortFilterOptions({ fatigue = true } = {}) {
  return [{ id: ROSTER_ORDER, label: 'Ordre de la compagnie' }, ...FIGHTER_SORTS.filter((sort) => fatigue || !sort.fatigue).map(({ id, label }) => ({ id, label }))];
}

export function isDefaultFilter(filter) {
  return (filter?.classId ?? ALL_CLASSES) === ALL_CLASSES && (filter?.sortId ?? ROSTER_ORDER) === ROSTER_ORDER;
}

/**
 * Liste organisée : { shown, outside, matching, total }.
 *   shown    combattants de la classe choisie, triés (égalités : ordre de la compagnie) ;
 *   outside  combattants SÉLECTIONNÉS qui ne correspondent pas au filtre : ils restent affichés
 *            à part, pour que la sélection reste lisible (ils ne sont jamais retirés).
 */
export function organizeFighters(fighters, filter = DEFAULT_FIGHTER_FILTER, { selectedIds = [] } = {}) {
  const classId = filter?.classId ?? ALL_CLASSES;
  const sort = FIGHTER_SORTS.find((s) => s.id === filter?.sortId);
  const order = new Map(fighters.map((fighter, index) => [fighter.id, index]));
  const compare = (a, b) => (sort ? sort.compare(a, b) : 0) || order.get(a.id) - order.get(b.id);
  const matches = (fighter) => classId === ALL_CLASSES || fighter.specialtyId === classId;
  const selected = new Set(selectedIds);
  const shown = fighters.filter(matches).sort(compare);
  const outside = fighters.filter((fighter) => !matches(fighter) && selected.has(fighter.id)).sort(compare);
  return { shown, outside, matching: shown.length, total: fighters.length };
}
