/**
 * Carnet de bord d'une journée : liste d'ÉVÉNEMENTS STRUCTURÉS produits par les
 * systèmes (activités, calendrier, Taverne, combats…). Les systèmes ne rédigent pas
 * de texte : la mise en forme est faite par l'interface (ui/report/logbookFormats.js).
 *
 * Types d'événements actuels (champ `type`) :
 *   'activity.reward'   { fighterId, activityId, reward: { type, stat | resource, amount } }
 *   'activity.failure'  { fighterId, activityId }
 *   'activity.blocked'  { fighterId, activityId, statId }       (stat déjà à sa meilleure valeur)
 *   'centre.closed'     {}                                      (journée de combat)
 *   'calendar.matchday' { matchday, opponentTeamId, location }   (combat prévu aujourd'hui ; location : 'HOME' | 'AWAY')
 *   'tavern.rotation'   { count }
 *   'match.result'      { matchday, opponentTeamId, won, roundsFor, roundsAgainst, points, location, homeReward, auto }
 *   'season.end'        { season, rank, leagueBefore, leagueAfter, movement, movements, nextSeason }
 *   'ai.recruitment'    { clubId, leagueId, specialtyId }       (club de la division du joueur seulement)
 *   'queen.available' / 'queen.result' / 'queen.missed'         (Combats de la Reine)
 *   'talent.revealed'   { fighterId, name, talentId, talentName } (fin d'une étude au Scriptorium)
 *   'save.autosaved'    {}
 *   'save.failed'       { message }
 * Un type inconnu de l'interface reste affiché (section « Divers ») : ajouter un type
 * ne nécessite pas de modifier le carnet.
 */
/** Ajoute le recrutement d'un club de l'IA au carnet (`event` null : recrutement non visible). */
export function addAIRecruitmentEvent(report, event) {
  if (!report || !event) return null;
  return report.add(event);
}

export class DailyReport {
  constructor(previousDay) {
    this.previousDay = previousDay;
    this.day = previousDay;
    this.entries = [];
  }

  add(event) {
    if (!event?.type) throw new Error('Un événement du carnet doit avoir un type.');
    this.entries.push(event);
    return event;
  }

  /** Ajoute en tête (ex. résultat du combat du joueur). */
  prepend(event) {
    this.entries.unshift(event);
    return event;
  }

  ofType(type) {
    return this.entries.filter((entry) => entry.type === type);
  }

  /** Total des améliorations par cible, ex. { 'stat:wrestling': 2, 'resource:deniers': 16 }. */
  totals() {
    const totals = {};
    for (const entry of this.ofType('activity.reward')) {
      const { reward } = entry;
      const key = `${reward.type}:${reward.stat ?? reward.resource}`;
      totals[key] = (totals[key] ?? 0) + reward.amount;
    }
    return totals;
  }
}
