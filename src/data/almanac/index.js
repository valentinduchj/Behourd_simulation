import { ALMANAC_CATEGORIES } from './categories.js';
import { MONDE_ARTICLES } from './articles/monde.js';
import { COMBATTANTS_ARTICLES } from './articles/combattants.js';
import { COMBAT_ARTICLES } from './articles/combat.js';
import { LIEUX_ARTICLES } from './articles/lieux.js';
import { COMPETITIONS_ARTICLES } from './articles/competitions.js';

// L'Almanach — documentation du jeu, en DONNÉES (aucune page n'est codée dans l'interface).
//
// Article : { id, categoryId, title, icon, summary, blocks: [bloc], related: [articleId] }
// L'ordre d'une catégorie suit l'ordre des articles dans les listes ci-dessous.
//
// Blocs :
//   { type: 'lead', text }                       premier paragraphe, avec lettrine
//   { type: 'p', text }                          paragraphe
//   { type: 'h', text }                          sous-titre
//   { type: 'list', items: [text], ordered }     liste (numérotée si ordered)
//   { type: 'callout', tone, title, text }       encadré (tone : 'info' | 'tip' | 'warning')
//   { type: 'example', title, text }             exemple
//   { type: 'table', source }                    tableau généré depuis les règles (systems/almanac/almanacFacts.js)
//   { type: 'table', columns, rows }             tableau écrit à la main
//   { type: 'collection', source }               fiches illustrées générées (spécialités, lieux, artisans, objets)
//   { type: 'figure', illustration, caption, align }  illustration (ui/almanac/illustrations.js) ; align : 'right' | 'center'
//   { type: 'divider' }                          séparateur décoratif
//
// Dans les textes :
//   {{clé}}             valeur lue dans les règles du jeu (ALMANAC_FACTS) — jamais recopiée
//   **gras**
//   [[articleId]] ou [[articleId|libellé]]   lien vers un autre article
//
// Ajouter un article : une entrée dans l'une des listes (ou une nouvelle liste ajoutée ici).
// Ajouter une catégorie : data/almanac/categories.js.

export { ALMANAC_CATEGORIES };

export const ALMANAC_ARTICLES = Object.freeze([
  ...MONDE_ARTICLES,
  ...COMBATTANTS_ARTICLES,
  ...COMBAT_ARTICLES,
  ...LIEUX_ARTICLES,
  ...COMPETITIONS_ARTICLES,
]);
