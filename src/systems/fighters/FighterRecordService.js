import { createFighterRecord } from '../../models/FighterRecord.js';

// Palmarès des combattants (voir models/FighterRecord.js).
// Seuls les combattants ayant RÉELLEMENT disputé une manche voient leur palmarès évoluer :
// être sélectionné dans l'effectif d'un combat ne suffit pas.
//
// Combattants du joueur : palmarès enregistré sur le combattant (fighter.record).
// Combattants des clubs de l'IA (v0.55.0) : les clubs sont des données statiques ; leur palmarès
// est tenu dans la partie (session.aiFighterRecords), à partir des combats réellement disputés.
// Les combats de la Coupe de France (combats isolés) ne comptent pas : la Coupe a ses propres
// statistiques.

const isPlayerFighter = (session, fighter) => fighter.teamId === session.player.teamId;

/** Palmarès d'un combattant, en lecture (un combattant de l'IA jamais suivi : palmarès vide). */
export function getFighterRecord(session, fighter) {
  if (!fighter) return createFighterRecord();
  if (isPlayerFighter(session, fighter)) return fighter.record;
  return session.aiFighterRecords?.[fighter.id] ?? createFighterRecord();
}

/** Palmarès d'un combattant, pour l'écrire (créé au premier besoin pour un combattant de l'IA). */
export function recordOf(session, fighter) {
  if (isPlayerFighter(session, fighter)) return fighter.record;
  session.aiFighterRecords ??= {};
  return (session.aiFighterRecords[fighter.id] ??= createFighterRecord());
}

function fightersOf(session, ids) {
  return ids.map((id) => session.getFighter(id)).filter(Boolean);
}

/** Après une manche : +1 manche jouée, et gagnée ou perdue, pour chaque combattant engagé. */
export function recordRound(session, round) {
  for (const side of ['A', 'B']) {
    const won = round.winner === side;
    for (const fighter of fightersOf(session, round[`fightersTeam${side}`])) {
      const record = recordOf(session, fighter);
      record.rounds.played += 1;
      record.rounds[won ? 'won' : 'lost'] += 1;
    }
  }
}

/** À la fin d'un combat : +1 combat joué, gagné ou perdu, pour ceux qui ont disputé au moins une manche. */
export function recordMatch(session, match) {
  for (const side of ['A', 'B']) {
    const teamId = side === 'A' ? match.teamAId : match.teamBId;
    const won = match.winnerId === teamId;
    const participants = new Set(match.rounds.flatMap((round) => round[`fightersTeam${side}`]));
    for (const fighter of fightersOf(session, [...participants])) {
      const record = recordOf(session, fighter);
      record.matches.played += 1;
      record.matches[won ? 'won' : 'lost'] += 1;
    }
  }
}
