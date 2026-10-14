// Le Scriptorium — règles de l'étude des talents et améliorations de la Professeure Flavia
// (systems/talents/StudyService.js, systems/talents/ScriptoriumUpgradeService.js).
// La mise en scène (décor, personnages) est dans data/scriptoriumLayout.js.

export const STUDY_RULES = Object.freeze({
  // Durée d'une étude (jours du calendrier du jeu) selon le potentiel du combattant (0 à 3).
  durationByPotential: Object.freeze({ 0: 25, 1: 20, 2: 15, 3: 10 }),
  // Places au Bureau d'étude au départ (une amélioration de Flavia en ajoute).
  desks: 1,
  // Remplacement d'un talent (v0.72 : combattant qui a déjà ses DEUX talents, au choix le premier
  // ou le second) : prix en deniers, payé au lancement, jamais remboursé. Premier et second talent :
  // études gratuites.
  replaceCost: 500,
});

/** Amélioration du Bureau d'étude (achat unique, auprès de Flavia). */
export const DESK_UPGRADE = Object.freeze({
  id: 'extra-desk',
  name: 'Un second Bureau d’étude',
  description: 'Une place d’étude de plus : deux combattants peuvent étudier en même temps.',
  cost: 2500,
  extraDesks: 1,
});

/**
 * Chances de chaque famille de talents à la révélation, sans artefact. Chaque configuration
 * totalise 100 % (vérifié par les tests).
 */
export const BASE_RARITY_ODDS = Object.freeze({ common: 0.8, rare: 0.19, epic: 0.01 });

/**
 * Artefacts (auprès de Flavia) : une AMÉLIORATION par paliers. Au départ, seul le premier est
 * à vendre ; chacun débloque le suivant (`requires`). Le dernier acheté est actif : sa
 * configuration COMPLÈTE de chances remplace la précédente (jamais de cumul).
 * Les identifiants sont ceux des sauvegardes (ne pas les changer) ; les noms peuvent changer.
 */
// `look` (présentation seulement) : l'artefact posé sur la table de Flavia — reliure, taille
// (fraction de la largeur d'une case) et lueur.
export const ARTIFACTS = Object.freeze([
  Object.freeze({ id: 'lugubre', name: 'Grimoire de guerre', icon: '📕', cost: 2000, requires: null, odds: Object.freeze({ common: 0.6, rare: 0.36, epic: 0.04 }),
    look: Object.freeze({ cover: '#5a1414', size: 0.34, glow: '200, 60, 40' }) }),
  Object.freeze({ id: 'brillant', name: 'Encyclopédie du guerrier', icon: '📚', cost: 6000, requires: 'lugubre', odds: Object.freeze({ common: 0.5, rare: 0.44, epic: 0.06 }),
    look: Object.freeze({ cover: '#1f3f7a', size: 0.4, glow: '120, 170, 255' }) }),
  Object.freeze({ id: 'grand', name: 'Traité de Poliorcétique', icon: '🏰', cost: 10000, requires: 'brillant', odds: Object.freeze({ common: 0.2, rare: 0.6, epic: 0.2 }),
    look: Object.freeze({ cover: '#2b2b2f', size: 0.46, glow: '240, 196, 25' }) }),
]);

/** Configuration sans artefact (affichage). */
export const NO_ARTIFACT = Object.freeze({ id: null, name: 'Aucune amélioration', icon: '📖', cost: 0, odds: BASE_RARITY_ODDS });
