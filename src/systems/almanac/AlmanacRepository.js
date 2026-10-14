import { ALMANAC_ARTICLES, ALMANAC_CATEGORIES } from '../../data/almanac/index.js';
import { ALMANAC_COLLECTIONS, ALMANAC_FACTS, ALMANAC_TABLES } from './almanacFacts.js';

// Accès aux données de l'Almanach (catégories et articles) et vérification de leur cohérence.
// Aucune règle de jeu ici : le dépôt ne fait que lire et contrôler les données.

export const BLOCK_TYPES = Object.freeze(['lead', 'p', 'h', 'list', 'callout', 'example', 'table', 'collection', 'figure', 'divider']);

const TEXT_FIELDS = ['text', 'title', 'caption'];

/** Toutes les chaînes d'un bloc (pour vérifier faits et liens). */
function textsOf(block) {
  return [...TEXT_FIELDS.map((f) => block[f]).filter((t) => typeof t === 'string'), ...(block.items ?? [])];
}

export class AlmanacRepository {
  constructor({ categories = ALMANAC_CATEGORIES, articles = ALMANAC_ARTICLES } = {}) {
    this.categories = categories;
    this.articles = articles;
    this.articlesById = new Map(articles.map((a) => [a.id, a]));
  }

  listCategories() {
    return this.categories;
  }

  getCategory(id) {
    return this.categories.find((c) => c.id === id) ?? null;
  }

  /** Articles d'une catégorie, dans l'ordre des données. */
  listArticles(categoryId) {
    return this.articles.filter((a) => a.categoryId === categoryId);
  }

  getArticle(id) {
    return this.articlesById.get(id) ?? null;
  }

  /**
   * Problèmes de cohérence (liste vide si tout va bien) : identifiants en double, catégorie
   * inconnue, bloc inconnu, fait / tableau / fiches / lien inconnus.
   */
  validate() {
    const problems = [];
    const seen = new Set();
    const categoryIds = new Set(this.categories.map((c) => c.id));
    for (const article of this.articles) {
      const where = `Almanach › ${article.id}`;
      if (seen.has(article.id)) problems.push(`${where} : identifiant en double.`);
      seen.add(article.id);
      if (!categoryIds.has(article.categoryId)) problems.push(`${where} : catégorie inconnue (${article.categoryId}).`);
      if (!article.title) problems.push(`${where} : titre manquant.`);
      for (const id of article.related ?? []) if (!this.articlesById.has(id)) problems.push(`${where} : article lié inconnu (${id}).`);
      for (const block of article.blocks ?? []) {
        if (!BLOCK_TYPES.includes(block.type)) problems.push(`${where} : bloc inconnu (${block.type}).`);
        if (block.type === 'table' && block.source && !ALMANAC_TABLES[block.source]) problems.push(`${where} : tableau inconnu (${block.source}).`);
        if (block.type === 'collection' && !ALMANAC_COLLECTIONS[block.source]) problems.push(`${where} : fiches inconnues (${block.source}).`);
        for (const text of textsOf(block)) {
          for (const [, key] of text.matchAll(/\{\{([^}]+)\}\}/g)) if (!ALMANAC_FACTS[key]) problems.push(`${where} : valeur inconnue {{${key}}}.`);
          for (const [, target] of text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) if (!this.articlesById.has(target)) problems.push(`${where} : lien inconnu [[${target}]].`);
        }
      }
    }
    for (const category of this.categories) {
      if (!this.listArticles(category.id).length) problems.push(`Almanach › catégorie ${category.id} : aucun article.`);
    }
    return problems;
  }
}

/** Dépôt partagé (données du jeu). */
export const almanacRepository = new AlmanacRepository();
