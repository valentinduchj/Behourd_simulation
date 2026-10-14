// Statistiques des combattants, toutes comprises entre 0 et 100.
//
//   kind      'condition' = état (PV, fatigue) ; 'skill' = compétence
//   polarity  +1 : plus c'est haut, mieux c'est.
//             -1 : plus c'est bas, mieux c'est. La fatigue est un NIVEAU de fatigue :
//                  100 = épuisé, 0 = reposé ; « récupérer » la fait donc baisser.
//             Les règles d'application (sens, bornes) sont centralisées dans
//             systems/fighters/stats.js.
//   level     true : compte dans le niveau du combattant (systems/fighters/ratings.js)
//   base      valeur par défaut (combattant ancien auquel il manque la stat)
//   start     valeur d'un combattant nouvellement généré : nombre ou { min, max }
//             — les plages de compétences sont PROVISOIRES, à équilibrer.

export const STAT_DEFINITIONS = Object.freeze([
  // v0.68 : 150 PV (au lieu de 100) pour des manches plus longues (sauvegardes migrées, format 8).
  { id: 'hp', label: 'Points de vie', short: 'PV', kind: 'condition', polarity: 1, min: 0, max: 150, base: 150, start: 150,
    description: 'État physique du combattant.' },
  { id: 'fatigue', label: 'Fatigue', short: 'FAT', kind: 'condition', polarity: -1, min: 0, max: 100, base: 0, start: 0,
    description: 'Fatigue actuelle : 0 = reposé, 100 = épuisé.' },
  { id: 'wrestling', label: 'Lutte', short: 'LUT', kind: 'skill', polarity: 1, min: 0, max: 100, level: true,
    base: 25, start: { min: 10, max: 30 }, description: 'Saisies, projections, corps-à-corps.' },
  { id: 'polearm', label: 'Force d’arme d’hast', short: 'HAS', kind: 'skill', polarity: 1, min: 0, max: 100, level: true,
    base: 25, start: { min: 10, max: 30 }, description: 'Maniement des armes d’hast.' },
  { id: 'percussion', label: 'Percussion', short: 'PER', kind: 'skill', polarity: 1, min: 0, max: 100, level: true,
    base: 25, start: { min: 10, max: 30 }, description: 'Puissance des charges et des impacts.' },
  { id: 'endurance', label: 'Endurance', short: 'END', kind: 'skill', polarity: 1, min: 0, max: 100, level: true,
    base: 25, start: { min: 10, max: 30 }, description: 'Capacité à tenir l’effort dans la durée.' },
]);

export const STAT_GROUPS = Object.freeze([
  { id: 'condition', label: 'État' },
  { id: 'skill', label: 'Compétences' },
]);

/** Statistiques prises en compte dans le niveau d'un combattant. */
export const LEVEL_STAT_IDS = Object.freeze(STAT_DEFINITIONS.filter((stat) => stat.level).map((stat) => stat.id));

const STATS_BY_ID = new Map(STAT_DEFINITIONS.map((stat) => [stat.id, stat]));

export function getStatDefinition(id) {
  return STATS_BY_ID.get(id) ?? null;
}

export function createBaseStats() {
  return Object.fromEntries(STAT_DEFINITIONS.map((stat) => [stat.id, stat.base]));
}
