// Mise en scène du Centre (centre/animation/) — PRÉSENTATION uniquement : aucune règle
// d'activité ici. Le gameplay affecte un combattant à une activité (ActivityService) ; la
// mise en scène en déduit sa place, son animation et l'ambiance du lieu.
//
//   ACTIVITY_VISUALS[activityId] :
//     occupiedAnimation  animation d'un combattant affecté (centre/animation/fighterAnimations.js)
//     byClass            (facultatif) { [classe]: animation } : variante selon la classe
//     idleAnimation      ambiance du lieu, même vide (centre/animation/environment.js)
//     environmentVfx     effets d'ambiance du lieu (oiseaux, feuilles, fumée, reflets…)
//     interactionPoints  places des combattants, dans l'ordre d'arrivée (cases, fractions permises) :
//                        { x, y, target: { x, y } | propId, to?: { x, y }, partner? }
//                        target : ce vers quoi il se tourne et qu'il fait réagir ; to : point
//                        d'arrivée d'une course (Tas de foin) ; partner : index de son partenaire
//                        (Petite lice). Au-delà du nombre de places, les points sont réutilisés
//                        avec un léger décalage.
//     entrance           (facultatif) passage obligé pour entrer et sortir (ex. contourner la table)
//
// Ajouter une animation : une entrée dans centre/animation/fighterAnimations.js puis son nom ici.

export const ACTIVITY_VISUALS = Object.freeze({
  banquet: {
    occupiedAnimation: 'eat',
    entrance: { x: 6.4, y: 2.55 },
    idleAnimation: 'banquet',
    environmentVfx: ['smoke:banquet-fire'],
    interactionPoints: [
      // Derrière la table, face au joueur : la table cache le bas du corps (ils sont assis).
      { x: 2.55, y: 2.75, target: 'banquet-table' }, { x: 3.5, y: 2.75, target: 'banquet-table' },
      { x: 4.5, y: 2.75, target: 'banquet-table' }, { x: 5.45, y: 2.75, target: 'banquet-table' },
      { x: 3.0, y: 2.3, target: 'banquet-table' }, { x: 4.0, y: 2.3, target: 'banquet-table' },
      { x: 5.0, y: 2.3, target: 'banquet-table' }, { x: 2.2, y: 2.35, target: 'banquet-table' },
    ],
  },
  lice: {
    occupiedAnimation: 'spar',
    entrance: { x: 8.7, y: 2.5 },
    idleAnimation: 'lice',
    environmentVfx: ['dust'],
    interactionPoints: [
      // Paires face à face dans l'axe horizontal de l'écran (x + 1, y − 1).
      { x: 9.6, y: 2.6, partner: 1 }, { x: 10.8, y: 1.4, partner: 0 },
      { x: 10.3, y: 3.5, partner: 3 }, { x: 11.5, y: 2.3, partner: 2 },
      { x: 9.4, y: 1.9, partner: 5 }, { x: 10.3, y: 1.1, partner: 4 },
      { x: 10.9, y: 3.7, partner: 7 }, { x: 11.7, y: 2.9, partner: 6 },
    ],
  },
  dummies: {
    occupiedAnimation: 'strikeDummy',
    entrance: { x: 11.9, y: 0.55 },
    idleAnimation: 'dummies',
    environmentVfx: [],
    interactionPoints: [
      { x: 13.05, y: 1.0, target: 'dummy-1' }, { x: 14.0, y: 2.05, target: 'dummy-2' },
      { x: 13.05, y: 3.0, target: 'dummy-3' }, { x: 14.05, y: 3.95, target: 'dummy-4' },
      { x: 12.1, y: 2.0, target: 'dummy-1' }, { x: 14.95, y: 1.15, target: 'dummy-2' },
      { x: 12.05, y: 3.95, target: 'dummy-3' }, { x: 14.95, y: 3.1, target: 'dummy-4' },
    ],
  },
  hay: {
    occupiedAnimation: 'chargeHay',
    idleAnimation: 'hay',
    environmentVfx: ['straw'],
    interactionPoints: [
      { x: 10.6, y: 5.75, to: { x: 10.55, y: 5.05 }, target: 'hay-1' },
      { x: 12.6, y: 5.75, to: { x: 12.55, y: 5.05 }, target: 'hay-2' },
      { x: 14.6, y: 5.75, to: { x: 14.55, y: 5.05 }, target: 'hay-3' },
      { x: 9.7, y: 5.8, to: { x: 10.05, y: 5.0 }, target: 'hay-1' },
      { x: 11.7, y: 5.8, to: { x: 12.05, y: 5.0 }, target: 'hay-2' },
      { x: 13.7, y: 5.8, to: { x: 14.05, y: 5.0 }, target: 'hay-3' },
      { x: 11.2, y: 5.45, to: { x: 10.95, y: 4.95 }, target: 'hay-1' },
      { x: 13.2, y: 5.45, to: { x: 12.95, y: 4.95 }, target: 'hay-2' },
    ],
  },
  forest: {
    occupiedAnimation: 'chop',
    idleAnimation: 'forest',
    environmentVfx: ['leaves', 'birds'],
    interactionPoints: [
      { x: 3.1, y: 9.7, target: 'stump-1' }, { x: 6.1, y: 9.7, target: 'stump-2' },
      { x: 4.1, y: 11.7, target: 'stump-3' }, { x: 6.1, y: 11.7, target: 'stump-4' },
      { x: 2.35, y: 10.15, target: 'stump-1' }, { x: 5.35, y: 10.15, target: 'stump-2' },
      { x: 3.35, y: 12.15, target: 'stump-3' }, { x: 5.35, y: 12.15, target: 'stump-4' },
      { x: 2.1, y: 8.75, target: 'tree-1' }, { x: 4.1, y: 8.75, target: 'tree-2' },
    ],
  },
  river: {
    occupiedAnimation: 'swim',
    idleAnimation: 'river',
    environmentVfx: ['waterGlints'],
    interactionPoints: [
      { x: 11.5, y: 9.0 }, { x: 12.5, y: 10.0 }, { x: 11.5, y: 11.0 }, { x: 12.5, y: 12.0 },
      { x: 12.5, y: 8.6 }, { x: 11.5, y: 12.2 }, { x: 11.6, y: 10.1 }, { x: 12.4, y: 11.1 },
      { x: 11.4, y: 8.4 }, { x: 12.6, y: 9.3 },
    ],
  },
});

// Variantes d'animation selon la classe (mêmes animations, gestes différents) :
//   reach  amplitude des fentes et des frappes (cases) ; tempo  vitesse des gestes (1 = normale).
// Le lutteur s'engage au corps à corps, le hastier frappe de loin, le coureur est plus vif.
export const CLASS_ANIMATION_STYLE = Object.freeze({
  lutteur: Object.freeze({ reach: 0.3, tempo: 1 }),
  hastier: Object.freeze({ reach: 0.14, tempo: 0.9 }),
  runner: Object.freeze({ reach: 0.2, tempo: 1.2 }),
});
export const DEFAULT_ANIMATION_STYLE = Object.freeze({ reach: 0.2, tempo: 1 });

// Fatigue : au-delà du seuil, les gestes ralentissent (présentation seulement).
export const FATIGUE_ANIMATION = Object.freeze({ threshold: 70, tempo: 0.75 });

// Combattant sans activité (la cour) et en déplacement.
export const REST_VISUAL = Object.freeze({ occupiedAnimation: 'idle' });
export const WALK_ANIMATION = 'walk';

// Déplacements entre la cour et les lieux (pas de téléportation) : vitesse en cases par seconde ;
// dans la cour, un combattant change de place de temps en temps (secondes).
export const CENTRE_MOVEMENT = Object.freeze({ walkSpeed: 1.9, restWander: Object.freeze({ min: 9, max: 18 }) });

// Taille d'un combattant à l'écran (fraction de la largeur d'une case) et cadrage de la caméra
// sur un lieu sélectionné (marge en cases autour de sa zone ; vitesse du glissement).
export const CENTRE_CAMERA = Object.freeze({ fighterHeight: 0.98, focusMargin: 1.4, minFocus: 6, ease: 3.2 });

// Particules du Centre (même format que data/vfx.js : render/vfx/particles.js).
const DUST_OUTLINE = 'rgba(92, 62, 30, 0.4)';
export const CENTRE_PARTICLES = Object.freeze({
  straw: Object.freeze({
    shape: 'spark', layer: 'over', life: 0.5, count: Object.freeze({ base: 7, perDamage: 0, max: 7 }),
    speed: [0.8, 1.8], rise: [0.6, 1.4], gravity: 3, spread: Math.PI, size: [0.02, 0.035], height: 0.25,
    colors: ['#f2dc7a', '#e3c45a', '#cfae46'], outline: 'rgba(110, 80, 20, 0.5)',
  }),
  chips: Object.freeze({
    shape: 'spark', layer: 'over', life: 0.45, count: Object.freeze({ base: 5, perDamage: 0, max: 5 }),
    speed: [1, 2], rise: [0.8, 1.6], gravity: 6, spread: 1.4, size: [0.025, 0.04], height: 0.18,
    colors: ['#d9b479', '#a8823a', '#7a5230'], outline: 'rgba(40, 24, 10, 0.6)',
  }),
  sparks: Object.freeze({
    shape: 'spark', layer: 'over', life: 0.25, count: Object.freeze({ base: 4, perDamage: 0, max: 4 }),
    speed: [1.2, 2.2], rise: [0.6, 1.2], gravity: 6, spread: Math.PI, size: [0.02, 0.03], height: 0.5,
    colors: ['#fffbe8', '#ffe066'], outline: 'rgba(40, 24, 10, 0.7)',
  }),
  splash: Object.freeze({
    shape: 'puff', layer: 'over', life: 0.55, count: Object.freeze({ base: 5, perDamage: 0, max: 5 }),
    speed: [0.3, 0.8], rise: [0.6, 1.1], gravity: 4, spread: Math.PI, size: [0.025, 0.045], grow: 0.4, height: 0.12,
    colors: ['#e8f4fb', '#cfe6f3', '#ffffff'], outline: 'rgba(40, 90, 130, 0.45)',
  }),
  crumbs: Object.freeze({
    shape: 'puff', layer: 'over', life: 0.5, count: Object.freeze({ base: 3, perDamage: 0, max: 3 }),
    speed: [0.2, 0.5], rise: [0.1, 0.4], gravity: 2, spread: Math.PI, size: [0.015, 0.025], grow: 0, height: 0.55,
    colors: ['#d9a35a', '#b8834a'], outline: 'rgba(60, 35, 10, 0.4)',
  }),
  dust: Object.freeze({
    shape: 'puff', layer: 'over', life: 0.6, count: Object.freeze({ base: 3, perDamage: 0, max: 3 }),
    speed: [0.25, 0.6], rise: [0.05, 0.25], gravity: 0.3, spread: Math.PI, size: [0.04, 0.07], grow: 1.3, height: 0.03,
    colors: ['#f2e6c8', '#e6d6b0'], outline: DUST_OUTLINE,
  }),
  // Farine soulevée par le pétrin (Boulanger du Bourg).
  flour: Object.freeze({
    shape: 'puff', layer: 'over', life: 0.7, count: Object.freeze({ base: 4, perDamage: 0, max: 4 }),
    speed: [0.15, 0.4], rise: [0.15, 0.4], gravity: 0.4, spread: Math.PI, size: [0.025, 0.045], grow: 1.1, height: 0.32,
    colors: ['#ffffff', '#f6f1e6', '#ece4d2'], outline: 'rgba(120, 100, 70, 0.3)',
  }),
  smoke: Object.freeze({
    shape: 'puff', layer: 'over', life: 3.2, count: Object.freeze({ base: 1, perDamage: 0, max: 1 }),
    speed: [0.05, 0.15], rise: [0.25, 0.4], gravity: -0.02, spread: Math.PI, size: [0.06, 0.09], grow: 2.4, height: 0.35,
    colors: ['#cfc8bc', '#bdb5a8'], outline: null,
  }),
});

// Ambiance générale (centre/animation/environment.js) : vent, oiseaux, feuilles, poussière.
export const CENTRE_AMBIENCE = Object.freeze({
  wind: Object.freeze({ strength: 0.045, speed: 0.9, gust: 0.35 }),
  // Un vol d'oiseaux de temps en temps (pas en permanence) : une fenêtre tous les `every`
  // secondes, avec une chance `chance`, d'une durée `duration`.
  birds: Object.freeze({ every: 26, chance: 0.75, duration: 9, count: [3, 5] }),
  leaves: Object.freeze({ count: 6, fall: 7 }),
  motes: Object.freeze({ count: 8 }),
  maxParticles: 160,
});
