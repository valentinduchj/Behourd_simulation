// Décors de La Lice — PRÉSENTATION uniquement. La grille (13 × 8), les placements et la
// simulation sont identiques quel que soit le décor (data/arenas.js).
//
//   background   dégradé du fond du canvas (haut → bas)
//   ground       sol par zone : `arena` (terrain de combat), `crowd` (bande des spectateurs,
//                le long de la palissade), `outer` (alentours) ; `slab` : tranche du socle.
//                style : 'checker' (damier de 2 teintes), 'speckle' (teintes mêlées et
//                grains), 'cobble' (pavés), 'flagstone' (dalles) — voir render/groundStyles.js
//   fence        couleurs de la palissade de bois (toujours présente)
//   layout       crowdBand : largeur de la bande réservée aux spectateurs (cases) ;
//                ringWidth : largeur de la ceinture de décor au-delà
//   props        éléments de décor tirés au hasard (déterministe) dans la ceinture :
//                `back`  côtés arrière et coins (éléments hauts permis)
//                `front` côtés avant, entre la caméra et La Lice (éléments bas uniquement,
//                        pour ne jamais gêner la lecture du combat)
//                entrée : { type, weight, w?, h?, row?: 'outer' | 'inner', variants? }
//                (type null = case vide ; `variants` : propriétés tirées au hasard ;
//                 types : render/propRenderers.js)
//   weight       fréquence de tirage du décor pour un combat
//   exclusiveTo  réservé à un type de combat (ex. 'queen' : Combats de la Reine) ; jamais tiré
//                pour les autres combats
//   path         chemin au-delà de la bande des spectateurs, le long d'un côté :
//                { side: 'south' | 'north' | 'east' | 'west', width, span? } ; sol `ground.path`, sans décor ;
//                span { from, to } : seulement cette portion du côté (cases du terrain), sinon tout le côté

const WOOD_FENCE = Object.freeze({ rail: '#8a6235', post: '#5a3b1e' });

const HOUSE_VARIANTS = [
  { wall: '#e8dcc0', roof: '#a8452f', height: 1.3 },
  { wall: '#d9c7a0', roof: '#6b5a4a', height: 1.2 },
  { wall: '#efe4cc', roof: '#8a3a2a', height: 1.4 },
  { wall: '#d6c3a5', roof: '#4f5a63', height: 1.25 },
];
const AWNINGS = [
  { color: '#b8402f', stripe: '#f4ecd8' },
  { color: '#2d5a9a', stripe: '#f4ecd8' },
  { color: '#3e7d3a', stripe: '#e0b43a' },
  { color: '#b07d1a', stripe: '#f4ecd8' },
];
const PENNANTS = [
  { color: '#b8402f', emblem: '#e0b43a' },
  { color: '#2d5a9a', emblem: '#f4ecd8' },
  { color: '#3e7d3a', emblem: '#f4ecd8' },
  { color: '#6b2c6e', emblem: '#e0b43a' },
];
const TENTS = [
  { color: '#e8dcc0', stripe: '#b8402f' },
  { color: '#e8dcc0', stripe: '#2d5a9a' },
  { color: '#d9c7a0', stripe: '#3e7d3a' },
  { color: '#efe4cc', stripe: '#b07d1a' },
];

export const LICE_DECORATIONS = Object.freeze([
  {
    id: 'lice_forest',
    name: 'Clairière forestière',
    description: 'La Lice dressée dans une clairière, entre arbres, buissons et rochers.',
    weight: 3,
    background: ['#a9cbe6', '#d3e6f0'],
    ground: {
      arena: { style: 'checker', colors: ['#dcc08a', '#d3b67e'], grid: 'rgba(80, 55, 25, 0.22)' },
      crowd: { style: 'checker', colors: ['#9ac874', '#90bf6c'] },
      outer: { style: 'checker', colors: ['#93c46e', '#8aba66'] },
      slab: { left: '#8b6a3f', right: '#6e5230' },
    },
    fence: WOOD_FENCE,
    layout: { crowdBand: 2, ringWidth: 2 },
    props: {
      back: [
        { type: 'tree', weight: 45 }, { type: 'bush', weight: 25 }, { type: 'flowers', weight: 15 },
        { type: 'rock', weight: 5 }, { type: null, weight: 10 },
      ],
      front: [
        { type: 'bush', weight: 30 }, { type: 'flowers', weight: 25 }, { type: 'rock', weight: 12 },
        { type: 'stump', weight: 8 }, { type: null, weight: 25 },
      ],
    },
  },
  {
    id: 'lice_sand',
    name: 'Grève sablonneuse',
    description: 'Une Lice installée sur un terrain de sable, parmi les dunes et les herbes sèches.',
    weight: 2,
    background: ['#f0d9a8', '#f8ecd2'],
    ground: {
      arena: { style: 'checker', colors: ['#ecd7a4', '#e4ce98'], grid: 'rgba(120, 90, 40, 0.2)' },
      crowd: { style: 'speckle', colors: ['#e3c88f', '#dcc086', '#e8d29e'], grain: '#c9a865' },
      outer: { style: 'speckle', colors: ['#d9bb7e', '#e2c78c', '#cfb073', '#e6cf98'], grain: '#b8955a' },
      slab: { left: '#b8955a', right: '#9c7c48' },
    },
    fence: WOOD_FENCE,
    layout: { crowdBand: 2, ringWidth: 2 },
    props: {
      back: [
        { type: 'tuft', weight: 26 }, { type: 'rock', weight: 12 }, { type: 'tent', weight: 6, w: 2, h: 2, variants: TENTS },
        { type: 'banner', weight: 5, variants: PENNANTS }, { type: 'barrel', weight: 5 }, { type: null, weight: 46 },
      ],
      front: [
        { type: 'tuft', weight: 26 }, { type: 'rock', weight: 12 }, { type: 'barrel', weight: 3 }, { type: null, weight: 59 },
      ],
    },
  },
  {
    id: 'lice_village',
    name: 'Place du village',
    description: 'La Lice montée pour un jour au cœur du village : maisons, échoppes, tonneaux et charrettes.',
    weight: 3,
    background: ['#b9d3e6', '#e4eef2'],
    ground: {
      arena: { style: 'checker', colors: ['#cdb07e', '#c4a674'], grid: 'rgba(80, 55, 25, 0.22)' },
      crowd: { style: 'cobble', colors: ['#a39d92', '#99938a'], stone: '#b5afa3', joint: '#7d786f' },
      outer: { style: 'cobble', colors: ['#9a958c', '#918c83'], stone: '#aaa498', joint: '#76716a' },
      slab: { left: '#7d786f', right: '#66625b' },
    },
    fence: WOOD_FENCE,
    layout: { crowdBand: 2, ringWidth: 2 },
    props: {
      back: [
        { type: 'building', weight: 40, w: 2, h: 2, variants: HOUSE_VARIANTS },
        { type: 'stall', weight: 12, variants: AWNINGS }, { type: 'barrel', weight: 7 }, { type: 'crate', weight: 7 },
        { type: 'cart', weight: 5 }, { type: 'well', weight: 2 }, { type: null, weight: 27 },
      ],
      front: [
        { type: 'barrel', weight: 12 }, { type: 'crate', weight: 12 }, { type: 'cart', weight: 6 },
        { type: 'hay', weight: 5 }, { type: null, weight: 65 },
      ],
    },
  },
  {
    id: 'lice_castle',
    name: 'Cour du château',
    description: 'La Lice dressée dans la cour d’un château, au pied des remparts pavoisés.',
    weight: 2,
    background: ['#c6d3dc', '#e6ebee'],
    ground: {
      arena: { style: 'checker', colors: ['#d8bf8c', '#cfb580'], grid: 'rgba(80, 55, 25, 0.22)' },
      crowd: { style: 'flagstone', colors: ['#b3ada2', '#aaa499'], joint: '#86817a' },
      outer: { style: 'flagstone', colors: ['#a9a399', '#a09a90'], joint: '#7d786f' },
      slab: { left: '#86817a', right: '#6f6a64' },
    },
    fence: WOOD_FENCE,
    layout: { crowdBand: 2, ringWidth: 2 },
    props: {
      back: [
        { type: 'rampart', weight: 1, row: 'outer' },
        { type: 'banner', weight: 14, row: 'inner', variants: PENNANTS }, { type: 'rack', weight: 10, row: 'inner' },
        { type: 'barrel', weight: 8, row: 'inner' }, { type: 'hay', weight: 6, row: 'inner' }, { type: null, weight: 62, row: 'inner' },
      ],
      front: [
        { type: 'barrel', weight: 10 }, { type: 'rack', weight: 8 }, { type: 'crate', weight: 8 },
        { type: 'hay', weight: 6 }, { type: null, weight: 68 },
      ],
    },
  },
  {
    id: 'lice_camp',
    name: 'Campement militaire',
    description: 'La Lice au milieu d’un camp d’hommes d’armes : tentes rayées, feux, râteliers et bannières.',
    weight: 2,
    background: ['#b5cfe0', '#dde9ef'],
    ground: {
      arena: { style: 'checker', colors: ['#cfb27c', '#c6a871'], grid: 'rgba(80, 55, 25, 0.22)' },
      crowd: { style: 'speckle', colors: ['#a3bd6e', '#9ab468', '#aab877', '#b0a86f'], grain: '#7f8f4a' },
      outer: { style: 'speckle', colors: ['#93b866', '#8aaf60', '#9cbd6c'], grain: '#6f8f45' },
      slab: { left: '#7a6a3f', right: '#655631' },
    },
    fence: WOOD_FENCE,
    layout: { crowdBand: 2, ringWidth: 2 },
    props: {
      back: [
        { type: 'tent', weight: 34, w: 2, h: 2, variants: TENTS }, { type: 'banner', weight: 9, variants: PENNANTS },
        { type: 'rack', weight: 8 }, { type: 'campfire', weight: 4 }, { type: 'barrel', weight: 6 }, { type: null, weight: 39 },
      ],
      front: [
        { type: 'campfire', weight: 4 }, { type: 'rack', weight: 7 }, { type: 'barrel', weight: 8 },
        { type: 'hay', weight: 6 }, { type: 'stump', weight: 6 }, { type: null, weight: 69 },
      ],
    },
  },
  {
    // Lice des Combats de la Reine : abords extérieurs d'une forteresse, sobre et militaire.
    id: 'lice_queen',
    name: 'Abords du château',
    description: 'La Lice de la Reine, sur l’herbe au pied des remparts : pierre, bois et chemin pavé.',
    exclusiveTo: 'queen',
    weight: 1,
    background: ['#b9cfdf', '#e1ebf0'],
    ground: {
      arena: { style: 'checker', colors: ['#8fc06a', '#86b662'], grid: 'rgba(30, 60, 20, 0.18)' },
      crowd: { style: 'checker', colors: ['#97c472', '#8ebb6a'] },
      outer: { style: 'speckle', colors: ['#8db866', '#93bd6c', '#88b260'], grain: '#6f9a4c' },
      path: { style: 'cobble', colors: ['#9a958c', '#918c83'], stone: '#aaa498', joint: '#76716a' },
      slab: { left: '#7d786f', right: '#66625b' },
    },
    fence: WOOD_FENCE,
    layout: { crowdBand: 2, ringWidth: 2 },
    // Chemin pavé le long du grand côté avant (entre la caméra et La Lice).
    path: { side: 'south', width: 2 },
    props: {
      back: [
        // Rempart continu sur le rang extérieur, ponctué de tours carrées.
        { type: 'rampart', weight: 82, row: 'outer' },
        { type: 'tower', weight: 18, row: 'outer' },
        // Au pied des murs : bâtiments de pierre simples, matériel militaire et utilitaire.
        { type: 'building', weight: 22, w: 2, h: 2, row: 'inner', variants: [
          { wall: '#b5afa3', roof: '#6b5a4a', height: 1.2 },
          { wall: '#a9a399', roof: '#5a4a3a', height: 1.3 },
          { wall: '#c2bcae', roof: '#4f5a63', height: 1.1 },
        ] },
        { type: 'rack', weight: 9, row: 'inner' }, { type: 'barrel', weight: 8, row: 'inner' },
        { type: 'crate', weight: 8, row: 'inner' }, { type: 'cart', weight: 4, row: 'inner' },
        { type: 'hay', weight: 5, row: 'inner' }, { type: 'banner', weight: 5, row: 'inner', variants: [
          { color: '#6b2a2a', emblem: '#d9d2c2' }, { color: '#3a4a5a', emblem: '#d9d2c2' },
        ] },
        { type: null, weight: 39, row: 'inner' },
      ],
      // Côté avant : le chemin pavé (sans décor) ; petit côté : quelques éléments bas.
      front: [
        { type: 'barrel', weight: 8 }, { type: 'crate', weight: 8 }, { type: 'rock', weight: 8 },
        { type: 'bush', weight: 12 }, { type: 'tuft', weight: 10 }, { type: null, weight: 54 },
      ],
    },
  },
  {
    // Lice de la Coupe de France : au pied du Château de Gabarnac, entre les rangs de vigne.
    id: 'lice_gabarnac',
    name: 'Château de Gabarnac',
    description: 'La Lice de la Coupe de France, dans les vignes, au pied des remparts du Château de Gabarnac.',
    exclusiveTo: 'cup',
    weight: 1,
    background: ['#a9c8e2', '#e6eef0'],
    ground: {
      arena: { style: 'checker', colors: ['#d8bf8c', '#cfb580'], grid: 'rgba(80, 55, 25, 0.22)' },
      crowd: { style: 'checker', colors: ['#97c472', '#8ebb6a'] },
      outer: { style: 'speckle', colors: ['#a7b86a', '#9cb062', '#b0b874', '#93a85c'], grain: '#7a8a45' },
      path: { style: 'speckle', colors: ['#cdb486', '#c4aa7c', '#d4bc90'], grain: '#a08658' },
      slab: { left: '#7d786f', right: '#66625b' },
    },
    fence: WOOD_FENCE,
    layout: { crowdBand: 2, ringWidth: 2 },
    // Allée de terre battue le long du grand côté avant.
    path: { side: 'south', width: 2 },
    props: {
      back: [
        { type: 'rampart', weight: 70, row: 'outer' },
        { type: 'conicalTower', weight: 12, row: 'outer' },
        { type: 'tower', weight: 10, row: 'outer' },
        { type: 'vine', weight: 46, row: 'inner', variants: [{ dir: 'x' }, { dir: 'x', grape: '#6d8a2f' }, { dir: 'y' }] },
        { type: 'banner', weight: 6, row: 'inner', variants: [{ color: '#7a1f2b', emblem: '#d9b44a' }, { color: '#2d4a7a', emblem: '#d9b44a' }] },
        { type: 'barrel', weight: 8, row: 'inner' }, { type: 'cart', weight: 3, row: 'inner' },
        { type: null, weight: 20, row: 'inner' },
      ],
      front: [
        { type: 'vine', weight: 30, variants: [{ dir: 'x' }, { dir: 'y' }] }, { type: 'barrel', weight: 8 },
        { type: 'tuft', weight: 10 }, { type: 'flowers', weight: 8 }, { type: null, weight: 44 },
      ],
    },
  },
  // Ma Lice d'entraînement (v0.71, écran TrainingScreen) : lice du domaine, jamais tirée pour un
  // combat officiel. Un court chemin part vers la droite (côté est), en direction du Centre ; sa
  // dernière case est la sortie (data/locations.js, training_path_east).
  {
    id: 'lice_training',
    name: 'Ma Lice d’entraînement',
    description: 'La lice du domaine : mannequins, râteliers, bottes de foin, et le Marshal qui arbitre.',
    exclusiveTo: 'training',
    weight: 1,
    background: ['#a9cbe6', '#d8e9f0'],
    ground: {
      arena: { style: 'checker', colors: ['#d6bb88', '#cdb07c'], grid: 'rgba(80, 55, 25, 0.22)' },
      crowd: { style: 'speckle', colors: ['#c9b386', '#bfa87a', '#a9b874'], grain: '#8a7a4f' },
      outer: { style: 'speckle', colors: ['#93c46e', '#8aba66', '#9cc574'], grain: '#6f9a4c' },
      path: { style: 'speckle', colors: ['#dcc89c', '#d4bf92'], grain: '#b89f6e' },
      slab: { left: '#8b6a3f', right: '#6e5230' },
    },
    fence: WOOD_FENCE,
    // Carte de 17 × 14, comme le Centre : 1 case de décor à l'est et à l'ouest, 2 au nord et au sud.
    layout: { crowdBand: 1, ringWidth: 1, ringDepth: 2 },
    // Côté est (vers la droite à l'écran), rangées 3 et 4 du terrain : 1 case de long, 2 de large.
    path: { side: 'east', width: 1, span: { from: 3, to: 5 } },
    props: {
      back: [
        { type: 'dummy', weight: 14 }, { type: 'rack', weight: 10 }, { type: 'tree', weight: 22 }, { type: 'tent', weight: 8, w: 2, h: 2, variants: TENTS },
        { type: 'banner', weight: 6, variants: PENNANTS }, { type: 'barrel', weight: 6 }, { type: 'campfire', weight: 3 }, { type: 'bush', weight: 8 }, { type: null, weight: 23 },
      ],
      front: [
        { type: 'hay', weight: 9 }, { type: 'dummy', weight: 7 }, { type: 'barrel', weight: 6 }, { type: 'stump', weight: 6 },
        { type: 'bush', weight: 8 }, { type: 'flowers', weight: 8 }, { type: 'tuft', weight: 8 }, { type: null, weight: 48 },
      ],
    },
  },
].map((decoration) => Object.freeze(decoration)));

/** Ma Lice d'entraînement (TrainingScreen). */
export const TRAINING_DECORATION_ID = 'lice_training';

/** Décors tirés au hasard pour les combats ordinaires (les décors réservés en sont exclus). */
export function listRandomDecorations() {
  return LICE_DECORATIONS.filter((decoration) => !decoration.exclusiveTo);
}

export const DEFAULT_LICE_DECORATION_ID = 'lice_forest';

export function getLiceDecoration(id) {
  return LICE_DECORATIONS.find((decoration) => decoration.id === id)
    ?? LICE_DECORATIONS.find((decoration) => decoration.id === DEFAULT_LICE_DECORATION_ID);
}
