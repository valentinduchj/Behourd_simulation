// Fatigue hors des manches (v0.75) : ce qu'un combat laisse derrière lui, et ce que la fatigue
// coûte au Centre. Les règles PENDANT la manche (gain tour par tour, malus de dégâts au-delà de 50)
// sont dans data/combatRules.js et ne changent pas. Valeurs « à valider ».
//
//   states     états affichés au joueur, du plus reposé au plus épuisé : { id, label, from }
//              (`from` : fatigue à partir de laquelle l'état s'applique ; le talent Sang-froid
//              décale ces seuils comme celui des dégâts). « Fatigué » commence au seuil du malus
//              de dégâts (COMBAT_RULES.fatigueDamage.threshold).
//   soreness   courbatures du lendemain, à la fin de chaque vrai combat du joueur (championnat,
//              Combat de la Reine, Coupe de France ; jamais la Lice d'entraînement) :
//              + perRound par manche disputée, + knockedOut s'il a été mis KO pendant le combat.
//              Le plafond du talent Bon vivant s'applique.
//   centre     tired      : au Centre, la réussite des entraînements et de la Forêt est
//                           multipliée par chanceFactor (le Banquet n'est jamais concerné) ;
//              exhausted  : il refuse tout autre lieu que `refuge` ; s'il y était affecté, il y est
//                           envoyé d'office (fin du combat, puis chaque jour au besoin).
export const FATIGUE_RULES = Object.freeze({
  states: Object.freeze([
    Object.freeze({ id: 'rested', label: 'Reposé', from: 0 }),
    Object.freeze({ id: 'tired', label: 'Fatigué', from: 50 }),
    Object.freeze({ id: 'exhausted', label: 'Épuisé', from: 70 }),
  ]),
  soreness: Object.freeze({ perRound: 15, knockedOut: 10 }),
  centre: Object.freeze({
    tired: Object.freeze({ chanceFactor: 0.5 }),
    exhausted: Object.freeze({ refuge: 'banquet' }),
  }),
});
