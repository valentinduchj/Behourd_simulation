import { ACTIVITY_SORT_CRITERIA, DEFAULT_ASSIGNMENT, SORT_DIRECTIONS } from '../../data/activityAssignment.js';
import { COMBAT_RULES } from '../../data/combatRules.js';
import { SPECIALTY_IDS } from '../../data/specialties.js';
import { getStatDefinition } from '../../data/stats.js';
import { calculateFighterLevel } from '../fighters/ratings.js';
import { isAway } from '../talents/StudyService.js';
import {
  CENTRE_CLOSED_REASON, assignActivity, getAssignedFighters, getEffectiveActivity, getFreeSlots, isCentreClosed, quickAssign, getActivityClosure,
} from './ActivityService.js';

// Affectation rapide des lieux du Centre (bouton [+] et réglage [⚙]) — au-dessus du système
// d'activités : chaque affectation passe par ActivityService.assignActivity (places, Centre
// fermé, une seule activité par combattant). Aucune règle d'activité n'est modifiée.
// Configuration de chaque lieu enregistrée avec la partie : session.activityAssignments.

const CRITERIA_BY_ID = new Map(ACTIVITY_SORT_CRITERIA.map((criterion) => [criterion.id, criterion]));

/** Compétence travaillée par un lieu (récompense « stat » comptant dans le niveau), ou null. */
export function getActivitySkill(activity) {
  const stat = activity?.reward?.type === 'stat' ? activity.reward.stat : null;
  return stat && getStatDefinition(stat)?.level ? stat : null;
}

/** Classe dont l'attaque est la compétence du lieu (Petite lice → Lutteur…), ou null. */
export function getActivityClass(activity, rules = COMBAT_RULES) {
  const skill = getActivitySkill(activity);
  return Object.entries(rules.offenseStatByClass).find(([, stat]) => stat === skill)?.[0] ?? null;
}

/** Critères de tri proposés pour un lieu (la compétence du lieu seulement s'il en a une). */
export function getSortCriteria(activity) {
  return ACTIVITY_SORT_CRITERIA.filter((criterion) => criterion.source !== 'activitySkill' || getActivitySkill(activity));
}

/** Libellé d'un tri : « Niveau décroissant », « Percussion croissante »… */
export function describeSort(activity, sortBy, sortDirection) {
  const criterion = CRITERIA_BY_ID.get(sortBy);
  if (!criterion) return '';
  const skill = criterion.source === 'activitySkill' ? getStatDefinition(getActivitySkill(activity)) : null;
  const label = skill ? skill.label : criterion.label;
  const feminine = skill ? true : criterion.feminine;
  const order = sortDirection === SORT_DIRECTIONS.ASC ? 'croissant' : 'décroissant';
  return `${label} ${order}${feminine ? 'e' : ''}`;
}

/** Tris proposés pour un lieu : [{ sortBy, sortDirection, label }]. */
export function getSortOptions(activity) {
  return getSortCriteria(activity).flatMap((criterion) => [SORT_DIRECTIONS.DESC, SORT_DIRECTIONS.ASC].map((sortDirection) => ({
    sortBy: criterion.id, sortDirection, label: describeSort(activity, criterion.id, sortDirection),
  })));
}

/** Configuration de départ d'un lieu (data/activityAssignment.js › DEFAULT_ASSIGNMENT). */
export function getDefaultConfig(activity) {
  const kind = getActivitySkill(activity) ? 'skill' : activity?.reward?.type === 'resource' ? 'resource' : 'other';
  const preset = DEFAULT_ASSIGNMENT[kind];
  return {
    activityId: activity.id,
    targetClass: preset.classFromSkill ? getActivityClass(activity) : null,
    sortBy: preset.sortBy,
    sortDirection: preset.sortDirection,
  };
}

/** Configuration valide (classe, critère et sens inconnus remplacés par ceux de départ). */
function normalizeConfig(activity, config = {}) {
  const base = getDefaultConfig(activity);
  const criteria = getSortCriteria(activity).map((criterion) => criterion.id);
  return {
    activityId: activity.id,
    targetClass: config.targetClass === null || SPECIALTY_IDS.includes(config.targetClass) ? config.targetClass : base.targetClass,
    sortBy: criteria.includes(config.sortBy) ? config.sortBy : base.sortBy,
    sortDirection: Object.values(SORT_DIRECTIONS).includes(config.sortDirection) ? config.sortDirection : base.sortDirection,
  };
}

/** Configuration enregistrée d'un lieu (ou celle de départ). */
export function getActivityConfig(session, activityId) {
  const activity = getEffectiveActivity(session, activityId);
  if (!activity) return null;
  const saved = session.activityAssignments?.[activityId];
  return saved ? normalizeConfig(activity, saved) : getDefaultConfig(activity);
}

/** Enregistre la configuration d'un lieu (validée). Renvoie la configuration retenue. */
export function setActivityConfig(session, activityId, config) {
  const activity = getEffectiveActivity(session, activityId);
  if (!activity) throw new Error(`Activité inconnue : ${activityId}`);
  const normalized = normalizeConfig(activity, { ...getActivityConfig(session, activityId), ...config });
  session.activityAssignments = { ...(session.activityAssignments ?? {}), [activityId]: normalized };
  session.markDirty?.();
  return normalized;
}

/** Valeur d'un combattant pour un critère de tri. */
function sortValue(criterion, fighter, activity) {
  switch (criterion.source) {
    case 'stat': return fighter.stats[criterion.stat] ?? 0;
    case 'level': return calculateFighterLevel(fighter);
    case 'activitySkill': return fighter.stats[getActivitySkill(activity)] ?? 0;
    default: return 0;
  }
}

/**
 * Combattants que la configuration placerait dans le lieu : ceux de la classe ciblée qui n'y
 * sont pas déjà, dans l'ordre du tri (égalité : par nom), dans la limite des places libres.
 */
export function planActivityAssignment(session, activityId, config = getActivityConfig(session, activityId)) {
  const activity = getEffectiveActivity(session, activityId);
  if (!activity) return [];
  const { targetClass, sortBy, sortDirection } = normalizeConfig(activity, config);
  const criterion = CRITERIA_BY_ID.get(sortBy);
  const sign = sortDirection === SORT_DIRECTIONS.ASC ? 1 : -1;
  const free = getFreeSlots(session, activity);
  return session.playerFighters
    .filter((fighter) => fighter.activityId !== activityId && (!targetClass || fighter.specialtyId === targetClass) && !isAway(session, fighter))
    .sort((a, b) => sign * (sortValue(criterion, a, activity) - sortValue(criterion, b, activity)) || a.name.localeCompare(b.name, 'fr'))
    .slice(0, Number.isFinite(free) ? free : undefined);
}

/**
 * Applique la configuration d'un lieu : les combattants retenus y sont affectés (ils quittent
 * leur activité précédente). Renvoie { ok, reason, assigned, free }.
 */
export function applyActivityConfig(session, activityId, config = getActivityConfig(session, activityId)) {
  if (isCentreClosed(session)) return { ok: false, reason: CENTRE_CLOSED_REASON, assigned: [], free: 0 };
  const activity = getEffectiveActivity(session, activityId);
  if (!activity) return { ok: false, reason: 'Activité inconnue.', assigned: [], free: 0 };
  // Saison : lieu fermé (rivière asséchée en été, forêt enneigée en hiver).
  const closure = getActivityClosure(session, activityId);
  if (closure) return { ok: false, reason: closure, assigned: [], free: 0 };
  const free = getFreeSlots(session, activity);
  const assigned = planActivityAssignment(session, activityId, config).filter((fighter) => assignActivity(session, fighter.id, activityId).ok);
  return { ok: true, reason: null, assigned, free, present: getAssignedFighters(session, activityId).length };
}

/**
 * Bouton [+] d'un lieu : le raccourci propre au lieu s'il en a un (Banquet : seuil de fatigue),
 * sinon sa configuration (classe et tri). Renvoie { ok, reason, assigned, mode }.
 */
export function runQuickAssign(session, activityId, { threshold = 0 } = {}) {
  const activity = getEffectiveActivity(session, activityId);
  if (activity?.quickAssign) return { ...quickAssign(session, activityId, threshold), mode: 'threshold' };
  return { ...applyActivityConfig(session, activityId), mode: 'config' };
}
