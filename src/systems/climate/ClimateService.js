import { CLIMATE_SEASONS, CLIMATE_YEAR } from '../../data/climate.js';

// Les quatre saisons de l'année (gestionnaire central, « SeasonManager » de la spécification).
// À ne pas confondre avec la saison de championnat (league/SeasonService.js).
//
// Trois familles de règles, séparées :
//   calendrier  saison et jour de l'année DÉDUITS du jour courant (rien à synchroniser) ;
//               transition traitée une seule fois (session.climate.lastTransitionDay) ;
//   métier      lieux fermés, affectations libérées, efficacité des classes au combat ;
//   visuel      data/climateVisuals.js et render/seasonLook.js (aucune règle de jeu).
// Les écrans, le combat et les rendus demandent la saison ici ; aucun ne la calcule.

const BY_ID = new Map(CLIMATE_SEASONS.map((season) => [season.id, season]));

/** Jour de l'année (1 à 100) d'un jour de la partie (1, 2, …). */
export function dayOfYear(day, year = CLIMATE_YEAR) {
  return ((Math.max(1, Math.floor(day)) - 1) % year.length) + 1;
}

/** Année de la partie (1, 2, …) d'un jour. */
export function yearOf(day, year = CLIMATE_YEAR) {
  return Math.floor((Math.max(1, Math.floor(day)) - 1) / year.length) + 1;
}

export function getClimateSeason(id) {
  return BY_ID.get(id) ?? null;
}

/** Saison d'un jour de la partie : jours 1–25 été, 26–50 automne, 51–75 hiver, 76–100 printemps. */
export function getSeasonForDay(day, year = CLIMATE_YEAR) {
  const index = Math.floor((dayOfYear(day, year) - 1) / year.seasonLength);
  return CLIMATE_SEASONS[Math.min(CLIMATE_SEASONS.length - 1, index)];
}

/** Saison actuelle de la partie. */
export function getCurrentSeason(session) {
  return getSeasonForDay(session.calendar.currentDay);
}

/** Jour de la saison (1 à 25) et jours restants avant la suivante. */
export function seasonProgress(day, year = CLIMATE_YEAR) {
  const inSeason = ((dayOfYear(day, year) - 1) % year.seasonLength) + 1;
  return { day: inSeason, remaining: year.seasonLength - inSeason };
}

/** Saison qui COMMENCE ce jour-là (premier jour d'une saison, hors jour 1 de la partie), sinon null. */
export function seasonStartingOn(day, year = CLIMATE_YEAR) {
  if (day <= 1) return null;
  return (dayOfYear(day, year) - 1) % year.seasonLength === 0 ? getSeasonForDay(day, year) : null;
}

/** Premier jour de la saison en cours (pour un jour donné). */
export function seasonStartDay(day, year = CLIMATE_YEAR) {
  return day - (((dayOfYear(day, year) - 1) % year.seasonLength));
}

// --- Règles métier ---

/** Raison de la fermeture saisonnière d'un lieu du Centre, ou null s'il est ouvert. */
export function getSeasonalClosure(activityId, season) {
  if (!season || !season.closedActivities.includes(activityId)) return null;
  return season.closedReason?.[activityId] ?? `Lieu fermé : ${season.name.toLowerCase()}.`;
}

/** Le lieu est-il ouvert aujourd'hui (saison) ? */
export function isActivityOpenToday(session, activityId) {
  return !getSeasonalClosure(activityId, getCurrentSeason(session));
}

/**
 * Efficacité au combat d'une classe pendant une saison (1 : normale ; 0,9 : −10 %).
 * Multiplicateur temporaire : il n'est jamais inscrit dans les statistiques du combattant.
 */
export function classEfficiencyFactor(classId, seasonOrId) {
  const season = typeof seasonOrId === 'string' ? getClimateSeason(seasonOrId) : seasonOrId;
  return 1 - (season?.classEfficiency?.[classId] ?? 0);
}

/**
 * Facteur saisonnier d'une unité de combat : celui de sa classe, sauf si un talent l'en
 * protège (effet `seasonImmune`, déjà filtré sur la saison active).
 */
export function combatSeasonFactor(classId, seasonId, talentEffects = []) {
  if (!seasonId) return 1;
  if (talentEffects.some((effect) => effect.type === 'seasonImmune')) return 1;
  return classEfficiencyFactor(classId, seasonId);
}

/**
 * Libère les affectations devenues impossibles (lieu fermé par la saison) : les combattants
 * passent au repos, sans être réaffectés ailleurs. Renvoie [{ fighter, activityId }].
 */
export function releaseClosedAssignments(session, season = getCurrentSeason(session)) {
  const released = [];
  for (const fighter of session.playerFighters) {
    if (fighter.activityId && getSeasonalClosure(fighter.activityId, season)) {
      released.push({ fighter, activityId: fighter.activityId });
      fighter.activityId = null;
    }
  }
  if (released.length) session.markDirty?.();
  return released;
}

/**
 * Passage de saison, au moment où le nouveau jour est pris en compte (phase de la journée) :
 * une seule fois par transition (session.climate.lastTransitionDay), affectations libérées,
 * entrée du carnet de bord. Renvoie l'événement, ou null.
 */
export function runSeasonTransition(session, report = null) {
  const day = session.calendar.currentDay;
  const season = seasonStartingOn(day);
  session.climate ??= { lastTransitionDay: null };
  if (!season || (session.climate.lastTransitionDay ?? 0) >= day) return null;
  const released = releaseClosedAssignments(session, season);
  session.climate.lastTransitionDay = day;
  session.markDirty?.();
  const event = {
    type: 'climate.season', seasonId: season.id, day, year: yearOf(day),
    released: released.map(({ fighter, activityId }) => ({ fighterId: fighter.id, activityId })),
  };
  report?.add(event);
  return event;
}

/**
 * Partie chargée (ancienne sauvegarde comprise) : état saisonnier cohérent, sans notification —
 * affectations impossibles libérées ; la transition de la saison en cours est tenue pour faite.
 */
export function ensureClimateState(session) {
  session.climate ??= { lastTransitionDay: null };
  const start = seasonStartDay(session.calendar.currentDay);
  if ((session.climate.lastTransitionDay ?? 0) < start && start > 1) session.climate.lastTransitionDay = start;
  return releaseClosedAssignments(session);
}
