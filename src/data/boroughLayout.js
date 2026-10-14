// Plan du Bourg (vue isométrique, systems/borough + borough/). Données uniquement :
// zones cliquables des artisans, décor, habitants, chiens et oiseaux (purement décoratifs).
//
// v0.54.0 : même taille que le Centre (17 × 14 cases), caméra au même cadrage ; un campement
// de tentes remplace les maisons. Organisation (cases) :
//   rues : grande rue (y 6–7, du chemin du Centre à l'est) et rue du marché (x 8–9), en croix
//   nord-ouest : atelier du Menuisier ; nord-est : scierie du Bûcheron
//   sud-est : pavillon du Sénéchal ; sud-ouest : fournil du Boulanger
//   carrefour : étals du marché, puits

const TENTS = {
  workshop: { color: '#d9c7a0', stripe: '#7a5a34' },
  pavilion: { color: '#efe4cc', stripe: '#3f4a6a' },
  bakery: { color: '#efe0bf', stripe: '#b0583a' },
  family: { color: '#e8dcc0', stripe: '#3e7d3a' },
  market: { color: '#e8dcc0', stripe: '#b8402f' },
};

export const BOROUGH_LAYOUT = Object.freeze({
  width: 17,
  height: 14,
  grass: ['#93c46e', '#8aba66'],
  paths: [
    { x: 0, y: 6, w: 17, h: 2 },
    { x: 8, y: 0, w: 2, h: 14 },
  ],
  pathColor: ['#c9b48c', '#c0ab82'],

  // Zones cliquables : une par artisan. `stand` : place de l'artisan ; `label` : ancrage de
  // l'étiquette ; `work` : son ouvrage (borough/artisanAnimations.js) — geste, cible, durées de
  // travail et de repos (s), particules.
  zones: [
    {
      artisanId: 'carpenter',
      area: { x: 1, y: 1, w: 6, h: 4 },
      ground: '#c9a978',
      stand: { x: 4.5, y: 3.55 },
      label: { x: 1, y: 1 },
      subtitle: 'Petite lice · Mannequins · Tas de foin',
      work: { animation: 'plane', target: { x: 4.5, y: 2.5 }, work: 8, rest: 3.5 },
      props: [
        { type: 'tent', x: 1, y: 1, w: 2, h: 2, ...TENTS.workshop },
        { type: 'workbench', x: 4, y: 2 },
        { type: 'lumber', x: 5, y: 1, w: 2, h: 1 },
        { type: 'lumber', x: 1, y: 4, w: 2, h: 1 },
        { type: 'crate', x: 3, y: 3 },
        { type: 'cart', x: 6, y: 2 },
        { type: 'barrel', x: 6, y: 4 },
      ],
    },
    {
      artisanId: 'woodcutter',
      area: { x: 10, y: 1, w: 6, h: 4 },
      ground: '#9cb86a',
      stand: { x: 12.35, y: 4.55 },
      label: { x: 16, y: 1 },
      subtitle: 'Forêt',
      work: { animation: 'chop', target: { x: 11.5, y: 4.5 }, work: 7, rest: 4 },
      props: [
        { type: 'sawmill', x: 12, y: 1, w: 3, h: 2 },
        { type: 'logs', x: 10, y: 2, w: 2, h: 1 },
        { type: 'logs', x: 14, y: 4, w: 2, h: 1 },
        { type: 'stump', x: 11, y: 4 }, { type: 'stump', x: 15, y: 3 },
        { type: 'tree', x: 10, y: 1 }, { type: 'tree', x: 15, y: 1 },
      ],
    },
    {
      artisanId: 'seneschal',
      area: { x: 10, y: 9, w: 6, h: 4 },
      ground: '#c4b9a0',
      stand: { x: 12.5, y: 12.35 },
      label: { x: 16, y: 13 },
      subtitle: 'Rivière · Contrat de chasse',
      work: { animation: 'write', target: { x: 12.5, y: 11.5 }, work: 9, rest: 3 },
      props: [
        { type: 'tent', x: 12, y: 9, w: 3, h: 2, ...TENTS.pavilion },
        { type: 'banner', x: 11, y: 9, color: '#4a3a7a', emblem: '#e0b43a' },
        { type: 'banner', x: 15, y: 9, color: '#4a3a7a', emblem: '#e0b43a' },
        { type: 'desk', x: 12, y: 11 },
        { type: 'crate', x: 10, y: 12 },
        { type: 'barrel', x: 15, y: 12 },
      ],
    },
    {
      // Fournil du Boulanger : tente de toile, four à pain en dôme, bois de chauffe, sacs de
      // farine, étal de miches et pétrin (décor seulement).
      artisanId: 'baker',
      area: { x: 1, y: 9, w: 5, h: 4 },
      ground: '#d8c39a',
      stand: { x: 4.5, y: 12.35 },
      label: { x: 3, y: 9 },
      subtitle: 'Pain au méteil · Hypocras',
      work: { animation: 'knead', target: { x: 4.5, y: 11.5 }, work: 7, rest: 3 },
      props: [
        { type: 'tent', x: 1, y: 9, w: 2, h: 2, ...TENTS.bakery },
        { type: 'breadOven', x: 3, y: 9 },
        { type: 'logs', x: 1, y: 11, w: 2, h: 1 },
        { type: 'flourSacks', x: 1, y: 12 },
        { type: 'breadStall', x: 3, y: 11 },
        { type: 'kneadingTrough', x: 4, y: 11 },
        { type: 'barrel', x: 5, y: 10 },
      ],
    },
  ],

  // Décor fixe hors des zones : tentes du campement, étals du marché, puits.
  props: [
    { type: 'tent', x: 6, y: 10, w: 2, h: 2, ...TENTS.family },
    { type: 'tent', x: 13, y: 5, w: 1, h: 1, ...TENTS.market },
    { type: 'well', x: 7, y: 8 },
    { type: 'stall', x: 7, y: 4, color: '#b8402f', stripe: '#f4ecd8' },
    { type: 'stall', x: 10, y: 5, color: '#2d5a9a', stripe: '#f4ecd8' },
    { type: 'stall', x: 10, y: 8, color: '#3e7d3a', stripe: '#e0b43a' },
    { type: 'hay', x: 1, y: 5 },
    { type: 'cart', x: 15, y: 5 },
  ],

  // Ceinture de décor (arbres, haies) sur les cases libres de la bordure.
  decorRing: {
    width: 1,
    mix: [
      { type: 'tree', weight: 50 },
      { type: 'bush', weight: 22 },
      { type: 'flowers', weight: 14 },
      { type: 'rock', weight: 4 },
      { type: null, weight: 10 },
    ],
  },

  // Habitants (décoratifs, non cliquables) : sprites des spectateurs.
  //   path    tournée en boucle avec arrêts (`pauses`, s) — pauses et départs différents pour chacun
  //   route   aller-retour simple
  //   sinon   immobiles (achats, travail, discussions `chat` avec bulles), avec gestes d'attente
  villagers: [
    // Grande rue et rue du marché.
    { spriteId: 'spectator_03', path: [{ x: 0.8, y: 6.4 }, { x: 7.4, y: 6.4 }, { x: 7.5, y: 7.6 }, { x: 2.5, y: 7.6 }], speed: 0.55, pauses: [2.5, 1, 3, 1.5], phase: 0 },
    { spriteId: 'spectator_04', path: [{ x: 12.0, y: 7.5 }, { x: 10.3, y: 7.5 }, { x: 10.3, y: 6.3 }, { x: 12.0, y: 6.3 }], speed: 0.4, pauses: [1.5, 3, 1, 2], phase: 4 },
    { spriteId: 'spectator_08', path: [{ x: 8.5, y: 0.8 }, { x: 8.5, y: 5.5 }, { x: 9.4, y: 5.6 }, { x: 9.4, y: 1 }], speed: 0.45, pauses: [3, 2, 1, 2], phase: 7 },
    { spriteId: 'spectator_11', path: [{ x: 9.5, y: 13.2 }, { x: 9.5, y: 8.6 }, { x: 8.4, y: 8.6 }, { x: 8.4, y: 12.8 }], speed: 0.5, pauses: [1, 2.5, 2, 1], phase: 2 },
    // Le long des ateliers.
    { spriteId: 'spectator_05', path: [{ x: 2.3, y: 5.5 }, { x: 6.5, y: 5.5 }], speed: 0.35, pauses: [3, 4], phase: 1 },
    { spriteId: 'spectator_09', path: [{ x: 1.5, y: 8.4 }, { x: 6.4, y: 8.4 }], speed: 0.4, pauses: [2, 3], phase: 5 },
    { spriteId: 'spectator_06', path: [{ x: 11.4, y: 5.5 }, { x: 12.6, y: 5.5 }], speed: 0.3, pauses: [4, 2], phase: 3 },
    { spriteId: 'spectator_10', path: [{ x: 11.4, y: 8.4 }, { x: 15.5, y: 8.4 }], speed: 0.38, pauses: [2.5, 3.5], phase: 6 },
    // Au marché : chalands devant les étals.
    { spriteId: 'spectator_02', x: 7.5, y: 5.45, view: 'back' },
    { spriteId: 'spectator_07', x: 10.5, y: 4.55, view: 'front', flip: true, idle: 'still' },
    { spriteId: 'spectator_01', x: 10.45, y: 9.2, view: 'back', flip: true },
    // Discussions.
    { spriteId: 'spectator_03', x: 6.5, y: 9.4, view: 'front', chat: 'puits' },
    { spriteId: 'spectator_10', x: 7.35, y: 9.55, view: 'front', flip: true, chat: 'puits', idle: 'still' },
    { spriteId: 'spectator_05', x: 14.4, y: 6.45, view: 'front', chat: 'carrefour' },
    { spriteId: 'spectator_09', x: 15.2, y: 6.25, view: 'back', flip: true, chat: 'carrefour', idle: 'still' },
    { spriteId: 'spectator_06', x: 14.9, y: 6.95, view: 'back', chat: 'carrefour' },
    // Au travail : apprenti du Menuisier, aide du Bûcheron, clerc du Sénéchal, cliente du fournil.
    { spriteId: 'spectator_03', x: 3.5, y: 2.6, view: 'front', flip: true, idle: 'still' },
    { spriteId: 'spectator_08', x: 13.5, y: 3.5, view: 'front' },
    { spriteId: 'spectator_10', x: 11.4, y: 11.4, view: 'front', idle: 'still' },
    { spriteId: 'spectator_07', x: 3.5, y: 10.45, view: 'back' },
    // Enfant qui court près de la tente.
    { spriteId: 'spectator_11', path: [{ x: 7.3, y: 12.2 }, { x: 7.3, y: 12.9 }, { x: 5.6, y: 12.9 }], speed: 0.9, pauses: [0.6, 0.4, 1.2], phase: 0.7 },
  ],

  // Chiens : tournée avec arrêts ; à chaque arrêt, une pose (`poses`, dans l'ordre des points).
  dogs: [
    { path: [{ x: 2.2, y: 7.15 }, { x: 5.8, y: 7.05 }, { x: 6.8, y: 7.5 }], speed: 0.6, pauses: [6, 3, 8], poses: ['sit', 'sniff', 'lie'], phase: 0, coat: '#8a5a2e', patch: '#e8d6b4' },
    { path: [{ x: 15.6, y: 7.6 }, { x: 13.2, y: 7.6 }, { x: 13.0, y: 6.25 }], speed: 0.7, pauses: [5, 4, 7], poses: ['look', 'sniff', 'sit'], phase: 3, coat: '#3a2e26', patch: '#d9c7a0' },
  ],

  // Oiseaux posés : deux bandes qui picorent, puis s'envolent vers l'autre coin.
  birds: [
    { spots: [{ x: 3.6, y: 1.5 }, { x: 7.4, y: 2.4 }], count: 3, stay: 10, flight: 1.6, phase: 0 },
    { spots: [{ x: 14.5, y: 11.5 }, { x: 11.5, y: 10.3 }], count: 4, stay: 12, flight: 1.8, phase: 5 },
  ],
});
