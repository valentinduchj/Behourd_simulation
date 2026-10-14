import { h } from '../../utils/dom.js';
import { renderIllustration } from './illustrations.js';

// Navigation de l'Almanach : sommaire (catégories, et articles de la catégorie ouverte) et
// page d'accueil d'une catégorie.

/**
 * Sommaire (page de gauche). options : { categories, activeCategoryId, activeArticleId,
 * articlesOf(categoryId), onCategory(id), onArticle(id) }.
 */
export function AlmanacIndex({ categories, activeCategoryId, activeArticleId, articlesOf, onCategory, onArticle }) {
  return h(
    'nav',
    { class: 'almanac-index', 'aria-label': 'Sommaire de l’Almanach' },
    h('p', { class: 'almanac-index-title' }, 'Sommaire'),
    h('ul', { class: 'almanac-categories' }, categories.map((category) => {
      const active = category.id === activeCategoryId;
      return h('li', { class: `almanac-category ${active ? 'is-active' : ''}`.trim() },
        h('button', {
          type: 'button', class: 'almanac-category-button', 'data-category': category.id,
          'aria-expanded': String(active), 'aria-current': active && !activeArticleId ? 'page' : null,
          onclick: () => onCategory(category.id),
        }, h('span', { class: 'almanac-category-icon', 'aria-hidden': 'true' }, category.icon), h('span', {}, category.title)),
        active
          ? h('ul', { class: 'almanac-articles' }, articlesOf(category.id).map((article) => h('li', {}, h('button', {
            type: 'button',
            class: `almanac-article-button ${article.id === activeArticleId ? 'is-active' : ''}`.trim(),
            'data-article': article.id,
            'aria-current': article.id === activeArticleId ? 'page' : null,
            onclick: () => onArticle(article.id),
          }, h('span', { 'aria-hidden': 'true' }, article.icon), h('span', {}, article.title)))))
          : null);
    })),
  );
}

/** Page d'une catégorie : vignette, présentation, articles en fiches. */
export function AlmanacCategoryPage(category, articles, { onArticle }) {
  return h(
    'section',
    { class: 'almanac-category-page', 'data-category': category.id },
    h('header', { class: 'almanac-article-head' },
      h('span', { class: 'almanac-article-icon', 'aria-hidden': 'true' }, category.icon),
      h('h2', { class: 'almanac-article-title' }, category.title),
      h('div', { class: 'almanac-divider', 'aria-hidden': 'true' }, '─── ❖ ───')),
    h('div', { class: 'almanac-category-vignette' }, renderIllustration(category.vignette)),
    h('p', { class: 'almanac-lead' }, category.intro),
    h('ul', { class: 'almanac-toc' }, articles.map((article) => h('li', {}, h('button', {
      type: 'button', class: 'almanac-toc-item', 'data-article': article.id, onclick: () => onArticle(article.id),
    },
    h('span', { class: 'almanac-toc-icon', 'aria-hidden': 'true' }, article.icon),
    h('span', { class: 'almanac-toc-text' }, h('span', { class: 'almanac-toc-title' }, article.title), h('span', { class: 'almanac-toc-summary' }, article.summary)))))),
  );
}
