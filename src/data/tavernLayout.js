// Intérieur de la Taverne (vue isométrique, tavern/) — données de PRÉSENTATION uniquement :
// décor, emplacements des recrues, tavernier et clients décoratifs. Aucune règle ici.
//
//   width, height  plancher, en cases (x : vers la droite, y : vers la gauche de l'écran)
//   walls          murs du fond (le long de y = 0 et de x = 0) : fenêtres, décorations
//   props          mobilier (types : render/tavernProps.js et render/propRenderers.js)
//                  blocking (défaut : true) : les recrues contournent la case
//                  layer 'ground' : dessiné au sol, sous les personnages
//   blocked        cases interdites aux recrues sans mobilier (derrière le comptoir)
//   spots          cases où une recrue peut s'arrêter (debout, près des tables ou du comptoir)
//   keeper         le tavernier (personnage cliquable, fixe)
//   patrons        clients attablés (décor, non cliquables)

export const TAVERN_LAYOUT = Object.freeze({
  width: 14,
  height: 10,
  floor: ['#8a5f38', '#7e5532'],
  wall: { stone: '#7d7266', plaster: '#d9c7a0', beam: '#5a3b1e', height: 1.7 },
  // Décor des murs : fenêtres (lumière du soir), boucliers, bannière.
  walls: {
    back: [
      { type: 'shield', x: 1.0, color: '#a8322d', emblem: '#e0b43a' },
      { type: 'banner', x: 10.4, color: '#2d5a9a', emblem: '#e0b43a' },
      { type: 'shield', x: 4.6, color: '#2d5a9a', emblem: '#f4ecd8' },
    ],
    left: [
      { type: 'window', y: 2.5 },
      // Porte d'entrée : elle s'ouvre quand de nouvelles recrues arrivent (rotation, effets visuels).
      { type: 'door', y: 4.05, width: 0.95 },
      { type: 'window', y: 5.6 },
      { type: 'shield', y: 8.2, color: '#3e7d3a', emblem: '#f4ecd8' },
      // Pancarte des statistiques des combattants (cliquable : classements).
      { type: 'statsBoard', y: 7.0 },
    ],
  },

  props: [
    // Contre le mur du fond : cheminée, étagères de vaisselle, tonneaux en perce.
    { type: 'fireplace', x: 2, y: 0, w: 2, h: 1 },
    { type: 'shelf', x: 5, y: 0, w: 2, h: 1 },
    // Armoire à trophées de la compagnie (cliquable : palmarès). Ses trophées viennent du palmarès.
    { type: 'trophyCabinet', x: 7, y: 0, w: 2, h: 1 },
    { type: 'kegRack', x: 10, y: 0, w: 3, h: 1 },
    { type: 'barrel', x: 13, y: 0 },
    { type: 'barrel', x: 13, y: 1 },
    // Le comptoir (le tavernier se tient derrière).
    { type: 'counter', x: 9, y: 2, w: 4, h: 1 },
    // Contre le mur de gauche : réserve.
    { type: 'barrel', x: 0, y: 7 },
    { type: 'barrel', x: 0, y: 8 },
    { type: 'crate', x: 0, y: 9 },
    // Tables, bancs et tabourets.
    { type: 'rug', x: 5, y: 3, w: 3, h: 4, layer: 'ground', blocking: false },
    { type: 'bench', x: 2, y: 3, w: 2, h: 1 },
    { type: 'longTable', x: 2, y: 4, w: 2, h: 1 },
    { type: 'bench', x: 2, y: 5, w: 2, h: 1 },
    { type: 'stool', x: 5, y: 5 },
    { type: 'roundTable', x: 6, y: 5 },
    { type: 'stool', x: 7, y: 5 },
    { type: 'stool', x: 6, y: 6 },
    { type: 'stool', x: 2, y: 8 },
    { type: 'roundTable', x: 3, y: 8 },
    { type: 'stool', x: 4, y: 8 },
    { type: 'bench', x: 8, y: 6, w: 2, h: 1 },
    { type: 'longTable', x: 8, y: 7, w: 2, h: 1 },
    { type: 'bench', x: 8, y: 8, w: 2, h: 1 },
    { type: 'roundTable', x: 11, y: 6 },
    { type: 'stool', x: 12, y: 6 },
    { type: 'stool', x: 11, y: 7 },
    // Lanternes et caisses.
    { type: 'lantern', x: 13, y: 4 },
    { type: 'lantern', x: 6, y: 9 },
    { type: 'crate', x: 12, y: 9 },
    { type: 'crate', x: 13, y: 9 },
  ],

  blocked: [{ x: 9, y: 1, w: 4, h: 1 }],

  spots: [
    { x: 1, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 6 }, { x: 7, y: 6 }, { x: 3, y: 7 }, { x: 10, y: 7 },
    { x: 7, y: 8 }, { x: 9, y: 3 }, { x: 11, y: 3 }, { x: 10, y: 5 }, { x: 1, y: 6 }, { x: 5, y: 9 },
  ],

  keeper: { x: 11.5, y: 1.55, spriteId: 'artisan_tavernkeeper' },

  patrons: [
    { spriteId: 'spectator_09', x: 2.6, y: 3.55, view: 'front' },
    { spriteId: 'spectator_02', x: 9.4, y: 8.45, view: 'back', flip: true },
  ],

  // Déplacement des recrues (purement visuel) : vitesse (cases par seconde) et pauses.
  wander: Object.freeze({ speed: 0.9, pause: Object.freeze({ min: 3, max: 8 }) }),
});
