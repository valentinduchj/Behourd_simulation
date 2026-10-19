import { h } from '../../utils/dom.js';
import { MATCH_RULES } from '../../data/matchRules.js';
import { canSelectForMatch, autoSelectLineup } from '../../systems/match/MatchService.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { getFatigueState, fatigueLevelClass, getColorIntensity } from '../../systems/fighters/FatigueService.js';
import { getClubLevel } from '../../systems/league/LeagueService.js';
import { describeBehavior } from '../../systems/ai/OpponentAIService.js';
import { FighterSprite } from '../components/FighterSprite.js';
import { FighterStars, ClubStars } from '../components/Rating.js';
import { FighterName } from '../components/CaptainCrown.js';
import { EmblemView } from '../components/EmblemView.js';
import { SkillLine } from '../components/PlacementFighterCard.js';
import { haptic } from './Haptics.js';

// Combat sur téléphone (v0.86) : effectif engagé, combattants de la manche, résultat de la
// manche et fin du combat, pensés pour un écran en paysage. Une même mise en page :
//   bandeau du haut (retour, titre, score) ;
//   à gauche, la grille de cartes (défilante) ; à droite, l'adversaire et les actions.
// Les règles restent celles de MatchScreen (sélection, KO, équipe type, placement).

function backButton(onclick) {
  const el = h('button', { type: 'button', class: 'mm-back', 'aria-label': 'Retour', onclick });
  el.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>';
  return el;
}

function topBar(screen, { title, subtitle, pill = null, onBack = null }) {
  return h('header', { class: 'mm-top' },
    onBack ? backButton(onBack) : null,
    h('div', { class: 'mm-top-text' }, h('strong', {}, title), subtitle ? h('span', {}, subtitle) : null),
    h('div', { class: 'mm-top-score' },
      EmblemView(screen.playerTeam.emblem, { size: 26, title: screen.playerTeam.name }),
      h('b', {}, `${screen.match.scoreA} – ${screen.match.scoreB}`),
      EmblemView(screen.opponentTeam.emblem, { size: 26, title: screen.opponentTeam.name })),
    pill ? h('span', { class: `mm-pill ${pill.className ?? ''}`.trim() }, pill.text) : null);
}

/** Carte d'un combattant : classe et étoiles, personnage et compétences, nom, fatigue. */
function fighterCard(screen, fighter, { selected = false, disabled = false, ko = false, note = null, onToggle }) {
  const fatigue = screen.matchFatigue(fighter);
  const state = getFatigueState(fighter, fatigue);
  return h('button', {
    type: 'button',
    class: `mm-card ${selected ? 'is-selected' : ''} ${ko ? 'is-ko' : ''} ${disabled && !selected ? 'is-disabled' : ''}`.replace(/\s+/g, ' ').trim(),
    'aria-pressed': String(selected), 'data-fighter-id': fighter.id,
    style: { '--spec-color': fighter.specialty?.color },
    onclick: () => {
      // Vibration (v0.93) : coché / décoché ; refus (KO, effectif complet) plus marqué.
      if (!ko && (selected || !disabled)) {
        haptic('tap');
        onToggle(fighter);
      } else haptic('warning');
    },
  },
  h('span', { class: 'mm-card-band' }, h('span', {}, fighter.specialty?.name ?? ''), FighterStars(calculateFighterLevel(fighter))),
  h('span', { class: 'mm-card-body' },
    FighterSprite(fighter, { size: 44, team: screen.playerTeam, colorIntensity: getColorIntensity(fatigue) }),
    SkillLine(fighter)),
  h('span', { class: 'mm-card-name' }, FighterName(fighter, { session: screen.session })),
  h('span', { class: `mm-card-fatigue ${fatigueLevelClass(fighter, fatigue)}` }, ko ? 'KO pour ce combat' : note ?? `${state.label} · ${fatigue}`),
  h('span', { class: 'mm-check', 'aria-hidden': 'true' }, ko ? 'KO' : selected ? '✓' : ''));
}

/** Fiche de l'adversaire (colonne de droite). */
function opponentCard(screen) {
  const club = screen.opponentTeam;
  return h('section', { class: 'mm-opponent', 'aria-label': `Adversaire : ${club.name}` },
    h('div', { class: 'mm-opponent-head' },
      EmblemView(club.emblem, { size: 36, title: club.name }),
      h('div', {}, h('strong', {}, club.name), h('span', {}, screen.rankLabel(club.id)))),
    ClubStars(getClubLevel(screen.session, club.id)),
    screen.aiProfile ? h('p', { class: 'mm-behavior' }, describeBehavior(screen.aiProfile)) : null);
}

function layout(screen, top, main, aside, extraClass = '') {
  return h('div', { class: `match-body m-match ${extraClass}`.trim() }, top, h('div', { class: 'mm-split' }, main, aside));
}

/** Effectif engagé : jusqu'à 8 combattants pour le combat. */
export function renderSquadMobile(screen) {
  const max = MATCH_RULES.maxSquadSize;
  const full = screen.squad.length >= max;
  const fighters = [...screen.session.playerFighters].sort((a, b) => calculateFighterLevel(b) - calculateFighterLevel(a));
  const toggle = (fighter) => {
    if (screen.squad.includes(fighter.id)) screen.squad = screen.squad.filter((id) => id !== fighter.id);
    else if (!full && canSelectForMatch(screen.session, fighter).ok) screen.squad.push(fighter.id);
    screen.update();
  };
  const where = screen.isQueen ? 'Combat de la Reine' : screen.isCup ? 'Coupe de France' : `Journée ${screen.event?.data?.matchday ?? ''}${screen.venue ? (screen.venue.isHome ? ' · à domicile' : ' · à l’extérieur') : ''}`;
  const grid = h('div', { class: 'mm-grid' }, fighters.map((fighter) => {
    const check = canSelectForMatch(screen.session, fighter);
    return fighterCard(screen, fighter, {
      selected: screen.squad.includes(fighter.id), disabled: full || !check.ok, onToggle: toggle,
      note: check.ok ? null : check.reason,
    });
  }));
  const aside = h('aside', { class: 'mm-aside' },
    opponentCard(screen),
    h('p', { class: 'mm-hint' }, `À chaque manche, ${MATCH_RULES.fightersPerRound} d’entre eux entreront dans La Lice.`),
    h('button', { type: 'button', class: 'btn mm-action', onclick: () => screen.selectTypeTeam() }, 'Équipe type'),
    h('button', { type: 'button', class: 'btn mm-action', disabled: !screen.squad.length, onclick: () => { screen.squad = []; screen.update(); } }, 'Tout décocher'),
    h('button', {
      type: 'button', class: 'btn btn-primary mm-go', disabled: screen.squad.length === 0,
      onclick: () => { screen.lineup = []; screen.match.squadIds = [...screen.squad]; screen.goTo('lineup'); },
    }, 'Valider l’effectif ▸'));
  return layout(screen,
    topBar(screen, { title: where, subtitle: `Choisissez jusqu’à ${max} combattants`, pill: { text: `${screen.squad.length} / ${max}`, className: full ? 'is-full' : '' }, onBack: () => screen.navigate(screen.backScreen) }),
    grid, aside, 'mm-squad');
}

/** Combattants de la manche : 5 parmi l'effectif engagé (KO exclus). */
export function renderLineupMobile(screen) {
  const need = screen.lineupSize;
  const full = screen.lineup.length >= need;
  const squad = screen.squad.map((id) => screen.session.getFighter(id)).filter(Boolean);
  const toggle = (fighter) => {
    if (screen.lineup.includes(fighter.id)) screen.lineup = screen.lineup.filter((id) => id !== fighter.id);
    else if (!full) screen.lineup.push(fighter.id);
    screen.update();
  };
  const decisive = screen.match.scoreA === 1 && screen.match.scoreB === 1;
  const grid = h('div', { class: 'mm-grid' }, squad.map((fighter) => fighterCard(screen, fighter, {
    selected: screen.lineup.includes(fighter.id), disabled: full, ko: screen.match.isKnockedOut(fighter.id), onToggle: toggle,
  })));
  const aside = h('aside', { class: 'mm-aside' },
    opponentCard(screen),
    decisive ? h('p', { class: 'mm-decisive' }, 'Manche décisive !') : null,
    need ? h('p', { class: 'mm-hint' }, 'La fatigue des manches précédentes compte : préférez les combattants reposés.') : h('p', { class: 'form-error' }, 'Tous vos combattants engagés sont KO.'),
    need ? h('button', {
      type: 'button', class: 'btn mm-action',
      onclick: () => { screen.lineup = autoSelectLineup(screen.session, screen.match, squad, need).map((f) => f.id); screen.update(); },
    }, 'Les moins fatigués') : null,
    screen.match.rounds.length === 0 ? h('button', { type: 'button', class: 'btn mm-action', onclick: () => screen.goTo('squad') }, 'Modifier l’effectif') : null,
    need
      ? h('button', { type: 'button', class: 'btn btn-primary mm-go', disabled: screen.lineup.length !== need, onclick: () => screen.startPlacement() }, 'Placer dans La Lice ▸')
      : h('button', { type: 'button', class: 'btn btn-primary mm-go', onclick: () => screen.forfeitRound() }, 'Concéder la manche ▸'));
  return layout(screen,
    topBar(screen, { title: `Manche ${screen.match.currentRound}`, subtitle: `Choisissez ${need} combattants`, pill: { text: `${screen.lineup.length} / ${need}`, className: full ? 'is-full' : '' } }),
    grid, aside, 'mm-lineup');
}

/** Résultat d'une manche : vainqueur, score, meilleur combattant, bilan de vos combattants. */
export function renderRoundResultMobile(screen) {
  const round = screen.lastRound;
  const won = round.winnerTeamId === screen.playerTeam.id;
  const sim = round.simulation;
  const ownIds = (sim?.initial ?? []).filter((u) => u.side === 'A').map((u) => u.id);
  const statOf = (id) => ({ dealt: 0, knockouts: 0, ...(sim?.stats?.[id] ?? {}) });
  const best = [...ownIds].sort((a, b) => (statOf(b).knockouts - statOf(a).knockouts) || (statOf(b).dealt - statOf(a).dealt))[0];
  const bestFighter = best ? screen.session.getFighter(best) : null;
  const fatigueOf = new Map(round.fatigueApplied.filter((e) => e.side === 'A').map((e) => [e.fighterId, e]));
  const decisive = !screen.match.isFinished && screen.match.scoreA === 1 && screen.match.scoreB === 1;
  const rows = ownIds.map((id) => {
    const fighter = screen.session.getFighter(id);
    if (!fighter) return null;
    const f = fatigueOf.get(id);
    const ko = (sim?.knockedOut ?? []).includes(id);
    const after = f?.after ?? screen.matchFatigue(fighter);
    return h('tr', { class: ko ? 'is-ko' : '' },
      h('td', {}, h('span', { class: 'mm-who' }, FighterSprite(fighter, { size: 26, team: screen.playerTeam, colorIntensity: getColorIntensity(after) }), FighterName(fighter, { session: screen.session }))),
      h('td', { class: 'num' }, String(statOf(id).knockouts)),
      h('td', { class: 'num' }, String(Math.round(statOf(id).dealt))),
      h('td', { class: 'num' }, f ? `${Math.round(f.before)} → ${Math.round(after)}` : String(Math.round(after))),
      h('td', {}, ko ? h('strong', { class: 'ko-label' }, 'KO') : h('span', { class: `pick-fatigue ${fatigueLevelClass(fighter, after)}` }, getFatigueState(fighter, after).label)));
  }).filter(Boolean);
  return h('div', { class: `match-body m-match mm-result ${won ? 'is-win' : 'is-loss'}` },
    h('section', { class: 'mm-result-card' },
      h('div', { class: 'mm-result-head' },
        h('div', {},
          h('p', { class: 'mm-result-label' }, `Manche ${round.number}`),
          h('h2', { class: 'mm-result-title' }, won ? `Manche ${round.number} remportée !` : `Manche ${round.number} perdue`),
          h('p', { class: 'mm-result-sub' }, `${screen.playerTeam.name} contre ${screen.opponentTeam.name}`)),
        h('div', { class: 'mm-result-score' }, `${screen.match.scoreA} – ${screen.match.scoreB}`)),
      bestFighter ? h('p', { class: 'mm-best' }, 'Meilleur combattant : ', h('strong', {}, bestFighter.name), ` · ${statOf(best).knockouts} mise${statOf(best).knockouts > 1 ? 's' : ''} à terre, ${Math.round(statOf(best).dealt)} dégâts`) : null,
      decisive ? h('p', { class: 'mm-decisive' }, 'Égalité 1 – 1 : une manche décisive va se jouer.') : null,
      h('div', { class: 'mm-table-wrap' }, h('table', { class: 'mm-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Combattant'), h('th', { class: 'num' }, 'Mises à terre'), h('th', { class: 'num' }, 'Dégâts'), h('th', { class: 'num' }, 'Fatigue'), h('th', {}, 'État'))),
        h('tbody', {}, rows))),
      h('div', { class: 'mm-result-actions' },
        screen.match.isFinished
          ? h('button', { type: 'button', class: 'btn btn-primary mm-go', onclick: () => screen.goTo('final') }, 'Voir le résultat du combat ▸')
          : h('button', { type: 'button', class: 'btn btn-primary mm-go', onclick: () => { screen.lineup = []; screen.goTo('lineup'); } }, `Préparer la manche ${screen.match.currentRound} ▸`))));
}

/**
 * Fin du combat (championnat) : victoire ou défaite en grand, points et recette, manches ;
 * à droite le classement et les autres combats ; courbatures repliées.
 */
export function renderFinalMobile(screen, { won, points, homeReward, standingsTable, others, seasonNote, soreness, onFinish }) {
  const playerId = screen.playerTeam.id;
  const name = (id) => screen.session.getTeam(id)?.name ?? '?';
  const details = soreness ? h('details', { class: 'mm-soreness' }, h('summary', {}, 'Courbatures du lendemain'), soreness) : null;
  return h('div', { class: `match-body m-match mm-final ${won ? 'is-win' : 'is-loss'}` },
    h('section', { class: 'mm-final-hero' },
      h('p', { class: 'mm-final-title' }, won ? 'Victoire !' : 'Défaite'),
      h('div', { class: 'mm-final-teams' },
        EmblemView(screen.playerTeam.emblem, { size: 54, title: screen.playerTeam.name }),
        h('b', { class: 'mm-final-score' }, `${screen.match.scoreA} – ${screen.match.scoreB}`),
        EmblemView(screen.opponentTeam.emblem, { size: 54, title: screen.opponentTeam.name })),
      h('p', { class: 'mm-final-points' }, `+${points} point${points > 1 ? 's' : ''} au classement`),
      homeReward ? h('p', { class: 'mm-final-points' }, `🏠 Victoire à domicile : +${homeReward} deniers`) : null,
      h('ol', { class: 'mm-rounds' }, screen.match.rounds.map((round) => h('li', { class: round.winnerTeamId === playerId ? 'is-win' : 'is-loss' },
        `M${round.number} · ${round.winnerTeamId === playerId ? 'gagnée' : 'perdue'} ${round.scoreA}–${round.scoreB}`))),
      h('button', { type: 'button', class: 'btn btn-primary mm-go', onclick: onFinish }, 'Terminer la journée ▸')),
    h('section', { class: 'mm-final-side' },
      seasonNote,
      standingsTable,
      others.length ? h('details', { class: 'mm-others' }, h('summary', {}, `Autres combats (${others.length})`),
        h('ul', { class: 'matchday-results' }, others.map(({ match }) => h('li', {},
          h('span', { class: match.winnerId === match.teamAId ? 'is-winner' : '' }, name(match.teamAId)),
          h('span', { class: 'matchday-score' }, `${match.scoreA} – ${match.scoreB}`),
          h('span', { class: match.winnerId === match.teamBId ? 'is-winner' : '' }, name(match.teamBId)))))) : null,
      details));
}
