// Domicile / extérieur des matchs de Ligue du joueur (systems/league/MatchLocationService.js,
// VenueService.js, HomeRewardService.js). Les Combats de la Reine ne sont pas concernés.

export const MATCH_LOCATIONS = Object.freeze({ HOME: 'HOME', AWAY: 'AWAY' });

// Alternance des matchs de Ligue du joueur, saison par saison : le 1er match est à domicile,
// puis domicile et extérieur alternent strictement (seuls les matchs de Ligue comptent).
export const HOME_AWAY_RULES = Object.freeze({
  firstMatch: MATCH_LOCATIONS.HOME,
  sequence: Object.freeze([MATCH_LOCATIONS.HOME, MATCH_LOCATIONS.AWAY]),
});

// Récompense d'une VICTOIRE à domicile, selon le niveau de la lice du club (data/liceUpgrades.js) :
// montant tiré entre min et max (inclus). Un niveau sans entrée reprend celle du plus haut
// niveau défini en dessous (à valider quand les niveaux suivants existeront).
export const HOME_REWARD_CURRENCY = 'deniers';
export const HOME_REWARD_BY_LICE_LEVEL = Object.freeze({
  1: Object.freeze({ min: 20, max: 50 }),
  // 2: { min, max } — à définir avec les améliorations de la lice.
});
