import { h } from '../../utils/dom.js';
import { EmblemView } from './EmblemView.js';
import { SCENE_VFX } from '../../data/vfx.js';
import { getVfxLevel, getVfxLevelId } from '../../render/vfx/vfxLevel.js';

// Qualifications déjà montrées (édition:place), le temps de la session de jeu.
const celebratedAdvances = new Set();

/**
 * Dernière qualification de la compagnie du joueur dans l'arbre : { from, to } (clés de places,
 * `to` = 'champion' pour la finale gagnée), ou null s'il n'a encore gagné aucun tour.
 */
export function playerAdvance(cup) {
  const rounds = cup?.bracket?.rounds ?? [];
  const me = cup?.playerTeamId;
  let advance = null;
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.status !== 'played' || match.winnerId !== me) continue;
      const key = match.teamAId === me ? 'A' : 'B';
      advance = { from: `${match.round}:${match.slot}:${key}`, to: nextSlotKey(cup.bracket, match) };
    }
  }
  return advance;
}

// Arbre final de la Coupe de France, lu dans l'état réel de la Coupe (cup.bracket) : il
// n'invente ni ne calcule aucun résultat. Pour l'animation (FrenchCupScreen), certaines
// informations déjà enregistrées peuvent être momentanément masquées :
//   hiddenSlots   places du tour suivant pas encore « rejointes » (`${round}:${slot}:${A|B}`)
//   hiddenScores  combats dont le score se dévoile manche après manche (identifiants)

/** Clé de la place qu'occupe le vainqueur d'un combat au tour suivant (null : finale). */
export function nextSlotKey(bracket, match) {
  if (match.round >= bracket.rounds.length - 1) return 'champion';
  return `${match.round + 1}:${Math.floor(match.slot / 2)}:${match.slot % 2 === 0 ? 'A' : 'B'}`;
}

export class CupBracketView {
  constructor({ session, cup }) {
    this.session = session;
    this.cup = cup;
    this.hiddenSlots = new Set();
    this.hiddenScores = new Set();
    this.el = h('div', { class: 'cup-tree' });
    this.update();
  }

  name(teamId) {
    return this.session.getTeam(teamId)?.name ?? '?';
  }

  update() {
    const { bracket } = this.cup;
    if (!bracket) {
      this.el.replaceChildren(h('p', { class: 'empty-state' }, 'L’arbre final se dessine à la fin des poules.'));
      return;
    }
    const final = bracket.rounds[bracket.rounds.length - 1].matches[0];
    const championId = final.status === 'played' && !this.hiddenSlots.has('champion') ? final.winnerId : null;
    this.el.replaceChildren(
      ...bracket.rounds.map((round) => h(
        'section',
        { class: 'cup-tree-round', 'data-round': round.index },
        h('h3', { class: 'cup-tree-title' }, round.name),
        h('ol', { class: 'cup-tree-matches' }, round.matches.map((match) => this.renderMatch(match))),
      )),
      h('section', { class: 'cup-tree-round is-champion' },
        h('h3', { class: 'cup-tree-title' }, 'Vainqueur'),
        h('div', { class: 'cup-tree-matches' },
          h('div', { class: `cup-tree-champion ${championId ? 'is-crowned' : ''}`.trim(), 'data-slot': 'champion' },
            championId
              ? [EmblemView(this.session.getTeam(championId).emblem, { size: 48, title: this.name(championId) }), h('strong', {}, this.name(championId)), h('span', {}, 'Champion de France')]
              : [h('span', { class: 'cup-tree-circle is-empty' }, '🏆'), h('span', { class: 'muted' }, 'à déterminer')]))),
    );
  }

  renderMatch(match) {
    const played = match.status === 'played';
    const scoreHidden = this.hiddenScores.has(match.id);
    const showResult = played && !scoreHidden;
    const side = (key) => {
      const teamId = match[`team${key}Id`];
      const hidden = this.hiddenSlots.has(`${match.round}:${match.slot}:${key}`);
      const shown = teamId && !hidden ? teamId : null;
      const result = showResult ? (match.winnerId === shown ? 'is-winner' : 'is-loser') : '';
      return h(
        'div',
        {
          class: ['cup-tree-team', result, shown && shown === this.cup.playerTeamId ? 'is-player' : '', shown ? '' : 'is-empty'].filter(Boolean).join(' '),
          'data-slot': `${match.round}:${match.slot}:${key}`, 'data-team-id': shown ?? '',
        },
        h('span', { class: 'cup-tree-circle' }, shown ? EmblemView(this.session.getTeam(shown).emblem, { size: 20 }) : null),
        h('span', { class: 'cup-tree-name', title: shown ? this.name(shown) : '' }, shown ? this.name(shown) : 'à déterminer'),
        h('span', { class: 'cup-tree-score', 'data-score': key }, showResult ? String(match[`roundsWon${key}`]) : ''),
      );
    };
    return h('li', { class: `cup-tree-match ${showResult ? 'is-played' : 'is-pending'}`, 'data-match-id': match.id }, side('A'), side('B'));
  }

  /** Éléments d'un combat (pour l'animation). */
  matchEl(matchId) {
    return this.el.querySelector(`[data-match-id="${matchId}"]`);
  }

  slotEl(key) {
    return this.el.querySelector(`[data-slot="${key}"]`);
  }

  /**
   * Qualification pas encore montrée (C2) : le blason de la compagnie quitte sa place, rejoint
   * celle du tour suivant et laisse une traînée lumineuse ; sa nouvelle place s'illumine. Une
   * seule fois par qualification. Effets réduits : seulement la place qui s'illumine.
   * Renvoie true si la qualification a été montrée.
   */
  celebratePlayerAdvance({ config = SCENE_VFX.cupAdvance } = {}) {
    const advance = playerAdvance(this.cup);
    if (!advance || getVfxLevel().count <= 0) return false;
    const id = `${this.cup.editionId ?? this.cup.edition}:${advance.to}`;
    if (celebratedAdvances.has(id)) return false;
    celebratedAdvances.add(id);
    const toEl = this.slotEl(advance.to);
    const fromCircle = this.el.querySelector(`[data-slot="${advance.from}"] .cup-tree-circle`);
    const toCircle = toEl?.querySelector('.cup-tree-circle') ?? toEl;
    const arrive = () => toEl?.classList.add('is-advanced');
    if (getVfxLevelId() !== 'full' || !fromCircle || !toCircle || !this.el.isConnected) {
      arrive();
      return true;
    }
    const host = this.el.getBoundingClientRect();
    const a = fromCircle.getBoundingClientRect();
    const b = toCircle.getBoundingClientRect();
    const start = { x: a.left - host.left + this.el.scrollLeft, y: a.top - host.top + this.el.scrollTop };
    const end = { x: b.left - host.left + this.el.scrollLeft, y: b.top - host.top + this.el.scrollTop };
    const token = fromCircle.cloneNode(true);
    token.classList.add('cup-advance-token');
    Object.assign(token.style, { left: `${start.x}px`, top: `${start.y}px`, width: `${a.width}px`, height: `${a.height}px` });
    this.el.append(token);
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const begin = performance.now();
    let dots = 0;
    const step = (now) => {
      const t = Math.min(1, (now - begin) / config.duration);
      const k = ease(t);
      const x = start.x + (end.x - start.x) * k;
      const y = start.y + (end.y - start.y) * k - Math.sin(Math.PI * t) * 18;
      token.style.transform = `translate(${x - start.x}px, ${y - start.y}px) scale(${1 + 0.25 * Math.sin(Math.PI * t)})`;
      // Traînée : un point lumineux tous les 1/trailDots du trajet, qui s'éteint.
      while (dots < Math.floor(t * config.trailDots)) {
        dots += 1;
        const dot = h('span', { class: 'cup-advance-dot', style: { left: `${x + a.width / 2}px`, top: `${y + a.height / 2}px`, '--life': `${config.dotLife}ms` } });
        this.el.append(dot);
        setTimeout(() => dot.remove(), config.dotLife + 50);
      }
      if (t < 1) requestAnimationFrame(step);
      else {
        token.remove();
        arrive();
      }
    };
    requestAnimationFrame(step);
    return true;
  }
}
