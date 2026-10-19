// Effets visuels (VFX) du rejeu d'une manche — présentation seulement, aucune règle de jeu.
// Chaque effet est déclenché par un événement de la simulation (coup, KO, déplacement) et
// calculé à partir du temps du rejeu (combat/presentation/vfx.js) : l'avance rapide et
// « Passer à la fin » restent cohérents. Régler un effet = modifier cette table.
//
// Unités : positions et vitesses en cases (x, y au sol ; z = hauteur, 1 = largeur d'une case),
// durées en secondes, tailles en fraction de la largeur d'une case.
//   life       durée de vie d'une particule
//   count      nombre de particules (impact : base + dégâts × perDamage, plafonné à max)
//   speed      vitesse au départ [min, max] ; rise : vitesse verticale [min, max]
//   gravity    attraction vers le sol (cases/s²)
//   size       taille [min, max] ; grow : grossissement sur la durée de vie (bouffées)
//   height     hauteur d'émission (z)
//   spread     demi-ouverture du jet autour de sa direction (radians ; π = tout autour)
//   layer      'under' (sous les combattants) ou 'over' (devant)
//   outline    contour sombre (style des sprites : formes cernées), lisible sur le sable

// shake : tremblement de caméra des gros coups (jamais en effets réduits).
export const VFX_LEVELS = Object.freeze({
  full: Object.freeze({ count: 1, flash: true, shake: true }),
  reduced: Object.freeze({ count: 0.5, flash: false, shake: false }),
  off: Object.freeze({ count: 0, flash: false, shake: false }),
});

// Couleurs des familles de talents sur le terrain : remplissage (celui des étiquettes,
// data/talents.js) et contour. Épique : le noir ne se lit pas sur le sable, d'où un contour d'or.
export const TALENT_VFX_COLORS = Object.freeze({
  common: Object.freeze({ fill: '#9fd3f2', stroke: '#1d4a66', rgb: '159, 211, 242' }),
  rare: Object.freeze({ fill: '#ec8a2c', stroke: '#5a2a05', rgb: '236, 138, 44' }),
  epic: Object.freeze({ fill: '#141416', stroke: '#e0b43a', rgb: '224, 180, 58' }),
  exotic: Object.freeze({ fill: '#3fae52', stroke: '#123d1a', rgb: '63, 174, 82' }),
});
export const DEFAULT_VFX_LEVEL = 'full';

const SAND_OUTLINE = 'rgba(92, 62, 30, 0.45)';
const SPARK_OUTLINE = 'rgba(40, 24, 10, 0.75)';

export const VFX_CONFIG = Object.freeze({
  // Plafond de particules affichées à la fois (les plus récentes sont gardées).
  maxParticles: 220,

  // Étincelles d'un coup, au point de contact, projetées dans le sens du coup.
  impact: Object.freeze({
    shape: 'spark', layer: 'over', life: 0.3,
    count: Object.freeze({ base: 4, perDamage: 0.3, max: 10 }),
    speed: [2, 3.6], rise: [0.8, 2], gravity: 7, spread: 1,
    size: [0.03, 0.05], height: 0.5,
    colors: ['#fffbe8', '#ffe066', '#ffc533'], outline: SPARK_OUTLINE,
  }),

  // Coup avantagé par la position (dans le dos, angle mort, à distance) : gerbe orange plus
  // large et bref éclair blanc.
  advantage: Object.freeze({
    shape: 'spark', layer: 'over', life: 0.4,
    count: Object.freeze({ base: 8, perDamage: 0, max: 8 }),
    speed: [2.4, 4.2], rise: [1, 2.4], gravity: 6, spread: 1.5,
    size: [0.035, 0.06], height: 0.5,
    colors: ['#ff5a1f', '#ff8a2a', '#ffc533'], outline: SPARK_OUTLINE,
    flash: Object.freeze({ life: 0.1, radius: 0.26, color: '255, 248, 225' }),
  }),

  // KO : nuage de poussière soulevé par la chute.
  ko: Object.freeze({
    shape: 'puff', layer: 'over', life: 0.8,
    count: Object.freeze({ base: 12, perDamage: 0, max: 12 }),
    speed: [0.5, 1.2], rise: [0.2, 0.6], gravity: 0.8, spread: Math.PI,
    size: [0.07, 0.12], grow: 1.4, height: 0.06,
    colors: ['#f6ecd2', '#ece0bf', '#e0cfa6'], outline: SAND_OUTLINE,
  }),

  // Pas : petites bouffées de poussière au départ de chaque déplacement, de part et d'autre des pieds.
  step: Object.freeze({
    shape: 'puff', layer: 'over', life: 0.45,
    count: Object.freeze({ base: 3, perDamage: 0, max: 3 }),
    speed: [0.35, 0.7], rise: [0.05, 0.2], gravity: 0.3, spread: Math.PI,
    size: [0.035, 0.055], grow: 1.3, height: 0.02,
    colors: ['#f6ecd2', '#ece0bf'], outline: SAND_OUTLINE,
  }),

  // Course d'un Runner : traînée de poussière le long du chemin (3 points par déplacement,
  // `count` particules à chacun).
  flankTrail: Object.freeze({
    classId: 'runner', shape: 'puff', layer: 'over', life: 0.55,
    count: Object.freeze({ base: 2, perDamage: 0, max: 2 }),
    speed: [0.1, 0.3], rise: [0.08, 0.3], gravity: 0.2, spread: Math.PI,
    size: [0.045, 0.07], grow: 1.5, height: 0.03,
    colors: ['#f6ecd2', '#e6d6b0'], outline: SAND_OUTLINE,
  }),

  // --- Lot 4 : talents et moments forts (« à valider » : seuils de 25 dégâts et 60 de fatigue) ---

  // A1. Talent déclenché par un coup : rune ✦ à la couleur de la famille, au-dessus de
  // l'attaquant, et petite gerbe assortie. Au plus une rune par talent et par combattant tous
  // les `minGapTicks` tours (les mêlées en enchaînent beaucoup). Les auras d'un allié ne
  // déclenchent rien chez celui qui en profite.
  talent: Object.freeze({
    life: 0.9, height: 1.05, rise: 0.8, size: 0.15, spin: 1.4, minGapTicks: 3,
    burst: Object.freeze({
      shape: 'spark', layer: 'over', life: 0.4,
      count: Object.freeze({ base: 6, perDamage: 0, max: 6 }),
      speed: [0.8, 1.6], rise: [0.5, 1.2], gravity: 3, spread: Math.PI,
      size: [0.025, 0.04], height: 1.0,
    }),
  }),

  // A2. Survie à 1 PV (Inébranlable, Immortel) : halo doré, bouclier qui se brise en éclats ;
  // scintillement pendant l'invulnérabilité (Immortel).
  lastStand: Object.freeze({
    life: 1.3, color: '#f0c419', halo: Object.freeze({ radius: [0.22, 0.55], width: 0.06 }),
    shield: Object.freeze({ height: 0.62, size: 0.2, breakAt: 0.45 }),
    flash: Object.freeze({ life: 0.18, radius: 0.5, color: '255, 226, 120' }),
    shards: Object.freeze({
      shape: 'spark', layer: 'over', life: 0.5,
      count: Object.freeze({ base: 10, perDamage: 0, max: 10 }),
      speed: [1.2, 2.4], rise: [0.6, 1.6], gravity: 5, spread: Math.PI,
      size: [0.03, 0.05], height: 0.62,
      colors: ['#fff3b0', '#f0c419', '#c9a227'], outline: SPARK_OUTLINE,
    }),
    shimmer: Object.freeze({ every: 0.16, life: 0.5, size: 0.06, radius: 0.32, color: '#fffbe8', outline: '#c9a227' }),
  }),

  // A3. Coup chanceux (Chanceux) : trèfle qui tourne puis s'efface, étincelles vertes.
  lucky: Object.freeze({
    life: 0.85, glyph: '🍀', size: 0.32, height: 1.1, rise: 0.5, spin: 6.3,
    burst: Object.freeze({
      shape: 'spark', layer: 'over', life: 0.45,
      count: Object.freeze({ base: 7, perDamage: 0, max: 7 }),
      speed: [0.8, 1.8], rise: [0.6, 1.4], gravity: 3, spread: Math.PI,
      size: [0.025, 0.04], height: 1.0,
      colors: ['#b8f28a', '#5fcf4a', '#2e8b2e'], outline: SPARK_OUTLINE,
    }),
  }),

  // A4. Combo (coups enchaînés sur la même cible, dès le 2e) : compteur « ×2, ×3… » qui grossit,
  // étincelles qui virent au rouge.
  combo: Object.freeze({
    // shiftX : à droite du chiffre des dégâts (même hauteur), pour rester lisible.
    minHits: 2, life: 0.6, size: 0.2, growth: 0.18, height: 1.0, rise: 0.35, shiftX: 0.42, color: '#ff5a3a',
    sparks: Object.freeze({
      shape: 'spark', layer: 'over', life: 0.3,
      count: Object.freeze({ base: 3, perDamage: 0.15, max: 7 }),
      speed: [2, 3.6], rise: [0.8, 2], gravity: 7, spread: 1,
      size: [0.03, 0.05], height: 0.5,
      colors: ['#ffd0c4', '#ff6a4a', '#d8231a'], outline: SPARK_OUTLINE,
    }),
  }),

  // A5. Gros coup (dégâts ≥ minDamage) : gerbe plus fournie, éclair, tremblement de caméra bref
  // (amplitude en pixels ; coupé en effets réduits et si le système demande moins d'animations).
  heavy: Object.freeze({
    minDamage: 25,
    shake: Object.freeze({ life: 0.12, amplitude: 3, frequency: 42 }),
    flash: Object.freeze({ life: 0.1, radius: 0.34, color: '255, 245, 220' }),
    shape: 'spark', layer: 'over', life: 0.42,
    count: Object.freeze({ base: 10, perDamage: 0, max: 10 }),
    speed: [2.6, 4.6], rise: [1, 2.6], gravity: 6, spread: 1.3,
    size: [0.04, 0.065], height: 0.5,
    colors: ['#ffffff', '#ffe066', '#ff9a2a'], outline: SPARK_OUTLINE,
  }),

  // Renversement (percussion du Runner dans le dos, v0.65) : poussière au sol et étoiles qui
  // tournent au-dessus de la cible, le temps qu'elle se relève.
  stun: Object.freeze({
    life: 0.9, glyph: '💫', size: 0.3, height: 1.0, spin: 4,
    dust: Object.freeze({
      shape: 'puff', layer: 'over', life: 0.6,
      count: Object.freeze({ base: 7, perDamage: 0, max: 7 }),
      speed: [0.4, 1], rise: [0.15, 0.45], gravity: 0.8, spread: Math.PI,
      size: [0.06, 0.1], grow: 1.4, height: 0.05,
      colors: ['#f6ecd2', '#ece0bf', '#e0cfa6'], outline: SAND_OUTLINE,
    }),
  }),

  // A6. Capitaine : lueur aux couleurs de sa compagnie sous ses pieds, au début de la manche.
  captain: Object.freeze({ life: 1.5, rings: 2, gap: 0.4, ringLife: 1.1, radius: [0.18, 0.6], width: 0.05, defaultColor: '#e0b43a' }),

  // A7. Fatigue élevée (au début de la manche ≥ threshold) : gouttes de sueur par moments ;
  // vapeur grise en plus au-delà de steamThreshold. Rend visible ce qui décide des matchs.
  fatigue: Object.freeze({
    threshold: 60, steamThreshold: 80, every: 1.4, life: 0.9,
    drops: Object.freeze({
      shape: 'drop', layer: 'over', life: 0.7,
      count: Object.freeze({ base: 2, perDamage: 0, max: 2 }),
      speed: [0.25, 0.5], rise: [0.3, 0.6], gravity: 2.4, spread: Math.PI,
      size: [0.035, 0.05], height: 0.85,
      colors: ['#8fd0ff', '#cfeaff'], outline: 'rgba(30, 70, 110, 0.6)',
    }),
    steam: Object.freeze({
      shape: 'puff', layer: 'over', life: 0.9,
      count: Object.freeze({ base: 2, perDamage: 0, max: 2 }),
      speed: [0.05, 0.15], rise: [0.35, 0.6], gravity: -0.1, spread: Math.PI,
      size: [0.04, 0.06], grow: 1.6, height: 0.9,
      colors: ['#d6d6d6', '#bcbcbc'], outline: 'rgba(60, 60, 60, 0.25)',
    }),
  }),
});

// ---------------------------------------------------------------------------------------------
// Effets hors combat (lot 3) : Centre, Bourg, Taverne (render/vfx/sceneEffects.js) et carnet de
// bord (fin de saison). Mêmes unités que ci-dessus ; `duration` : durée totale de l'effet.
export const SCENE_VFX = Object.freeze({
  // Centre, après « Passer la journée » : gain de chaque activité réussie au-dessus du combattant.
  gain: Object.freeze({
    duration: 1.8, stagger: 0.12, rise: 0.9, height: 0.95, size: 0.24,
    colors: Object.freeze({ stat: '#9be37a', fatigue: '#8fd0ff', resource: '#ffd75e' }),
  }),

  // Bourg et Centre : chantier sur l'installation améliorée (coups de marteau et poussière).
  hammer: Object.freeze({
    duration: 1.5, strikes: 3, glyph: '🔨', size: 0.62, height: 0.75, swing: 0.9, stagger: 0.45,
    dust: Object.freeze({
      shape: 'puff', layer: 'over', life: 0.6,
      count: Object.freeze({ base: 6, perDamage: 0, max: 6 }),
      speed: [0.4, 1], rise: [0.2, 0.6], gravity: 0.8, spread: Math.PI,
      size: [0.06, 0.1], grow: 1.3, height: 0.05,
      colors: ['#f6ecd2', '#e6d6b0', '#d9c49a'], outline: SAND_OUTLINE,
    }),
    chips: Object.freeze({
      shape: 'spark', layer: 'over', life: 0.35,
      count: Object.freeze({ base: 4, perDamage: 0, max: 4 }),
      speed: [1.2, 2.2], rise: [0.8, 1.6], gravity: 6, spread: Math.PI,
      size: [0.025, 0.04], height: 0.3,
      colors: ['#c9925a', '#8a5a2b', '#ffe066'], outline: 'rgba(40, 24, 10, 0.6)',
    }),
  }),

  // Taverne, nouvelle rotation : la porte s'ouvre, de la fumée entre, la porte se referme.
  door: Object.freeze({
    duration: 2.6, opening: 0.5, closing: 0.7, maxAngle: 0.85,
    smoke: Object.freeze({
      shape: 'puff', layer: 'over', life: 1.6,
      count: Object.freeze({ base: 5, perDamage: 0, max: 5 }),
      speed: [0.3, 0.7], rise: [0.15, 0.45], gravity: -0.05, spread: 0.7,
      size: [0.09, 0.15], grow: 1.8, height: 0.35,
      colors: ['#d8d2c6', '#c6beb0', '#e6e0d4'], outline: 'rgba(70, 60, 50, 0.3)',
    }),
    puffs: 4, puffEvery: 0.25,
  }),

  // Taverne, recrue engagée : deux chopes se rejoignent et trinquent, la mousse gicle.
  cheers: Object.freeze({
    duration: 1.3, glyph: '🍺', size: 0.4, height: 1.25, gap: 0.45, meetAt: 0.45,
    froth: Object.freeze({
      shape: 'spark', layer: 'over', life: 0.45,
      count: Object.freeze({ base: 8, perDamage: 0, max: 8 }),
      speed: [0.8, 1.8], rise: [0.6, 1.4], gravity: 4, spread: Math.PI,
      size: [0.03, 0.05], height: 1.3,
      colors: ['#fffdf2', '#fff3c4', '#f7e3a1'], outline: 'rgba(90, 60, 20, 0.5)',
    }),
  }),

  // Carnet de bord, fin de saison : guirlande de bannières aux couleurs de la compagnie ;
  // confettis en cas de montée.
  seasonEnd: Object.freeze({
    banners: 14,
    confetti: Object.freeze({ count: 70, extraColors: ['#e0b43a', '#f4ecd8'], duration: [2.4, 4.2], delay: [0, 1.6] }),
  }),

  // --- Lot 4 ---

  // A8. Manche gagnée : fanions du vainqueur qui claquent au-dessus de ses combattants debout,
  // poussière soulevée par la foule le long de la palissade. Sobre (les confettis restent à la fin
  // de saison). Horloge de rendu : l'effet continue une fois le rejeu arrêté.
  roundWin: Object.freeze({
    duration: 2.8, pennant: Object.freeze({ height: 1.25, size: 0.3, wave: 7, fadeIn: 0.25 }),
    dustPoints: 12, dustEvery: 0.16,
    dust: Object.freeze({
      shape: 'puff', layer: 'over', life: 0.9,
      count: Object.freeze({ base: 4, perDamage: 0, max: 4 }),
      speed: [0.2, 0.6], rise: [0.3, 0.8], gravity: 0.4, spread: Math.PI,
      size: [0.06, 0.1], grow: 1.5, height: 0.15,
      colors: ['#f6ecd2', '#ece0bf', '#e0cfa6'], outline: SAND_OUTLINE,
    }),
  }),

  // B1. Révélation d'un talent (Scriptorium, à la première visite qui suit) : le livre s'ouvre,
  // les pages tourbillonnent, une lumière à la couleur de la famille jaillit, le nom du talent
  // monte. Épique : rayons noirs cernés d'or, plus longs.
  reveal: Object.freeze({
    duration: 3.2, epicDuration: 4.4, height: 0.85, glyph: '📖', glyphSize: 0.42,
    pages: 10, pageRadius: 0.55, pageRise: 0.9, pageSize: 0.07, pageTurns: 1.6,
    rays: 12, raySize: 1.3, raySpin: 0.5, textSize: 0.3, textRise: 0.7,
    flash: Object.freeze({ life: 0.35, radius: 0.9 }),
    maxAgeDays: 30,
  }),

  // B2. Étude en cours (chaque pupitre occupé) : points d'encre de la plume, poussière dorée
  // de chandelle qui flotte. Ambiance : fonction du temps, sans effet à déclencher.
  study: Object.freeze({
    inkEvery: 1.1, motes: 4, moteLife: 3.2, moteRise: 0.7, moteSize: 0.025, height: 0.5,
    ink: Object.freeze({
      shape: 'drop', layer: 'over', life: 0.45,
      count: Object.freeze({ base: 3, perDamage: 0, max: 3 }),
      speed: [0.15, 0.35], rise: [0.2, 0.4], gravity: 2.5, spread: Math.PI,
      size: [0.018, 0.026], height: 0.55,
      colors: ['#1b2440', '#2b3a66'], outline: null,
    }),
  }),

  // B3. Achat d'un artefact : l'objet descend se poser sur la table de Flavia, onde de lumière,
  // pages qui volent.
  artifact: Object.freeze({
    duration: 2.6, drop: 0.9, dropHeight: 1.6,
    wave: Object.freeze({ life: 1.2, radius: [0.15, 1.3], width: 0.06 }),
    flash: Object.freeze({ life: 0.3, radius: 0.7 }),
    pages: Object.freeze({
      shape: 'page', layer: 'over', life: 1.3,
      count: Object.freeze({ base: 9, perDamage: 0, max: 9 }),
      speed: [0.5, 1.2], rise: [0.8, 1.6], gravity: 1.2, spread: Math.PI,
      size: [0.06, 0.08], height: 0.5, spin: 5,
      colors: ['#f4ecd8', '#fffaf0', '#e8dcc0'], outline: 'rgba(90, 70, 40, 0.6)',
    }),
  }),

  // C1. Victoire (Reine : pétales ; Coupe : étincelles d'or) sur l'écran de résultat.
  victory: Object.freeze({
    queen: Object.freeze({ count: 46, shape: 'petal', colors: ['#e0607e', '#f4a3b8', '#fff0f3', '#c2185b'], duration: [2.8, 4.6], delay: [0, 1.4] }),
    cup: Object.freeze({ count: 54, shape: 'spark', colors: ['#ffd75e', '#e0b43a', '#fff6d0'], duration: [1.8, 3.2], delay: [0, 1.6] }),
  }),

  // C2. Qualification au tour suivant de la Coupe : le blason de la compagnie avance dans
  // l'arbre, suivi d'une traînée lumineuse (millisecondes).
  cupAdvance: Object.freeze({ duration: 1100, trailDots: 9, dotLife: 650 }),
});