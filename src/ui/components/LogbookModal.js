import { h } from '../../utils/dom.js';
import { buildLogbookView } from '../report/logbookFormats.js';
import { getTalent } from '../../systems/talents/TalentService.js';
import { openModal } from './Modal.js';
import { SeasonEndReport } from './SeasonEndReport.js';
import { TalentBadge } from './TalentBadge.js';
import { isOffSeason } from '../../systems/league/SeasonService.js';

// Carnet de bord « Les Sceaux » (v0.64) : un sceau pour le combat du jour, les annonces à ne
// pas manquer, une tuile par domaine (on ouvre celle qui intéresse), les nouvelles des autres
// compagnies repliées. Le contenu vient de buildLogbookView (ui/report/logbookFormats.js).

/** Une ligne de texte : nom mis en avant, texte, talent éventuel, précision. */
function Line(line) {
  const talent = line.talentId ? getTalent(line.talentId) : null;
  return h(
    'li',
    { class: `logbook-line tone-${line.tone ?? 'neutral'}` },
    line.who ? h('strong', {}, line.who) : null,
    line.who ? ' ' : null,
    line.text,
    talent ? ' ' : null,
    talent ? TalentBadge(talent) : null,
    line.detail ? h('span', { class: 'logbook-detail' }, line.detail) : null,
  );
}

/** Contenu du panneau d'une tuile : pastilles (Centre), comptes (Trésor) ou lignes. */
function TilePanel(tile) {
  if (tile.chips) {
    const chips = h('ul', { class: 'logbook-chips' }, tile.chips.map((chip) => h(
      'li',
      { class: `logbook-chip is-${chip.tone}`, title: chip.hint },
      chip.who, ' ', h('b', {}, chip.text),
    )));
    // Notes explicites sous les pastilles (ex. entraînement devenu inutile).
    if (!tile.notes?.length) return chips;
    return h('div', {}, chips, h('ul', { class: 'logbook-notes' }, tile.notes.map((note) => h('li', {}, note))));
  }
  if (tile.ledger) {
    return h('table', { class: 'logbook-ledger' }, h('tbody', {}, tile.ledger.map((row) => h(
      'tr',
      {},
      h('td', {}, row.label),
      h('td', { class: 'logbook-amount' }, `+${row.amount}`),
    ))));
  }
  return h('ul', { class: 'logbook-lines' }, (tile.lines ?? []).map(Line));
}

/** Les tuiles et leurs panneaux : une seule ouverte à la fois (cliquer à nouveau la referme). */
function TileBoard(view) {
  const tiles = new Map();
  const panels = new Map();
  const show = (id) => {
    for (const [tileId, button] of tiles) button.setAttribute('aria-expanded', String(tileId === id));
    for (const [tileId, panel] of panels) panel.hidden = tileId !== id;
  };
  for (const tile of view.tiles) {
    const panelId = `logbook-panel-${tile.id}`;
    const button = h(
      'button',
      {
        type: 'button', class: `logbook-tile tone-${tile.tone}`, 'data-tile': tile.id,
        'aria-expanded': String(tile.id === view.openTile), 'aria-controls': panelId,
        onclick: () => show(button.getAttribute('aria-expanded') === 'true' ? null : tile.id),
      },
      h('span', { class: 'logbook-tile-icon', 'aria-hidden': 'true' }, tile.icon),
      h('b', { class: 'logbook-tile-value' }, tile.value),
      h('span', { class: 'logbook-tile-label' }, tile.label),
    );
    tiles.set(tile.id, button);
    panels.set(tile.id, h(
      'section',
      { class: `logbook-panel logbook-panel-${tile.id}`, id: panelId, hidden: tile.id !== view.openTile, 'aria-label': tile.title },
      h('h4', { class: 'logbook-panel-title' }, tile.title),
      TilePanel(tile),
    ));
  }
  // Colonnes : la grille se remplit (6 tuiles → 3 × 2), jamais une tuile seule sur sa rangée.
  const n = view.tiles.length;
  const columns = n <= 5 ? n : n === 6 ? 3 : 4;
  return [
    h('div', { class: 'logbook-tiles', role: 'group', 'aria-label': 'La journée par domaine', style: { '--columns': String(columns) } }, [...tiles.values()]),
    ...panels.values(),
  ];
}

/** Nouvelles des autres compagnies : une ligne, dépliable. */
function Rumours(rumours) {
  if (!rumours.length) return null;
  const list = h('ul', { class: 'logbook-lines logbook-rumour-list', id: 'logbook-rumours', hidden: true }, rumours.map(Line));
  const toggle = h('button', {
    type: 'button', class: 'logbook-toggle', 'aria-expanded': 'false', 'aria-controls': 'logbook-rumours',
    onclick: () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      list.hidden = !open;
    },
  }, `Rumeurs : ${rumours.length} nouvelle${rumours.length > 1 ? 's' : ''} des autres compagnies`);
  return h('div', { class: 'logbook-rumours' }, toggle, list);
}

/**
 * Carnet de bord de la journée (affiché après « Passer la journée » ou un combat).
 * Le jour de la fin de saison, il présente d'abord le bilan (« FIN DE LA SAISON ») et son
 * bouton devient « Aller en Coupe de France » (onGoToCup).
 */
export function openLogbook(session, report, { onGoToCup = null, onClose = null } = {}) {
  const view = buildLogbookView(report, { session });
  const seasonEnd = report.ofType('season.end')[0] ?? null;
  const awaitingCup = Boolean(seasonEnd && onGoToCup && isOffSeason(session));
  const { seal } = view;

  const body = h(
    'div',
    { class: `logbook ${seasonEnd ? 'is-season-end' : ''}`.trim() },
    h(
      'header',
      { class: 'logbook-header' },
      h('div', { class: `logbook-seal is-${seal.kind}`, 'aria-hidden': 'true' },
        h('div', {}, h('b', {}, seal.big), h('small', {}, seal.small))),
      h('div', { class: 'logbook-heading' },
        h('p', { class: 'logbook-eyebrow' }, h('span', { class: 'logbook-title' }, 'Carnet de bord'), h('span', { class: 'logbook-day' }, ` · Jour ${report.day} · ${session.playerTeam?.name ?? ''}`)),
        h('h3', { class: `logbook-headline tone-${seal.tone}` }, seal.title),
        seal.subtitle ? h('p', { class: 'logbook-subtitle' }, seal.subtitle) : null),
    ),
    seasonEnd ? SeasonEndReport(session, seasonEnd) : null,
    view.notices.length ? h('ul', { class: 'logbook-notices' }, view.notices.map(Line)) : null,
    view.tiles.length ? TileBoard(view) : null,
    // « Rien à signaler » seulement un jour sans combat, sans annonce et sans tuile.
    !view.tiles.length && seal.kind === 'day' && !view.notices.length ? h('p', { class: 'logbook-empty' }, 'Journée calme : rien à signaler.') : null,
    view.rumours.length || view.footer.length
      ? h('div', { class: 'logbook-footer' }, Rumours(view.rumours), view.footer.length ? h('span', { class: 'logbook-footnote' }, view.footer.join(' ')) : null)
      : null,
  );

  return openModal({
    title: seasonEnd ? `Fin de la saison ${seasonEnd.season} — Jour ${report.day}` : `Carnet de bord — Jour ${report.day}`,
    body,
    className: 'modal-wide modal-logbook',
    onClose: () => onClose?.(),
    actions: awaitingCup
      ? [{ label: '🏆 Aller en Coupe de France ▸', variant: 'primary', onClick: (handle) => { handle.close(); onGoToCup(); } }]
      : [{ label: 'Refermer le carnet', variant: 'primary' }],
  });
}
