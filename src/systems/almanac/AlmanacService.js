import { ALMANAC_COLLECTIONS, ALMANAC_TABLES, getFact } from './almanacFacts.js';
import { almanacRepository } from './AlmanacRepository.js';

// Service de l'Almanach : prépare les articles pour l'affichage (valeurs des règles insérées,
// tableaux et fiches générés) et répond aux questions de navigation. Il ne lit que les
// règles : il ne modifie jamais l'état du jeu.

/** Remplace les {{clés}} par les valeurs des règles (une clé inconnue reste visible, entre crochets). */
export function resolveText(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => getFact(key) ?? `[${key}]`);
}

function resolveBlock(block) {
  const resolved = { ...block };
  for (const field of ['text', 'title', 'caption']) if (block[field]) resolved[field] = resolveText(block[field]);
  if (block.items) resolved.items = block.items.map(resolveText);
  if (block.type === 'table' && block.source) Object.assign(resolved, ALMANAC_TABLES[block.source]?.() ?? { columns: [], rows: [] });
  if (block.type === 'table' && block.rows && !block.source) resolved.rows = block.rows.map((row) => row.map(resolveText));
  if (block.type === 'collection') resolved.entries = ALMANAC_COLLECTIONS[block.source]?.() ?? [];
  return resolved;
}

export class AlmanacService {
  constructor(repository = almanacRepository) {
    this.repository = repository;
  }

  listCategories() {
    return this.repository.listCategories().map((category) => ({
      ...category,
      intro: resolveText(category.intro),
      articleCount: this.repository.listArticles(category.id).length,
    }));
  }

  getCategory(id) {
    const category = this.repository.getCategory(id);
    return category ? { ...category, intro: resolveText(category.intro) } : null;
  }

  /** Articles d'une catégorie (titre, icône, résumé) pour la navigation. */
  listArticles(categoryId) {
    return this.repository.listArticles(categoryId).map(({ id, title, icon, summary }) => ({ id, title, icon, summary: resolveText(summary) }));
  }

  /** Article prêt à afficher : textes résolus, tableaux et fiches générés, articles liés. */
  getArticle(id) {
    const article = this.repository.getArticle(id);
    if (!article) return null;
    return {
      ...article,
      summary: resolveText(article.summary),
      blocks: (article.blocks ?? []).map(resolveBlock),
      related: (article.related ?? []).map((relatedId) => this.repository.getArticle(relatedId)).filter(Boolean)
        .map(({ id: relatedId, title, icon }) => ({ id: relatedId, title, icon })),
    };
  }

  /** Article précédent et suivant dans la même catégorie. */
  getNeighbours(articleId) {
    const article = this.repository.getArticle(articleId);
    if (!article) return { previous: null, next: null };
    const list = this.repository.listArticles(article.categoryId);
    const index = list.findIndex((a) => a.id === articleId);
    const pick = (a) => (a ? { id: a.id, title: a.title, icon: a.icon } : null);
    return { previous: pick(list[index - 1]), next: pick(list[index + 1]) };
  }

  /** Premier article d'une catégorie (null si elle est vide). */
  firstArticleOf(categoryId) {
    return this.repository.listArticles(categoryId)[0]?.id ?? null;
  }
}

export const almanacService = new AlmanacService();
