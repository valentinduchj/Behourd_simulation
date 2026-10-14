// Effectifs des clubs de l'IA : recrutements, départs, retraite
// (systems/clubs/AIRecruitmentService.js).

export const AI_RECRUITMENT_CONFIG = Object.freeze({
  // Probabilité, pour CHAQUE club de l'IA et chaque journée, de recruter un combattant
  // (un tirage indépendant par club) — recrutement « naturel ».
  dailyRecruitChance: 0.01,

  // Effectif maximal d'un club de l'IA. Au-delà, le combattant le plus faible (niveau
  // numérique) est aussitôt congédié (départ lié au niveau).
  maxClubFighters: 12,

  // Retraite : un combattant qui atteint cet âge quitte aussitôt son club.
  retirementAge: 36,
  // Après une retraite, si l'effectif passe SOUS ce nombre, une recrue remplace le retraité
  // (sans tirage de probabilité) ; sinon le club reste ainsi.
  minRosterAfterRetirement: 9,

  // Âge des combattants de l'IA à leur création initiale (nouvelle partie, ou combattant
  // de l'IA sans âge dans une sauvegarde) : l'âge MOYEN est décalé de ce nombre d'années,
  // sans sortir des bornes de génération (data/fighterProfile.js › AGE_CONFIG.initial).
  // Les recrues des clubs de l'IA en cours de partie gardent le tirage normal.
  initialAgeOffset: -2,

  // La recrue est construite autour d'un combattant tiré au hasard parmi les positions
  // `from` à `to` du club (classement par niveau, 1 = le plus fort). Effectif plus court :
  // les positions existantes de cette plage, ou à défaut le plus faible.
  referenceRange: Object.freeze({ from: 4, to: 7 }),

  // Écart de niveau autorisé autour de la référence (tirage uniforme dans
  // [référence − écart, référence + écart], borné entre 0 et 100).
  // VALEUR NON DÉFINIE : 0 = la recrue a exactement le niveau de la référence.
  levelSpread: 0,

  // Clubs concernés : ceux engagés dans les divisions, et ceux hors championnat.
  includeOutOfChampionship: true,
});

// Noms courts, utilisés par les autres systèmes (une seule source : la configuration ci-dessus).
export const AI_MAX_ROSTER_SIZE = AI_RECRUITMENT_CONFIG.maxClubFighters;
export const MAX_AI_CLUB_FIGHTERS = AI_MAX_ROSTER_SIZE;
export const AI_RETIREMENT_AGE = AI_RECRUITMENT_CONFIG.retirementAge;
export const AI_MIN_ROSTER_AFTER_RETIREMENT = AI_RECRUITMENT_CONFIG.minRosterAfterRetirement;
export const AI_DAILY_RECRUITMENT_CHANCE = AI_RECRUITMENT_CONFIG.dailyRecruitChance;
export const AI_INITIAL_AGE_OFFSET = AI_RECRUITMENT_CONFIG.initialAgeOffset;

// Types d'événements de l'historique d'effectif d'un club (session.clubRosterEvents).
export const ROSTER_EVENT_TYPES = Object.freeze({
  RECRUITMENT: 'RECRUITMENT',
  DEPART_NIVEAU: 'DEPART_NIVEAU',
  DEPART_RETRAITE: 'DEPART_RETRAITE',
});
