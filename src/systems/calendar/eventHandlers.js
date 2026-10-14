import { rotateTavern } from '../tavern/TavernService.js';
import { generateQueenCombat } from '../queen/QueenCombatService.js';

// Effet de chaque type d'événement le jour où il arrive.
// handler(event, ctx) → { report?: événement du carnet, keepScheduled?, outcome? }
// ctx = { session, rng, report }
// keepScheduled : l'événement reste à disputer ce jour-là (action du joueur requise).
const EVENT_HANDLERS = {
  // Journée de championnat : le joueur la dispute via « COMBATTRE » (MatchdayService).
  combat: (event) => ({
    keepScheduled: true,
    report: { type: 'calendar.matchday', matchday: event.data.matchday, opponentTeamId: event.data.opponentTeamId ?? null, location: event.data.location ?? null },
  }),
  // Combat de la Reine : les 3 adversaires sont proposés ce jour-là ; le joueur choisit et combat.
  queen: (event, { session, rng }) => ({ keepScheduled: true, report: generateQueenCombat(session, event, rng) }),
  // Rotation hebdomadaire de la Taverne.
  tavern: (event, { session, rng }) => ({ outcome: 'done', report: rotateTavern(session, rng) }),
};

const defaultHandler = (event) => ({ outcome: 'done', report: { type: 'calendar.event', typeId: event.typeId, title: event.title } });

/** Traite les événements prévus au jour courant. */
export function processEventsForDay(ctx) {
  const { session, report } = ctx;
  const { calendar } = session;
  for (const event of calendar.getEventsOn(calendar.currentDay)) {
    if (event.status !== 'scheduled') continue;
    const handler = EVENT_HANDLERS[event.typeId] ?? defaultHandler;
    const result = handler(event, ctx);
    if (!result.keepScheduled) {
      event.status = 'done';
      event.outcome = result.outcome ?? null;
    }
    if (result.report) report.add(result.report);
  }
  calendar.pruneHistory();
}
