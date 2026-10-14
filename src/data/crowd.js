// Affluence autour de La Lice — PRÉSENTATION uniquement : la foule n'a aucun effet sur
// les règles, les manches ou les probabilités. Valeurs de conception, ajustables ici.
//
// Calcul (systems/crowd/CrowdService.js) :
//   1. prestige de chaque club = (N − rang) / (N − 1) : 1 pour le 1er, 0 pour le dernier
//      (les clubs à égalité au classement partagent la moyenne de leurs rangs) ;
//   2. prestige du combat = moyenne des deux ;
//   3. affluence de référence = interpolation linéaire entre les `referenceCurve` ;
//   4. effet de la division : × multiplier, puis bornée entre minimum et maximum.

export const CROWD_CONFIG = Object.freeze({
  // Affluence de référence (Ligue 3) selon le prestige du combat.
  // Repères de conception, avec 18 équipes :
  //   18e contre 16e → prestige 0,06 → ~1 spectateur (0 à quelques-uns)
  //   11e contre 6e  → prestige 0,56 → ~12 (10 à 15)
  //   2e contre 1er  → prestige 0,97 → 40
  referenceCurve: Object.freeze([
    { prestige: 0, spectators: 0 },
    { prestige: 0.15, spectators: 3 },
    { prestige: 0.45, spectators: 9 },
    { prestige: 0.56, spectators: 12.5 },
    { prestige: 0.85, spectators: 25 },
    { prestige: 0.97, spectators: 40 },
    { prestige: 1, spectators: 42 },
  ]),

  // Effet de la division, par niveau (tier 1 = Ligue 1). À classement comparable :
  // Ligue 1 > Ligue 2 > Ligue 3 (affluence minimale et capacité).
  byTier: Object.freeze({
    1: Object.freeze({ multiplier: 2.2, minimum: 12, maximum: 100 }),
    2: Object.freeze({ multiplier: 1.5, minimum: 4, maximum: 70 }),
    3: Object.freeze({ multiplier: 1, minimum: 0, maximum: 45 }),
  }),
  // Division sans réglage propre.
  defaultTier: Object.freeze({ multiplier: 1, minimum: 0, maximum: 45 }),

  // Variation aléatoire autour de la valeur calculée (± fraction), quand un générateur
  // aléatoire est fourni ; sans générateur, le calcul est déterministe.
  variation: 0.12,

  // Règles propres à un type de combat, prioritaires sur le calcul ci-dessus.
  // Combat de la Reine : jamais moins de `minimum` spectateurs (davantage si le calcul l'indique).
  byCombatKind: Object.freeze({
    queen: Object.freeze({ minimum: 50 }),
  }),
});

/** Placement de la foule autour de la palissade (combat/presentation/crowdLayout.js). */
export const CROWD_LAYOUT = Object.freeze({
  // Nombre maximal de spectateurs dessinés (fluidité) ; l'affluence peut être plus grande.
  maxRendered: 110,
  // Rangées de spectateurs : distance à la palissade (en cases).
  rows: Object.freeze([0.55, 1.3]),
  // Écart entre deux spectateurs voisins d'une rangée (en cases).
  spacing: 0.5,
  // Marge laissée aux extrémités de chaque côté (en cases).
  margin: 0.35,
  // Déplacement aléatoire de chaque spectateur autour de sa place (en cases).
  jitter: 0.12,
  // Priorité des côtés : les longs côtés se remplissent d'abord (poids relatifs).
  sideWeights: Object.freeze({ long: 3, short: 1 }),
  // Taille d'un spectateur (hauteur, en largeur de case) et variation.
  height: 0.62,
  heightVariation: 0.06,
  // Place laissée libre autour de La Reine (en cases) lors d'un Combat de la Reine.
  queenClearance: 0.8,
});
