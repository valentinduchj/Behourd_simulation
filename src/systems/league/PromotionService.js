import { PROMOTION_RULES, getRuleRanks } from '../../data/leagues.js';
import { getLeagueDefinition, getLeagueSize, listLeagueDefinitions } from './LeagueService.js';

// Montées et descentes de fin de saison, déduites de LEAGUE_CONFIG (data/leagues.js) :
// les `promotionCount` premiers montent, les `relegationCount` derniers descendent.
// Les rangs sont calculés d'après la taille réelle de chaque classement ; aucune
// division n'a de règle propre codée en dur.

/**
 * Mouvements d'après les classements finaux.
 * finalStandings : { [leagueId]: [teamId, …] } (ordre du classement, 1er en tête)
 * Renvoie [{ teamId, from, to, rank, ruleId }].
 */
export function calculateMovements(finalStandings, rules = PROMOTION_RULES) {
  const movements = [];
  for (const rule of rules) {
    const ranking = finalStandings[rule.sourceLeague] ?? [];
    const { startRank, endRank } = getRuleRanks(rule, ranking.length);
    for (let rank = startRank; rank <= endRank; rank++) {
      movements.push({ teamId: ranking[rank - 1], from: rule.sourceLeague, to: rule.targetLeague, rank, ruleId: rule.id });
    }
  }
  return movements;
}

/**
 * Applique les mouvements et renvoie les nouvelles compositions { [leagueId]: [teamId] }.
 *
 * Avec des divisions à la bonne taille, montées et descentes s'équilibrent et rien
 * d'autre ne change. Une saison héritée d'une ancienne sauvegarde (divisions d'une autre
 * taille) est ramenée au format courant, ajustements ajoutés à `movements` :
 *   'rebalance'  le dernier club resté dans une division en sureffectif descend d'un
 *                niveau (ou le premier d'une division inférieure monte combler un manque) ;
 *   'withdrawal' surplus dans la plus basse division : ses derniers clubs de l'IA quittent
 *                le championnat (to: null) ;
 *   'entry'      manque dans la plus basse division : un club hors championnat (`reserve`) entre.
 * Le club du joueur (`protectedIds`) ne quitte jamais le championnat.
 */
export function applyMovements(finalStandings, movements, { protectedIds = [], reserve = [] } = {}) {
  const compositions = Object.fromEntries(Object.entries(finalStandings).map(([id, ranking]) => [id, [...ranking]]));
  for (const move of movements) {
    compositions[move.from] = compositions[move.from].filter((id) => id !== move.teamId);
    compositions[move.to].push(move.teamId);
  }
  normalizeSizes(finalStandings, compositions, movements, { protectedIds, reserve });
  return compositions;
}

function normalizeSizes(finalStandings, compositions, movements, { protectedIds, reserve }) {
  const size = getLeagueSize();
  const tiers = listLeagueDefinitions().filter((def) => compositions[def.id]);
  const rankOf = (leagueId, teamId) => {
    const index = (finalStandings[leagueId] ?? []).indexOf(teamId);
    return index < 0 ? Infinity : index; // arrivants (sans rang dans cette division) : après les natifs
  };
  // Un club déjà promu, relégué ou déplacé n'est pas déplacé à nouveau.
  const moved = new Set(movements.map((m) => m.teamId));
  const move = (teamId, from, to, ruleId) => {
    compositions[from] = compositions[from].filter((id) => id !== teamId);
    if (to) compositions[to].push(teamId);
    moved.add(teamId);
    const rank = rankOf(from, teamId);
    movements.push({ teamId, from, to, rank: Number.isFinite(rank) ? rank + 1 : null, ruleId });
  };
  const candidates = (leagueId, { excludeProtected = false } = {}) => compositions[leagueId]
    .filter((id) => !moved.has(id) && !(excludeProtected && protectedIds.includes(id)))
    .sort((a, b) => rankOf(leagueId, a) - rankOf(leagueId, b));

  // Sureffectif : de haut en bas, le surplus descend ; la plus basse division s'en sépare.
  tiers.forEach((def, index) => {
    const lower = tiers[index + 1];
    while (compositions[def.id].length > size) {
      const pool = candidates(def.id, { excludeProtected: !lower });
      const teamId = pool.at(-1) ?? compositions[def.id].filter((id) => lower || !protectedIds.includes(id)).at(-1);
      if (!teamId) break;
      move(teamId, def.id, lower?.id ?? null, lower ? 'rebalance' : 'withdrawal');
    }
  });
  // Sous-effectif : de haut en bas, le meilleur club de la division inférieure monte ; la plus basse division puise dans la réserve.
  const available = reserve.filter((id) => !tiers.some((def) => compositions[def.id].includes(id)));
  tiers.forEach((def, index) => {
    const lower = tiers[index + 1];
    while (compositions[def.id].length < size) {
      if (lower) {
        const teamId = candidates(lower.id)[0] ?? compositions[lower.id][0];
        if (!teamId) break;
        move(teamId, lower.id, def.id, 'rebalance');
      } else {
        const teamId = available.shift();
        if (!teamId) break;
        compositions[def.id].push(teamId);
        movements.push({ teamId, from: null, to: def.id, rank: null, ruleId: 'entry' });
      }
    }
  });
}

/**
 * Invariant d'une saison : chaque division compte exactement LEAGUE_CONFIG.teamCount
 * équipes et chaque club n'est engagé que dans une seule division. Lève une erreur
 * (et bloque ainsi le lancement de la saison) sinon.
 */
export function validateLeagueSizes(compositions) {
  const size = getLeagueSize();
  const problems = [];
  const seen = new Set();
  for (const def of listLeagueDefinitions()) {
    if (!compositions[def.id]) problems.push(`${def.name} : division absente.`);
  }
  for (const [leagueId, teamIds] of Object.entries(compositions)) {
    const def = getLeagueDefinition(leagueId);
    if (!def) problems.push(`Division inconnue : ${leagueId}.`);
    else if (teamIds.length !== size) problems.push(`${def.name} : ${teamIds.length} clubs au lieu de ${size}.`);
    for (const id of teamIds) {
      if (seen.has(id)) problems.push(`Club présent deux fois : ${id}.`);
      seen.add(id);
    }
  }
  if (problems.length) throw new Error(`Composition des divisions invalide — ${problems.join(' ')}`);
  return true;
}
