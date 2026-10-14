// Âge et potentiel des combattants (systems/fighters/PotentialService.js).

export const AGE_CONFIG = Object.freeze({
  // Âge à la création : tirage uniforme, bornes comprises.
  initial: Object.freeze({ min: 18, max: 35 }),
  // Années gagnées à chaque fin de saison (SeasonService.applyAgeIncrease).
  yearsPerSeason: 1,
});

export const POTENTIAL_CONFIG = Object.freeze({
  // Potentiel : capacité d'évolution future (0 à 3 flammes), donnée de jeu destinée au
  // futur système d'évolution des combattants.
  min: 0,
  max: 3,

  // Potentiel à la création (poids en %) : tous les combattants (recrues, clubs de l'IA)…
  initialDistribution: Object.freeze([
    Object.freeze({ potential: 0, weight: 60 }),
    Object.freeze({ potential: 1, weight: 30 }),
    Object.freeze({ potential: 2, weight: 8 }),
    Object.freeze({ potential: 3, weight: 2 }),
  ]),
  // … sauf le capitaine du joueur, qui garde la répartition d'avant la v0.53.0 (restreinte
  // ensuite à son potentiel minimal, data/captain.js).
  captainDistribution: Object.freeze([
    Object.freeze({ potential: 0, weight: 25 }),
    Object.freeze({ potential: 1, weight: 40 }),
    Object.freeze({ potential: 2, weight: 30 }),
    Object.freeze({ potential: 3, weight: 5 }),
  ]),

  // Plafond personnel des compétences (Lutte, Hast, Percussion, Endurance) selon le potentiel
  // ACTUEL : au-delà, plus aucun gain. Un vétéran qui perd une flamme plafonne plus bas ; une
  // valeur déjà au-dessus est conservée mais ne progresse plus (systems/fighters/stats.js).
  // Le joueur voit des flammes et un libellé, jamais le chiffre.
  skillCaps: Object.freeze({ 0: 55, 1: 70, 2: 85, 3: 100 }),
  skillCapLabels: Object.freeze({ 0: 'modeste', 1: 'honorable', 2: 'élevé', 3: 'sans limite' }),

  // Une vérification tous les N jours de jeu (à partir du jour de création du combattant).
  checkIntervalDays: 15,

  // Règles selon l'âge au moment de la vérification. `chances[p]` : probabilité que le
  // potentiel p change de `change` (+1 ou −1). Potentiel absent : aucune évolution.
  // v0.56.0 : gains environ −20 % (18–25 ans : 20/10/5 % → 16/8/4 % ; 26–31 ans : 50/30/1 % →
  // 40/24/1 %) ; pertes après 32 ans inchangées.
  ageBands: Object.freeze([
    Object.freeze({ minAge: 18, maxAge: 25, change: +1, chances: Object.freeze({ 0: 0.16, 1: 0.08, 2: 0.04 }) }),
    Object.freeze({ minAge: 26, maxAge: 31, change: +1, chances: Object.freeze({ 0: 0.4, 1: 0.24, 2: 0.01 }) }),
    Object.freeze({ minAge: 32, maxAge: Infinity, change: -1, chances: Object.freeze({ 1: 0.01, 2: 0.03, 3: 0.05 }) }),
  ]),
});
