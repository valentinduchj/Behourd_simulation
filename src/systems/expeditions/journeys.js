// Expéditions en cours (v0.98 ; toutes les natures v0.99) — lecture seule, sans dépendance : les
// autres systèmes (étude, activités, combats) demandent seulement si un combattant est parti.
// L'état vit dans session.expeditions (systems/expeditions/ExpeditionService.js) :
//   journeys : [{ id, offerId, kind, placeId, fighterId, startDay, duration, endDay, reward,
//                 replaceSlot, status: 'active' | 'completed', potentialBefore, potentialAfter }]

const idOf = (fighterOrId) => (typeof fighterOrId === 'string' ? fighterOrId : fighterOrId?.id);

/**
 * Expédition en cours d'un combattant, ou null : pérégrination (journey), ou expédition singulière
 * (v1.1 : { kind: 'singular', run } — l'un des trois combattants de session.expeditions.run).
 */
export function getActiveJourney(session, fighterOrId) {
  const id = idOf(fighterOrId);
  if (!id) return null;
  const run = session?.expeditions?.run;
  if (run && run.status === 'active' && run.fighterIds?.includes(id)) return { kind: 'singular', fighterId: id, run };
  const journeys = session?.expeditions?.journeys;
  if (!Array.isArray(journeys) || !journeys.length) return null;
  return journeys.find((journey) => journey.status === 'active' && journey.fighterId === id) ?? null;
}

/** Jours écoulés depuis son dernier retour d'expédition (0 : rentré aujourd'hui), ou null. */
export function daysSinceReturn(session, fighterOrId) {
  const id = idOf(fighterOrId);
  const journeys = session?.expeditions?.journeys;
  if (!id || !Array.isArray(journeys)) return null;
  const ends = journeys.filter((journey) => journey.status === 'completed' && journey.fighterId === id).map((journey) => journey.endDay);
  if (!ends.length) return null;
  return (session.calendar?.currentDay ?? 0) - Math.max(...ends);
}

/** Le combattant est-il parti en pérégrination ? */
export function isOnPeregrination(session, fighterOrId) {
  return getActiveJourney(session, fighterOrId) !== null;
}

export const PEREGRINATION_REASON = 'En expédition avec le Baron : indisponible jusqu’à son retour.';
