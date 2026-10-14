import { ELITE_CONFIG } from '../../data/ratings.js';
import { calculateFighterLevel } from './RatingService.js';

// Statut « Elite » : les 16 meilleurs combattants de toutes les compagnies des Ligues 1, 2 et 3
// (celle du joueur comprise), au classement global par niveau actuel — le même niveau que celui
// des étoiles affichées (RatingService.calculateFighterLevel). Aucun quota par ligue ni par club.
//
// Le statut n'est JAMAIS enregistré : il se déduit du classement actuel. Pour ne pas refaire le
// classement pour chaque étiquette affichée, il est calculé une fois par passage d'affichage
// (mis en cache jusqu'à la fin de la tâche en cours), puis recalculé au passage suivant : toute
// progression, recrue, départ, retraite ou changement de club est donc pris en compte.

const cache = new WeakMap(); // session → Set(fighterId)

/** Combattants éligibles : ceux des effectifs actuels de toutes les compagnies des Ligues. */
export function getEligibleFighters(session) {
  const seen = new Set();
  const fighters = [];
  for (const league of session?.leagues ?? []) {
    for (const teamId of league.teamIds) {
      for (const fighter of session.getFightersOfTeam(teamId)) {
        if (seen.has(fighter.id)) continue;
        seen.add(fighter.id);
        fighters.push(fighter);
      }
    }
  }
  return fighters;
}

/**
 * Classement global : [{ fighter, level, rank }], niveau décroissant ; égalité → identifiant
 * du combattant (ordre alphabétique), pour un classement stable et déterministe.
 */
export function getGlobalFighterRanking(session) {
  return getEligibleFighters(session)
    .map((fighter) => ({ fighter, level: calculateFighterLevel(fighter) }))
    .sort((a, b) => b.level - a.level || String(a.fighter.id).localeCompare(String(b.fighter.id)))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** Identifiants des combattants Elite (au plus ELITE_CONFIG.count). */
export function getEliteIds(session, { fresh = false } = {}) {
  if (!session) return new Set();
  if (!fresh && cache.has(session)) return cache.get(session);
  const ids = new Set(getGlobalFighterRanking(session).slice(0, ELITE_CONFIG.count).map((entry) => entry.fighter.id));
  cache.set(session, ids);
  // Valable pour le passage d'affichage en cours seulement.
  queueMicrotask(() => { if (cache.get(session) === ids) cache.delete(session); });
  return ids;
}

/** Le combattant fait-il partie des 16 meilleurs, toutes Ligues confondues, en ce moment ? */
export function isElite(session, fighter) {
  return Boolean(fighter) && getEliteIds(session).has(fighter.id);
}

/** Oublie le classement en cache (après une modification, avant un nouvel affichage immédiat). */
export function invalidateEliteRanking(session) {
  cache.delete(session);
}
