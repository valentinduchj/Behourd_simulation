// Combats de la Reine : événements spéciaux, indépendants du championnat
// (systems/queen/QueenCombatService.js). Ils ne modifient ni le classement, ni les
// journées de championnat, ni les montées et descentes.

export const QUEEN_COMBAT_CONFIG = Object.freeze({
  // Jours entre deux Combats de la Reine (tirage uniforme, bornes comprises), à partir
  // de la date du précédent (ou du début de la partie pour le premier).
  interval: Object.freeze({ min: 15, max: 18 }),

  // Nombre d'adversaires proposés ; le joueur en choisit un seul. Ils sont présentés du
  // moins étoilé au plus étoilé (à égalité, dans l'ordre du tirage).
  opponentOptions: 5,

  // Autres Combats de la Reine du même jour : combats IA contre IA simulés en parallèle
  // (2 clubs chacun, tirés parmi tous les clubs des origines ci-dessous, ligues mélangées,
  // jamais parmi les adversaires proposés au joueur). Ils ne vont pas au carnet de bord.
  secondaryMatches: 4,

  // Lice des Combats de la Reine : décor réservé (data/liceDecorations.js, `exclusiveTo: 'queen'`),
  // utilisé par aucun autre combat. La grille de combat reste celle de La Lice.
  arenaDecorationId: 'lice_queen',

  // Origine de chaque proposition (tirage indépendant, poids en %). `pool` :
  //   'reserve' — clubs hors championnat (data/leagues/reserve.json, non engagés dans une division)
  //   identifiant de division — clubs qui y sont engagés cette saison (hors compagnie du joueur)
  opponentPools: Object.freeze([
    Object.freeze({ pool: 'reserve', weight: 50 }),
    Object.freeze({ pool: 'league_2', weight: 20 }),
    Object.freeze({ pool: 'league_3', weight: 20 }),
    Object.freeze({ pool: 'league_1', weight: 10 }),
  ]),

  // Récompense de base (deniers) selon le niveau en étoiles du club adverse. En dessous
  // de la plus petite valeur définie (club à 0 étoile), la plus petite récompense s'applique.
  rewardsByStars: Object.freeze({ 1: 10, 2: 30, 3: 60, 4: 150, 5: 450 }),
  // Variation tirée une seule fois, à la proposition : ± 15 % (montant arrondi au denier).
  rewardVariation: 0.15,
  // Multiplicateur propre aux Combats de la Reine, appliqué au montant tiré (barème ± variation).
  rewardMultiplier: 2,

  // Fatigue des manches d'un Combat de la Reine — VALEUR PROPRE NON DÉFINIE : avec null,
  // la fatigue des combats de championnat s'applique (MATCH_RULES.fatigue). Pour la
  // définir : { roundWinner: { min, max }, roundLoser: { min, max } }.
  fatigue: null,
});
