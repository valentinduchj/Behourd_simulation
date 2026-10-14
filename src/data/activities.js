import { GAME_CONFIG } from '../config/gameConfig.js';

// Activités du Centre. Toutes passent par le même système générique
// (systems/activities/ActivityService.js). Pour ajouter un lieu (forge, mine, chapelle…),
// ajouter une entrée ici (et sa mise en scène dans data/centreVisuals.js).
//
// Champs :
//   group          regroupement affiché (ex. les trois zones du Pôle Combat)
//   capacity       nombre de places (null = illimité) ; une zone pleine refuse toute affectation
//   successChance  probabilité de réussite quotidienne (0 à 1)
//   reward         { type: 'stat', stat, amount } ou { type: 'stat', stat, min, max } (tirage aléatoire)
//                  { type: 'resource', resource, amount }
//                  Types gérés dans systems/activities/rewards.js. Pour une stat, la récompense
//                  est une AMÉLIORATION : pour la fatigue, elle la fait baisser.
//   conditions     [{ type, … }] — types gérés dans systems/activities/conditions.js
//   area           emplacement dans la grille du Centre (cases, voir data/centreLayout.js)
//   visual         sol, décor (props) et ancrage de l'étiquette pour le rendu isométrique
//                  (un décor peut porter un `id` : les animations le font réagir, ex. mannequin frappé)
//   resolve        (optionnel) traitement quotidien spécifique, à la place du traitement générique
//   quickAssign    (optionnel) { stat, settingKey } : bouton [+] de la scène du Centre, qui affecte
//                  d'un clic tous les combattants dont `stat` dépasse le seuil de l'option `settingKey`
//
// v0.40 : l'Infirmerie a été retirée du Centre (les PV ne baissent jamais hors des manches ;
// aucune autre règle ne dépendait d'elle). Les règles des six autres lieux sont inchangées ;
// seuls leur emplacement et leur décor ont été redessinés.

export const ACTIVITIES = Object.freeze([
  {
    id: 'banquet',
    name: 'Banquet',
    icon: '🍗',
    color: '#9a5b1e',
    description: 'Une grande table où l’on mange et se repose pour récupérer de la fatigue.',
    capacity: null,
    successChance: 1,
    reward: { type: 'stat', stat: 'fatigue', min: 20, max: 40 },
    conditions: [{ type: 'statCanImprove', stat: 'fatigue' }],
    // Raccourci [+] dans la scène du Centre : y envoie d'un clic tous les combattants dont la
    // fatigue dépasse le seuil réglé par le joueur (option `settingKey`, de 0 à 100).
    quickAssign: { stat: 'fatigue', settingKey: 'gameplay.banquetThreshold' },
    area: { x: 2, y: 1, w: 4, h: 4 },
    visual: {
      ground: '#cdb48a',
      label: { x: 2, y: 1 },
      props: [
        { id: 'banquet-table', type: 'table', x: 2, y: 3, w: 4, h: 1 },
        { type: 'barrel', x: 2, y: 1 },
        { id: 'banquet-fire', type: 'campfire', x: 5, y: 1 },
      ],
    },
  },
  {
    id: 'lice',
    group: 'Pôle Combat',
    name: 'Petite lice',
    icon: '🤼',
    color: '#a5651f',
    description: 'Un espace clos de cordes pour l’entraînement à la lutte.',
    capacity: 4,
    successChance: 0.35,
    reward: { type: 'stat', stat: 'wrestling', amount: 1 },
    conditions: [],
    area: { x: 9, y: 1, w: 3, h: 3 },
    visual: {
      ground: '#dcbf86',
      label: { x: 9, y: 1 },
      props: [{ type: 'ring', x: 9, y: 1, w: 3, h: 3, blocking: false, layer: 'ground' }],
    },
  },
  {
    id: 'dummies',
    group: 'Pôle Combat',
    name: 'Mannequins',
    icon: '🎯',
    color: '#7a5230',
    description: 'Des mannequins d’entraînement pour travailler les armes d’hast.',
    capacity: 4,
    successChance: 0.35,
    reward: { type: 'stat', stat: 'polearm', amount: 1 },
    conditions: [],
    area: { x: 12, y: 1, w: 3, h: 3 },
    visual: {
      ground: '#c9b07c',
      label: { x: 12, y: 1 },
      props: [
        { id: 'dummy-1', type: 'dummy', x: 12, y: 1 },
        { id: 'dummy-2', type: 'dummy', x: 14, y: 1 },
        { id: 'dummy-3', type: 'dummy', x: 12, y: 3 },
        { id: 'dummy-4', type: 'dummy', x: 14, y: 3 },
      ],
    },
  },
  {
    id: 'hay',
    group: 'Pôle Combat',
    name: 'Tas de foin',
    icon: '🌾',
    color: '#b58a12',
    description: 'Des bottes de foin pour s’entraîner à la percussion.',
    capacity: 4,
    successChance: 0.35,
    reward: { type: 'stat', stat: 'percussion', amount: 1 },
    conditions: [],
    area: { x: 9, y: 4, w: 6, h: 2 },
    visual: {
      ground: '#e2cf96',
      label: { x: 9, y: 4 },
      props: [
        { id: 'hay-1', type: 'hay', x: 10, y: 4 },
        { id: 'hay-2', type: 'hay', x: 12, y: 4 },
        { id: 'hay-3', type: 'hay', x: 14, y: 4 },
      ],
    },
  },
  {
    id: 'forest',
    name: 'Forêt',
    icon: '🌲',
    color: '#3e7d3a',
    description: 'Coupe de bois et petits travaux payés par les villages voisins.',
    // Places de base ; le Bûcheron (Bourg) en ajoute 2 par amélioration (4 achats : 10 places au plus).
    capacity: 2,
    successChance: 0.5,
    reward: { type: 'resource', resource: 'deniers', min: GAME_CONFIG.economy.forestDeniers.min, max: GAME_CONFIG.economy.forestDeniers.max },
    conditions: [],
    area: { x: 1, y: 8, w: 6, h: 5 },
    visual: {
      ground: '#5f9a4c',
      label: { x: 1, y: 8 },
      props: [
        { id: 'tree-1', type: 'tree', x: 1, y: 8 }, { id: 'tree-2', type: 'tree', x: 3, y: 8 }, { type: 'tree', x: 6, y: 8 },
        { type: 'tree', x: 1, y: 10 }, { type: 'tree', x: 1, y: 12 }, { type: 'tree', x: 6, y: 12 },
        { id: 'stump-1', type: 'stump', x: 2, y: 9 }, { id: 'stump-2', type: 'stump', x: 5, y: 9 },
        { id: 'stump-3', type: 'stump', x: 3, y: 11 }, { id: 'stump-4', type: 'stump', x: 5, y: 11 },
        { type: 'logs', x: 2, y: 12 },
      ],
    },
  },
  {
    id: 'river',
    name: 'Rivière',
    icon: '≋',
    color: '#2d6aa0',
    description: 'Courses sur les berges et passages à gué pour développer l’endurance.',
    capacity: null,
    successChance: 0.35,
    reward: { type: 'stat', stat: 'endurance', amount: 1 },
    conditions: [],
    area: { x: 9, y: 8, w: 6, h: 5 },
    visual: {
      ground: '#8cc06a',
      label: { x: 9, y: 8 },
      // La rivière traverse le camp jusqu'à la lisière (pont sur la grande allée).
      props: [
        { type: 'water', x: 11, y: 6, w: 2, h: 8 },
        { type: 'tuft', x: 10, y: 9 }, { type: 'tuft', x: 13, y: 11 }, { type: 'rock', x: 14, y: 8 },
        { type: 'bush', x: 9, y: 12 }, { type: 'flowers', x: 14, y: 10, layer: 'ground' },
      ],
    },
  },
]);
