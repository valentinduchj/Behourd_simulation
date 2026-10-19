import { ACTIVITIES } from '../../data/activities.js';
import { getRewardType, describeReward, resolveAmount } from './rewards.js';
import { activityChanceBonus, activityRewardBonus, dailyTalentIncome } from '../talents/TalentEffects.js';
import { addResource } from '../economy/wallet.js';
import { findUnmetCondition, getConditionType } from './conditions.js';
import { isCombatDay } from '../calendar/CalendarService.js';
import { applyUpgradesToActivity } from '../borough/UpgradeService.js';
import { formatChance } from './format.js';
import { isAtPotentialCap } from '../fighters/stats.js';
import { getStatDefinition } from '../../data/stats.js';
import { getCurrentSeason, getSeasonForDay, getSeasonalClosure } from '../climate/ClimateService.js';
import { isAway, awayReason } from '../talents/StudyService.js';
import { getFatigueState } from '../fighters/FatigueService.js';
import { FATIGUE_RULES } from '../../data/fatigue.js';

// Système générique des activités du Centre.
//
// Les améliorations du Bourg (systems/borough/) modifient les activités : avec une partie
// (`session`), on obtient l'activité « effective » (places, probabilité, gains améliorés),
// utilisée par la résolution quotidienne, les affectations et l'affichage.

const ACTIVITIES_BY_ID = new Map(ACTIVITIES.map((activity) => [activity.id, activity]));

export { formatChance };

/** Activités du Centre ; avec `session`, telles qu'améliorées dans cette partie. */
export function listActivities(session = null) {
  return session ? ACTIVITIES.map((activity) => applyUpgradesToActivity(session, activity)) : ACTIVITIES;
}

/** Définition de base d'une activité (nom, icône…). */
export function getActivity(activityId) {
  return ACTIVITIES_BY_ID.get(activityId) ?? null;
}

/** Activité telle qu'améliorée dans la partie (Bourg). */
export function getEffectiveActivity(session, activityId) {
  const base = getActivity(activityId);
  return base ? applyUpgradesToActivity(session, base) : null;
}

export function getAssignedFighters(session, activityId) {
  return session.playerFighters.filter((fighter) => fighter.activityId === activityId);
}

export function getActivityTitle(activity) {
  return activity.group ? `${activity.group} — ${activity.name}` : activity.name;
}

export const CENTRE_CLOSED_REASON = 'Journée de combat : le Centre est fermé. Les affectations reprendront demain.';

// Fatigue au Centre (v0.75, data/fatigue.js) : lieu qui accueille les épuisés (le Banquet).
const EXHAUSTED_REFUGE = FATIGUE_RULES.centre.exhausted.refuge;

/** Refus d'affectation d'un combattant épuisé. */
export function exhaustedReason(fighter) {
  return `${fighter.name} est épuisé (fatigue ${Math.round(fighter.stats.fatigue ?? 0)}) : seul le ${getActivity(EXHAUSTED_REFUGE)?.name ?? 'Banquet'} peut le remettre sur pied.`;
}

/**
 * Part de réussite gardée par un combattant selon sa fatigue (1 : rien de perdu) : réduite quand il
 * est fatigué, nulle quand il est épuisé. Le Banquet n'est jamais concerné.
 */
export function fatigueChanceFactor(fighter, activityId) {
  if (activityId === EXHAUSTED_REFUGE) return 1;
  const state = getFatigueState(fighter).id;
  if (state === 'exhausted') return 0;
  return state === 'tired' ? FATIGUE_RULES.centre.tired.chanceFactor : 1;
}

/** Fermeture saisonnière d'un lieu aujourd'hui (« La rivière est asséchée en été. »), ou null. */
export function getActivityClosure(session, activityId) {
  return getSeasonalClosure(activityId, getCurrentSeason(session));
}

/** Le Centre est fermé les jours de championnat (pas d'entraînement et de combat le même jour). */
export function isCentreClosed(session) {
  return isCombatDay(session.calendar);
}

/** Places restantes, améliorations comprises (Infinity si l'activité n'a pas de limite). */
export function getFreeSlots(session, activity) {
  const { capacity } = getEffectiveActivity(session, activity.id) ?? activity;
  if (capacity === null || capacity === undefined) return Infinity;
  return Math.max(0, capacity - getAssignedFighters(session, activity.id).length);
}

/**
 * Affecte un combattant à une activité (null = repos).
 * Renvoie { ok, reason }.
 */
export function assignActivity(session, fighterId, activityId) {
  const fighter = session.getFighter(fighterId);
  if (!fighter) return { ok: false, reason: 'Combattant introuvable.' };
  if (fighter.activityId === activityId) return { ok: true, reason: null };
  // En étude au Scriptorium : indisponible pour le Centre jusqu'à la fin de son étude.
  if (activityId !== null && isAway(session, fighter)) return { ok: false, reason: `${fighter.name} — ${awayReason(session, fighter)}` };
  if (isCentreClosed(session)) return { ok: false, reason: CENTRE_CLOSED_REASON };
  // Épuisé (v0.75) : il ne peut aller qu'au Banquet (ou rester au repos).
  if (activityId !== null && activityId !== EXHAUSTED_REFUGE && getFatigueState(fighter).id === 'exhausted') {
    return { ok: false, reason: exhaustedReason(fighter) };
  }
  if (activityId !== null) {
    const activity = getEffectiveActivity(session, activityId);
    if (!activity) return { ok: false, reason: 'Activité inconnue.' };
    // Saison : rivière asséchée en été, forêt enneigée en hiver (ClimateService).
    const closure = getActivityClosure(session, activityId);
    if (closure) return { ok: false, reason: closure };
    if (getFreeSlots(session, activity) <= 0) return { ok: false, reason: `${activity.name} : plus de place disponible.` };
  }
  fighter.activityId = activityId;
  session.markDirty();
  return { ok: true, reason: null };
}

/**
 * Affectation groupée (bouton [+] d'une activité qui déclare `quickAssign`) : tous les combattants
 * du joueur dont la statistique `quickAssign.stat` est STRICTEMENT au-dessus de `threshold`
 * (0 à 100) rejoignent l'activité, dans la limite de ses places.
 * Renvoie { ok, reason, assigned: [fighters], full: [fighters] } ; ceux déjà présents ne comptent pas.
 */
export function quickAssign(session, activityId, threshold) {
  const activity = getEffectiveActivity(session, activityId);
  if (!activity?.quickAssign) return { ok: false, reason: 'Aucune affectation groupée pour ce lieu.', assigned: [], full: [] };
  if (isCentreClosed(session)) return { ok: false, reason: CENTRE_CLOSED_REASON, assigned: [], full: [] };
  const limit = Math.max(0, Math.min(100, Number(threshold) || 0));
  const { stat } = activity.quickAssign;
  const assigned = [];
  const full = [];
  for (const fighter of session.playerFighters) {
    if (fighter.activityId === activityId || !(fighter.stats[stat] > limit) || isAway(session, fighter)) continue;
    if (assignActivity(session, fighter.id, activityId).ok) assigned.push(fighter);
    else full.push(fighter);
  }
  return { ok: true, reason: null, assigned, full };
}

/**
 * Retire les affectations au-delà des places d'une activité (ex. sauvegarde antérieure à
 * une limite de places) : les premiers affectés restent, les suivants passent au repos.
 * Un combattant affecté à un lieu qui n'existe plus (ex. l'Infirmerie, retirée en v0.40)
 * passe aussi au repos. Renvoie le nombre de combattants désaffectés.
 */
export function enforceActivityCapacities(session) {
  let removed = 0;
  for (const fighter of session.playerFighters) {
    if (fighter.activityId && !getActivity(fighter.activityId)) {
      fighter.activityId = null;
      removed++;
    }
  }
  for (const activity of listActivities(session)) {
    if (activity.capacity === null || activity.capacity === undefined) continue;
    for (const fighter of getAssignedFighters(session, activity.id).slice(activity.capacity)) {
      fighter.activityId = null;
      removed++;
    }
  }
  return removed;
}

/**
 * Entraînement devenu inutile : le lieu fait progresser une compétence (Lutte, Hast, Percussion,
 * Endurance) que le combattant a déjà portée au plafond de son potentiel. Les lieux qui ne font
 * pas progresser de compétence (Banquet, Forêt) ne sont jamais concernés. Calculé à la demande
 * (aucun état enregistré) : il suit l'affectation et la progression du combattant.
 */
export function isTrainingUseless(fighter, activity) {
  const stat = activity?.reward?.type === 'stat' ? activity.reward.stat : null;
  return Boolean(stat && getStatDefinition(stat)?.kind === 'skill' && isAtPotentialCap(fighter, stat));
}

export function describeActivityEffect(activity) {
  return describeReward(activity.reward);
}

export function describeActivityConditions(activity) {
  return (activity.conditions ?? []).map((condition) => getConditionType(condition.type).describe(condition));
}

/**
 * Résolution générique d'une journée pour un combattant :
 * conditions → test de réussite → récompense (bornes respectées).
 */
export function defaultResolve(activity, fighter, ctx) {
  const { session, rng, report } = ctx;
  const base = { fighterId: fighter.id, activityId: activity.id };

  const unmet = findUnmetCondition(activity.conditions, { session, fighter });
  if (unmet) {
    report.add({ ...base, type: 'activity.blocked', statId: unmet.stat ?? null });
    return;
  }

  // Compétence au plafond de son potentiel : plus aucun gain possible, inutile de tirer.
  const stat = activity.reward.type === 'stat' ? activity.reward.stat : null;
  if (isTrainingUseless(fighter, activity)) {
    report.add({ ...base, type: 'activity.blocked', statId: stat, capped: true });
    return;
  }

  // Talents : réussite en plus (les siens, et l'Écuyer d'un autre combattant du même lieu).
  // Fatigue (v0.75) : un combattant fatigué réussit moins souvent (le Banquet n'est pas concerné).
  const tiredFactor = fatigueChanceFactor(fighter, activity.id);
  const successChance = Math.min(1, activity.successChance + activityChanceBonus(session, fighter, activity.id, { season: ctx.season?.id ?? getCurrentSeason(session).id })) * tiredFactor;
  if (rng() >= successChance) {
    report.add({ ...base, type: 'activity.failure', ...(tiredFactor < 1 ? { tired: true } : {}) });
    return;
  }

  // Talents : gain en plus à chaque réussite (deniers en Forêt, fatigue au Banquet, points de compétence).
  const extra = activityRewardBonus(fighter, activity.id);
  const reward = extra ? { ...activity.reward, amount: resolveAmount(activity.reward, rng) + extra, min: undefined, max: undefined } : activity.reward;
  const result = getRewardType(reward.type).apply(reward, { session, fighter, rng });
  if (result.amount <= 0) {
    report.add({ ...base, type: 'activity.blocked', statId: stat, capped: Boolean(stat && isAtPotentialCap(fighter, stat)) });
    return;
  }
  report.add({ ...base, type: 'activity.reward', reward: { ...activity.reward, amount: result.amount } });
}

/**
 * Revenus quotidiens des talents (Collecteur, Trésorier du roi), chaque jour, jours de combat
 * compris. Renvoie l'événement du carnet de bord, ou null s'il n'y a rien.
 */
export function collectTalentIncome(session, report = null) {
  const { amount, details } = dailyTalentIncome(session);
  if (!amount) return null;
  addResource(session, 'deniers', amount);
  return report?.add({ type: 'talent.income', amount, details }) ?? { type: 'talent.income', amount, details };
}

/** Phase quotidienne : résout les activités de tous les combattants affectés. */
export function resolveActivitiesForDay(ctx) {
  // Le travail réglé est celui de la veille : saison de ce jour-là (talents saisonniers, lieux fermés).
  ctx.season ??= getSeasonForDay(ctx.previousDay ?? Math.max(1, ctx.session.calendar.currentDay - 1));
  for (const fighter of ctx.session.playerFighters) {
    if (!fighter.activityId) continue;
    // (Garde-fou : un lieu fermé par la saison ne fait pas travailler ; l'affectation est libérée.)
    if (getSeasonalClosure(fighter.activityId, ctx.season)) {
      fighter.activityId = null;
      continue;
    }
    // (Garde-fou : un combattant en étude n'a pas d'activité ; s'il en garde une, elle est retirée.)
    if (isAway(ctx.session, fighter)) {
      fighter.activityId = null;
      continue;
    }
    // Épuisé (v0.75) : il quitte son lieu pour le Banquet, où il mange dès aujourd'hui.
    if (fighter.activityId !== EXHAUSTED_REFUGE && getFatigueState(fighter).id === 'exhausted') {
      ctx.report.add({ type: 'activity.exhausted', fighterId: fighter.id, activityId: fighter.activityId, refugeId: EXHAUSTED_REFUGE, fatigue: Math.round(fighter.stats.fatigue ?? 0) });
      fighter.activityId = EXHAUSTED_REFUGE;
    }
    // Activité améliorée (Bourg) : probabilité et gains réellement appliqués.
    const activity = getEffectiveActivity(ctx.session, fighter.activityId);
    if (!activity) {
      fighter.activityId = null; // activité supprimée des données
      continue;
    }
    (activity.resolve ?? defaultResolve)(activity, fighter, ctx);
  }
}
