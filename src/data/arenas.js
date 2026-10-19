// Terrains de combat — données de JEU uniquement (grille et placements). Le décor, la
// palissade et la foule relèvent de la présentation (data/liceDecorations.js, data/crowd.js).
//
//   width, height   grille de combat, en cases (x : longueur, y : largeur)
//   sides           pour chaque camp : zone de placement autorisée et emplacements par défaut
//                   (le camp 0 est toujours celui qui place ses combattants : le joueur)
//
// La Lice : 13 cases de longueur × 8 de largeur. Les deux camps se font face dans la
// longueur, séparés par la colonne centrale (x = 6).
export const ARENAS = Object.freeze({
  lice: {
    id: 'lice',
    name: 'La Lice',
    width: 13,
    height: 8,
    sides: [
      {
        // Toute la largeur (rangées 0 à 7) : un Lutteur peut se poser contre chaque barrière.
        area: { x: 1, y: 0, w: 5, h: 8 },
        // Emplacements par défaut (sans lecture des classes) ; la formation du béhourd est celle
        // du placement automatique (combat/engine/AIPlacementStrategy.js).
        defaultSlots: [
          { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 4, y: 1 },
          { x: 4, y: 6 }, { x: 3, y: 3 }, { x: 3, y: 4 },
        ],
      },
      {
        area: { x: 7, y: 0, w: 5, h: 8 },
        defaultSlots: [
          { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 8, y: 6 },
          { x: 8, y: 1 }, { x: 9, y: 4 }, { x: 9, y: 3 },
        ],
      },
    ],
  },
  // Le Sentier (v1.1, expéditions singulières) : une lice deux fois plus petite que La Lice
  // (7 × 4), pour des duels en un contre un, en pleine forêt.
  sentier: {
    id: 'sentier',
    name: 'Le Sentier',
    width: 7,
    height: 4,
    sides: [
      { area: { x: 0, y: 0, w: 3, h: 4 }, defaultSlots: [{ x: 1, y: 1 }, { x: 1, y: 2 }] },
      { area: { x: 4, y: 0, w: 3, h: 4 }, defaultSlots: [{ x: 5, y: 2 }, { x: 5, y: 1 }] },
    ],
  },
});

export const DEFAULT_ARENA_ID = 'lice';
