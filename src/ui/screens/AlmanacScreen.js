import { h } from '../../utils/dom.js';
import { SCREENS } from '../../core/screenIds.js';
import { almanacService } from '../../systems/almanac/AlmanacService.js';
import { AlmanacArticle } from '../almanac/AlmanacArticle.js';
import { AlmanacCategoryPage, AlmanacIndex } from '../almanac/AlmanacCategory.js';
import { BaseScreen } from './BaseScreen.js';

// Dernière page consultée (le temps de la session du navigateur) : rouvrir l'Almanach y ramène.
let lastPosition = { categoryId: null, articleId: null };

/**
 * L'Almanach : la documentation du jeu, présentée comme un ouvrage médiéval.
 *   page de gauche : sommaire (catégories, et articles de la catégorie ouverte)
 *   page de droite : une catégorie (présentation, articles) ou un article
 * Paramètres : { returnTo, returnParams } — écran rouvert par « Retour » (la partie en cours
 * n'est jamais modifiée : l'Almanach ne fait que lire les règles) ; { categoryId, articleId }.
 */
export class AlmanacScreen extends BaseScreen {
  static theme = 'hub';

  render() {
    const categories = almanacService.listCategories();
    const fromParams = this.params.articleId || this.params.categoryId;
    this.categoryId = fromParams ? this.params.categoryId : lastPosition.categoryId;
    this.articleId = fromParams ? this.params.articleId ?? null : lastPosition.articleId;
    if (this.articleId) this.categoryId = almanacService.getArticle(this.articleId)?.categoryId ?? this.categoryId;
    if (!categories.some((c) => c.id === this.categoryId)) {
      this.categoryId = categories[0]?.id ?? null;
      this.articleId = null;
    }

    this.indexHost = h('div', { class: 'almanac-left' });
    this.pageHost = h('div', { class: 'almanac-right' });
    this.el = h(
      'section',
      { class: 'almanac' },
      h('header', { class: 'almanac-head' },
        h('button', { type: 'button', class: 'btn almanac-back', onclick: () => this.back() }, '‹ Retour'),
        h('div', { class: 'almanac-head-title' },
          h('h1', {}, 'L’Almanach'),
          h('p', { class: 'almanac-head-sub' }, 'Recueil des us et coutumes du béhourd')),
        h('span', { class: 'almanac-head-spacer', 'aria-hidden': 'true' })),
      h('div', { class: 'almanac-book' }, this.indexHost, h('div', { class: 'almanac-spine', 'aria-hidden': 'true' }), this.pageHost),
    );
    this.refresh();
    return this.el;
  }

  mounted() {
    this.listen(document, 'keydown', (event) => {
      if (event.key === 'Escape' && !document.querySelector('#modal-root .modal')) this.back();
    });
  }

  /** Retour à l'écran d'où l'Almanach a été ouvert (la partie n'a pas changé). */
  back() {
    const fallback = this.services.gameState.hasSession() ? SCREENS.TEAM : SCREENS.MAIN_MENU;
    this.navigate(this.params.returnTo ?? fallback, this.params.returnParams ?? {});
  }

  openCategory(categoryId) {
    this.categoryId = categoryId;
    this.articleId = null;
    this.refresh({ scroll: true });
  }

  openArticle(articleId) {
    const article = almanacService.getArticle(articleId);
    if (!article) return;
    this.categoryId = article.categoryId;
    this.articleId = articleId;
    this.refresh({ scroll: true });
  }

  refresh({ scroll = false } = {}) {
    lastPosition = { categoryId: this.categoryId, articleId: this.articleId };
    this.indexHost.replaceChildren(AlmanacIndex({
      categories: almanacService.listCategories(),
      activeCategoryId: this.categoryId,
      activeArticleId: this.articleId,
      articlesOf: (id) => almanacService.listArticles(id),
      onCategory: (id) => this.openCategory(id),
      onArticle: (id) => this.openArticle(id),
    }));
    this.pageHost.replaceChildren(...this.renderPage());
    if (scroll) this.pageHost.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  renderPage() {
    const category = almanacService.getCategory(this.categoryId);
    if (!category) return [h('p', { class: 'muted' }, 'L’Almanach est vide.')];
    const articles = almanacService.listArticles(category.id);
    if (!this.articleId) return [AlmanacCategoryPage(category, articles, { onArticle: (id) => this.openArticle(id) })];

    const article = almanacService.getArticle(this.articleId);
    const { previous, next } = almanacService.getNeighbours(this.articleId);
    const titleOf = (id) => almanacService.getArticle(id)?.title;
    const nav = (target, label, rel) => (target
      ? h('button', { type: 'button', class: `almanac-turn is-${rel}`, 'data-article': target.id, onclick: () => this.openArticle(target.id) }, label(target))
      : h('span', { class: `almanac-turn is-${rel} is-empty` }));
    return [
      h('nav', { class: 'almanac-breadcrumb', 'aria-label': 'Fil d’Ariane' },
        h('button', { type: 'button', class: 'almanac-crumb', onclick: () => this.openCategory(category.id) }, `‹ ${category.icon} ${category.title}`),
        h('span', { 'aria-hidden': 'true' }, ' · '),
        h('span', { class: 'almanac-crumb-current' }, article.title)),
      AlmanacArticle(article, { onNavigate: (id) => this.openArticle(id), titleOf }),
      h('div', { class: 'almanac-turns' },
        nav(previous, (a) => `‹ ${a.icon} ${a.title}`, 'previous'),
        nav(next, (a) => `${a.icon} ${a.title} ›`, 'next')),
    ];
  }
}
