import { computeDamage } from '../CombatDamageCalculator.js';
import { isActive, isInReach } from '../CombatMovementManager.js';
import { effectBonusIds, strikeSituation, withSituation } from '../CombatSituation.js';
import { selectTarget } from './TargetSelectionService.js';
import { talentStrikeModifiers, ignoresFatigue } from '../TalentCombat.js';
import { applyStrikeFatigue } from '../RoundFatigue.js';

// Engagement et attaques d'un tour (règles de dégâts : CombatDamageCalculator ; bonus de
// position : CombatSituation). Chaque combattant debout frappe une fois, dans l'ordre d'endurance :
//   sa cible si elle est à son allonge (2 cases pour le Hastier, le contact pour les autres) ;
//   sinon, s'il ne recule pas, l'adversaire à son allonge le plus intéressant (opportunité) ;
//   un combattant qui recule, qui souffle, ou renversé par un Runner, ne frappe pas.
// Chaque coup fatigue l'attaquant un peu, la cible davantage (RoundFatigue).

/** Le combattant est-il renversé (il perd ses actions jusqu'à ce tour compris) ? */
export const isStunned = (unit, tick) => tick <= (unit.stunnedUntil ?? -1);

export class CombatController {
  /**
   * round : { fighters, byId, arena, rules, rng, events, stats, controllers, setTarget(unit, id, tick) }.
   */
  constructor(round) {
    this.round = round;
  }

  attackPhase(acting, tick, makeContext) {
    const { byId, controllers, rules } = this.round;
    for (const unit of acting) {
      if (!isActive(unit) || isStunned(unit, tick)) continue;
      const controller = controllers.get(unit.id);
      // Il recule ou souffle (il se ménage) : pas de coup ce tour-ci.
      if (controller.isRetreating || controller.isBreathing) continue;
      let target = unit.targetId ? byId.get(unit.targetId) : null;
      if (!target || !isActive(target) || !isInReach(unit, target, rules)) {
        const opportunity = selectTarget(makeContext(unit), controller, { onlyInReach: true });
        if (!opportunity) continue;
        target = opportunity.target;
        controller.setTarget(target.id, tick);
        controller.request('opportunity');
      }
      this.strike(unit, target, tick);
    }
  }

  /** Un coup : dégâts, statistiques, événements, KO éventuel. */
  strike(unit, target, tick) {
    const { fighters, arena, rules, rng, events, stats, controllers } = this.round;
    // Combo : coups consécutifs sur la même cible (remis à zéro au changement de cible).
    if (unit.comboTargetId !== target.id) {
      unit.comboTargetId = target.id;
      unit.comboHits = 0;
    }
    unit.comboHits += 1;
    const attacker = withSituation(unit, fighters, arena, rules);
    const defender = withSituation(target, fighters, arena, rules);
    // Talent Sang-froid : ses pénalités de fatigue commencent plus tard.
    if (unit.fatigueShift) attacker.fatigue = Math.max(0, attacker.fatigue - unit.fatigueShift);
    // Talent Fureur du Nord : blessé, la fatigue ne le pénalise plus.
    const furious = ignoresFatigue(unit, target, fighters);
    if (furious) attacker.fatigue = 0;
    // Position : cible plaquée, Hastier à distance ou gêné, coup dans le dos, angle mort.
    const position = strikeSituation(unit, target, fighters, arena, rules, tick);
    // Talents : bonus de l'attaquant, malus des Tacticiens à son contact, réduction de la cible.
    const talent = talentStrikeModifiers(unit, target, fighters, rules);
    // Bonus de dégâts finaux : position, effets temporaires (ex. Hypocras) et talents, additionnés.
    const finalBonus = position.finalBonus + (unit.finalDamageBonus ?? 0) + talent.bonus;
    // Talent Chanceux : sur son premier coup de la manche, l'aléa est tiré deux fois (le meilleur).
    const lucky = unit.lucky && unit.strikes === 0;
    // Banc d'essai : `damage.fixedRoll` fige l'aléa des dégâts (mesure de la part du hasard) ; null en jeu.
    const fixedRoll = rules.damage.fixedRoll ?? null;
    const detail = computeDamage(attacker, defender, {
      roll: fixedRoll ?? (lucky ? Math.max(rng(), rng()) : rng()),
      comboHits: unit.comboHits + position.comboBoost,
      comboExtra: unit.comboExtra ?? 0,
      // Ordre unique : (1 + bonus additionnés) × (1 − réduction de la cible) × efficacité saisonnière.
      finalMultiplier: Math.max(0, (1 + finalBonus) * (1 - talent.reduction) * (unit.seasonFactor ?? 1)),
    }, rules);
    // Intouchable (Immortel, juste après avoir survécu) : le coup ne lui fait rien.
    const untouchable = tick <= (target.invulnerableUntil ?? -1);
    if (untouchable) detail.damage = 0;
    // Talent Feu follet : il esquive le coup (aucun dégât). Tirage seulement s'il a ce talent.
    const dodged = !untouchable && (target.dodgeChance ?? 0) > 0 && rng() < target.dodgeChance;
    if (dodged) detail.damage = 0;
    // Décomposition du bonus final (journal détaillé de Ma Lice d'entraînement) : les valeurs
    // réellement multipliées ci-dessus, sans aucun recalcul ; aucune influence sur le coup.
    detail.modifiers = {
      position: position.finalBonus, positionIds: [...position.ids], items: unit.finalDamageBonus ?? 0,
      talents: talent.bonus, talentIds: [...talent.ids], reduction: talent.reduction, season: unit.seasonFactor ?? 1,
      untouchable, comboBoost: position.comboBoost ?? 0, situation: [...attacker.situation],
    };
    detail.bonuses = [
      ...(unit.isCaptain ? ['captain'] : []),
      ...attacker.situation,
      ...position.ids,
      ...effectBonusIds(unit),
      ...talent.ids.map((id) => `talent:${id}`),
      // Malus saisonnier de sa classe (« ☀ Chaleur »…), comme les autres modificateurs du coup.
      ...((unit.seasonFactor ?? 1) < 1 ? [`season:${unit.season}`] : []),
      ...(lucky ? unit.talentEffects.filter((e) => e.type === 'luckyRoll').map((e) => `talent:${e.talentId}`) : []),
      ...(furious ? unit.talentEffects.filter((e) => e.type === 'fatigueIgnore').map((e) => `talent:${e.talentId}`) : []),
    ];
    if (dodged) {
      detail.dodged = true;
      detail.dodgeTalentId = target.talentEffects.find((e) => e.type === 'dodgeChance')?.talentId ?? null;
    }
    // Pour la présentation (effets visuels) : coup chanceux, rang du coup dans le combo, coup
    // avantagé par la position (dans le dos, angle mort, à distance).
    detail.lucky = Boolean(lucky);
    detail.comboHits = unit.comboHits;
    detail.highlight = position.finalBonus > 0;
    unit.strikes = (unit.strikes ?? 0) + 1;
    target.hp = Math.max(0, target.hp - detail.damage);
    // Fatigue du coup : frapper fatigue un peu, encaisser beaucoup plus (selon les dégâts).
    applyStrikeFatigue(unit, target, detail.damage, rules);
    // Casques fermés : frappé par un adversaire qu'il ne voyait pas, il le « sent » désormais.
    if (position.blind) {
      if (!target.perceived) target.perceived = new Map();
      target.perceived.set(unit.id, tick + rules.vision.memoryTicks);
      controllers.get(target.id)?.request('struck-from-behind');
    }
    // Talents Inébranlable / Immortel : un coup fatal le laisse à 1 PV (une fois).
    if (target.hp <= 0 && target.lastStand?.available) {
      target.hp = 1;
      target.lastStand.available = false;
      target.lastStand.used = true;
      if (target.lastStand.invulnerableTicks) target.invulnerableUntil = tick + target.lastStand.invulnerableTicks;
      events.push({ tick, type: 'lastStand', unitId: target.id, talentId: target.lastStand.talentId, per: target.lastStand.per });
    }
    // Talent Druide de Brocéliande : un allié debout qui tombe sous le seuil est soigné (une fois
    // par manche et par druide ; le druide peut se soigner lui-même). Inscrit dans le coup (hpAfter).
    if (target.hp > 0 && !dodged) {
      const healer = fighters.find((ally) => ally.side === target.side && isActive(ally) && ally.allyHeal?.available
        && target.hp < target.maxHp * ally.allyHeal.threshold);
      if (healer) {
        const amount = Math.min(healer.allyHeal.value, target.maxHp - target.hp);
        target.hp += amount;
        healer.allyHeal.available = false;
        detail.heal = { unitId: healer.id, amount, talentId: healer.allyHeal.talentId };
        events.push({ tick, type: 'heal', unitId: target.id, byId: healer.id, amount, talentId: healer.allyHeal.talentId });
      }
    }
    unit.state = 'attacking';
    stats.get(unit.id).dealt += detail.damage;
    stats.get(unit.id).attacks += 1;
    stats.get(target.id).taken += detail.damage;
    events.push({ tick, type: 'attack', unitId: unit.id, targetId: target.id, damage: detail.damage, hpAfter: target.hp, detail });
    // Percussion du Runner : la cible, renversée, perd son prochain tour.
    if (position.stun && target.hp > 0) {
      target.stunnedUntil = Math.max(target.stunnedUntil ?? -1, tick + position.stun);
      events.push({ tick, type: 'stun', unitId: target.id, byId: unit.id, until: target.stunnedUntil });
    }
    if (target.hp <= 0) {
      unit.knockdowns = (unit.knockdowns ?? 0) + 1;
      // KO : il quitte la lice (plus de déplacement, d'attaque ni de collision), mais reste
      // dans les données de la manche (résultat, statistiques).
      target.status = 'ko';
      target.state = 'ko';
      stats.get(unit.id).knockouts += 1;
      events.push({ tick, type: 'ko', unitId: target.id, byId: unit.id });
      // Attribution du KO à l'auteur du coup fatal, au moment même (statistiques de carrière).
      this.round.onKnockout?.(unit.id, target.id, tick);
      controllers.get(target.id).knockOut(tick);
      for (const [id, controller] of controllers) {
        if (id !== target.id && controller.targetId === target.id) controller.loseTarget('target-ko', tick);
      }
    }
  }
}
