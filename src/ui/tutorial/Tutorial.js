import { h } from '../../utils/dom.js';
import { TUTORIAL_CHAPTERS, TUTORIAL_STEPS, TUTORIAL_END_SCREEN } from '../../data/tutorial.js';
import { SPECIALTIES, SPECIALTY_IDS } from '../../data/specialties.js';
import { ACTIVITIES } from '../../data/activities.js';
import { getStatDefinition } from '../../data/stats.js';
import { LEAGUE_RULES } from '../../data/leagues.js';
import { MAX_TEAM_FIGHTERS } from '../../data/roster.js';
import { translateText } from '../../i18n/i18n.js';
import { assetUrl } from '../../utils/assets.js';

// Tutoriel (v0.81) : une sur-couche posée sur le jeu lui-même (document.body), qui survit aux
// changements d'écran. Le jeu reste vivant dessous ; le calque :
//   - floute légèrement tout, sauf la zone de l'étape (quatre voiles autour d'un « trou ») ;
//   - bloque les clics hors de cette zone (et dans la zone, sauf aux étapes « à cliquer ») ;
//   - suit la zone à chaque image (défilement, caméra des cartes, redimensionnement).
// Étapes : data/tutorial.js. Lancé à la fin de la création de la compagnie (NewCaptainScreen).

const HOLE_PADDING = 6;
const BUBBLE_GAP = 16;
const VIEW_MARGIN = 12;
// Le portrait du tavernier dépasse du haut de la bulle : la bulle reste assez bas pour le montrer.
const PORTRAIT_OVERHANG = 82;
const PORTRAIT_PATH = 'assets/tutorial/tavernier.webp';

/** Valeurs du jeu insérées dans les textes ({nom}). */
const TEXT_VALUES = {
  maxFighters: () => MAX_TEAM_FIGHTERS,
  winPoints: () => LEAGUE_RULES.points.win,
  lossWithRoundPoints: () => LEAGUE_RULES.points.lossWithRound,
};

let host = null;
let active = null;

/** Le gestionnaire d'écrans (main.js) : le tutoriel y lit l'écran courant et s'y déplace. */
export function installTutorial(screens) {
  host = screens;
}

export function isTutorialActive() {
  return Boolean(active);
}

/** État du tutoriel en cours (tests, outils) : { stepId, index, chapter } ou null. */
export function getTutorialState() {
  if (!active) return null;
  const step = active.steps[active.index];
  return { stepId: step.id, index: active.index, chapter: chapterNumber(step) };
}

/**
 * Lance le tutoriel. onEnd(reason) : 'done' (Terminer), 'skipped' (Passer), 'left' (écran hors
 * du domaine, ex. retour au menu).
 */
export function startTutorial({ steps = TUTORIAL_STEPS, onEnd = null } = {}) {
  stopTutorial();
  active = new TutorialRun(steps, onEnd);
  active.start();
  return active;
}

export function stopTutorial(reason = 'left') {
  if (!active) return;
  const run = active;
  active = null;
  run.destroy(reason);
  // Terminé ou passé : le joueur reprend la main au Centre.
  if ((reason === 'done' || reason === 'skipped') && host && host.currentId !== TUTORIAL_END_SCREEN) host.show(TUTORIAL_END_SCREEN);
}

function chapterNumber(step) {
  return TUTORIAL_CHAPTERS.findIndex((chapter) => chapter.id === step.chapter) + 1;
}

/**
 * Texte d'une bulle : valeurs du jeu insérées, traduit, puis espaces insécables autour des
 * guillemets et avant « : ; ! ? » (une consigne « Cliquez sur « + ». » ne se coupe pas).
 */
function fillText(text) {
  const filled = translateText(text.replace(/\{(\w+)\}/g, (all, key) => (TEXT_VALUES[key] ? String(TEXT_VALUES[key]()) : all)));
  return filled.replace(/« /g, '« ').replace(/ (»|:|;|!|\?)/g, ' $1');
}

/** Visible à l'écran : présent, non masqué, de taille non nulle. */
function visibleRect(el) {
  if (!el || !el.isConnected || el.closest('[hidden]')) return null;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function union(rects) {
  const list = rects.filter(Boolean);
  if (!list.length) return null;
  const left = Math.min(...list.map((r) => r.left));
  const top = Math.min(...list.map((r) => r.top));
  const right = Math.max(...list.map((r) => r.right));
  const bottom = Math.max(...list.map((r) => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function clipToViewport(rect) {
  if (!rect) return null;
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(window.innerWidth, rect.right);
  const bottom = Math.min(window.innerHeight, rect.bottom);
  if (right - left < 4 || bottom - top < 4) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

class TutorialRun {
  constructor(steps, onEnd) {
    this.steps = steps;
    this.onEnd = onEnd;
    this.index = 0;
    this.cleanups = [];
  }

  start() {
    this.veils = ['top', 'right', 'bottom', 'left'].map((side) => h('div', { class: `tutorial-veil is-${side}` }));
    this.guard = h('div', { class: 'tutorial-guard' });
    this.ring = h('div', { class: 'tutorial-ring', hidden: true });
    this.bubble = h('aside', { class: 'tutorial-bubble', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tutoriel' });
    this.layer = h('div', { class: 'tutorial-layer' }, ...this.veils, this.guard, this.ring, this.bubble);
    document.body.append(this.layer);
    document.body.classList.add('has-tutorial');

    // Clics : seuls la bulle et la zone d'une étape « à cliquer » passent (voiles et garde
    // arrêtent le reste) ; sur une carte, seul le lieu demandé est accepté.
    this.on(window, 'click', (event) => this.filterClick(event), true);
    this.on(window, 'mousedown', (event) => this.filterPointer(event), true);
    // Clavier : réservé à la bulle (Échap, Entrée… ne doivent pas agir sur le jeu dessous).
    this.on(window, 'keydown', (event) => {
      if (this.bubble.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    const frame = () => {
      this.update();
      this.frameId = requestAnimationFrame(frame);
    };
    this.enter(0);
    this.frameId = requestAnimationFrame(frame);
  }

  on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  destroy(reason) {
    cancelAnimationFrame(this.frameId);
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.layer.remove();
    document.body.classList.remove('has-tutorial');
    this.onEnd?.(reason);
  }

  get step() {
    return this.steps[this.index];
  }

  get screen() {
    return host?.current ?? null;
  }

  /** Affiche la bulle de l'étape `index` (et se rend sur son écran au besoin). */
  enter(index) {
    this.index = index;
    this.scrolled = false;
    this.lastRect = undefined;
    const step = this.step;
    if (step.screen && host && host.currentId !== step.screen) host.show(step.screen);
    this.renderBubble();
  }

  next() {
    if (this.index >= this.steps.length - 1) {
      stopTutorial('done');
      return;
    }
    this.enter(this.index + 1);
  }

  renderBubble() {
    const step = this.step;
    const number = chapterNumber(step);
    const chapter = TUTORIAL_CHAPTERS[number - 1];
    const inChapter = this.steps.filter((s) => s.chapter === step.chapter);
    const last = this.index === this.steps.length - 1;
    const paragraphs = (lines) => (lines ?? []).map((line) => h('p', { class: 'tutorial-text' }, fillText(line)));
    const footer = h(
      'div',
      { class: 'tutorial-footer' },
      h('button', { type: 'button', class: 'tutorial-skip', onclick: () => stopTutorial('skipped') }, 'Passer le tutoriel'),
      h('span', { class: 'tutorial-dots', 'aria-hidden': 'true' },
        inChapter.map((s) => h('span', { class: `tutorial-dot ${s === step ? 'is-current' : ''}`.trim() }))),
      step.advance === 'next'
        ? h('button', { type: 'button', class: `btn btn-sm ${last ? 'btn-primary tutorial-finish' : 'tutorial-next'}`, onclick: () => this.next() },
          last ? 'Terminer ✓' : 'Suivant ▸')
        : null,
    );
    this.bubble.replaceChildren(
      h('img', { class: 'tutorial-portrait', src: assetUrl(PORTRAIT_PATH), alt: 'Le tavernier', width: 230, height: 259 }),
      h(
        'div',
        { class: 'tutorial-body' },
        h('p', { class: 'tutorial-chapter' }, h('span', { class: 'tutorial-chapter-number' }, `(${number}/${TUTORIAL_CHAPTERS.length})`), ' ', chapter.title),
        ...paragraphs(step.text),
        step.list ? this.renderList(step.list) : null,
        ...paragraphs(step.after),
        step.action ? h('p', { class: 'tutorial-action' }, h('span', { 'aria-hidden': 'true' }, '👉 '), fillText(step.action)) : null,
        footer,
      ),
    );
    this.bubble.dataset.step = step.id;
    this.bubble.classList.toggle('is-waiting', step.advance !== 'next');
    // Le bouton de la bulle prend le focus (Entrée = Suivant).
    requestAnimationFrame(() => this.bubble.querySelector('.tutorial-next, .tutorial-finish')?.focus({ preventScroll: true }));
  }

  /** Contenu tiré des données : rôles des spécialités, lieux du Centre par pôle. */
  renderList(kind) {
    if (kind === 'specialties') {
      return h('ul', { class: 'tutorial-list' }, SPECIALTY_IDS.map((id) => {
        const specialty = SPECIALTIES[id];
        return h('li', { style: { '--spec-color': specialty.color } },
          h('span', { class: 'tutorial-list-icon', 'aria-hidden': 'true' }, specialty.icon),
          h('strong', {}, specialty.name), ' — ', specialty.shortDescription);
      }));
    }
    if (kind === 'activities') {
      const gain = (activity) => {
        const { reward } = activity;
        if (reward?.type === 'resource') return 'Deniers';
        if (reward?.type === 'stat' && reward.stat === 'fatigue') return 'Repos';
        return reward?.type === 'stat' ? getStatDefinition(reward.stat)?.label ?? null : null;
      };
      const groups = [];
      for (const activity of ACTIVITIES) {
        const key = activity.group ?? activity.id;
        let group = groups.find((g) => g.key === key);
        if (!group) groups.push(group = { key, title: activity.group ?? null, items: [] });
        group.items.push(activity);
      }
      return h('ul', { class: 'tutorial-list' }, groups.map((group) => h(
        'li',
        {},
        group.title ? h('strong', {}, group.title) : null,
        group.title ? ' : ' : null,
        group.items.map((activity, i) => [
          i ? ' · ' : null,
          h('span', { class: 'tutorial-list-icon', 'aria-hidden': 'true' }, activity.icon),
          group.title ? activity.name : h('strong', {}, activity.name),
          gain(activity) ? h('span', { class: 'tutorial-gain' }, ` (${gain(activity)})`) : null,
        ]),
      )));
    }
    return null;
  }

  // --- Zone mise en lumière ---

  /** Éléments de la zone (étapes à sélecteur), pour le défilement et le test des clics. */
  targetElements() {
    const { target } = this.step;
    if (!target) return [];
    if (typeof target === 'string') {
      const el = [...document.querySelectorAll(target)].find((node) => visibleRect(node));
      return el ? [el] : [];
    }
    if (target.selectorAll) return [...document.querySelectorAll(target.selectorAll)].filter((node) => visibleRect(node));
    if (target.activity) return this.screen?.canvas ? [this.screen.canvas] : [];
    return [];
  }

  /** Rectangle d'un lieu du Centre, d'après sa zone sur la carte et la caméra du moment. */
  activityRect(activityId) {
    const screen = this.screen;
    const activity = ACTIVITIES.find((a) => a.id === activityId);
    const canvasRect = visibleRect(screen?.canvas);
    if (!activity?.area || !canvasRect || !screen.renderer?.toScreen) return null;
    const { x, y, w, h: ah } = activity.area;
    const corners = [[x, y], [x + w, y], [x, y + ah], [x + w, y + ah]].map(([gx, gy]) => screen.renderer.toScreen(gx, gy));
    const xs = corners.map((p) => canvasRect.left + p.x);
    const ys = corners.map((p) => canvasRect.top + p.y);
    // Un peu de marge au-dessus : décors (cordes, poteaux) et étiquette du lieu.
    const lift = (Math.max(...xs) - Math.min(...xs)) * 0.18;
    const rect = { left: Math.min(...xs), top: Math.min(...ys) - lift, right: Math.max(...xs), bottom: Math.max(...ys) };
    return union([{ ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top }]);
  }

  targetRect() {
    if (this.watching) return union([visibleRect(document.querySelector(this.watching.target))]);
    const { target } = this.step;
    if (!target) return null;
    if (target.activity) return this.activityRect(target.activity);
    return union(this.targetElements().map((el) => visibleRect(el)));
  }

  /** Clic dans la zone (et sur le bon lieu de la carte) ? */
  acceptsClick(event) {
    const step = this.step;
    if (this.watching) return false;
    if (step.advance === 'next' || !step.target) return false;
    if (step.target.activity) {
      const screen = this.screen;
      if (event.target !== screen?.canvas || !screen.renderer?.pickTile) return false;
      const tile = screen.renderer.pickTile(event.clientX, event.clientY);
      const zone = tile ? screen.scene?.zoneAt?.(tile.x, tile.y) : null;
      return zone?.activity?.id === step.target.activity;
    }
    return this.targetElements().some((el) => el.contains(event.target));
  }

  filterPointer(event) {
    if (this.bubble.contains(event.target) || this.acceptsClick(event)) return;
    // Sur une carte, mousedown ne fait rien d'important, mais on ne laisse rien passer.
    if (!this.layer.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  filterClick(event) {
    if (this.bubble.contains(event.target)) return;
    if (!this.acceptsClick(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Étape « à cliquer » : le clic agit sur le jeu, puis l'étape suivante s'affiche.
    if (this.step.advance === 'click') {
      const index = this.index;
      const { watch } = this.step;
      if (watch) {
        // On regarde le résultat du clic (bulle effacée, rien de cliquable), puis on continue.
        this.watching = watch;
        this.bubble.hidden = true;
        this.lastRect = undefined;
      }
      setTimeout(() => {
        if (active !== this || this.index !== index) return;
        this.watching = null;
        this.bubble.hidden = false;
        this.next();
      }, watch?.ms ?? 0);
    }
  }

  /** Chaque image : écran toujours dans le domaine, étape « select » accomplie, zone suivie. */
  update() {
    const screen = this.screen;
    if (screen && !('hubLocationId' in screen.constructor)) {
      stopTutorial('left');
      return;
    }
    const step = this.step;
    if (step.advance === 'select' && screen?.selectedActivityId === step.target.activity) {
      this.next();
      return;
    }
    // Le lieu doit rester sélectionné pour que ses boutons [+] [⚙] restent affichés.
    if (step.select && screen?.selectActivity && screen.selectedActivityId !== step.select) screen.selectActivity(step.select);

    if (!this.scrolled && step.target && !step.target.activity) {
      const [first] = this.targetElements();
      if (first) {
        this.scrolled = true;
        const rect = first.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) first.scrollIntoView({ block: 'center' });
      }
    }
    this.place(clipToViewport(this.targetRect()));
  }

  /** Voiles autour du trou, anneau, garde (zone non cliquable) et bulle. */
  place(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // La bulle change de taille quand sa traduction s'applique : elle compte aussi.
    const size = `${vw},${vh},${this.bubble.offsetWidth},${this.bubble.offsetHeight}`;
    const key = rect ? `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.right)},${Math.round(rect.bottom)},${size}` : `none,${size}`;
    const waiting = this.step.advance !== 'next' && !this.watching;
    if (key === this.lastRect && waiting === this.lastWaiting) return;
    this.lastRect = key;
    this.lastWaiting = waiting;

    const hole = rect
      ? {
        left: Math.max(0, rect.left - HOLE_PADDING),
        top: Math.max(0, rect.top - HOLE_PADDING),
        right: Math.min(vw, rect.right + HOLE_PADDING),
        bottom: Math.min(vh, rect.bottom + HOLE_PADDING),
      }
      : null;
    // Pixels entiers : sans quoi une fine ligne apparaît à la jonction des voiles floutés.
    const box = (el, left, top, width, height) => Object.assign(el.style, {
      left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, width: `${Math.max(0, Math.round(left + width) - Math.round(left))}px`, height: `${Math.max(0, Math.round(top + height) - Math.round(top))}px`,
    });
    const [top, right, bottom, left] = this.veils;
    if (!hole) {
      box(top, 0, 0, vw, vh);
      [right, bottom, left].forEach((el) => box(el, 0, 0, 0, 0));
      box(this.guard, 0, 0, 0, 0);
      this.ring.hidden = true;
    } else {
      box(top, 0, 0, vw, hole.top);
      box(bottom, 0, hole.bottom, vw, vh - hole.bottom);
      box(left, 0, hole.top, hole.left, hole.bottom - hole.top);
      box(right, hole.right, hole.top, vw - hole.right, hole.bottom - hole.top);
      // Étape « Suivant » : la zone est montrée, pas cliquable.
      if (waiting) box(this.guard, 0, 0, 0, 0);
      else box(this.guard, hole.left, hole.top, hole.right - hole.left, hole.bottom - hole.top);
      box(this.ring, hole.left, hole.top, hole.right - hole.left, hole.bottom - hole.top);
      this.ring.hidden = false;
      this.ring.classList.toggle('is-click', waiting);
    }
    this.placeBubble(hole);
  }

  placeBubble(hole) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = this.bubble.offsetWidth;
    const bh = this.bubble.offsetHeight;
    const clampX = (x) => Math.min(Math.max(VIEW_MARGIN, x), vw - bw - VIEW_MARGIN);
    const clampY = (y) => Math.min(Math.max(PORTRAIT_OVERHANG, y), vh - bh - VIEW_MARGIN);
    let x = (vw - bw) / 2;
    let y = (vh - bh) / 2;
    if (hole) {
      const midY = (hole.top + hole.bottom) / 2 - bh / 2;
      const midX = (hole.left + hole.right) / 2 - bw / 2;
      if (vw - hole.right >= bw + BUBBLE_GAP + VIEW_MARGIN) { x = hole.right + BUBBLE_GAP; y = midY; }
      else if (hole.left >= bw + BUBBLE_GAP + VIEW_MARGIN) { x = hole.left - BUBBLE_GAP - bw; y = midY; }
      else if (vh - hole.bottom >= bh + BUBBLE_GAP + VIEW_MARGIN) { x = midX; y = hole.bottom + BUBBLE_GAP; }
      else if (hole.top >= bh + BUBBLE_GAP + PORTRAIT_OVERHANG) { x = midX; y = hole.top - BUBBLE_GAP - bh; }
      else { x = midX; y = vh - bh - VIEW_MARGIN; }
    }
    this.bubble.style.left = `${clampX(x)}px`;
    this.bubble.style.top = `${clampY(y)}px`;
  }
}
