import { COMBAT_PLAYBACK } from '../../data/combatRules.js';

// Rejeu animé d'une manche simulée (CombatManager) — présentation seulement.
// Le moteur produit des événements (« A attaque B », « B est KO ») ; ce gestionnaire
// d'animation en déduit, à chaque instant, la position, les PV et l'ÉTAT D'ANIMATION de
// chaque combattant, sans jamais recalculer le combat :
//
//   idle · moving · attacking · taking_damage · ko · victory
//
// Chaque état correspond à une animation de sprite (ANIMATION_BY_STATE, data/sprites.js) :
// tant qu'elle n'existe pas, le sprite « idle » est affiché.
//
// Un tour (tick) se déroule en deux temps : déplacements (première moitié), attaques (seconde).
// Un combattant qui ne frappe pas pendant ce tour marche sur tout le tour (pas plus fluide).
// Un combattant KO s'efface (COMBAT_PLAYBACK.koFadeSeconds) puis disparaît de la lice :
// `ko` reste vrai (résultats, décompte), `hidden` indique qu'il n'est plus dessiné.

export const ANIMATION_BY_STATE = Object.freeze({
  idle: 'idle', moving: 'walk', attacking: 'attack', taking_damage: 'hit', ko: 'death', victory: 'victory',
});

// Durée d'affichage d'un dégât flottant (courte : les mêlées en enchaînent beaucoup).
const EFFECT_SECONDS = 0.55;

export class CombatPlayback {
  constructor(simulation, { tickSeconds = COMBAT_PLAYBACK.tickSeconds, introSeconds = COMBAT_PLAYBACK.introSeconds, koFadeSeconds = COMBAT_PLAYBACK.koFadeSeconds } = {}) {
    this.simulation = simulation;
    this.tickSeconds = tickSeconds;
    this.koFadeSeconds = koFadeSeconds;
    // Introduction : bonus de chaque combattant affichés avant le premier tour.
    this.introSeconds = introSeconds;
    this.startBonuses = simulation.startBonuses ?? {};
    this.ticks = simulation.ticks;
    const ids = simulation.initial.map((unit) => unit.id);

    // Positions et PV à la fin de chaque tour (index 0 = départ).
    this.positions = [new Map(simulation.initial.map((u) => [u.id, { x: u.x, y: u.y }]))];
    this.hp = [new Map(simulation.initial.map((u) => [u.id, u.hp]))];
    this.byTick = Array.from({ length: this.ticks + 1 }, () => ({ moves: [], attacks: [], kos: [] }));
    for (const event of simulation.events) {
      const bucket = this.byTick[event.tick];
      if (!bucket) continue;
      if (event.type === 'move') bucket.moves.push(event);
      else if (event.type === 'attack') bucket.attacks.push(event);
      else if (event.type === 'ko') bucket.kos.push(event);
    }
    this.koTick = new Map();
    this.koTime = new Map();
    for (let tick = 1; tick <= this.ticks; tick++) {
      const pos = new Map(this.positions[tick - 1]);
      for (const move of this.byTick[tick].moves) pos.set(move.unitId, { ...move.to });
      const hp = new Map(this.hp[tick - 1]);
      for (const attack of this.byTick[tick].attacks) hp.set(attack.targetId, attack.hpAfter);
      for (const ko of this.byTick[tick].kos) this.koTick.set(ko.unitId, tick);
      // Instant du KO (rejeu, sans l'introduction) : début de la tranche du coup décisif.
      const attacks = this.byTick[tick].attacks;
      attacks.forEach((attack, i) => {
        if (attack.hpAfter <= 0) this.koTime.set(attack.targetId, (tick - 1 + 0.5 + (0.5 * i) / attacks.length) * this.tickSeconds);
      });
      this.positions.push(pos);
      this.hp.push(hp);
    }
    this.ids = ids;
    this.sideOf = new Map(simulation.initial.map((u) => [u.id, u.side]));
    this.maxHp = new Map(simulation.initial.map((u) => [u.id, u.maxHp]));

    // Fatigue à la fin de chaque tour (v0.66 ; index 0 = départ), d'après les événements 'fatigue'
    // (valeurs dans l'ordre de `initial`). Une manche d'avant la v0.66 garde sa fatigue de départ.
    this.fatigue = [new Map(simulation.initial.map((u) => [u.id, u.fatigue ?? 0]))];
    const rows = new Map(simulation.events.filter((e) => e.type === 'fatigue').map((e) => [e.tick, e.values]));
    for (let tick = 1; tick <= this.ticks; tick++) {
      const row = rows.get(tick);
      this.fatigue.push(row ? new Map(ids.map((id, i) => [id, row[i]])) : new Map(this.fatigue[tick - 1]));
    }
    // Temps morts [{ start, until }] (tours) et souffles de chacun (tours où il se ménage).
    this.lulls = simulation.events.filter((e) => e.type === 'lull').map((e) => ({ start: e.tick, until: e.until }));
    this.breaths = new Map(ids.map((id) => [id, []]));
    const open = new Map();
    for (const event of simulation.events) {
      if (event.type !== 'ai') continue;
      if (open.has(event.unitId)) {
        this.breaths.get(event.unitId).push({ start: open.get(event.unitId), until: event.tick - 1 });
        open.delete(event.unitId);
      }
      if (event.state === 'BREATHE') open.set(event.unitId, event.tick);
    }
    for (const [id, start] of open) this.breaths.get(id).push({ start, until: this.ticks });
  }

  /** Temps mort en cours à ce tour ? */
  lullAt(tick) {
    return this.lulls.some((l) => tick >= l.start && tick <= l.until);
  }

  /** Ce combattant souffle-t-il (souffle individuel ou temps mort) à ce tour ? */
  isResting(id, tick) {
    return this.lullAt(tick) || (this.breaths.get(id) ?? []).some((b) => tick >= b.start && tick <= b.until);
  }

  /** Durée totale du rejeu (secondes, à vitesse 1), introduction comprise. */
  get duration() {
    return this.introSeconds + (this.ticks + 1) * this.tickSeconds;
  }

  /** Bonus d'un combattant au lancement de la manche (identifiants). */
  bonusesOf(id) {
    return this.startBonuses[id] ?? [];
  }

  /**
   * État à l'instant `time` : { tick, intro, finished, lull, units: [{ id, x, y, hp, maxHp, ko,
   * fatigue, resting, state, animation, lunge, bonuses }], effects: [{ x, y, text, age, kind }] }.
   * Pendant l'introduction (intro = true), les combattants attendent à leur place et leurs
   * bonus sont affichés.
   */
  frameAt(time) {
    if (time < this.introSeconds) {
      const start = this.positions[0];
      return {
        tick: 0,
        intro: true,
        finished: false,
        units: this.ids.map((id) => ({
          id, ...start.get(id), hp: this.hp[0].get(id), maxHp: this.maxHp.get(id), ko: false, fatigue: this.fatigue[0].get(id),
          state: 'idle', animation: ANIMATION_BY_STATE.idle, lunge: { dx: 0, dy: 0 }, bonuses: this.bonusesOf(id),
        })),
        effects: [],
        lull: false,
      };
    }
    time -= this.introSeconds;
    if (this.ticks === 0) {
      // Manche sans tour (camp vide) : tout est déjà joué.
      const start = this.positions[0];
      return {
        tick: 0, intro: false, finished: true, effects: [], lull: false,
        units: this.ids.map((id) => ({ id, ...start.get(id), hp: this.hp[0].get(id), maxHp: this.maxHp.get(id), ko: false, fatigue: this.fatigue[0].get(id), state: this.sideOf.get(id) === this.simulation.winnerSide ? 'victory' : 'idle', animation: 'idle', lunge: { dx: 0, dy: 0 } })),
      };
    }
    const t = Math.max(0, time) / this.tickSeconds;
    const finished = t >= this.ticks + 0.999;
    const tick = Math.min(this.ticks, Math.floor(t) + 1);
    const phase = finished ? 1 : t - Math.floor(t);
    const from = this.positions[tick - 1];
    const to = this.positions[tick];
    const bucket = this.byTick[tick];
    // Seconde moitié du tour : les attaques s'enchaînent dans l'ordre (endurance décroissante),
    // chacune dans sa propre tranche de temps ; ses dégâts s'appliquent au début de sa tranche.
    const attackCount = bucket.attacks.length;
    const inAttacks = phase >= 0.5 && !finished;
    const slotFloat = finished ? attackCount : phase >= 0.5 ? ((phase - 0.5) / 0.5) * attackCount : -1;
    const currentSlot = Math.min(attackCount - 1, Math.floor(slotFloat));
    const slotProgress = slotFloat - Math.floor(slotFloat);
    const applied = finished ? attackCount : currentSlot + 1;
    const hpNow = new Map(this.hp[tick - 1]);
    for (const attack of bucket.attacks.slice(0, Math.max(0, applied))) hpNow.set(attack.targetId, attack.hpAfter);
    const knockedNow = new Set(bucket.attacks.slice(0, Math.max(0, applied)).filter((a) => a.hpAfter <= 0).map((a) => a.targetId));
    const activeAttack = inAttacks && currentSlot >= 0 ? bucket.attacks[currentSlot] : null;
    const attackers = new Set(bucket.attacks.map((attack) => attack.unitId));
    const now = Math.max(0, time);

    const units = this.ids.map((id) => {
      const a = from.get(id);
      const b = to.get(id);
      const koAt = this.koTick.get(id);
      const ko = koAt !== undefined && (koAt < tick || (koAt === tick && (finished || knockedNow.has(id))));
      // Marche : première moitié du tour s'il frappe ensuite, tout le tour sinon.
      const moves = bucket.moves.some((m) => m.unitId === id);
      const walk = attackers.has(id) ? phase * 2 : phase;
      const moveProgress = finished ? 1 : Math.min(1, walk);
      // KO : s'efface puis disparaît.
      const koAge = ko ? (finished ? Infinity : now - (this.koTime.get(id) ?? now)) : 0;
      const koFade = ko ? Math.max(0, 1 - koAge / this.koFadeSeconds) : 1;
      let state = 'idle';
      let lunge = { dx: 0, dy: 0 };
      if (ko) state = 'ko';
      else if (finished && this.sideOf.get(id) === this.simulation.winnerSide) state = 'victory';
      else if (moves && moveProgress < 1) state = 'moving';
      else if (activeAttack?.unitId === id) {
        state = 'attacking';
        const target = to.get(activeAttack.targetId);
        const strength = Math.sin(slotProgress * Math.PI) * 0.22;
        lunge = { dx: (target.x - b.x) * strength, dy: (target.y - b.y) * strength };
      } else if (activeAttack?.targetId === id) state = 'taking_damage';
      return {
        id,
        x: a.x + (b.x - a.x) * moveProgress,
        y: a.y + (b.y - a.y) * moveProgress,
        hp: hpNow.get(id),
        maxHp: this.maxHp.get(id),
        ko,
        koFade,
        hidden: ko && koFade <= 0,
        // Fatigue du moment : glisse de la fin du tour précédent à la fin de ce tour.
        fatigue: (this.fatigue[tick - 1].get(id) ?? 0) + ((this.fatigue[tick].get(id) ?? 0) - (this.fatigue[tick - 1].get(id) ?? 0)) * Math.min(1, phase),
        resting: !ko && this.isResting(id, tick),
        state,
        animation: ANIMATION_BY_STATE[state],
        lunge,
      };
    });

    // Dégâts flottants (et KO) des attaques récentes, chacune au début de sa tranche.
    const effects = [];
    for (let k = Math.max(1, tick - 2); k <= tick; k++) {
      const attacks = this.byTick[k].attacks;
      attacks.forEach((attack, i) => {
        const start = (k - 1 + 0.5 + (0.5 * i) / attacks.length) * this.tickSeconds;
        const age = now - start;
        if (age < 0 || age > EFFECT_SECONDS) return;
        const p = this.positions[k].get(attack.targetId);
        if (attack.detail?.dodged) effects.push({ x: p.x, y: p.y, text: 'Esquive !', age: age / EFFECT_SECONDS, kind: 'dodge' });
        else effects.push({ x: p.x, y: p.y, text: `−${attack.damage}`, age: age / EFFECT_SECONDS, kind: attack.detail.highlight ? 'advantage' : 'normal' });
        // Druide de Brocéliande : soin juste après le coup (PV déjà remontés dans hpAfter).
        if (attack.detail?.heal) effects.push({ x: p.x, y: p.y, text: `+${attack.detail.heal.amount} PV`, age: Math.max(0, age / EFFECT_SECONDS - 0.15), kind: 'heal' });
        if (attack.hpAfter <= 0) effects.push({ x: p.x, y: p.y, text: 'KO', age: age / EFFECT_SECONDS, kind: 'ko' });
      });
    }
    return { tick, intro: false, finished, units, effects, lull: !finished && this.lullAt(tick) };
  }
}
