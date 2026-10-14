import { createRng } from '../utils/random.js';

// La Professeure Flavia dans son cabinet — présentation seulement, aucune règle de jeu.
//
// Elle lit derrière sa table de travail, puis en sort pour l'une de ses deux habitudes, en
// alternance : caresser son chat (qui l'attend assis et ronronne), ou aller au rayonnage sortir
// un livre bleu et le lire 4 secondes sur le tapis vert. Parfois elle flâne un peu avant de
// rentrer. Elle contourne sa table, ne quitte jamais son cabinet et revient toujours à sa table.
// L'état avance avec le temps des images affichées (update(dt)) : rien hors du Scriptorium.
//
// États : 'desk' (lecture, derrière la table), 'walk', 'stroll' (pause, regard), 'take' (sort le
// livre du rayon), 'read' (lit le livre bleu), 'pet' (caresse le chat).

const WALK_SPEED = 0.6;
// Le livre bleu : le temps de le trouver et de le sortir du rayon, puis de le lire.
export const TAKE_SECONDS = 2.2;
export const READ_SECONDS = 4;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

/** Le segment [a, b] traverse-t-il le rectangle `r` (élargi de `pad`) ? */
function crosses(a, b, r, pad = 0.2) {
  const box = { x0: r.x - pad, y0: r.y - pad, x1: r.x + r.w + pad, y1: r.y + r.h + pad };
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1) return true;
  }
  return false;
}

export class FlaviaAmbience {
  /** flavia : data/scriptoriumLayout.js › flavia ; cat : CatAmbience (le chat à caresser). */
  constructor(flavia, cat, { seed = 'flavia' } = {}) {
    this.config = flavia;
    this.cat = cat;
    this.rng = createRng(seed);
    this.elapsed = 0;
    this.pos = { ...flavia.stand };
    this.facing = 1;
    this.state = 'desk';
    this.until = 5 + this.rng() * 4;
    this.path = [];
    this.then = null;
    this.outings = 0; // activités depuis qu'elle a quitté sa table
    this.pets = 0;
    this.books = 0;
    this.hasBook = false; // le livre bleu, sorti du rayonnage
    this.nextHabit = 'pet'; // alternance : caresser le chat, puis le livre bleu
    this.stateDuration = this.until;
  }

  #clamp(p) {
    const b = this.config.bounds;
    return { x: Math.max(b.x, Math.min(b.x + b.w, p.x)), y: Math.max(b.y, Math.min(b.y + b.h, p.y)) };
  }

  /** Trajet vers `to` : depuis la table, par la gauche (gap, front) ; la table est contournée par `hub`. */
  #routeTo(to) {
    const { route, table } = this.config;
    const path = [];
    let from = this.pos;
    if (this.state === 'desk' || dist(from, this.config.stand) < 0.3) {
      path.push(route.gap, route.front);
      from = route.front;
    }
    if (crosses(from, to, table)) {
      path.push(route.hub);
      from = route.hub;
    }
    path.push(this.#clamp(to));
    return path.map((p) => ({ ...p }));
  }

  /** Trajet de retour à la table (contourne la table, puis passe derrière par la gauche). */
  #routeHome() {
    const { route, table } = this.config;
    const path = [];
    if (crosses(this.pos, route.front, table)) path.push(route.hub);
    path.push(route.front, route.gap, this.config.stand);
    return path.map((p) => ({ ...p }));
  }

  #go(path, then) {
    this.state = 'walk';
    this.path = path;
    this.then = then;
  }

  #setState(state, duration) {
    this.state = state;
    this.until = this.elapsed + duration;
    this.stateDuration = duration;
  }

  /**
   * Activité suivante. Chaque sortie commence par l'une de ses deux habitudes, en alternance :
   * caresser le chat, puis aller chercher le livre bleu au rayonnage et le lire (si le chat est
   * occupé, elle prend le livre). Ensuite, parfois une courte flânerie, puis retour à sa table.
   */
  #nextActivity() {
    if (this.outings >= 1 + (this.rng() < 0.4 ? 1 : 0)) {
      this.outings = 0;
      this.#go(this.#routeHome(), { state: 'desk', duration: 6 + this.rng() * 5 });
      return;
    }
    this.outings += 1;
    if (this.outings === 1) {
      if (this.nextHabit !== 'book' && this.#tryPet()) {
        this.nextHabit = 'book';
        return;
      }
      this.#fetchBook();
      this.nextHabit = 'pet';
      return;
    }
    const spots = this.config.rugSpots;
    this.#go(this.#routeTo(spots[Math.floor(this.rng() * spots.length)]), { state: 'stroll', duration: 2 + this.rng() * 2.5 });
  }

  /** Le livre bleu : elle va au rayonnage et le sort (geste de recherche), puis ira le lire. */
  #fetchBook() {
    this.#go(this.#routeTo(this.config.shelf.stand), { state: 'take', duration: TAKE_SECONDS });
  }

  /** Le livre en main, elle va le lire sur le tapis vert, READ_SECONDS secondes. */
  #goRead() {
    this.hasBook = true;
    this.books += 1;
    const spots = this.config.rugSpots;
    this.#go(this.#routeTo(spots[Math.floor(this.rng() * spots.length)]), { state: 'read', duration: READ_SECONDS });
  }

  /** Va caresser le chat s'il est tranquille : il l'attend assis ; elle se place à côté de lui. */
  #tryPet() {
    const at = this.cat?.requestPet();
    if (!at) return false;
    const { table } = this.config;
    // À côté du chat À L'ÉCRAN (même profondeur : elle ne le cache pas), du côté libre, jamais
    // dans la table : à sa droite (x + , y −), sinon à sa gauche (x −, y +).
    const inTable = (p) => p.x > table.x - 0.15 && p.x < table.x + table.w + 0.15 && p.y > table.y - 0.15 && p.y < table.y + table.h + 0.15;
    const candidates = [{ x: at.x + 0.38, y: at.y - 0.38 }, { x: at.x - 0.38, y: at.y + 0.38 }, { x: at.x + 0.45, y: at.y }, { x: at.x, y: at.y + 0.45 }]
      .map((p) => this.#clamp(p));
    const spot = candidates.find((p) => !inTable(p) && dist(p, at) > 0.3) ?? candidates[0];
    this.petTarget = at;
    this.#go(this.#routeTo(spot), { state: 'pet', duration: 4 + this.rng() * 3 });
    return true;
  }

  update(dt) {
    const step = Math.max(0, Math.min(dt, 0.25));
    this.elapsed += step;
    // Le chat est parti en chasse pendant qu'elle venait le caresser : elle renonce et flâne.
    if ((this.state === 'pet' || this.then?.state === 'pet') && this.cat && !['await', 'petted'].includes(this.cat.catFrame().state)) {
      this.then = this.state === 'walk' ? { state: 'stroll', duration: 2 } : this.then;
      if (this.state === 'pet') this.#setState('stroll', 1.5);
    }
    if (this.state === 'walk') {
      let left = WALK_SPEED * step;
      while (left > 0 && this.path.length) {
        const next = this.path[0];
        const d = dist(this.pos, next);
        if (Math.abs(next.x - this.pos.x - (next.y - this.pos.y)) > 0.05) this.facing = next.x - this.pos.x - (next.y - this.pos.y) >= 0 ? 1 : -1;
        if (d <= left) {
          this.pos = { ...next };
          this.path.shift();
          left -= d;
        } else {
          this.pos = { x: this.pos.x + ((next.x - this.pos.x) / d) * left, y: this.pos.y + ((next.y - this.pos.y) / d) * left };
          left = 0;
        }
      }
      if (!this.path.length) {
        const then = this.then ?? { state: 'stroll', duration: 2 };
        this.then = null;
        this.#setState(then.state, then.duration);
        if (then.state === 'pet') {
          const cat = this.cat.catFrame();
          this.facing = cat.x - this.pos.x - (cat.y - this.pos.y) >= 0 ? 1 : -1;
          if (this.cat.startPet(this.pos, then.duration)) this.pets += 1;
          else this.#setState('stroll', 1.5);
        }
        if (then.state === 'take') this.facing = this.config.shelf.target.x - this.pos.x - (this.config.shelf.target.y - this.pos.y) >= 0 ? 1 : -1;
        // De retour à sa table, elle y repose le livre.
        if (then.state === 'desk') {
          this.facing = 1;
          this.hasBook = false;
        }
      }
      return;
    }
    if (this.elapsed < this.until) return;
    if (this.state === 'pet') this.cat?.endPet();
    if (this.state === 'take') {
      this.#goRead();
      return;
    }
    this.#nextActivity();
  }

  /**
   * Image de Flavia : { x, y, state, facing, atDesk, hasBook, since } — `since` : secondes
   * écoulées dans l'état en cours (geste de prise du livre).
   */
  frame() {
    return {
      x: this.pos.x, y: this.pos.y, state: this.state, facing: this.facing, atDesk: this.state === 'desk',
      hasBook: this.hasBook, since: this.state === 'walk' ? 0 : this.elapsed - (this.until - (this.stateDuration ?? 0)),
    };
  }
}
