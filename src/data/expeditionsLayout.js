// Plan des Expéditions (v0.96, vue isométrique, expeditions/). Données uniquement.
//
// Même taille que le Centre (17 × 14 cases), même cadrage. Une rivière (x 8–9) coupe la carte
// de droite à gauche ; un pont de bois au milieu (y 6–7) la franchit.
//   nord (x 0–7)   : le marché — étals, marchandises, tentes de marchands, quelques civils ;
//                    le chemin du nord-ouest ramène au Bourg (data/locations.js).
//   sud (x 10–16)  : la montagne — pics enneigés au fond, rochers, pins ; le camp du Baron
//                    (zone cliquable de 5 × 5 cases). Son dialogue viendra plus tard.

const TENTS = {
  merchant: { color: '#ece0c4', stripe: '#b8402f' },
  cloth: { color: '#e4d6b4', stripe: '#2d5a9a' },
  captain: { color: '#7a1f2b', stripe: '#e0b43a' },
};

export const EXPEDITIONS_LAYOUT = Object.freeze({
  width: 17,
  height: 14,
  grass: ['#93c46e', '#8aba66'],
  // Sud : herbe rase des alpages, plus sèche ; terre et cailloux par endroits.
  wildGrass: ['#9db56f', '#94ad66'],
  rockGround: ['#a6a08f', '#9c9686'],
  paths: [
    { x: 0, y: 6, w: 8, h: 2 },
    { x: 10, y: 6, w: 1, h: 2 },
  ],
  pathColor: ['#c9b48c', '#c0ab82'],
  // La rivière, de droite à gauche (le courant suit l'axe y), et le pont de bois.
  // neverDry : la grande rivière ne s'assèche pas l'été (eau basse, courant lent).
  river: { x: 8, y: 0, w: 2, h: 14, neverDry: true },
  bridge: { x: 8, y: 6, w: 2, h: 2 },
  // Moitié sauvage : à partir de cette colonne (au-delà de la rivière).
  wildFrom: 10,
  // Plaques de rocaille du sud (sol).
  rockPatches: [
    { x: 10, y: 0, w: 7, h: 4 },
    { x: 16, y: 4, w: 1, h: 10 },
    { x: 13, y: 11, w: 3, h: 3 },
  ],

  // Le Baron : sa zone (cliquable), sa place, l'ancrage de son étiquette.
  captain: {
    area: { x: 11, y: 5, w: 5, h: 5 },
    stand: { x: 13.55, y: 7.75 },
    label: { x: 13.5, y: 4.4 },
    spriteId: 'expedition_captain',
    title: '⚔ Le Baron',
    subtitle: 'Expéditions',
    ground: '#b9a77f',
  },

  props: [
    // --- Nord : le marché ---
    { type: 'stall', x: 2, y: 3, color: '#b8402f', stripe: '#f4ecd8' },
    { type: 'stall', x: 5, y: 3, color: '#2d5a9a', stripe: '#f4ecd8' },
    { type: 'stall', x: 3, y: 9, color: '#3e7d3a', stripe: '#e0b43a' },
    { type: 'tent', x: 1, y: 10, w: 2, h: 2, ...TENTS.merchant },
    { type: 'tent', x: 5, y: 10, w: 2, h: 2, ...TENTS.cloth },
    { type: 'crate', x: 1, y: 4 }, { type: 'crate', x: 4, y: 4 }, { type: 'crate', x: 6, y: 9 },
    { type: 'barrel', x: 6, y: 4 }, { type: 'barrel', x: 2, y: 8 }, { type: 'barrel', x: 7, y: 12 },
    { type: 'flourSacks', x: 3, y: 2 },
    { type: 'flourSacks', x: 4, y: 8 },
    { type: 'cart', x: 6, y: 2 },
    { type: 'logs', x: 1, y: 2, w: 2, h: 1 },
    { type: 'well', x: 7, y: 4 },
    // Au bord de l'eau, côté nord.
    { type: 'tuft', x: 7, y: 9, layer: 'ground', blocking: false },
    { type: 'flowers', x: 7, y: 1, layer: 'ground', blocking: false },

    // --- La rivière : le pont ---
    { type: 'bridge', x: 8, y: 6, w: 2, h: 2, layer: 'ground' },

    // --- Sud : la montagne (pics au fond, à droite de l'écran) ---
    { type: 'mountain', x: 11, y: 0, w: 3, h: 3, height: 2.1, tone: '#8d8a84' },
    { type: 'mountain', x: 14, y: 0, w: 3, h: 4, height: 2.7, tone: '#827f79' },
    { type: 'mountain', x: 10, y: 3, w: 1, h: 1, height: 0.9, tone: '#96928b' },
    { type: 'rock', x: 10, y: 4 }, { type: 'rock', x: 16, y: 5 }, { type: 'rock', x: 12, y: 11 },
    { type: 'rock', x: 15, y: 10 }, { type: 'rock', x: 10, y: 9 },
    { type: 'tree', x: 10, y: 11 }, { type: 'tree', x: 11, y: 12 }, { type: 'tree', x: 14, y: 12 },
    { type: 'tree', x: 16, y: 11 }, { type: 'tree', x: 13, y: 13 }, { type: 'tree', x: 16, y: 9 },
    { type: 'bush', x: 10, y: 12 }, { type: 'bush', x: 15, y: 13 },

    // --- Le camp du Baron (dans sa zone) ---
    { type: 'tent', x: 13, y: 5, w: 2, h: 2, ...TENTS.captain },
    { type: 'banner', x: 12, y: 5, color: '#7a1f2b', emblem: '#e0b43a' },
    { type: 'banner', x: 15, y: 5, color: '#7a1f2b', emblem: '#e0b43a' },
    { type: 'campfire', x: 12, y: 8 },
    { type: 'rack', x: 15, y: 8 },
    { type: 'crate', x: 11, y: 9 },
  ],

  // Ceinture de décor sur les cases libres de la bordure (nord : arbres et buissons).
  decorRing: {
    width: 1,
    mix: [
      { type: 'tree', weight: 40 },
      { type: 'bush', weight: 22 },
      { type: 'flowers', weight: 14 },
      { type: 'rock', weight: 10 },
      { type: null, weight: 14 },
    ],
  },

  // Civils du marché (décoratifs, non cliquables) et deux soldats au camp.
  villagers: [
    { spriteId: 'spectator_05', path: [{ x: 0.8, y: 6.4 }, { x: 7.2, y: 6.4 }, { x: 7.2, y: 7.6 }, { x: 1.2, y: 7.6 }], speed: 0.45, pauses: [2, 1.5, 3, 1], phase: 0 },
    { spriteId: 'spectator_04', path: [{ x: 2.5, y: 5.4 }, { x: 6.4, y: 5.4 }], speed: 0.35, pauses: [3, 2.5], phase: 2 },
    { spriteId: 'spectator_11', path: [{ x: 3.5, y: 8.5 }, { x: 6.5, y: 8.5 }, { x: 6.5, y: 7.9 }], speed: 0.8, pauses: [0.8, 0.5, 1.2], phase: 1 },
    { spriteId: 'spectator_02', x: 2.5, y: 4.45, view: 'back' },
    { spriteId: 'spectator_01', x: 5.45, y: 4.5, view: 'back', flip: true },
    { spriteId: 'spectator_07', x: 3.4, y: 10.2, view: 'front', chat: 'etal' },
    { spriteId: 'spectator_03', x: 4.2, y: 10.4, view: 'front', flip: true, chat: 'etal', idle: 'still' },
    // Au camp : deux hommes d'armes du Baron.
    { spriteId: 'spectator_08', x: 11.6, y: 6.4, view: 'front', idle: 'still' },
    { spriteId: 'spectator_09', x: 15.3, y: 9.2, view: 'front', flip: true },
  ],

  dogs: [
    { path: [{ x: 1.5, y: 7.2 }, { x: 5.5, y: 7.0 }, { x: 6.6, y: 6.4 }], speed: 0.6, pauses: [5, 3, 7], poses: ['sit', 'sniff', 'lie'], phase: 1, coat: '#a8743e', patch: '#f0e2c4' },
  ],

  birds: [
    { spots: [{ x: 2.4, y: 1.4 }, { x: 5.8, y: 12.6 }], count: 3, stay: 11, flight: 1.7, phase: 2 },
  ],
});
