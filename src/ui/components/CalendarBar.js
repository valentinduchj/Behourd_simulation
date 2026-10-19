import { h } from '../../utils/dom.js';
import { getSingularRun } from '../../systems/expeditions/SingularRunService.js';
import { CALENDAR_CONFIG, QUEEN_COMBAT, getEventType } from '../../data/calendar.js';
import { getEventTitle } from '../../systems/calendar/scheduler.js';
import { isOffSeason } from '../../systems/league/SeasonService.js';
import { getSeasonForDay, seasonProgress, seasonStartingOn, yearOf } from '../../systems/climate/ClimateService.js';
import { CLIMATE_YEAR } from '../../data/climate.js';
import {
  getPendingCombatEvent, getPendingQueenEvent, getTimelineEvents, getUpcomingHighlights,
} from '../../systems/calendar/CalendarService.js';

/**
 * Pastille de la saison de l'année sous le jour courant : icône + nom (lisible sans la couleur),
 * fond à la couleur de la saison ; l'info-bulle rappelle ses effets.
 */
export function SeasonBadge(day) {
  const season = getSeasonForDay(day);
  const { day: inSeason } = seasonProgress(day);
  return h('span', {
    class: `season-badge is-${season.id}`,
    style: { '--season-color': season.color, '--season-text': season.text },
    title: `${season.name}, jour ${inSeason} sur ${CLIMATE_YEAR.seasonLength} (année ${yearOf(day)}) — ${season.effectSummary}`,
  }, h('span', { class: 'season-badge-icon', 'aria-hidden': 'true' }, season.icon), season.name);
}

/** Jour de la frise : liseré à la couleur de sa saison, et marque au premier jour d'une saison. */
function seasonMark(day) {
  const season = getSeasonForDay(day);
  const starts = seasonStartingOn(day);
  return {
    style: { '--season-color': season.color },
    marker: starts ? h('span', { class: 'calendar-season-start', title: `Début de ${season.article}`, 'aria-hidden': 'true' }, season.icon) : null,
    title: starts ? ` · début de ${season.article}` : '',
  };
}

export function formatDaysUntil(days) {
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  return `dans ${days} j`;
}

/**
 * Saison terminée : la frise montre la fin de la saison puis des jours grisés (aucun
 * événement), et l'action devient « Aller en Coupe de France » (la nouvelle saison se lance
 * depuis l'écran du vainqueur de la Coupe).
 */
function OffSeasonBar(session, { onGoToCup }) {
  const { calendar, season } = session;
  const endDay = season.endedOnDay;
  const from = Math.max(1, Math.max(endDay, calendar.currentDay - CALENDAR_CONFIG.stripDays + 3) - 2);
  const days = Array.from({ length: CALENDAR_CONFIG.stripDays }, (_, i) => from + i);
  const strip = h(
    'ol',
    { class: 'calendar-strip is-off-season', 'aria-label': 'Fin de saison' },
    days.map((day) => {
      const inSeason = day <= endDay;
      const events = inSeason ? calendar.getEventsOn(day).filter((e) => getEventType(e.typeId).combatDay) : [];
      return h(
        'li',
        {
          class: ['calendar-day', inSeason ? 'is-season-day' : 'is-off-season', day === endDay ? 'is-season-end' : '', day === calendar.currentDay ? 'is-today' : '', ...events.map((e) => getEventType(e.typeId).dayClass)].filter(Boolean).join(' '),
          title: inSeason ? `Jour ${day}${day === endDay ? ' : fin de la saison' : ''}` : `Jour ${day} : hors saison`,
          style: seasonMark(day).style,
        },
        h('span', { class: 'calendar-day-number' }, String(day)),
        h('span', { class: 'calendar-day-events' }, day === endDay
          ? h('span', { class: 'calendar-event-dot season-end-flag', 'aria-hidden': 'true' }, '🏁')
          : events.map((event) => h('span', { class: 'calendar-event-dot', style: { '--event-color': getEventType(event.typeId).color }, 'aria-hidden': 'true' }, getEventType(event.typeId).icon))),
      );
    }),
  );
  return h(
    'header',
    { class: 'calendar-bar is-off-season' },
    h('div', { class: 'calendar-today' }, h('span', { class: 'calendar-today-label' }, 'Aujourd’hui'), h('strong', { class: 'calendar-today-day' }, `Jour ${calendar.currentDay}`), SeasonBadge(calendar.currentDay)),
    h(
      'div',
      { class: 'calendar-main' },
      strip,
      h('p', { class: 'season-over-banner', role: 'status' },
        h('strong', {}, `🏁 Saison ${season.number} terminée`),
        ' — place à la Coupe de France, puis à la nouvelle saison.'),
    ),
    h('button', { type: 'button', class: 'btn btn-primary btn-advance btn-go-cup', onclick: onGoToCup }, '🏆 Aller en Coupe de France ▸'),
  );
}

/**
 * Bandeau du calendrier : jour actuel, frise des prochains jours, prochains événements
 * et action du jour : « Passer la journée », ou « ⚔ COMBATTRE » un jour de championnat.
 */
export function CalendarBar(session, { onAdvance, onFight, onGoToCup }) {
  if (isOffSeason(session)) return OffSeasonBar(session, { onGoToCup });
  const { calendar } = session;
  const today = calendar.currentDay;
  const championshipToday = getPendingCombatEvent(calendar);
  const queenToday = getPendingQueenEvent(calendar);
  const combatToday = championshipToday ?? queenToday;
  const days = Array.from({ length: CALENDAR_CONFIG.stripDays }, (_, i) => today + i);
  // Tous les événements de la frise, triés (chronologie, puis type).
  const timeline = getTimelineEvents(calendar, { from: today, to: today + CALENDAR_CONFIG.stripDays - 1 });

  const strip = h(
    'ol',
    { class: 'calendar-strip', 'aria-label': 'Prochains jours' },
    days.map((day) => {
      const events = timeline.filter((e) => e.day === day);
      const label = events.length ? `Jour ${day} : ${events.map((e) => getEventTitle(e, session)).join(', ')}` : `Jour ${day}`;
      // Style de la case selon les événements du jour (ex. fond doré : rotation de la Taverne).
      const typeClasses = [...new Set(events.map((e) => getEventType(e.typeId).dayClass).filter(Boolean))];
      const mark = seasonMark(day);
      return h(
        'li',
        { class: ['calendar-day', day === today ? 'is-today' : '', events.length ? 'has-events' : '', ...typeClasses].filter(Boolean).join(' '), title: `${label}${mark.title}`, style: mark.style },
        h('span', { class: 'calendar-day-number' }, String(day)),
        mark.marker,
        h(
          'span',
          { class: 'calendar-day-events' },
          events.map((event) => {
            const type = getEventType(event.typeId);
            return h('span', { class: 'calendar-event-dot', style: { '--event-color': type.color }, 'aria-hidden': 'true' }, type.icon);
          }),
        ),
      );
    }),
  );

  // Seules les prochaines actualités sont affichées ; le calendrier garde tous les événements.
  const upcoming = getUpcomingHighlights(calendar);
  const upcomingList = h(
    'div',
    { class: 'calendar-upcoming-block' },
    h('span', { class: 'calendar-upcoming-heading' }, 'Prochains événements'),
    h(
      'ul',
      { class: 'calendar-upcoming', 'aria-label': 'Prochains événements' },
      upcoming.length
        ? upcoming.map((event) => {
          const type = getEventType(event.typeId);
          const days = calendar.daysUntil(event);
          return h(
            'li',
            { class: 'calendar-upcoming-item', style: { '--event-color': type.color }, title: `Jour ${event.day} — ${formatDaysUntil(days)}` },
            h('span', { class: 'calendar-upcoming-delay' }, `J-${days}`),
            h('span', { class: 'calendar-upcoming-type', 'aria-hidden': 'true' }, type.icon),
            h('span', { class: 'calendar-upcoming-title' }, getEventTitle(event, session)),
          );
        })
        : h('li', { class: 'muted' }, 'Aucun événement prévu.'),
    ),
  );

  const bannerTitle = queenToday && !championshipToday
    ? `${getEventType(QUEEN_COMBAT).icon} Combat de la Reine`
    : `⚔ Journée de championnat ${combatToday?.data.matchday ?? ''}`.trim();
  const main = combatToday
    ? h(
      'div',
      { class: 'calendar-main' },
      h(
        'div',
        { class: `combat-day-banner ${championshipToday ? '' : 'is-queen'}`.trim(), role: 'status', style: { '--event-color': getEventType(combatToday.typeId).color } },
        h('strong', {}, bannerTitle),
        h('span', {}, championshipToday ? getEventTitle(combatToday, session) : 'Choisissez votre adversaire parmi trois compagnies.'),
        h('span', { class: 'muted' }, 'Le Centre est fermé aujourd’hui.'),
      ),
      upcomingList,
    )
    : h('div', { class: 'calendar-main' }, strip, upcomingList);

  return h(
    'header',
    { class: `calendar-bar ${combatToday ? 'is-combat-day' : ''} ${queenToday && !championshipToday ? 'is-queen-day' : ''}`.replace(/\s+/g, ' ').trim() },
    h(
      'div',
      { class: 'calendar-today' },
      h('span', { class: 'calendar-today-label' }, 'Aujourd’hui'),
      h('strong', { class: 'calendar-today-day' }, `Jour ${today}`),
      SeasonBadge(today),
    ),
    main,
    // Expédition singulière en cours (v1.1) : le temps est arrêté, le bouton y ramène.
    getSingularRun(session)
      ? h('button', { type: 'button', class: 'btn btn-fight btn-singular', onclick: onAdvance, title: 'Les jours ne passent pas pendant une expédition singulière.' }, '⚜ EXPÉDITION EN COURS')
      : combatToday
      ? h('button', { type: 'button', class: `btn btn-fight ${championshipToday ? '' : 'btn-queen'}`.trim(), onclick: onFight },
        championshipToday ? '⚔ COMBATTRE' : '♛ COMBAT DE LA REINE')
      : h('button', { type: 'button', class: 'btn btn-primary btn-advance', onclick: onAdvance }, 'Passer la journée ▸'),
  );
}
