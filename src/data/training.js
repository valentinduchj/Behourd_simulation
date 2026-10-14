// Ma Lice d'entraînement (v0.71) — combats internes au club, sans aucune conséquence.
// Service : systems/training/TrainingCombatService.js ; écran : ui/screens/TrainingScreen.js.

export const TRAINING_FORMATS = Object.freeze([
  Object.freeze({ id: '1v1', size: 1, label: '1 contre 1' }),
  Object.freeze({ id: '3v3', size: 3, label: '3 contre 3' }),
  Object.freeze({ id: '5v5', size: 5, label: '5 contre 5' }),
]);

export const DEFAULT_TRAINING_FORMAT = '3v3';

export const TRAINING_RULES = Object.freeze({
  // Fatigue de départ proposée : celle du moment (représentative) ou reposés (0).
  fatigueModes: Object.freeze([
    Object.freeze({ id: 'current', label: 'Fatigue actuelle' }),
    Object.freeze({ id: 'rested', label: 'Reposés (fatigue 0)' }),
  ]),
  // Saison : les règles de l'entraînement n'en dépendent pas (aucun malus saisonnier, aucun
  // talent saisonnier actif) ; seul le décor suit la saison de l'année.
  season: null,
  // Journal : nombre d'entrées gardées au plus (les plus anciennes cèdent la place).
  journalMaxEntries: 800,
  // Spectateurs de la lice (compagnons qui regardent l'entraînement).
  watchers: 7,
});

// Camp B : tabards contrastés, pour distinguer les deux camps d'une même compagnie.
export const TRAINING_SIDE_B_COLORS = Object.freeze({
  default: Object.freeze({ primary: 'azur', secondary: 'argent', tertiary: 'sable' }),
  // Si la compagnie porte déjà de l'azur : gueules.
  alternate: Object.freeze({ primary: 'gueules', secondary: 'argent', tertiary: 'sable' }),
});

// Le Marshal : arbitre du béhourd, DANS la lice (coordonnées du terrain de combat 13 × 8), pour
// qu'on le voie bien. Hors combat, il va et vient au milieu du terrain, s'arrête, regarde.
export const MARSHAL = Object.freeze({
  name: 'Marshal',
  sprites: Object.freeze({ idle: 'training_marshal', signal: 'training_marshal_signal' }),
  // Ronde : points d'arrêt (terrain de combat), durée d'un aller (s), pause à chaque point (s).
  patrol: Object.freeze([Object.freeze({ x: 6.5, y: 2.6 }), Object.freeze({ x: 8.6, y: 4.2 }), Object.freeze({ x: 6.5, y: 5.6 }), Object.freeze({ x: 4.4, y: 4.2 })]),
  walkSeconds: 2.4,
  pauseSeconds: 3.6,
  // Pendant un combat : immobile au milieu du bord arrière de la lice, loin des zones de placement
  // (qui sont aux deux bouts) ; signal de départ.
  combatSpot: Object.freeze({ x: 6.5, y: 0.45 }),
  // Taille à l'écran (par rapport à un spectateur) et zone cliquable autour de lui.
  scale: 1.3,
  hitPadding: 0.25,
});