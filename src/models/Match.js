import { createId } from '../utils/id.js';

/**
 * Combat entre deux clubs, en manches gagnantes.
 *
 * Une manche (round) :
 * {
 *   number,
 *   fightersTeamA: [fighterId], fightersTeamB: [fighterId],
 *   placementsTeamA: [{ fighterId, x, y }], placementsTeamB: [...],
 *   probabilityA,            // chance de victoire de A (interne, jamais affichée au joueur)
 *   winner: 'A' | 'B', winnerTeamId,
 *   fatigueApplied: [{ fighterId, side, amount, before, after }],
 *   scoreA, scoreB,          // score après la manche
 *   result,                  // texte de synthèse
 * }
 */
export class Match {
  constructor(data = {}) {
    this.id = data.id ?? createId('match');
    this.teamAId = data.teamAId;
    this.teamBId = data.teamBId;
    this.matchday = data.matchday ?? null;
    // Nature du combat : 'combat' (championnat) ou 'queen' (Combat de la Reine).
    this.kind = data.kind ?? 'combat';
    // Fatigue propre à ce type de combat ({ roundWinner, roundLoser }) ; null : règle générale.
    this.fatigueRules = data.fatigueRules ?? null;
    this.rounds = (data.rounds ?? []).map((round) => ({ ...round }));
    this.scoreA = data.scoreA ?? 0;
    this.scoreB = data.scoreB ?? 0;
    this.winnerId = data.winnerId ?? null;
    // Fatigue des combattants de l'IA, suivie pendant le combat seulement.
    this.localFatigue = { ...(data.localFatigue ?? {}) };
    // Combat Joueur contre IA : combattants mis KO (ils le restent jusqu'à la fin du combat)
    // et endurance de combat des combattants de l'IA (tirée une fois pour tout le combat).
    this.knockedOut = [...(data.knockedOut ?? [])];
    this.aiEndurance = { ...(data.aiEndurance ?? {}) };
    // Camp qui a placé en premier à la 1re manche (niveau le plus élevé) ; alternance ensuite.
    this.firstPlacingSide = data.firstPlacingSide ?? null;
    // Combat Joueur contre IA : comportement de l'équipe adverse, tiré pour ce combat
    // (data/aiProfiles.js, systems/ai/OpponentAIService.js) ; null : IA habituelle.
    this.aiProfileId = data.aiProfileId ?? null;
    // Combat isolé (Coupe de France) : aucun effet sur le palmarès, la carrière ni le championnat.
    this.isolated = data.isolated === true;
    // Fatigue des combattants du joueur : leur vraie fatigue (true), ou suivie le temps du combat
    // seulement (false). Par défaut : vraie fatigue, sauf combat isolé. La Coupe de France garde la
    // vraie fatigue (v0.73.1) : remise à 0 une fois à l'entrée dans la Coupe, puis règles normales.
    this.playerFatigue = typeof data.playerFatigue === 'boolean' ? data.playerFatigue : !this.isolated;
    // Lieu d'un match de Ligue pour le camp A (joueur) : 'HOME' | 'AWAY' | null (talents de lieu).
    this.location = data.location ?? null;
    // Effectif engagé par le joueur (camp A) : identifiants (talent Légende vivante).
    this.squadIds = [...(data.squadIds ?? [])];
    // Talents « une fois par combat » déjà utilisés : { [fighterId]: { lastStand: true } }.
    this.talentUses = Object.fromEntries(Object.entries(data.talentUses ?? {}).map(([id, uses]) => [id, { ...uses }]));
    // Courbatures de fin de combat (v0.75, FatigueService.applyMatchSoreness) :
    // [{ fighterId, rounds, knockedOut, amount, before, after, toRefuge }] ; null : pas encore appliquées.
    this.soreness = Array.isArray(data.soreness) ? data.soreness.map((entry) => ({ ...entry })) : null;
  }

  isKnockedOut(fighterId) {
    return this.knockedOut.includes(fighterId);
  }

  get isFinished() {
    return this.winnerId !== null;
  }

  /** Numéro de la prochaine manche à disputer. */
  get currentRound() {
    return this.rounds.length + 1;
  }

  get loserId() {
    if (!this.winnerId) return null;
    return this.winnerId === this.teamAId ? this.teamBId : this.teamAId;
  }

  sideOf(teamId) {
    if (teamId === this.teamAId) return 'A';
    if (teamId === this.teamBId) return 'B';
    return null;
  }

  toJSON() {
    return {
      id: this.id,
      teamAId: this.teamAId,
      teamBId: this.teamBId,
      matchday: this.matchday,
      kind: this.kind,
      fatigueRules: this.fatigueRules,
      rounds: this.rounds.map((round) => ({ ...round })),
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      winnerId: this.winnerId,
      knockedOut: [...this.knockedOut],
      aiEndurance: { ...this.aiEndurance },
      firstPlacingSide: this.firstPlacingSide,
      aiProfileId: this.aiProfileId,
      isolated: this.isolated,
      playerFatigue: this.playerFatigue,
      location: this.location,
      squadIds: [...this.squadIds],
      talentUses: Object.fromEntries(Object.entries(this.talentUses).map(([id, uses]) => [id, { ...uses }])),
      soreness: this.soreness ? this.soreness.map((entry) => ({ ...entry })) : null,
    };
  }
}
