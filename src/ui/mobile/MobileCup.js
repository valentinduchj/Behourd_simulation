import { h } from '../../utils/dom.js';
import { FRENCH_CUP_RULES } from '../../data/frenchCup.js';
import {
  getCupStatus, getPlayerPendingMatch, describeStep, describeMatch, getStandings, opponentOf, playerHasMatchesLeft,
} from '../../systems/frenchCup/FrenchCupManager.js';
import { slotLabel } from '../../systems/frenchCup/CupDraw.js';
import { getClubLevel, getLeagueName } from '../../systems/league/LeagueService.js';
import { GAME_CONFIG } from '../../config/gameConfig.js';
import { EmblemView } from '../components/EmblemView.js';
import { ClubStars } from '../components/Rating.js';
import { openModal } from '../components/Modal.js';
import { openOptionsModal } from '../components/OptionsModal.js';
import { openPatchNotes } from '../components/PatchNotesModal.js';
import { openMenuDrawer } from './MenuDrawer.js';
import { attachSwipeClose } from './SwipeClose.js';

// Coupe de France sur téléphone (v0.90, maquettes « Coupe · … ») :
//   bandeau      Coupe de France + étape (gauche), état de la compagnie (centre), menu ☰ (droite) ;
//   tirage       la dernière compagnie tirée en grand, les 9 poules en blasons (toucher : la
//                poule et ses noms) ;
//   Gabarnac     la carte en plein écran, le prochain combat, un dock (Gabarnac · Tableau ·
//                Arbre · Résultats) et le bouton rond « Combattre » ;
//   tableau      un volet : rubriques à gauche, poules A à I en onglets (blasons et noms) ;
//   arbre final  les tours en pastilles, trois tours visibles à la fois, le parcours en or.
// Les règles restent dans systems/frenchCup/ ; FrenchCupScreen garde ses actions (tirer,
// entrer dans la Lice, abandonner…) et délègue ici l'affichage.

const TROPHY = '<path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/><path d="M12 14v4M8 21h8"/>';
const DOCK_ICONS = {
  map: '<path d="M4 20V9l8-5 8 5v11Z"/><path d="M9 20v-6h6v6"/>',
  board: '<path d="M4 5h16v14H4Z"/><path d="M4 10h16M10 5v14"/>',
  bracket: '<path d="M3 5h5v5H3zM3 14h5v5H3z"/><path d="M8 7.5h4v9H8M12 12h4"/><path d="M16 9.5h5v5h-5z"/>',
  results: '<path d="M6 3h9l3 3v15H6Z"/><path d="M9 10h6M9 14h6M9 18h3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
};

function svgIcon(paths, size = 20, cls = 'm-icon') {
  const el = h('span', { class: cls, 'aria-hidden': 'true' });
  el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return el;
}

const teamOf = (screen, id) => screen.session.getTeam(id);

/** État de la compagnie, en une pastille : « En lice · Poule H · 4e », « Éliminée · … », « Championne ». */
export function cupStatusLabel(screen) {
  const cup = screen.cup;
  if (!cup || cup.step.stage === 'draw') return null;
  if (cup.playerStatus === 'champion') return { text: 'Championne de France', className: 'is-champion' };
  if (cup.playerStatus === 'eliminated') return { text: `Éliminée · ${cup.playerEliminatedAt}`, className: 'is-eliminated' };
  if (cup.step.stage === 'groups' || !cup.bracket) {
    const group = cup.groups.find((g) => g.id === cup.playerGroup);
    const row = group ? getStandings(screen.session, group).find((r) => r.teamId === cup.playerTeamId) : null;
    return { text: `En lice · ${group?.name ?? ''}${row ? ` · ${row.position}e` : ''}`, className: 'is-active' };
  }
  return { text: `En lice · ${describeStep(cup)}`, className: 'is-active' };
}

/** Bandeau du haut (remplace l'en-tête de l'ordinateur). */
export function CupHud(screen) {
  const cup = screen.cup;
  const status = cupStatusLabel(screen);
  return h('header', { class: 'm-cup-hud' },
    h('div', { class: 'm-hud m-cup-chip' },
      svgIcon(TROPHY, 24, 'm-icon m-cup-trophy'),
      h('div', { class: 'm-cup-chip-text' },
        h('strong', {}, FRENCH_CUP_RULES.name),
        h('span', {}, cup ? (cup.step.stage === 'draw' ? `Édition ${cup.edition} · tirage au sort` : describeStep(cup)) : FRENCH_CUP_RULES.venueName))),
    status ? h('span', { class: `m-cup-status ${status.className}` }, status.text) : h('span', { class: 'm-cup-status-spacer' }),
    cup?.step.stage === 'draw'
      ? h('span', { class: 'm-hud m-cup-count' }, h('strong', {}, `${cup.draw.drawn} / ${cup.draw.order.length}`), ' tirées')
      : null,
    h('button', { type: 'button', class: 'm-hud m-round mobile-menu-button', 'aria-label': 'Menu', onclick: () => openCupMenu(screen) }, svgIcon(DOCK_ICONS.menu)));
}

/** Menu de la Coupe : sauvegarde, tableau, options… et, en bas, Menu principal et l'abandon. */
export function openCupMenu(screen) {
  const cup = screen.cup;
  const exits = [{ id: 'main-menu', glyph: 'exit', label: 'Menu principal', onClick: () => screen.backToMenu() }];
  if (cup && cup.step.stage !== 'finished') {
    exits.push(playerHasMatchesLeft(cup)
      ? { id: 'abandon', glyph: 'flag', label: 'Abandonner la Coupe', danger: true, onClick: () => screen.abandon() }
      : { id: 'quit', glyph: 'flag', label: 'Quitter la Coupe', onClick: () => screen.quit() });
  }
  const items = [];
  if (cup && cup.step.stage !== 'draw') items.push({ id: 'board', glyph: 'board', label: 'Tableau de la Coupe', onClick: () => screen.openBoard('groups') });
  items.push(
    { id: 'options', glyph: 'options', label: 'Options', onClick: () => openOptionsModal(screen.services) },
    { id: 'patch-notes', glyph: 'notes', label: 'Patch Notes', side: GAME_CONFIG.version, onClick: () => openPatchNotes({ currentVersion: GAME_CONFIG.version }) },
  );
  return openMenuDrawer({ session: screen.session, onSave: () => screen.save(), items, exits });
}

// --- Tirage au sort ---

/** Tirage : la dernière tirée en grand à gauche ; les 9 poules en blasons à droite. */
export function renderDrawMobile(screen) {
  const cup = screen.cup;
  const total = cup.draw.order.length;
  const last = screen.lastDrawn;
  const lastTeam = last ? teamOf(screen, last.teamId) : null;
  const lastGroup = last ? cup.groups.find((g) => g.teamIds.includes(last.teamId)) : null;
  const reveal = h('section', { class: 'm-cup-reveal', 'aria-label': 'Dernière compagnie tirée' },
    h('p', { class: 'm-cup-eyebrow' }, lastTeam ? 'Dernière tirée' : 'Tirage au sort'),
    lastTeam
      ? [EmblemView(lastTeam.emblem, { size: 74, title: lastTeam.name }),
        h('strong', { class: 'm-cup-reveal-name' }, lastTeam.name),
        h('p', { class: 'm-cup-reveal-slot' }, 'rejoint la ', h('strong', {}, lastGroup ? lastGroup.name.charAt(0).toLowerCase() + lastGroup.name.slice(1) : ''), ` · place ${last.slot}`)]
      : h('p', { class: 'm-cup-reveal-hint' }, 'Sans tête de série ni chapeau : chaque compagnie tirée prend la prochaine place (A1, B1… I1, puis A2…).'),
    h('div', { class: 'm-cup-progress', role: 'progressbar', 'aria-label': 'Compagnies tirées', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(cup.draw.drawn) },
      h('span', { style: { width: `${Math.round((cup.draw.drawn / total) * 100)}%` } })),
    h('button', { type: 'button', class: 'btn btn-primary m-cup-draw-one', onclick: () => screen.drawOne() }, 'Tirer la suivante'),
    h('button', { type: 'button', class: 'btn m-cup-draw-all', onclick: () => screen.drawEverything() }, 'Tout tirer d’un coup'));
  const grid = h('section', { class: 'm-cup-groups', 'aria-label': 'Les neuf poules' }, cup.groups.map((group, groupIndex) => {
    const isNew = lastGroup?.id === group.id;
    const filled = group.teamIds.filter(Boolean).length;
    return h('button', {
      type: 'button', class: `m-cup-group ${isNew ? 'is-new' : ''} ${group.id === cup.playerGroup ? 'is-player' : ''}`.replace(/\s+/g, ' ').trim(),
      'data-group': group.id, 'aria-label': `${group.name} : ${filled} compagnie${filled > 1 ? 's' : ''} sur ${FRENCH_CUP_RULES.groupSize}`,
      onclick: () => openGroupSheet(screen, group, groupIndex),
    },
    h('span', { class: 'm-cup-group-head' }, h('strong', {}, group.name), h('span', {}, isNew ? 'nouvelle !' : `${filled} / ${FRENCH_CUP_RULES.groupSize}`)),
    h('span', { class: 'm-cup-group-shields' }, Array.from({ length: FRENCH_CUP_RULES.groupSize }, (_, position) => {
      const teamId = group.teamIds[position];
      return teamId
        ? h('span', { class: `m-cup-shield ${teamId === last?.teamId ? 'is-new' : ''}`.trim() }, EmblemView(teamOf(screen, teamId).emblem, { size: 22 }))
        : h('span', { class: 'm-cup-shield is-empty', 'aria-hidden': 'true' });
    })));
  }));
  return h('div', { class: 'm-cup m-cup-draw' }, reveal, grid);
}

/** Une poule ouverte : ses places, blasons et noms (et la division de chaque compagnie). */
export function openGroupSheet(screen, group, groupIndex = screen.cup.groups.indexOf(group)) {
  const cup = screen.cup;
  const rows = Array.from({ length: FRENCH_CUP_RULES.groupSize }, (_, position) => {
    const teamId = group.teamIds[position];
    const slot = slotLabel(position * FRENCH_CUP_RULES.groupCount + groupIndex);
    if (!teamId) return h('li', { class: 'm-cup-slot is-empty' }, h('span', { class: 'm-cup-slot-id' }, slot), h('span', { class: 'muted' }, 'à tirer'));
    const team = teamOf(screen, teamId);
    const league = screen.session.getLeagueOfTeam?.(teamId);
    return h('li', { class: `m-cup-slot ${teamId === cup.playerTeamId ? 'is-player' : ''}`.trim(), 'data-team-id': teamId },
      h('span', { class: 'm-cup-slot-id' }, slot),
      EmblemView(team.emblem, { size: 26 }),
      h('span', { class: 'm-cup-slot-name' }, team.name),
      league ? h('span', { class: 'm-cup-slot-div' }, getLeagueName(league.id)) : null);
  });
  return openModal({ title: group.name, body: h('ol', { class: 'm-cup-slots' }, rows), className: 'm-cup-group-modal', actions: [{ label: 'Fermer', variant: 'primary' }] });
}

// --- Château de Gabarnac ---

/** Carte « Prochain combat » (ou l'état de la Coupe), posée sur la carte, à gauche. */
function nextCard(screen) {
  const cup = screen.cup;
  const match = getPlayerPendingMatch(cup);
  if (screen.simulating) {
    return h('section', { class: 'm-cup-next is-busy' },
      h('p', { class: 'm-cup-eyebrow' }, 'Les combats se disputent…'),
      screen.progressEl = h('p', { class: 'muted', role: 'status' }, 'Les autres compagnies entrent dans la Lice.'));
  }
  if (match) {
    const opponentId = opponentOf(cup, match);
    const opponent = teamOf(screen, opponentId);
    const league = screen.session.getLeagueOfTeam?.(opponentId);
    return h('section', { class: 'm-cup-next', 'aria-label': 'Prochain combat' },
      h('p', { class: 'm-cup-eyebrow' }, 'Prochain combat'),
      h('p', { class: 'm-cup-next-step' }, describeMatch(cup, match)),
      h('div', { class: 'm-cup-versus' },
        EmblemView(screen.session.playerTeam.emblem, { size: 36, title: screen.session.playerTeam.name }),
        h('span', {}, 'VS'),
        EmblemView(opponent.emblem, { size: 36, title: opponent.name })),
      h('strong', { class: 'm-cup-next-name' }, opponent.name),
      h('span', { class: 'm-cup-next-stars' }, ClubStars(getClubLevel(screen.session, opponentId)), league ? ` · ${getLeagueName(league.id)}` : ''));
  }
  const status = getCupStatus(cup);
  if (status === 'finished') {
    return h('section', { class: 'm-cup-next' },
      h('p', { class: 'm-cup-eyebrow' }, 'Coupe terminée'),
      h('strong', { class: 'm-cup-next-name' }, `${screen.name(cup.winnerId)}, Champion de France`),
      h('button', { type: 'button', class: 'btn', onclick: () => { screen.showMap = false; screen.update(); } }, 'Voir le vainqueur'),
      h('button', { type: 'button', class: 'btn btn-primary cup-new-season', onclick: () => screen.startNewSeason() }, 'Nouvelle saison ▸'));
  }
  const watch = h('button', {
    type: 'button', class: 'btn btn-primary cup-watch',
    onclick: () => (cup.step.stage === 'groups' ? screen.runStep() : screen.openSpectator({ autoStart: true })),
  }, 'Assister aux combats');
  if (cup.playerStatus === 'active') {
    return h('section', { class: 'm-cup-next' },
      h('p', { class: 'm-cup-eyebrow' }, describeStep(cup)),
      h('strong', { class: 'm-cup-next-name' }, 'Votre combat est joué'),
      h('p', { class: 'muted' }, 'Les autres combats du tour attendent.'),
      watch);
  }
  return h('section', { class: 'm-cup-next' },
    h('p', { class: 'm-cup-eyebrow' }, 'Votre parcours est terminé'),
    h('strong', { class: 'm-cup-next-name' }, `Éliminée · ${cup.playerEliminatedAt}`),
    h('p', { class: 'muted' }, `Prochain tour : ${describeStep(cup)}.`),
    watch);
}

/** Dock de la Coupe : Gabarnac (la carte) · Tableau (poules) · Arbre final · Résultats. */
function cupDock(screen) {
  const item = (id, label, iconName, onclick, active = false) => h('button', {
    type: 'button', class: `m-dock-item ${active ? 'is-active' : ''}`.trim(), 'data-cup-dock': id, 'aria-current': active ? 'page' : null, onclick,
  }, svgIcon(DOCK_ICONS[iconName]), h('span', {}, label));
  return h('nav', { class: 'm-dock m-cup-dock', 'aria-label': 'Coupe de France' },
    item('map', 'Gabarnac', 'map', () => {}, true),
    item('board', 'Tableau', 'board', () => screen.openBoard('groups')),
    item('bracket', 'Arbre', 'bracket', () => screen.openBoard('bracket')),
    item('results', 'Résultats', 'results', () => screen.openBoard('results')));
}

/** Le Château en plein écran, le prochain combat, le dock et « Combattre ». */
export function renderGabarnacMobile(screen, mapStage) {
  const match = getPlayerPendingMatch(screen.cup);
  return h('div', { class: 'm-cup m-cup-gabarnac' },
    mapStage,
    nextCard(screen),
    cupDock(screen),
    match && !screen.simulating
      ? h('button', { type: 'button', class: 'm-advance is-fight m-cup-fight', onclick: () => screen.enterLice() }, 'Combattre')
      : null);
}

// --- Tableau de la Coupe ---

const BOARD_TABS = [['results', 'Résultats'], ['groups', 'Poules'], ['bracket', 'Arbre final'], ['qualified', 'Qualifiés'], ['fighters', 'Combattants']];

/** Poules : A à I en onglets ; la poule choisie en tableau (blasons, points, manches, KO). */
function boardGroups(screen, state, rerender) {
  const cup = screen.cup;
  state.group ??= cup.playerGroup ?? cup.groups[0].id;
  const group = cup.groups.find((g) => g.id === state.group) ?? cup.groups[0];
  return h('div', { class: 'm-board-groups' },
    h('div', { class: 'm-board-group-tabs', role: 'tablist', 'aria-label': 'Poule' }, cup.groups.map((g) => h('button', {
      type: 'button', role: 'tab', class: `m-board-group-tab ${g.id === group.id ? 'is-active' : ''} ${g.id === cup.playerGroup ? 'is-player' : ''}`.replace(/\s+/g, ' ').trim(),
      'aria-selected': String(g.id === group.id), 'data-group': g.id,
      onclick: () => { state.group = g.id; rerender(); },
    }, g.id))),
    screen.standingsTable(getStandings(screen.session, group)),
    h('p', { class: 'm-board-legend' },
      h('span', { class: 'is-in' }, `qualifiés (${FRENCH_CUP_RULES.qualifiersPerGroup} premiers)`),
      h('span', { class: 'is-maybe' }, `${FRENCH_CUP_RULES.extraQualifiers.rank}e : parmi les ${FRENCH_CUP_RULES.extraQualifiers.count} meilleurs ?`)));
}

/** Volet du tableau : rubriques à gauche, contenu à droite. */
export function openBoardMobile(screen, tab = 'groups') {
  const state = { tab, group: null, round: null };
  const rail = h('nav', { class: 'm-board-rail', 'aria-label': 'Rubriques' });
  const content = h('div', { class: 'm-board-content' });
  let handle = null;
  const render = () => {
    rail.replaceChildren(
      h('div', { class: 'm-board-rail-head' },
        h('strong', {}, 'Tableau'),
        h('button', { type: 'button', class: 'm-board-close', 'aria-label': 'Fermer le tableau', onclick: () => handle.close() }, svgIcon(DOCK_ICONS.close, 18))),
      ...BOARD_TABS.map(([id, label]) => h('button', {
        type: 'button', class: `m-board-tab ${id === state.tab ? 'is-active' : ''}`.trim(), 'data-tab': id, 'aria-selected': String(id === state.tab),
        onclick: () => { state.tab = id; render(); },
      }, label)));
    const views = {
      results: () => screen.boardResults(),
      groups: () => boardGroups(screen, state, render),
      bracket: () => MobileBracket(screen, state, render),
      qualified: () => screen.boardQualified(),
      fighters: () => screen.boardFighters(),
    };
    content.replaceChildren(views[state.tab]());
  };
  render();
  handle = openModal({ body: h('div', { class: 'm-board' }, h('span', { class: 'm-grip', 'aria-hidden': 'true' }), rail, content), className: 'm-board-modal' });
  // v0.93 : tirer le tableau vers le bas le referme.
  attachSwipeClose(handle.element, { direction: 'down', onClose: () => handle.close() });
  return handle;
}

// --- Arbre final ---

const SLOT = 70; // hauteur d'une affiche du premier tour affiché (px)
const CARD_H = 54;
const COL_W = 200;
const COL_GAP = 36;

/**
 * Arbre final (maquette « Coupe · arbre final ») : les tours en pastilles ; à partir du tour
 * choisi, les colonnes côte à côte (on glisse pour les suivantes), les traits du tableau et le
 * parcours de la compagnie en or.
 */
export function MobileBracket(screen, state = {}, rerender = () => {}) {
  const cup = screen.cup;
  if (!cup.bracket) {
    return h('p', { class: 'empty-state' }, `L’arbre final se remplit à la fin des poules : ${FRENCH_CUP_RULES.qualifiersPerGroup} qualifiés par poule et les ${FRENCH_CUP_RULES.extraQualifiers.count} meilleurs ${FRENCH_CUP_RULES.extraQualifiers.rank}es.`);
  }
  const rounds = cup.bracket.rounds;
  const current = Math.min(cup.step.round ?? 0, rounds.length - 1);
  state.round ??= cup.step.stage === 'knockout' ? current : 0;
  const from = Math.min(state.round, rounds.length - 1);
  const shown = rounds.slice(from);
  const first = shown[0].matches.length;
  const height = first * SLOT;
  const isPlayerMatch = (m) => m.teamAId === cup.playerTeamId || m.teamBId === cup.playerTeamId;
  const cards = [];
  const lines = [];
  const gold = [];
  shown.forEach((round, k) => {
    const slot = height / round.matches.length;
    const x = k * (COL_W + COL_GAP);
    round.matches.forEach((match, i) => {
      const center = slot * (i + 0.5);
      cards.push(bracketCard(screen, match, { x, y: center - CARD_H / 2, player: isPlayerMatch(match) }));
      // Trait vers l'affiche du tour suivant (deux affiches → une).
      if (k < shown.length - 1) {
        const nextCenter = (height / shown[k + 1].matches.length) * (Math.floor(i / 2) + 0.5);
        const x1 = x + COL_W;
        const xm = x1 + COL_GAP / 2;
        const path = `M${x1} ${center}H${xm}V${nextCenter}H${x1 + COL_GAP}`;
        const winnerIsPlayer = match.winnerId && match.winnerId === cup.playerTeamId;
        (winnerIsPlayer ? gold : lines).push(path);
      }
    });
  });
  const width = shown.length * COL_W + (shown.length - 1) * COL_GAP;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('m-bracket-lines');
  svg.innerHTML = `<g class="is-plain">${lines.map((d) => `<path d="${d}"/>`).join('')}</g><g class="is-gold">${gold.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  const heads = h('div', { class: 'm-bracket-heads', style: { width: `${width}px` } }, shown.map((round, k) => h('span', {
    class: 'm-bracket-head', style: { left: `${k * (COL_W + COL_GAP)}px`, width: `${COL_W}px` },
  }, round.name)));
  const reward = FRENCH_CUP_RULES.rewards?.knockout ?? [];
  return h('div', { class: 'm-bracket' },
    h('div', { class: 'm-bracket-rounds', role: 'tablist', 'aria-label': 'Tour' }, rounds.map((round, index) => h('button', {
      type: 'button', role: 'tab', class: `m-bracket-round ${index === from ? 'is-active' : ''} ${index === current && cup.step.stage === 'knockout' ? 'is-current' : ''}`.replace(/\s+/g, ' ').trim(),
      'aria-selected': String(index === from), 'data-round': String(index),
      onclick: () => { state.round = index; rerender(); },
    }, shortRoundName(round.name, index, rounds.length)))),
    h('div', { class: 'm-bracket-scroll' },
      heads,
      h('div', { class: 'm-bracket-board', style: { width: `${width}px`, height: `${height}px` } }, svg, cards)),
    reward.length ? h('p', { class: 'm-bracket-note' }, `Finale : ${reward[reward.length - 1].toLocaleString('fr-FR')} deniers au vainqueur.`) : null);
}

function shortRoundName(name, index, count) {
  if (index === count - 1) return 'Finale';
  const lower = name.toLowerCase();
  const short = [['seizi', '16es'], ['huiti', '8es'], ['quart', 'Quarts'], ['demi', 'Demies']].find(([start]) => lower.startsWith(start));
  return short ? short[1] : name;
}

function bracketCard(screen, match, { x, y, player }) {
  const side = (teamId, rounds) => {
    const team = teamId ? teamOf(screen, teamId) : null;
    return h('span', { class: `m-bracket-team ${match.winnerId && match.winnerId === teamId ? 'is-winner' : ''} ${teamId === screen.cup.playerTeamId ? 'is-player' : ''}`.replace(/\s+/g, ' ').trim() },
      team ? EmblemView(team.emblem, { size: 16 }) : h('span', { class: 'm-bracket-blank', 'aria-hidden': 'true' }),
      h('span', { class: 'm-bracket-name' }, team ? team.name : 'à déterminer'),
      h('span', { class: 'm-bracket-score' }, match.status === 'played' ? String(rounds) : ''));
  };
  return h('div', {
    class: `m-bracket-card ${player ? 'is-player' : ''}`.trim(), 'data-match-id': match.id,
    style: { left: `${x}px`, top: `${y}px`, width: `${COL_W}px`, height: `${CARD_H}px` },
  }, side(match.teamAId, match.roundsWonA), side(match.teamBId, match.roundsWonB));
}
