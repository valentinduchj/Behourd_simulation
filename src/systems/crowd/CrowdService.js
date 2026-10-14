import { CROWD_CONFIG } from '../../data/crowd.js';
import { LEAGUE_RULES } from '../../data/leagues.js';
import { getLeagueDefinition } from '../league/LeagueService.js';
import { getStandings } from '../league/StandingsService.js';

// Affluence d'un combat de La Lice — PRÉSENTATION : le résultat ne sert qu'à l'affichage
// de la foule et n'intervient dans aucune règle de combat. Valeurs : data/crowd.js.

/** Prestige d'un rang dans une division de `size` équipes : 1 pour le 1er, 0 pour le dernier. */
export function getRankPrestige(rank, size) {
  if (!(size > 1)) return 0.5;
  return Math.max(0, Math.min(1, (size - rank) / (size - 1)));
}

/** Interpolation linéaire de la courbe de référence (prestige → spectateurs). */
export function getReferenceCrowd(prestige, curve = CROWD_CONFIG.referenceCurve) {
  const p = Math.max(0, Math.min(1, prestige));
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if (p <= b.prestige) {
      const t = b.prestige === a.prestige ? 1 : (p - a.prestige) / (b.prestige - a.prestige);
      return a.spectators + (b.spectators - a.spectators) * t;
    }
  }
  return curve[curve.length - 1].spectators;
}

/**
 * Nombre de spectateurs d'un combat.
 *   teamA, teamB : { rank } (ou { position }) — rang au classement actuel
 *   league       : division (modèle League, ou { tier, size })
 *   options.rng  : variation aléatoire (± config.variation) ; sans rng, résultat déterministe
 */
export function calculateCrowdSize(teamA, teamB, league, { rng = null, config = CROWD_CONFIG } = {}) {
  const size = league.size ?? league.teamIds?.length ?? 0;
  const tier = league.tier ?? getLeagueDefinition(league.definitionId ?? league.id)?.tier;
  const rankOf = (team) => team.rank ?? team.position;
  const prestige = (getRankPrestige(rankOf(teamA), size) + getRankPrestige(rankOf(teamB), size)) / 2;
  const profile = config.byTier[tier] ?? config.defaultTier;
  let crowd = getReferenceCrowd(prestige, config.referenceCurve) * profile.multiplier;
  if (rng) crowd *= 1 + (rng() * 2 - 1) * config.variation;
  return Math.round(Math.max(profile.minimum, Math.min(profile.maximum, crowd)));
}

/**
 * Rangs « partagés » d'un classement : des clubs à égalité (points et départages) se
 * partagent la moyenne de leurs rangs — en début de saison, tous sont ainsi au milieu
 * du classement plutôt que rangés par ordre alphabétique. Renvoie Map(teamId → rang).
 */
export function getSharedRanks(rows) {
  const key = (row) => [row.points, ...LEAGUE_RULES.tiebreakers.map((k) => row[k] ?? 0)].join('|');
  const ranks = new Map();
  for (let i = 0; i < rows.length;) {
    let j = i;
    while (j < rows.length && key(rows[j]) === key(rows[i])) j++;
    const shared = (i + 1 + j) / 2; // moyenne des rangs i+1 … j
    for (let k = i; k < j; k++) ranks.set(rows[k].team.id, shared);
    i = j;
  }
  return ranks;
}

/** Règle propre à un type de combat (ex. Combat de la Reine : 50 spectateurs au minimum), prioritaire. */
export function applyCombatKindRule(crowd, kind, config = CROWD_CONFIG) {
  const rule = kind ? config.byCombatKind?.[kind] : null;
  return rule?.minimum ? Math.max(rule.minimum, crowd) : crowd;
}

/**
 * Bonus du lieu du combat (améliorations d'une lice, systems/lice/LiceService.js) :
 * affluence × multiplier + flat, arrondie. Sans bonus, l'affluence est inchangée.
 */
export function applyVenueBonus(crowd, venueBonus = null) {
  if (!venueBonus) return crowd;
  return Math.max(0, Math.round(crowd * (venueBonus.multiplier ?? 1) + (venueBonus.flat ?? 0)));
}

/**
 * Affluence d'un combat d'après le classement actuel de la division des deux clubs.
 * `kind` : type de combat ('combat' : championnat, 'queen' : Combat de la Reine).
 * `options.venueBonus` : bonus de la lice où se dispute le combat ({ multiplier, flat }).
 * Aucun appelant ne le transmet encore : le choix de la lice (domicile / extérieur) n'existe
 * pas ; il suffira de le passer ici le moment venu.
 */
export function getMatchCrowdSize(session, { teamAId, teamBId, kind = null }, options = {}) {
  const league = session.getLeagueOfTeam(teamAId) ?? session.getLeagueOfTeam(teamBId);
  if (!league) return applyCombatKindRule(applyVenueBonus(0, options.venueBonus), kind, options.config);
  const rows = getStandings(session, league);
  const ranks = getSharedRanks(rows);
  const fallback = (rows.length + 1) / 2;
  const crowd = calculateCrowdSize(
    { rank: ranks.get(teamAId) ?? fallback },
    { rank: ranks.get(teamBId) ?? fallback },
    league,
    options,
  );
  return applyCombatKindRule(applyVenueBonus(crowd, options.venueBonus), kind, options.config);
}
