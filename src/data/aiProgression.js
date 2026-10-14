// Progression des combattants des clubs de l'IA (systems/clubs/AIProgressionService.js).
// Ne concerne jamais les combattants de la compagnie du joueur.

export const AI_PROGRESSION_CONFIG = Object.freeze({
  // Gain d'un point de niveau par jour, selon les étoiles ACTUELLES du combattant (combattants
  // de moins de `aging.fromAge` ans). Première tranche dont `maxStars` est atteint ou dépassé.
  // v0.56.0 : progression freinée ×1,5 (chances d'avant divisées par 1,5) pour limiter le
  // tassement des niveaux vers le haut ; le vieillissement (ci-dessous) est inchangé.
  progressionByStars: Object.freeze([
    Object.freeze({ maxStars: 3, chance: 0.10 / 1.5 }),   // 0 à 3 ★ : 6,7 %
    Object.freeze({ maxStars: 4, chance: 0.05 / 1.5 }),   // 3,5 à 4 ★ : 3,3 %
    Object.freeze({ maxStars: 5, chance: 0.02 / 1.5 }),   // 4,5 à 5 ★ : 1,3 %
  ]),
  levelGain: 1,

  // Vieillissement : à partir de `fromAge` ans, plus de progression ; à la place, perte d'un
  // point par jour avec la chance min((âge − ageOffset) × chancePerYear, maxChance).
  //   32 ans 2 % · 33 ans 3 % · 34 ans 4 % · 35 ans et plus 5 %
  aging: Object.freeze({ fromAge: 32, ageOffset: 30, chancePerYear: 0.01, maxChance: 0.05 }),
  levelLoss: 1,

  // Bornes du niveau d'un combattant (celles du système de niveaux).
  minLevel: 0,
  maxLevel: 100,

  // Historique : période de l'indicateur (jours) ; les événements plus anciens sont supprimés.
  historyDays: 30,

  // Indicateur de progression sur la période, d'après le bilan NET (niveau actuel − niveau
  // au début de la période) : première règle satisfaite.
  indicators: Object.freeze([
    Object.freeze({ id: 'DOWN', maxNet: -1, arrows: '↓' }),
    Object.freeze({ id: 'UP_3', minNet: 4, arrows: '↑↑↑' }),
    Object.freeze({ id: 'UP_2', minNet: 3, arrows: '↑↑' }),
    Object.freeze({ id: 'UP_1', minNet: 1, arrows: '↑' }),
  ]),
});

export const PROGRESSION_NONE = 'NONE';
