import { h } from '../../utils/dom.js';
import { renderIllustration } from './illustrations.js';

// Rendu d'un article de l'Almanach (déjà préparé par AlmanacService) : un renderer par type
// de bloc. Aucun contenu ici : tout vient des données.

/**
 * Texte enrichi : **gras** et [[articleId|libellé]] (lien vers un autre article). Construit des
 * nœuds DOM (jamais de HTML injecté).
 */
export function richText(text, { onNavigate, titleOf } = {}) {
  const nodes = [];
  const pattern = /\*\*([^*]+)\*\*|\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] !== undefined) nodes.push(h('strong', {}, match[1]));
    else {
      const id = match[2];
      const label = match[3] ?? titleOf?.(id) ?? id;
      nodes.push(h('a', {
        href: `#almanach-${id}`, class: 'almanac-link', 'data-article': id,
        onclick: (event) => { event.preventDefault(); onNavigate?.(id); },
      }, label));
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const TONES = Object.freeze({ info: { icon: '📜', label: 'À savoir' }, tip: { icon: '✒', label: 'Conseil' }, warning: { icon: '⚠', label: 'Attention' } });

const BLOCK_RENDERERS = Object.freeze({
  lead: (block, ctx) => h('p', { class: 'almanac-lead' }, ...richText(block.text, ctx)),
  p: (block, ctx) => h('p', { class: 'almanac-p' }, ...richText(block.text, ctx)),
  h: (block) => h('h3', { class: 'almanac-h' }, h('span', { class: 'almanac-h-mark', 'aria-hidden': 'true' }, '❧'), block.text),
  list: (block, ctx) => h(block.ordered ? 'ol' : 'ul', { class: 'almanac-list' }, block.items.map((item) => h('li', {}, ...richText(item, ctx)))),
  callout: (block, ctx) => {
    const tone = TONES[block.tone] ?? TONES.info;
    return h('aside', { class: `almanac-callout is-${block.tone ?? 'info'}` },
      h('p', { class: 'almanac-callout-title' }, h('span', { 'aria-hidden': 'true' }, tone.icon), block.title ?? tone.label),
      h('p', {}, ...richText(block.text, ctx)));
  },
  example: (block, ctx) => h('aside', { class: 'almanac-example' },
    h('p', { class: 'almanac-example-title' }, block.title ?? 'Exemple'),
    h('p', {}, ...richText(block.text, ctx))),
  table: (block) => h('div', { class: 'almanac-table-wrap' }, h('table', { class: 'almanac-table' },
    h('thead', {}, h('tr', {}, (block.columns ?? []).map((c) => h('th', { scope: 'col' }, c)))),
    h('tbody', {}, (block.rows ?? []).map((row) => h('tr', {}, row.map((cell) => h('td', {}, cell))))))),
  collection: (block) => h('div', { class: 'almanac-cards' }, (block.entries ?? []).map((entry) => h(
    'article',
    { class: 'almanac-card', 'data-entry': entry.id, style: entry.color ? { '--card-color': entry.color } : null },
    h('div', { class: 'almanac-card-art' }, renderIllustration(entry.illustration) ?? h('span', { class: 'almanac-icon-big', 'aria-hidden': 'true' }, entry.icon)),
    h('div', { class: 'almanac-card-body' },
      h('h4', { class: 'almanac-card-title' }, entry.illustration ? `${entry.icon} ${entry.title}` : entry.title),
      h('p', { class: 'almanac-card-text' }, entry.text),
      entry.details?.length ? h('dl', { class: 'almanac-card-details' }, entry.details.flatMap(([label, value]) => [h('dt', {}, label), h('dd', {}, value)])) : null),
  ))),
  figure: (block) => {
    const art = renderIllustration(block.illustration);
    if (!art) return null;
    return h('figure', { class: `almanac-figure is-${block.align ?? 'center'}` }, art, block.caption ? h('figcaption', {}, block.caption) : null);
  },
  divider: () => h('div', { class: 'almanac-divider', role: 'separator' }, '─── ❖ ───'),
});

/** Élément d'un bloc, ou null si son type est inconnu. */
export function renderBlock(block, ctx) {
  return BLOCK_RENDERERS[block.type]?.(block, ctx) ?? null;
}

/**
 * Article complet. ctx : { onNavigate(articleId), titleOf(articleId) }.
 */
export function AlmanacArticle(article, ctx = {}) {
  return h(
    'article',
    { class: 'almanac-article', 'data-article': article.id },
    h('header', { class: 'almanac-article-head' },
      h('span', { class: 'almanac-article-icon', 'aria-hidden': 'true' }, article.icon),
      h('h2', { class: 'almanac-article-title' }, article.title),
      h('div', { class: 'almanac-divider', 'aria-hidden': 'true' }, '─── ❖ ───')),
    h('div', { class: 'almanac-article-body' }, article.blocks.map((block) => renderBlock(block, ctx))),
    article.related?.length
      ? h('footer', { class: 'almanac-related' },
        h('p', { class: 'almanac-related-title' }, 'Voir aussi'),
        h('ul', {}, article.related.map((r) => h('li', {}, h('a', {
          href: `#almanach-${r.id}`, class: 'almanac-link', 'data-article': r.id,
          onclick: (event) => { event.preventDefault(); ctx.onNavigate?.(r.id); },
        }, `${r.icon} ${r.title}`)))))
      : null,
  );
}
