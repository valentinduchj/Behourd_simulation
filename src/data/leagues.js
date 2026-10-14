// Pays, divisions et règles du championnat. Les trois divisions utilisent le même
// moteur (systems/league/) : seules ces données les distinguent.

export const COUNTRIES = Object.freeze({
  fr: { id: 'fr', name: 'France' },
});

/**
 * Format du championnat — SOURCE UNIQUE. Tout en découle :
 *   N = teamCount équipes par division → N − 1 adversaires, N − 1 journées (aller simple),
 *   N / 2 rencontres par journée, N × (N − 1) / 2 rencontres par division et par saison ;
 *   les `promotionCount` premiers montent, les `relegationCount` derniers descendent.
 */
export const LEAGUE_CONFIG = Object.freeze({
  teamCount: 18,
  promotionCount: 3,
  relegationCount: 3,
  // Aller simple : chaque club rencontre chaque autre club une fois (false : aller-retour).
  singleRoundRobin: true,
  // Répartition des clubs de l'IA dans une NOUVELLE partie :
  //   'level' : les clubs des trois fichiers de division sont classés par niveau (8 meilleurs
  //             combattants) ; les plus forts en Ligue 1, les suivants en Ligue 2, les plus
  //             faibles en Ligue 3 (avec la compagnie du joueur). Égalité : ordre des fichiers.
  //   'file'  : chaque club commence dans la division de son fichier.
  // Les parties en cours gardent leurs divisions.
  initialDistribution: 'level',
});

export const LEAGUE_TEAM_COUNT = LEAGUE_CONFIG.teamCount;

/**
 * Divisions (toutes de LEAGUE_CONFIG.teamCount équipes). `tier` : 1 = plus haute division.
 *   clubsFile   composition INITIALE (clubs de l'IA) pour une nouvelle partie
 *   playerStart division de départ de la compagnie du joueur (elle y occupe une place)
 */
export const LEAGUE_DEFINITIONS = Object.freeze([
  { id: 'league_1', countryId: 'fr', name: 'Ligue 1', tier: 1, clubsFile: 'data/leagues/league_1.json' },
  { id: 'league_2', countryId: 'fr', name: 'Ligue 2', tier: 2, clubsFile: 'data/leagues/league_2.json' },
  { id: 'league_3', countryId: 'fr', name: 'Ligue 3', tier: 3, clubsFile: 'data/leagues/league_3.json', playerStart: true },
]);

/**
 * Clubs hors championnat : définis (anciennes sauvegardes, Module Admin) mais engagés
 * dans aucune division d'une nouvelle partie. Ils complètent une division en sous-effectif.
 */
export const RESERVE_POOL = Object.freeze({ id: 'reserve', name: 'Hors championnat', clubsFile: 'data/leagues/reserve.json' });

/** Division de départ du joueur. */
export const DEFAULT_LEAGUE_ID = LEAGUE_DEFINITIONS.find((def) => def.playerStart).id;

/**
 * Montées et descentes entre divisions voisines, déduites de LEAGUE_CONFIG
 * (appliquées en fin de saison par systems/league/PromotionService.js).
 *   zone 'top'    : les `count` premiers du classement final montent
 *   zone 'bottom' : les `count` derniers descendent
 * Les rangs concrets dépendent de la taille de la division (getRuleRanks).
 */
export const PROMOTION_RULES = Object.freeze(
  [...LEAGUE_DEFINITIONS].sort((a, b) => a.tier - b.tier).flatMap((upper, index, tiers) => {
    const lower = tiers[index + 1];
    if (!lower) return [];
    return [
      { id: `l${upper.tier}-to-l${lower.tier}`, sourceLeague: upper.id, targetLeague: lower.id, zone: 'bottom', count: LEAGUE_CONFIG.relegationCount },
      { id: `l${lower.tier}-to-l${upper.tier}`, sourceLeague: lower.id, targetLeague: upper.id, zone: 'top', count: LEAGUE_CONFIG.promotionCount },
    ];
  }).map(Object.freeze),
);

/** Rangs (inclusifs) concernés par une règle dans une division de `leagueSize` équipes. */
export function getRuleRanks(rule, leagueSize = LEAGUE_CONFIG.teamCount) {
  return rule.zone === 'top'
    ? { startRank: 1, endRank: Math.min(rule.count, leagueSize) }
    : { startRank: Math.max(1, leagueSize - rule.count + 1), endRank: leagueSize };
}

/** Rythme des saisons. */
export const SEASON_CONFIG = Object.freeze({
  // Jour de la 1re journée de la 1re saison.
  firstMatchdayDay: 4,
  // Jours SANS combat entre deux journées de championnat (tirage uniforme, bornes comprises),
  // tiré une fois à la génération du calendrier puis enregistré avec les dates.
  // Ex. 4 : combat le jour 4, puis le jour 9 (jours 5 à 8 libres). La même règle vaut
  // entre la dernière journée d'une saison et la première de la suivante.
  daysBetweenMatches: Object.freeze({ min: 4, max: 6 }),
});

/** Règles de classement. */
export const LEAGUE_RULES = Object.freeze({
  // Points attribués à l'issue d'un combat (il n'y a pas de match nul : 2 manches gagnantes).
  points: Object.freeze({ win: 3, lossWithRound: 1, loss: 0 }),
  // Départages après les points — NON DÉFINIS. Clés possibles : toute colonne du
  // classement (ex. 'wins', 'roundDifference'), triée de façon décroissante.
  // À égalité complète, l'ordre alphabétique sert d'affichage stable.
  tiebreakers: [],
});
