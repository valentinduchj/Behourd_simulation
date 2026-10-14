/** Ligne de classement d'un club (il n'y a pas de match nul : 2 manches gagnantes). */
export function createStandingRow() {
  return { played: 0, wins: 0, losses: 0, roundsWon: 0, roundsLost: 0, points: 0 };
}

/**
 * Une division pendant une saison :
 *   id / definitionId  identifiant stable de la division (ex. 'league_3', voir data/leagues.js)
 *   season             numéro de saison
 *   teamIds            clubs engagés (le club du joueur et des clubs de l'IA)
 *   standings          lignes de classement brutes (le tri est fait par StandingsService)
 *   schedule           journées de la saison : [[{ teamAId, teamBId }]] (ScheduleService)
 *   roundsPlayed       nombre de journées déjà disputées
 *   results            résultats de la saison : [{ round, teamAId, teamBId, scoreA, scoreB, winnerId }]
 *   legacyFormat       vrai pour une saison héritée d'une ancienne sauvegarde (taille différente)
 */
export class League {
  constructor(data = {}) {
    this.definitionId = data.definitionId;
    this.id = data.id ?? this.definitionId;
    this.season = data.season ?? 1;
    this.teamIds = [...(data.teamIds ?? [])];
    this.standings = Object.fromEntries(
      this.teamIds.map((teamId) => {
        const { draws, ...saved } = data.standings?.[teamId] ?? {};
        return [teamId, { ...createStandingRow(), ...saved }];
      }),
    );
    this.schedule = (data.schedule ?? []).map((round) => round.map((fixture) => ({ ...fixture })));
    this.roundsPlayed = data.roundsPlayed ?? 0;
    this.results = (data.results ?? []).map((result) => ({ ...result }));
    this.legacyFormat = Boolean(data.legacyFormat);
  }

  get size() {
    return this.teamIds.length;
  }

  get isComplete() {
    return this.roundsPlayed >= this.schedule.length;
  }

  /** Prochaine journée à disputer (liste de rencontres), ou null. */
  get nextRound() {
    return this.schedule[this.roundsPlayed] ?? null;
  }

  addTeam(teamId) {
    if (this.teamIds.includes(teamId)) return;
    this.teamIds.push(teamId);
    this.standings[teamId] = createStandingRow();
  }

  toJSON() {
    return {
      id: this.id,
      definitionId: this.definitionId,
      season: this.season,
      teamIds: [...this.teamIds],
      standings: Object.fromEntries(Object.entries(this.standings).map(([id, row]) => [id, { ...row }])),
      schedule: this.schedule.map((round) => round.map((fixture) => ({ ...fixture }))),
      roundsPlayed: this.roundsPlayed,
      results: this.results.map((result) => ({ ...result })),
      legacyFormat: this.legacyFormat,
    };
  }

  static fromJSON(data) {
    return new League(data);
  }
}
