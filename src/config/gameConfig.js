// Paramètres globaux du jeu. Tout ce qui est "réglage de conception" vit ici.
export const GAME_CONFIG = Object.freeze({
  title: 'Béhourd',
  subtitle: 'Gestion de compagnie médiévale',
  version: '0.76.1',

  roster: Object.freeze({
    size: 8,
    // Compétences de départ des combattants générés avec la compagnie du joueur (hors
    // capitaine, qui a sa propre plage : data/captain.js). v0.56.0 : 8–27 au lieu de 10–30
    // (−2 à −3), pour une Ligue 3 moins facile. Recrues et clubs de l'IA : plage habituelle.
    startingSkillRange: Object.freeze({ min: 8, max: 27 }),
  }),

  team: Object.freeze({
    nameMinLength: 2,
    nameMaxLength: 32,
  }),

  fighter: Object.freeze({
    nameMinLength: 2,
    nameMaxLength: 40,
  }),

  economy: Object.freeze({
    startingDeniers: 100,
    // Deniers gagnés par réussite en Forêt : tirage entre min et max (bornes comprises).
    forestDeniers: Object.freeze({ min: 8, max: 12 }),
  }),

  combat: Object.freeze({
    // Nombre de combattants alignés par camp dans La Lice (aperçu).
    fightersPerSide: 8,
  }),

  admin: Object.freeze({
    // Outil de développement : ce code n'est pas une protection de sécurité.
    accessCode: 'yn3yn3yn3',
  }),

  storage: Object.freeze({
    prefix: 'behourd.',
  }),
});
