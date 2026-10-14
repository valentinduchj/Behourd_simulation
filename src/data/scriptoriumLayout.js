// Intérieur du Scriptorium (vue isométrique, scriptorium/) — données de PRÉSENTATION uniquement :
// décor, Bureau d'étude, Professeure Flavia, personnages et animaux d'ambiance. Aucune règle ici
// (règles : data/scriptorium.js).
//
// Une bibliothèque fortifiée de citadelle : murs de pierre, voûte de bois, rayonnages, pupitres
// de copistes, coin d'astronomie, chandeliers ; au premier plan à gauche, le cabinet de Flavia.
//
//   width, height  dallage, en cases (x : vers la droite, y : vers la gauche de l'écran)
//   walls          décor des murs du fond (le long de y = 0) et de gauche (le long de x = 0)
//   props          mobilier (render/scriptoriumProps.js, render/tavernProps.js, render/propRenderers.js)
//                  layer 'ground' : dessiné au sol, sous les personnages
//                  requires : amélioration nécessaire pour qu'il apparaisse (second Bureau)
//   desk           le Bureau d'étude : zone cliquable (area), places des combattants en étude
//                  (seats : stand, geste `work`, amélioration requise), étiquette (label)
//   flavia         la Professeure Flavia : zone cliquable de 4 × 4 cases, place, étiquette
//   cat            le Sacré de Birmanie : coins où il se promène, gamelles, coussin
//   mouse          la souris : sortie entre deux livres, trajet, trou où elle se réfugie,
//                  intervalle moyen entre deux apparitions (secondes)
//   workers        personnages qui travaillent sur place (gestes : borough/artisanAnimations.js)
//   walkers        personnages qui circulent (tournées avec pauses, borough/BoroughScene.js › patrolAt)

export const SCRIPTORIUM_LAYOUT = Object.freeze({
  width: 13,
  height: 13,
  floor: ['#8d8579', '#857d71'],
  wall: { stone: '#6f675d', upper: '#857c70', beam: '#4a3220', height: 1.9 },
  walls: {
    back: [
      { type: 'window', x: 7.1 },
      { type: 'starChart', x: 9.0 },
      { type: 'banner', x: 6.4, color: '#5a2a5e', emblem: '#e0b43a' },
    ],
    left: [
      { type: 'window', y: 2.4 },
      // Porte vers le Centre (sortie : data/locations.js › scriptorium_door_exit).
      { type: 'door', y: 4.5, width: 0.95 },
      { type: 'starChart', y: 7.0 },
      { type: 'sconce', y: 5.7 },
      { type: 'sconce', y: 3.3 },
      // Cabinet de Flavia : fenêtre, bannière verte, trou de souris au ras du sol.
      { type: 'window', y: 11.7 },
      { type: 'banner', y: 12.5, color: '#2f5e3a', emblem: '#e0b43a' },
      { type: 'sconce', y: 11.0 },
      { type: 'mouseHole', y: 12.35 },
    ],
  },

  props: [
    // La grande bibliothèque, contre le mur du fond.
    { type: 'bookshelf', x: 0, y: 0, w: 2, h: 1, seed: 1 },
    { type: 'bookshelf', x: 2, y: 0, w: 2, h: 1, seed: 2 },
    { type: 'bookshelf', x: 4, y: 0, w: 2, h: 1, seed: 3 },
    { type: 'bookshelf', x: 10, y: 0, w: 3, h: 1, seed: 4 },
    // Coin d'astronomie, sous la fenêtre : lunette, sphère armillaire.
    { type: 'telescope', x: 7, y: 1 },
    { type: 'armillary', x: 9, y: 1 },
    // Pupitres des copistes (registres, encriers, chandelles).
    { type: 'scribeDesk', x: 2, y: 3, w: 2, h: 1 },
    { type: 'scribeDesk', x: 2, y: 6, w: 2, h: 1 },
    { type: 'lectern', x: 5, y: 2 },
    // Au milieu : tapis et globe terrestre.
    { type: 'rug', x: 4, y: 4, w: 3, h: 3, layer: 'ground', blocking: false, color: '#3d2a5a', trim: '#c9a227' },
    { type: 'globe', x: 5, y: 5 },
    // Réserve de parchemins le long du mur de gauche.
    { type: 'scrollChest', x: 0, y: 8 },
    { type: 'bookPile', x: 1, y: 8 },
    // Chandeliers.
    { type: 'candelabra', x: 7, y: 3 },
    { type: 'candelabra', x: 5, y: 9 },
    { type: 'candelabra', x: 12, y: 4 },
    // Le Bureau d'étude : bureaux, livres, instruments, mannequins d'entraînement.
    { type: 'studyDesk', x: 8, y: 6, w: 2, h: 1 },
    { type: 'studyDesk', x: 10, y: 6, w: 2, h: 1, requires: 'extra-desk' },
    { type: 'bookPile', x: 8, y: 8 },
    { type: 'dummy', x: 12, y: 6 },
    { type: 'dummy', x: 12, y: 8 },
    { type: 'armillary', x: 8, y: 9, small: true },
    // Le cabinet de la Professeure Flavia : rayonnages contre le mur, table de travail
    // (manuscrits, astrolabe, sablier), chandelier, tapis vert ; le coin du chat.
    { type: 'rug', x: 1, y: 10, w: 3, h: 3, layer: 'ground', blocking: false, color: '#2f5e3a', trim: '#c9a227' },
    { type: 'bookshelfLeft', x: 0, y: 9, w: 1, h: 2, seed: 5 },
    { type: 'scholarTable', x: 2, y: 10, w: 2, h: 1 },
    { type: 'candelabra', x: 3, y: 9 },
    { type: 'catCushion', x: 3, y: 12, layer: 'ground', blocking: false },
    { type: 'catBowl', x: 1, y: 12, kind: 'water', layer: 'ground', blocking: false },
    { type: 'catBowl', x: 2, y: 12, kind: 'kibble', layer: 'ground', blocking: false },
    // Au premier plan : salle de lecture (pupitre de copiste, lutrin, livres, chandelier).
    { type: 'scribeDesk', x: 6, y: 11, w: 2, h: 1 },
    { type: 'lectern', x: 10, y: 11 },
    { type: 'bookPile', x: 8, y: 12 },
    { type: 'candelabra', x: 12, y: 11 },
    { type: 'scrollChest', x: 12, y: 12 },
  ],

  // Le Bureau d'étude (cliquable) : chaque combattant en étude se tient devant son bureau,
  // livre en main. La seconde place n'existe qu'avec l'amélioration de Flavia.
  desk: Object.freeze({
    area: Object.freeze({ x: 8, y: 5, w: 5, h: 5 }),
    seats: Object.freeze([
      Object.freeze({ stand: Object.freeze({ x: 9.0, y: 7.6 }), work: Object.freeze({ animation: 'read', target: Object.freeze({ x: 9, y: 6.5 }), work: 9, rest: 3 }) }),
      Object.freeze({ stand: Object.freeze({ x: 11.0, y: 7.6 }), work: Object.freeze({ animation: 'read', target: Object.freeze({ x: 11, y: 6.5 }), work: 8, rest: 4 }), requires: 'extra-desk' }),
    ]),
    label: Object.freeze({ x: 10.2, y: 5.2 }),
    color: '#7a4fa0',
  }),

  // La Professeure Flavia : zone d'interaction de 4 × 4 cases (logique, pas forcément visible),
  // derrière sa table de travail, face à la salle.
  flavia: Object.freeze({
    area: Object.freeze({ x: 0, y: 9, w: 4, h: 4 }),
    stand: Object.freeze({ x: 2.5, y: 9.5 }),
    // Ses allées et venues (scriptorium/FlaviaBehavior.js) : elle sort de derrière sa table par
    // la gauche (gap, front), se promène sur le tapis vert, consulte son rayonnage, caresse le chat.
    // Elle contourne la table (obstacle) par le point hub, devant elle.
    route: Object.freeze({
      gap: Object.freeze({ x: 1.5, y: 9.6 }),
      front: Object.freeze({ x: 1.3, y: 10.6 }),
      hub: Object.freeze({ x: 1.7, y: 11.6 }),
    }),
    table: Object.freeze({ x: 2, y: 10, w: 2, h: 1 }),
    // Place de l'artefact acquis sur la table (lot VFX 4), et hauteur du plateau (cases).
    artifactSpot: Object.freeze({ x: 2.3, y: 10.78, tableHeight: 0.36 }),
    shelf: Object.freeze({ stand: Object.freeze({ x: 0.95, y: 10.2 }), target: Object.freeze({ x: 0.2, y: 10.2 }) }),
    rugSpots: Object.freeze([Object.freeze({ x: 1.6, y: 11.8 }), Object.freeze({ x: 2.7, y: 11.6 }), Object.freeze({ x: 3.5, y: 11.4 }), Object.freeze({ x: 1.2, y: 12.3 })]),
    bounds: Object.freeze({ x: 0.8, y: 9.3, w: 3.1, h: 3.4 }),
    spriteId: 'scriptorium_flavia',
    label: Object.freeze({ x: 2.0, y: 9.2 }),
    color: '#2f5e3a',
  }),

  // Le Sacré de Birmanie : il se promène entre ces coins, boit et mange aux gamelles, dort sur
  // son coussin, guette les rayonnages (scriptorium/CatBehavior.js).
  cat: Object.freeze({
    start: Object.freeze({ x: 3.4, y: 12.4 }),
    spots: Object.freeze([
      Object.freeze({ x: 1.6, y: 11.3 }), Object.freeze({ x: 2.6, y: 11.7 }), Object.freeze({ x: 0.9, y: 10.9 }),
      Object.freeze({ x: 3.5, y: 11.2 }), Object.freeze({ x: 1.2, y: 9.8 }),
    ]),
    water: Object.freeze({ x: 1.5, y: 12.3 }),
    kibble: Object.freeze({ x: 2.5, y: 12.3 }),
    cushion: Object.freeze({ x: 3.5, y: 12.45 }),
    bounds: Object.freeze({ x: 0.3, y: 9.2, w: 3.6, h: 3.6 }),
  }),

  // La souris : elle sort d'un interstice entre deux livres du rayonnage de Flavia, file le long
  // du tapis et se réfugie dans le trou du mur. En moyenne toutes les 20 s (± 6 s).
  mouse: Object.freeze({
    path: Object.freeze([Object.freeze({ x: 0.62, y: 9.75 }), Object.freeze({ x: 1.7, y: 11.0 }), Object.freeze({ x: 0.9, y: 12.1 }), Object.freeze({ x: 0.08, y: 12.35 })]),
    speed: 2.3,
    interval: Object.freeze({ mean: 20, spread: 6 }),
  }),

  // Ceux qui travaillent sur place : copistes, lecteur au pupitre, bailli aux rayonnages.
  workers: [
    { role: 'Moine copiste', spriteId: 'spectator_10', stand: { x: 3.0, y: 4.3 }, view: 'back', work: { animation: 'write', target: { x: 3, y: 3.5 }, work: 9, rest: 2.5 } },
    { role: 'Scribe', spriteId: 'spectator_01', stand: { x: 3.1, y: 7.3 }, view: 'back', work: { animation: 'write', target: { x: 3, y: 6.5 }, work: 7, rest: 3 } },
    { role: 'Moine lecteur', spriteId: 'spectator_10', stand: { x: 5.5, y: 3.25 }, view: 'back', work: { animation: 'read', target: { x: 5.5, y: 2.5 }, work: 10, rest: 3 } },
    { role: 'Bailli', spriteId: 'artisan_seneschal', stand: { x: 11.4, y: 1.6 }, view: 'back', work: { animation: 'browse', target: { x: 11.4, y: 0.5 }, work: 6, rest: 4 } },
    { role: 'Copiste', spriteId: 'spectator_05', stand: { x: 7.0, y: 12.3 }, view: 'back', work: { animation: 'write', target: { x: 7, y: 11.5 }, work: 8, rest: 3 } },
    { role: 'Moine lecteur', spriteId: 'spectator_10', stand: { x: 10.5, y: 12.25 }, view: 'back', work: { animation: 'read', target: { x: 10.5, y: 11.5 }, work: 9, rest: 4 } },
  ],

  // Ceux qui circulent : moine entre les rayonnages, citoyens, bailli chargé de parchemins.
  // Deux lecteurs discutent devant le Bureau d'étude, loin du cabinet de Flavia (`chat` : bulle).
  walkers: [
    { role: 'Moine', spriteId: 'spectator_10', path: [{ x: 1.2, y: 1.55 }, { x: 4.6, y: 1.55 }, { x: 6.4, y: 1.7 }], pauses: [4, 3, 5], speed: 0.45, phase: 0 },
    { role: 'Citoyen', spriteId: 'spectator_04', path: [{ x: 0.8, y: 4.6 }, { x: 6.6, y: 4.3 }, { x: 7.4, y: 8.0 }, { x: 2.6, y: 8.1 }], pauses: [2, 3, 4, 3], speed: 0.5, phase: 7 },
    { role: 'Bailli', spriteId: 'spectator_05', path: [{ x: 7.8, y: 2.4 }, { x: 12.3, y: 3.0 }, { x: 8.5, y: 3.6 }], pauses: [3, 4, 2], speed: 0.4, phase: 3 },
    { role: 'Citoyenne', spriteId: 'spectator_02', x: 8.9, y: 10.45, view: 'front', chat: 'lecteurs', idle: 'still' },
    { role: 'Étudiant', spriteId: 'spectator_11', x: 9.65, y: 10.75, view: 'front', flip: true, chat: 'lecteurs' },
  ],
});
