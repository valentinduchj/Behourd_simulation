// Talents de combat des clubs de l'IA (v1.2.1). Règle par division : pour chaque famille, un
// nombre de combattants tiré (équiprobable) dans [min, max], choisis parmi les `topCount`
// meilleurs du club (niveau, ordre de la fiche du club). Tirage à la création des équipes, puis
// ajustement au plus juste à chaque fin de Coupe de France (après les retraites) :
// AITalentService.applyClubTalentRule.
//
//   rules       par division (id de data/leagues.js, ou 'reserve' : clubs hors championnat)
//   domains     domaines de talents retenus comme « de combat » (data/talents.js) ; un talent
//               n'est retenu que si TOUS ses effets agissent en combat (TalentEffects.COMBAT_TYPES)
//   excluded    familles jamais données à l'IA
export const AI_TALENT_RULES = Object.freeze({
  topCount: 5,
  maxPerFighter: 2,
  rules: Object.freeze({
    league_3: Object.freeze([Object.freeze({ rarity: 'common', min: 0, max: 2 })]),
    league_2: Object.freeze([Object.freeze({ rarity: 'common', min: 1, max: 3 }), Object.freeze({ rarity: 'rare', min: 0, max: 1 })]),
    league_1: Object.freeze([Object.freeze({ rarity: 'rare', min: 1, max: 3 }), Object.freeze({ rarity: 'epic', min: 1, max: 2 })]),
    // Clubs hors championnat (Combats de la Reine) : règle de la Ligue 1.
    reserve: Object.freeze([Object.freeze({ rarity: 'rare', min: 1, max: 3 }), Object.freeze({ rarity: 'epic', min: 1, max: 2 })]),
  }),
  // Combat, Aura, Moral (capitaine), fatigue pendant la manche, saisonniers de combat.
  domains: Object.freeze(['Combat', 'Aura', 'Moral', 'Fatigue', 'Été', 'Automne', 'Hiver', 'Printemps', 'Saisons']),
  excluded: Object.freeze(['exotic']),
});
