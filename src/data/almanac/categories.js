// Catégories de l'Almanach (ordre d'affichage = ordre de la liste). Pour en ajouter une :
// une entrée ici, puis des articles qui la citent (data/almanac/articles/).
//   id, title, icon, vignette (illustration d'en-tête, voir ui/almanac/illustrations.js), intro

export const ALMANAC_CATEGORIES = Object.freeze([
  { id: 'monde', title: 'Le Monde', icon: '📜', vignette: { kind: 'vignette', name: 'monde' },
    intro: 'Le royaume du béhourd : les ligues, les saisons, le calendrier et le classement.' },
  { id: 'combattants', title: 'Les Combattants', icon: '🛡', vignette: { kind: 'classTrio' },
    intro: 'Ceux qui portent vos couleurs : leurs spécialités, leurs statistiques, leur fatigue et leur avenir.' },
  { id: 'combat', title: 'Le Combat', icon: '⚔', vignette: { kind: 'liceMap' },
    intro: 'De la sélection à la dernière mêlée : comment se gagne une manche dans la lice.' },
  { id: 'centre', title: 'Le Centre', icon: '⛺', vignette: { kind: 'vignette', name: 'centre' },
    intro: 'Le camp de la compagnie : chaque jour, vos combattants s’y entraînent, s’y reposent ou y travaillent.' },
  { id: 'bourg', title: 'Le Bourg', icon: '🏘', vignette: { kind: 'vignette', name: 'bourg' },
    intro: 'Les artisans du village : améliorations du Centre et provisions du Boulanger.' },
  { id: 'taverne', title: 'La Taverne', icon: '🍺', vignette: { kind: 'vignette', name: 'taverne' },
    intro: 'Où l’on recrute de nouveaux combattants pour la compagnie.' },
  { id: 'coffre', title: 'Le Coffre', icon: '🧰', vignette: { kind: 'vignette', name: 'coffre' },
    intro: 'L’inventaire de la compagnie et ses consommables.' },
  { id: 'competitions', title: 'Les Compétitions', icon: '👑', vignette: { kind: 'vignette', name: 'competitions' },
    intro: 'Le championnat, ses montées et ses descentes, et les Combats de la Reine.' },
].map(Object.freeze));
