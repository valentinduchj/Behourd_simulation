import { LEAGUE_RULES } from './leagues.js';

// Coupe de France — compétition à part du championnat (systems/frenchCup/). Toutes les équipes
// françaises (les clubs des trois Ligues et la compagnie du joueur, lus dans la partie : jamais
// ajoutés à la main) sont tirées au sort dans des poules, puis les meilleures disputent un
// tableau à élimination directe. Les combats utilisent le moteur de combat habituel.

export const FRENCH_CUP_RULES = Object.freeze({
  name: 'Coupe de France',
  // Poules : 9 poules de 6 équipes (54 équipes), lettres A à I.
  groupCount: 9,
  groupSize: 6,
  groupLetters: Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']),
  // Qualification : les 3 premiers de chaque poule (27), puis les meilleurs suivants (rang 4)
  // comparés entre poules, pour compléter le tableau à 32 (5 qualifiés).
  // À VALIDER : la demande parlait des « 5 meilleurs troisièmes » ; or les 3 premiers incluent
  // déjà les 9 troisièmes (27 + 5 = 32 n'est possible qu'avec les quatrièmes). Réglable ici.
  qualifiersPerGroup: 3,
  extraQualifiers: Object.freeze({ rank: 4, count: 5 }),
  bracketSize: 32,
  // Points d'un combat de poule : ceux du championnat (victoire, défaite avec une manche, défaite).
  points: LEAGUE_RULES.points,
  // Départage (poules et meilleurs troisièmes), dans cet ordre : points, manches remportées,
  // adversaires mis KO.
  ranking: Object.freeze(['points', 'roundsWon', 'knockouts']),
  // Tours du tableau final.
  knockoutRounds: Object.freeze(['Seizièmes de finale', 'Huitièmes de finale', 'Quarts de finale', 'Demi-finales', 'Finale']),
  // Décor des combats de la Coupe (data/liceDecorations.js).
  decorationId: 'lice_gabarnac',
  // Lieu de la Coupe.
  venueName: 'Château de Gabarnac',
  // Affluence autour de la Lice (présentation seulement) : poules, puis chaque tour du tableau.
  // À VALIDER : valeurs non définies par la demande, choisies pour une foule qui grossit jusqu'à
  // la finale (comparable à une affiche de Ligue 1, 100 au plus).
  crowd: Object.freeze({ groups: 50, knockout: Object.freeze([60, 70, 80, 90, 100]) }),
  // Intitulés de l'historique des clubs (meilleur résultat de l'édition). Tours du tableau :
  // « Saison X <tour> ». À VALIDER : seizièmes et huitièmes n'étaient pas définis ; même logique
  // que pour les quarts et les demies.
  historyLabels: Object.freeze({
    groups: 'Phase de poule',
    rounds: Object.freeze(['seizième de finale', 'huitième de finale', 'quart de finale', 'demi-finale']),
    finalist: 'Finaliste',
    champion: 'Champion de France',
    // Historique harmonisé (v0.69) : « Saison 4 — Vainqueur — Coupe de France ».
    winner: 'Vainqueur',
  }),
  // Récompense de chaque victoire de la compagnie du joueur (deniers), versée une seule fois par
  // combat : en poules (sans condition de qualification), puis selon le tour remporté.
  rewards: Object.freeze({ groups: 150, knockout: Object.freeze([300, 600, 1200, 2500, 5000]) }),
});
