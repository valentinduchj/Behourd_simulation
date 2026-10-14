// Plan du Château de Gabarnac (Coupe de France, vue isométrique, frenchCup/). Données
// uniquement : château au nord, Lice au centre (cliquable : prochain combat), tableau de la
// Coupe (cliquable : bilan), vignes tout autour, habitants décoratifs.
//
// Organisation (cases, 26 × 20) :
//   y 0–1  : logis et remparts du château, porte fortifiée au milieu (x 12–13)
//   centre : la Lice (x 9–16, y 7–11), entourée d'une allée de terre
//   est    : le tableau de la Coupe (x 20, y 9)
//   ouest, est et sud : rangs de vigne

const STONE = { wall: '#c9c0ad', roof: '#4a5560' };
const SPRITES = ['spectator_01', 'spectator_02', 'spectator_03', 'spectator_04', 'spectator_05', 'spectator_06',
  'spectator_07', 'spectator_08', 'spectator_09', 'spectator_10', 'spectator_11'];

/** Rangs de vigne d'un bloc : un rang toutes les deux cases (dir 'x' : rangs est-ouest). */
function vineyard({ x, y, w, h, dir = 'x', grape = null }) {
  const props = [];
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      const onRow = dir === 'x' ? (ty - y) % 2 === 0 : (tx - x) % 2 === 0;
      if (onRow) props.push({ type: 'vine', x: tx, y: ty, dir, ...(grape ? { grape } : {}) });
    }
  }
  return props;
}

export const GABARNAC_LAYOUT = Object.freeze({
  width: 26,
  height: 20,
  grass: ['#a3bd6e', '#9ab468'],
  pathColor: ['#d0b98c', '#c7af82'],
  paths: [
    // De la porte du château à la Lice, puis vers le sud.
    { x: 12, y: 2, w: 2, h: 4 },
    { x: 12, y: 13, w: 2, h: 7 },
    // Allée autour de la Lice.
    { x: 8, y: 6, w: 10, h: 1 }, { x: 8, y: 12, w: 10, h: 1 },
    { x: 8, y: 6, w: 1, h: 7 }, { x: 17, y: 6, w: 1, h: 7 },
    // Vers le tableau de la Coupe.
    { x: 18, y: 9, w: 2, h: 1 },
  ],

  // Zones cliquables. `label` : ancrage de l'étiquette (cases).
  lice: { area: { x: 9, y: 7, w: 8, h: 5 }, label: { x: 13, y: 7 }, sand: ['#dcc493', '#d4bb88'], fence: { rail: '#8a6235', post: '#5a3b1e' } },
  board: { area: { x: 19, y: 8, w: 3, h: 3 }, prop: { type: 'noticeBoard', x: 20, y: 9 }, label: { x: 21, y: 11, below: true } },

  props: [
    // Le château : logis à l'arrière, remparts, tours et porte.
    { type: 'building', x: 9, y: 0, w: 8, h: 1, wall: STONE.wall, roof: STONE.roof, height: 2.2 },
    { type: 'conicalTower', x: 8, y: 0, height: 2.6 }, { type: 'conicalTower', x: 17, y: 0, height: 2.6 },
    { type: 'conicalTower', x: 2, y: 1, height: 1.6 }, { type: 'conicalTower', x: 23, y: 1, height: 1.6 },
    ...[3, 4, 5, 6, 8, 9, 10, 11, 14, 15, 16, 17, 19, 20, 21, 22].map((x) => ({ type: 'rampart', x, y: 1 })),
    { type: 'tower', x: 7, y: 1 }, { type: 'tower', x: 18, y: 1 },
    { type: 'castleGate', x: 12, y: 1, w: 2, color: '#7a1f2b' },
    // Abords de la porte et de la Lice.
    { type: 'banner', x: 11, y: 3, color: '#7a1f2b', emblem: '#d9b44a' },
    { type: 'banner', x: 14, y: 3, color: '#2d4a7a', emblem: '#d9b44a' },
    { type: 'barrel', x: 10, y: 3 }, { type: 'barrel', x: 10, y: 4 }, { type: 'cart', x: 15, y: 4 },
    { type: 'hay', x: 16, y: 3 },
    { type: 'banner', x: 8, y: 13, color: '#7a1f2b', emblem: '#d9b44a' },
    { type: 'banner', x: 17, y: 13, color: '#7a1f2b', emblem: '#d9b44a' },
    // Tente de campement du tournoi (rayée aux couleurs du château), tonneaux près des vignes.
    { type: 'tent', x: 20, y: 3, w: 2, h: 2, color: '#efe4cc', stripe: '#7a1f2b' },
    { type: 'barrel', x: 23, y: 4 }, { type: 'barrel', x: 23, y: 5 }, { type: 'barrel', x: 22, y: 6 },
    // Vignes (de nombreux rangs, balancés par le vent).
    ...vineyard({ x: 1, y: 3, w: 6, h: 16, dir: 'y' }),
    ...vineyard({ x: 19, y: 12, w: 6, h: 7, dir: 'x' }),
    ...vineyard({ x: 15, y: 15, w: 4, h: 5, dir: 'x', grape: '#6d8a2f' }),
    ...vineyard({ x: 8, y: 15, w: 4, h: 5, dir: 'x' }),
    ...vineyard({ x: 22, y: 7, w: 3, h: 4, dir: 'x', grape: '#6d8a2f' }),
  ],

  // Ceinture de décor (arbres, haies) sur les cases libres de la bordure.
  decorRing: {
    width: 1,
    mix: [
      { type: 'tree', weight: 40 }, { type: 'bush', weight: 30 }, { type: 'flowers', weight: 15 }, { type: null, weight: 15 },
    ],
  },

  // Habitants (décoratifs, non cliquables). `route` : aller-retour ; sinon immobiles (discussions).
  // `chat` : groupe qui discute (bulles à tour de rôle).
  villagers: [
    { spriteId: 'spectator_03', route: [{ x: 12.4, y: 2.6 }, { x: 12.4, y: 5.6 }], speed: 0.3 },
    { spriteId: 'spectator_05', route: [{ x: 13.5, y: 19.4 }, { x: 13.5, y: 13.4 }], speed: 0.35, phase: 2 },
    { spriteId: 'spectator_06', route: [{ x: 7.4, y: 4 }, { x: 7.4, y: 18 }], speed: 0.22, phase: 3 },
    { spriteId: 'spectator_02', route: [{ x: 18.4, y: 13.3 }, { x: 24.6, y: 13.3 }], speed: 0.2, phase: 1.5 },
    // Discussions.
    { spriteId: 'spectator_01', x: 11.2, y: 4.9, view: 'front', chat: 'porte' },
    { spriteId: 'spectator_10', x: 11.9, y: 4.3, view: 'back', flip: true, chat: 'porte' },
    { spriteId: 'spectator_04', x: 19.1, y: 10.6, view: 'back', chat: 'tableau' },
    { spriteId: 'spectator_09', x: 20.2, y: 10.9, view: 'back', flip: true, chat: 'tableau' },
    { spriteId: 'spectator_07', x: 21.4, y: 10.4, view: 'front', flip: true, chat: 'tableau' },
    { spriteId: 'spectator_03', x: 14.5, y: 16.6, view: 'front', chat: 'vigne' },
    { spriteId: 'spectator_11', x: 15.4, y: 16.2, view: 'back', flip: true, chat: 'vigne' },
    // Vendangeurs dans les rangs.
    { spriteId: 'spectator_02', x: 2.5, y: 9.5, view: 'front' },
    { spriteId: 'spectator_08', x: 21.5, y: 15.5, view: 'back' },

    // --- Le rassemblement de la Coupe (36 de plus) ---
    // Spectateurs le long de la palissade, tournés vers la Lice.
    ...[9.4, 10.6, 11.6, 13.7, 14.8, 15.9, 16.8].map((x, i) => ({ spriteId: SPRITES[i % SPRITES.length], x, y: 6.35, view: 'front', flip: i % 2 === 1 })),
    ...[9.2, 10.3, 11.4, 14.6, 15.7, 16.8].map((x, i) => ({ spriteId: SPRITES[(i + 3) % SPRITES.length], x, y: 12.65, view: 'back', flip: i % 2 === 0 })),
    ...[7.6, 9.4, 11.0].map((y, i) => ({ spriteId: SPRITES[(i + 6) % SPRITES.length], x: 8.35, y, view: 'front', flip: false })),
    ...[7.4, 8.6, 10.6, 11.6].map((y, i) => ({ spriteId: SPRITES[(i + 8) % SPRITES.length], x: 17.65, y, view: 'back', flip: true })),
    // Passants entre les rangs de vigne et sur les allées.
    { spriteId: 'spectator_09', route: [{ x: 2.5, y: 4 }, { x: 2.5, y: 17 }], speed: 0.2, phase: 2 },
    { spriteId: 'spectator_04', route: [{ x: 4.5, y: 17 }, { x: 4.5, y: 4 }], speed: 0.25, phase: 5 },
    { spriteId: 'spectator_10', route: [{ x: 6.5, y: 5 }, { x: 6.5, y: 16 }], speed: 0.18, phase: 1 },
    { spriteId: 'spectator_01', route: [{ x: 14.5, y: 19.3 }, { x: 14.5, y: 13.6 }], speed: 0.3, phase: 3 },
    { spriteId: 'spectator_07', route: [{ x: 21.5, y: 11 }, { x: 24.5, y: 11 }], speed: 0.22, phase: 0.5 },
    { spriteId: 'spectator_05', route: [{ x: 9.2, y: 2.5 }, { x: 9.2, y: 5.4 }], speed: 0.2, phase: 4 },
    { spriteId: 'spectator_11', route: [{ x: 14.5, y: 2.6 }, { x: 17.5, y: 2.6 }], speed: 0.25, phase: 2.5 },
    // Discussions : devant la tente, sur l'allée du sud, dans les vignes.
    { spriteId: 'spectator_02', x: 19.3, y: 6.4, view: 'front', chat: 'tente' },
    { spriteId: 'spectator_06', x: 20.1, y: 6.9, view: 'back', flip: true, chat: 'tente' },
    { spriteId: 'spectator_08', x: 12.3, y: 16.2, view: 'front', chat: 'allee' },
    { spriteId: 'spectator_05', x: 13.2, y: 16.6, view: 'back', flip: true, chat: 'allee' },
    { spriteId: 'spectator_10', x: 12.8, y: 17.3, view: 'back', chat: 'allee' },
    { spriteId: 'spectator_07', x: 4.4, y: 12.3, view: 'front', chat: 'vendange' },
    { spriteId: 'spectator_01', x: 4.9, y: 11.6, view: 'back', flip: true, chat: 'vendange' },
    // Vendangeurs.
    { spriteId: 'spectator_04', x: 6.4, y: 7.5, view: 'front' },
    { spriteId: 'spectator_09', x: 2.6, y: 14.5, view: 'back' },
  ],

  // Combattants de compagnies engagées dans la Coupe (personnages d'ambiance) : chacun flâne
  // autour de sa place, près de la porte, de la tente et de la Lice.
  fighterSpots: [
    { x: 9.6, y: 4.5 }, { x: 15.5, y: 5.2 }, { x: 16.8, y: 4.6 }, { x: 19.5, y: 5.6 },
    { x: 21.6, y: 6.2 }, { x: 18.6, y: 7.4 }, { x: 18.8, y: 11.2 }, { x: 9.6, y: 13.6 },
    { x: 11.0, y: 14.2 }, { x: 15.2, y: 13.6 }, { x: 16.6, y: 14.1 }, { x: 7.5, y: 8.5 },
  ],

  // Cadrage de la caméra (cases) : vue rapprochée sur le château, la Lice et le tableau.
  camera: { x: 4, y: -1.5, w: 17.5, h: 15.5 },
});
