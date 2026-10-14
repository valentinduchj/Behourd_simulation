// Niveau de la lice du club (systems/lice/) — SOURCE UNIQUE des niveaux de la lice.
//
// v0.44 : le lieu « Ma Lice » et son maître d'œuvre ont été retirés du jeu. Le NIVEAU de la
// lice reste une donnée technique : il règle la recette des victoires à domicile
// (data/homeAway.js), le décor du terrain à domicile et le bonus de spectateurs. Aucune
// interface ne propose d'amélioration pour l'instant.
//
// La lice du joueur commence au niveau `startLevel` (lice d'origine, sans amélioration).
// Chaque amélioration fait passer au niveau suivant :
//   {
//     id,              identifiant stable (sauvegardes)
//     level,           niveau atteint (startLevel + 1, + 2…)
//     name,            nom de l'amélioration
//     cost,            prix en deniers
//     spectatorBonus,  { multiplier, flat } : appliqué par CrowdService à l'affluence d'un
//                      combat disputé dans cette lice (multiplier puis flat ; cumulatif)
//     description,     texte de présentation
//     visualUpgrade,   { arenaProps: { back: [...], front: [...] } } : éléments ajoutés au
//                      terrain des combats à domicile (entrées { type, weight, w?, h?, variants? }
//                      comme dans data/liceDecorations.js ; types de render/propRenderers.js)
//   }
//
// AUCUNE AMÉLIORATION N'EST DÉFINIE : niveaux, coûts, bonus de spectateurs et éléments de
// décor restent à fournir.
export const LICE_UPGRADE_CONFIG = Object.freeze({
  startLevel: 1,
  currency: 'deniers',
  upgrades: Object.freeze([]),
});
