import { CALENDAR_CONFIG, CHAMPIONSHIP_MATCH, QUEEN_COMBAT, getEventType } from '../../data/calendar.js';
import { randInt } from '../../utils/random.js';

// Lecture et génération des dates du calendrier. Les dates tirées au hasard sont
// enregistrées dans les événements : recharger une partie ne provoque aucun nouveau tirage.
// (Les événements récurrents sont dans scheduler.js, les effets du jour J dans eventHandlers.js.)

// --- Génération des dates ---

/**
 * Dates des journées de championnat : la première le jour `firstDay`, puis un écart tiré
 * au hasard pour chaque journée suivante (`gap` : jours sans combat, { min, max }).
 */
export function generateChampionshipDates(count, firstDay, gap, rng = Math.random) {
  const days = [];
  let day = firstDay;
  for (let i = 0; i < count; i++) {
    if (i > 0) day += randInt(rng, gap.min, gap.max) + 1;
    days.push(day);
  }
  return days;
}

/** Date du prochain Combat de la Reine : `fromDay` + intervalle tiré dans { min, max }. */
export function generateQueenCombatDate(fromDay, interval, rng = Math.random) {
  return fromDay + randInt(rng, interval.min, interval.max);
}

/** Vrai si un combat non déplaçable (championnat) est prévu ce jour-là. */
export function hasFixedCombatOn(calendar, day) {
  return calendar.getEventsOn(day).some((event) => getEventType(event.typeId).combatDay && !getEventType(event.typeId).movable);
}

/** Premier jour à partir de `day` sans aucun combat. */
export function findFreeCombatDay(calendar, day, ignoreEvent = null) {
  let candidate = day;
  while (calendar.getEventsOn(candidate).some((event) => event !== ignoreEvent && getEventType(event.typeId).combatDay)) candidate++;
  return candidate;
}

/**
 * Deux combats ne partagent jamais une journée : un événement déplaçable (Combat de la
 * Reine) qui tombe le même jour qu'un combat de championnat est décalé au jour libre suivant.
 * Renvoie les événements déplacés.
 */
export function resolveCombatDayConflicts(calendar) {
  const moved = [];
  const movable = calendar.events
    .filter((event) => event.status === 'scheduled' && getEventType(event.typeId).movable && event.day > calendar.currentDay)
    .sort((a, b) => a.day - b.day);
  for (const event of movable) {
    if (!hasFixedCombatOn(calendar, event.day)) continue;
    event.day = findFreeCombatDay(calendar, event.day, event);
    moved.push(event);
  }
  return moved;
}

// --- Lecture ---

/**
 * Repousse les Combats de la Reine prévus avant `fromDay` (v1.2.4 : repos après la Coupe de
 * France) au premier jour libre à partir de `fromDay` (jamais un jour de championnat). Renvoie
 * les événements déplacés.
 */
export function postponeQueenCombats(calendar, fromDay) {
  const moved = [];
  for (const event of calendar.events) {
    if (event.typeId !== QUEEN_COMBAT || event.status !== 'scheduled' || event.day >= fromDay) continue;
    event.day = findFreeCombatDay(calendar, fromDay, event);
    moved.push(event);
  }
  return moved;
}

/** Journée de championnat prévue ce jour et pas encore disputée, ou null. */
export function getPendingCombatEvent(calendar, day = calendar.currentDay) {
  return calendar.getEventsOn(day).find((event) => event.typeId === CHAMPIONSHIP_MATCH && event.status === 'scheduled') ?? null;
}

/** Combat de la Reine prévu ce jour et pas encore disputé, ou null. */
export function getPendingQueenEvent(calendar, day = calendar.currentDay) {
  return calendar.getEventsOn(day).find((event) => event.typeId === QUEEN_COMBAT && event.status === 'scheduled') ?? null;
}

/**
 * Vrai si le jour est une journée de combat (championnat ou Combat de la Reine, disputé
 * ou non). Une journée de combat est entièrement consacrée au combat : le Centre est fermé.
 */
export function isCombatDay(calendar, day = calendar.currentDay) {
  return calendar.getEventsOn(day).some((event) => getEventType(event.typeId).combatDay);
}

/** Vrai si une rotation de la Taverne a lieu ce jour-là. */
export function isTavernDay(calendar, day = calendar.currentDay) {
  return calendar.getEventsOn(day).some((event) => event.typeId === 'tavern');
}

/** Ordre chronologique, puis ordre des types (data/calendar.js). */
export function compareEvents(a, b) {
  return a.day - b.day || (getEventType(a.typeId).order ?? 99) - (getEventType(b.typeId).order ?? 99);
}

/** Événements à afficher dans la frise, du jour `from` au jour `to` inclus, triés. */
export function getTimelineEvents(calendar, { from = calendar.currentDay, to = from + CALENDAR_CONFIG.stripDays - 1 } = {}) {
  return calendar.events
    .filter((event) => event.day >= from && event.day <= to && (event.status === 'scheduled' || event.day === calendar.currentDay))
    .sort(compareEvents);
}

/** Prochain événement à venir (après aujourd'hui), éventuellement d'un type donné. */
export function getNextEvent(calendar, typeId = null) {
  return calendar.events
    .filter((event) => event.status === 'scheduled' && event.day > calendar.currentDay && (!typeId || event.typeId === typeId))
    .sort(compareEvents)[0] ?? null;
}

/** Prochaines actualités à afficher (les autres restent planifiées dans le calendrier). */
export function getUpcomingHighlights(calendar, count = CALENDAR_CONFIG.upcomingCount) {
  return calendar.events
    .filter((event) => event.status === 'scheduled' && event.day > calendar.currentDay)
    .sort(compareEvents)
    .slice(0, count);
}
