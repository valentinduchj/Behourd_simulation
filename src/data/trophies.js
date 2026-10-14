// Trophées de la compagnie du joueur (systems/trophies/TrophyService.js, render/trophies.js).
// Un trophée n'est remis que pour une VICTOIRE FINALE : champion d'une Ligue (1re place du
// classement final), vainqueur de la finale de la Coupe de France. Rien pour une 2e place, une
// demi-finale ou une qualification. Chaque titre est une entrée distincte (trois titres de
// Ligue 3 = trois trophées).
//
//   competition  identifiant de la compétition (Ligue : son identifiant ; Coupe : 'cup')
//   name         nom du trophée ; title : titre du vainqueur
//   design       dessin du trophée (render/trophies.js) : métal, forme, ornement

export const TROPHY_TYPES = Object.freeze({
  league_1: Object.freeze({ competition: 'league_1', name: 'Trophée de Ligue 1', title: 'Champion de Ligue 1', order: 1, design: Object.freeze({ shape: 'grandCup', metal: 'gold', gem: '#b8402f' }) }),
  league_2: Object.freeze({ competition: 'league_2', name: 'Trophée de Ligue 2', title: 'Champion de Ligue 2', order: 2, design: Object.freeze({ shape: 'lidCup', metal: 'silver', gem: '#2d5a9a' }) }),
  league_3: Object.freeze({ competition: 'league_3', name: 'Trophée de Ligue 3', title: 'Champion de Ligue 3', order: 3, design: Object.freeze({ shape: 'goblet', metal: 'bronze', gem: '#3e7d3a' }) }),
  cup: Object.freeze({ competition: 'cup', name: 'Coupe de France', palmaresName: 'Calice d’or', title: 'Champion de France', order: 0, design: Object.freeze({ shape: 'crownCup', metal: 'gold', gem: '#2d4a7a', ribbon: '#2d4a7a' }) }),
});

export const TROPHY_ORDER = Object.freeze(['cup', 'league_1', 'league_2', 'league_3']);

// Armoire de la Taverne : trophées visibles par étagère (au-delà, la vue détaillée les montre tous).
export const TROPHY_CABINET = Object.freeze({ shelves: 3, perShelf: 4 });

// Palmarès des fiches de club (v0.69, systems/trophies/PalmaresService.js) : les trophées
// ci-dessus, plus des RUBANS de classement propres aux fiches de club (pas d'objet dans l'armoire).
// Tout est calculé depuis l'historique enregistré du club, cumulé, sans notion de saison.
//   position / cupStage  ce qui vaut le ruban (place finale en Ligue, ou stade de Coupe)
//   colors               rosette (fond, bord), queues, chiffre ou symbole au centre (mark)
export const PALMARES_RIBBONS = Object.freeze({
  second: Object.freeze({ id: 'second', name: 'Ruban de deuxième place', title: '2e place en Ligue', position: 2, mark: '2', colors: Object.freeze({ disc: '#d5dbe0', rim: '#6f777e', tails: '#5b7fa8', text: '#2a2f33' }) }),
  third: Object.freeze({ id: 'third', name: 'Ruban de troisième place', title: '3e place en Ligue', position: 3, mark: '3', colors: Object.freeze({ disc: '#e3a874', rim: '#7a4a24', tails: '#8a3b2b', text: '#3a200c' }) }),
  cupFinalist: Object.freeze({ id: 'cupFinalist', name: 'Ruban de finaliste', title: 'Finaliste de la Coupe de France', cupStage: 'finalist', mark: '★', colors: Object.freeze({ disc: '#f2dc8c', rim: '#8a6114', tails: '#2d4a7a', text: '#2d4a7a' }) }),
});

// Ordre d'affichage du palmarès : trophées (Coupe, Ligue 1 → 3), puis rubans.
export const PALMARES_ORDER = Object.freeze(['cup', 'league_1', 'league_2', 'league_3', 'second', 'third', 'cupFinalist']);
