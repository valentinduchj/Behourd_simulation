// Habillage visuel des saisons de l'année (v0.70) — PRÉSENTATION uniquement, aucune règle de
// jeu (règles : data/climate.js). Lu par render/seasonLook.js et les décors partagés
// (render/propRenderers.js), pour Le Centre, Le Bourg et les lices. La Taverne et le
// Scriptorium ne reçoivent jamais de saison : leur apparence ne change pas.
//
// La géométrie, les zones cliquables et les animations ne changent pas : seules les couleurs,
// la végétation, des détails au sol, la météo et quelques états (eau, feux) varient.
//
//   ground     transformation des couleurs du sol (verts : herbe ; autres : terre, sable, pierre)
//              hue/hueMix : teinte visée et part du mélange ; sat : saturation × ; light : clarté +
//   snow       part de neige mêlée aux couleurs (hiver) selon le rôle du sol
//   foliage    feuillages des arbres (3 étages), par variante (choisie par arbre, fixe)
//   bush       feuillage des buissons (3 boules)
//   details    détails posés au sol (fraction des cases concernées)
//   water      état de l'eau : 'dry' (lit asséché), 'cold', 'normal'
//   weather    météo animée : 'motes', 'leaves', 'snow', 'petals'
//   sky        ciel des lices (dégradé)

export const SNOW_COLOR = '#eef3f8';

export const CLIMATE_VISUALS = Object.freeze({
  summer: Object.freeze({
    ground: Object.freeze({ green: { hue: 48, hueMix: 0.8, sat: 1.35, light: 0.05 }, other: { hue: 38, hueMix: 0.15, sat: 1.05, light: 0.04 } }),
    snow: null,
    foliage: Object.freeze([Object.freeze(['#5b7a28', '#6a8a2f', '#7d9b38'])]),
    bush: Object.freeze(['#738a33', '#6a8030', '#869c3d']),
    blossom: 0,
    details: Object.freeze({ grass: 0.14, path: 0.1, ground: 0.06 }),
    water: 'dry',
    weather: 'motes',
    flowers: true,
    sky: Object.freeze(['#8fc0ea', '#f3e3b3']),
    tuft: Object.freeze(['#b8a15a', '#d1b96a']),
  }),
  autumn: Object.freeze({
    ground: Object.freeze({ green: { hue: 40, hueMix: 0.45, sat: 0.85, light: -0.05 }, other: { hue: 30, hueMix: 0, sat: 0.95, light: -0.06 } }),
    snow: null,
    foliage: Object.freeze([
      Object.freeze(['#9c3f17', '#be5622', '#d8772b']),
      Object.freeze(['#8a2a1c', '#ab3a26', '#c8552f']),
      Object.freeze(['#a87a1a', '#c99428', '#e0b13a']),
      Object.freeze(['#2c5f2a', '#356f31', '#43803b']),
    ]),
    bush: Object.freeze(['#a65a24', '#8c4a1e', '#c47a2e']),
    blossom: 0,
    details: Object.freeze({ grass: 0.42, path: 0.16, ground: 0.3 }),
    water: 'normal',
    weather: 'leaves',
    flowers: false,
    sky: Object.freeze(['#94aabd', '#d9dcd6']),
    tuft: Object.freeze(['#8c6a3a', '#a8804a']),
  }),
  winter: Object.freeze({
    ground: Object.freeze({ green: { hue: 200, hueMix: 0.15, sat: 0.5, light: 0 }, other: { hue: 210, hueMix: 0.1, sat: 0.6, light: 0 } }),
    snow: Object.freeze({ grass: 0.8, ground: 0.58, path: 0.5, arena: 0.32, other: 0.45 }),
    foliage: Object.freeze([Object.freeze(['#1d4a2e', '#245638', '#2c6341'])]),
    bush: Object.freeze(['#2d5338', '#284a32', '#365f40']),
    blossom: 0,
    details: Object.freeze({ grass: 0.3, path: 0.2, ground: 0.2 }),
    water: 'cold',
    weather: 'snow',
    flowers: false,
    sky: Object.freeze(['#aebccb', '#e9eef2']),
    tuft: Object.freeze(['#c9d2da', '#e4e9ee']),
  }),
  spring: Object.freeze({
    ground: Object.freeze({ green: { hue: 105, hueMix: 0.2, sat: 1.12, light: 0.02 }, other: { hue: 0, hueMix: 0, sat: 1, light: 0 } }),
    snow: null,
    foliage: Object.freeze([Object.freeze(['#3d8a34', '#4c9f41', '#60b453'])]),
    bush: Object.freeze(['#4a963f', '#43893a', '#5aad4d']),
    blossom: 0.4,
    details: Object.freeze({ grass: 0.3, path: 0.04, ground: 0.12 }),
    water: 'normal',
    weather: 'petals',
    flowers: true,
    sky: Object.freeze(['#9fd0f2', '#e2f2e6']),
    tuft: Object.freeze(['#7fae4e', '#99c35c']),
  }),
});

// Couleurs de l'eau selon son état (cases d'eau du Centre).
export const WATER_LOOKS = Object.freeze({
  normal: Object.freeze({ colors: ['#4f97c9', '#4890c3'], flow: 1 }),
  cold: Object.freeze({ colors: ['#7aa1bb', '#7299b4'], flow: 0.35, ice: '#e3eef5' }),
  dry: Object.freeze({ colors: ['#a3865b', '#987b51'], flow: 0, crack: '#6e5434', pebble: '#c8b48f' }),
});
