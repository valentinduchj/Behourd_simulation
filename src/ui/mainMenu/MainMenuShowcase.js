import { h } from '../../utils/dom.js';
import { MAIN_MENU_VIDEOS, SHOWCASE_TIMING } from '../../data/mainMenuShowcase.js';
import { assetUrl } from '../../utils/assets.js';
import { listSequences, pickNextSequence, fadeOpacity } from './showcaseRotation.js';
import { createShowcaseScene } from './showcaseScenes.js';

// Lecteur des séquences de l'écran principal (« vitrine »), de chaque côté du menu.
//
//   noir → fondu entrant → séquence (3 à 6 s) → fondu sortant → noir → séquence suivante…
//
// Une seule séquence par côté existe à la fois : elle est créée à son tour (chargement à la
// demande) puis détruite (canvas retiré, vidéo vidée). Une séquence qui échoue (fichier vidéo
// absent ou illisible, scène en erreur) est écartée pour la suite. Le menu ne dépend jamais
// de la vitrine : démarrage différé, aucune attente, tout est arrêté et libéré à la sortie.

export class MainMenuShowcase {
  /**
   * panels : { left: HTMLElement, right: HTMLElement } — zones d'affichage (vides).
   * options : { videos, timing, rng, vfxSetting, now }
   */
  constructor(panels, { videos = MAIN_MENU_VIDEOS, timing = SHOWCASE_TIMING, rng = Math.random, vfxSetting = 'full', now = () => performance.now() / 1000 } = {}) {
    this.timing = timing;
    this.videos = videos;
    this.rng = rng;
    this.vfxSetting = vfxSetting;
    this.now = now;
    this.failed = new Set();
    this.counter = 0;
    this.running = false;
    this.sides = Object.entries(panels).filter(([, el]) => el).map(([side, el]) => ({
      side, el, current: null, previous: null, nextAt: 0,
    }));
    this.onResize = () => this.sides.forEach((s) => s.current?.scene?.resize?.());
  }

  /** Démarre la rotation (après `startDelayMs`, le menu étant déjà affiché). */
  start() {
    if (this.running) return;
    this.running = true;
    window.addEventListener('resize', this.onResize);
    this.startTimer = setTimeout(() => {
      const t = this.now();
      this.sides.forEach((s) => { s.nextAt = t + (s.side === 'right' ? this.timing.rightOffset : 0); });
      // Cadence fixe : 30 images/s suffisent en arrière-plan (ralentie d'office dans un onglet caché).
      const loop = () => {
        if (!this.running) return;
        this.tick(this.now());
        this.frameId = setTimeout(loop, 1000 / this.timing.fps);
      };
      loop();
    }, this.timing.startDelayMs);
  }

  /** Arrête tout et libère les séquences en cours (sortie de l'écran principal). */
  stop() {
    this.running = false;
    clearTimeout(this.startTimer);
    clearTimeout(this.frameId);
    this.frameId = null;
    window.removeEventListener('resize', this.onResize);
    for (const side of this.sides) this.release(side);
  }

  /** Une image : changement de séquence si besoin, puis dessin et fondu de chaque côté. */
  tick(time) {
    for (const side of this.sides) {
      // Zone masquée (écran étroit) : rien n'est créé ni dessiné.
      if (!side.el.isConnected || side.el.offsetWidth === 0) {
        if (side.current) this.release(side);
        continue;
      }
      const current = side.current;
      if (current && time - current.start >= current.sequence.duration) {
        this.release(side);
        side.nextAt = time + this.timing.blackGap;
      }
      if (!side.current && time >= side.nextAt) this.begin(side, time);
      const active = side.current;
      if (!active) continue;
      const age = time - active.start;
      active.el.style.opacity = (fadeOpacity(age, active.sequence.duration, this.timing) * (this.timing.maxOpacity ?? 1)).toFixed(3);
      if (active.scene) {
        try {
          active.scene.frame(time);
        } catch (error) {
          console.warn(`Vitrine : séquence « ${active.sequence.id} » interrompue.`, error);
          this.fail(side, active.sequence);
        }
      }
    }
  }

  /** Lance la séquence suivante d'un côté (tirage, création à la demande). */
  begin(side, time) {
    const others = this.sides.filter((s) => s !== side && s.current).map((s) => s.current.sequence.id);
    const sequence = pickNextSequence(listSequences(side.side, { videos: this.videos, failed: this.failed }), {
      previous: side.previous, avoidIds: others, rng: this.rng,
    });
    if (!sequence) return;
    side.previous = sequence;
    this.counter += 1;
    const active = { sequence, start: time, el: null, scene: null, video: null };
    side.current = active;
    try {
      if (sequence.source?.type === 'video') this.mountVideo(side, active);
      else this.mountScene(side, active);
    } catch (error) {
      console.warn(`Vitrine : séquence « ${sequence.id} » indisponible.`, error);
      this.fail(side, sequence);
    }
  }

  mountScene(side, active) {
    const { sequence } = active;
    const canvas = h('canvas', { class: 'menu-showcase-media', 'data-sequence': sequence.id, 'data-category': sequence.category, 'aria-hidden': 'true' });
    canvas.style.opacity = '0';
    side.el.append(canvas);
    active.el = canvas;
    active.scene = createShowcaseScene(sequence.source.scene, canvas, sequence.source.options, {
      seed: `${sequence.id}:${this.counter}`, duration: sequence.duration, vfxSetting: this.vfxSetting,
    });
  }

  mountVideo(side, active) {
    const { sequence } = active;
    const video = h('video', {
      class: 'menu-showcase-media', 'data-sequence': sequence.id, 'data-category': sequence.category, 'aria-hidden': 'true',
      muted: true, playsinline: true, preload: 'auto', disablepictureinpicture: true,
    });
    video.muted = true;
    video.style.opacity = '0';
    // Fichier absent ou illisible : séquence écartée, la suivante enchaîne.
    video.addEventListener('error', () => { if (side.current === active) this.fail(side, sequence); });
    video.src = assetUrl(sequence.source.path);
    side.el.append(video);
    active.el = video;
    active.video = video;
    video.play?.()?.catch?.(() => {});
  }

  /** Séquence en échec : écartée pour la suite de la visite, le côté passe à la suivante. */
  fail(side, sequence) {
    this.failed.add(sequence.id);
    this.release(side);
    side.nextAt = this.now();
  }

  /** Détruit la séquence en cours d'un côté (libère canvas et vidéo). */
  release(side) {
    const active = side.current;
    if (!active) return;
    side.current = null;
    try { active.scene?.dispose?.(); } catch { /* rien à libérer de plus */ }
    if (active.video) {
      active.video.pause();
      active.video.removeAttribute('src');
      active.video.load();
    }
    active.el?.remove();
  }

  /** Séquence affichée de chaque côté : { left: id | null, right: id | null }. */
  get currentIds() {
    return Object.fromEntries(this.sides.map((s) => [s.side, s.current?.sequence.id ?? null]));
  }
}
