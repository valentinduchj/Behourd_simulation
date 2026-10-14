import { CALENDAR_CONFIG, CHAMPIONSHIP_MATCH, QUEEN_COMBAT, getEventType } from '../../data/calendar.js';

// Événements récurrents du calendrier (ex. rotation de la Taverne).
// Les journées de championnat ne sont pas récurrentes : elles sont planifiées saison
// par saison par SeasonService, d'après le calendrier des rencontres.

// Construction des événements selon leur type : titre et données propres.
// factory({ rng, session, day, rule, occurrence }) → { title, data }
const EVENT_FACTORIES = {
  tavern: () => ({ title: 'Nouvelle rotation de la Taverne', data: {} }),
};

function describeCombat(session, data) {
  const opponent = data.opponentTeamId ? session?.getTeam(data.opponentTeamId) : null;
  if (opponent) return `Combat contre ${opponent.name}`;
  if (data.opponentName) return `Combat contre ${data.opponentName}`;
  return 'Journée de championnat (au repos)';
}

/** Titre à afficher (recalculé : suit les renommages de clubs faits dans l'Admin). */
export function getEventTitle(event, session) {
  if (event.typeId === CHAMPIONSHIP_MATCH && session) return describeCombat(session, event.data ?? {});
  if (event.typeId === QUEEN_COMBAT) {
    const opponent = event.data?.selectedTeamId ? session?.getTeam(event.data.selectedTeamId) : null;
    return opponent ? `Combat de la Reine contre ${opponent.name}` : 'Combat de la Reine';
  }
  return event.title;
}

export function scheduleEvent(calendar, typeId, day, { rng = Math.random, session = null, rule = null, occurrence = 0 } = {}) {
  const factory = EVENT_FACTORIES[typeId];
  const { title, data } = factory
    ? factory({ rng, session, day, rule, occurrence })
    : { title: getEventType(typeId).label, data: {} };
  return calendar.addEvent({ typeId, day, title, data });
}

/** Planifie les événements récurrents jusqu'à l'horizon (idempotent). */
export function ensureSchedule(calendar, rng = Math.random, session = null) {
  const target = calendar.currentDay + CALENDAR_CONFIG.horizonDays;
  for (let day = calendar.scheduledThrough + 1; day <= target; day++) {
    for (const rule of CALENDAR_CONFIG.recurringEvents) {
      if (day >= rule.firstDay && (day - rule.firstDay) % rule.interval === 0) {
        const occurrence = (day - rule.firstDay) / rule.interval;
        scheduleEvent(calendar, rule.typeId, day, { rng, session, rule, occurrence });
      }
    }
  }
  calendar.scheduledThrough = Math.max(calendar.scheduledThrough, target);
}
