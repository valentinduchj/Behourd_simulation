// Niveau de la Taverne (systems/tavern/) — SOURCE UNIQUE des coûts et des plages d'étoiles.
//
//   level     niveau de la Taverne (la partie commence au premier)
//   cost      deniers pour atteindre ce niveau depuis le précédent (null : niveau de départ)
//   minStars  étoiles minimales des recrues générées à la rotation suivante
//   maxStars  étoiles maximales (demi-étoiles comprises, barème de data/ratings.js)
//
// v0.45 : une amélioration ne relève que la borne HAUTE ; on peut toujours tomber sur des recrues
// à 1★. Le prix d'une recrue dépend de ses étoiles, plus du niveau de la Taverne
// (systems/tavern/TavernRotationService.js, data/recruitment.js).
//
// Le niveau ne change jamais les recrues présentes : il s'applique à la PROCHAINE rotation.
// Le dernier niveau de la liste est le niveau maximal.
export const TAVERN_LEVELS = Object.freeze([
  { level: 1, cost: null, minStars: 1, maxStars: 2 },
  { level: 2, cost: 500, minStars: 1, maxStars: 2.5 },
  { level: 3, cost: 2500, minStars: 1, maxStars: 3 },
  { level: 4, cost: 5000, minStars: 1, maxStars: 3.5 },
  { level: 5, cost: 7500, minStars: 1, maxStars: 4 },
].map(Object.freeze));

export const TAVERN_CONFIG = Object.freeze({
  startLevel: 1,
  currency: 'deniers',
  // Génération d'une recrue (TavernRecruitmentGenerationService) : un nombre d'étoiles est
  // tiré uniformément parmi ceux de la plage (par demi-étoile), puis un niveau dans cette
  // tranche du barème ; les 4 compétences sont réparties autour de ce niveau, avec des écarts
  // d'au plus `statSpread` points par échange (le niveau, moyenne des compétences, ne change pas).
  statSpread: 6,
  statShuffles: 4,
});
