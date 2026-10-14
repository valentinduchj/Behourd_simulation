import { COMBAT_RULES } from '../../data/combatRules.js';
import { ITEM_EFFECT_TYPES } from '../../data/items.js';
import { getStat } from '../../systems/fighters/stats.js';
import { getStatDefinition, LEVEL_STAT_IDS } from '../../data/stats.js';
import { combatSeasonFactor } from '../../systems/climate/ClimateService.js';

// Combattant pendant une manche (état temporaire, jamais sauvegardé) :
//   { id, side: 'A' | 'B', classId, name, isCaptain, stats: { polearm, wrestling, percussion,
//     endurance }, endurance, hp, maxHp, fatigue, x, y, status: 'active' | 'ko', targetId, state,
//     comboTargetId, comboHits }
// Les stats sont celles du début de la manche, bonus de capitaine compris (+15 % sur toutes).
// Les bonus de position (Lutteur contre la barrière, Hastier à distance, Runner dans le dos…)
// ne sont jamais inscrits ici : ils sont recalculés à chaque coup, d'après la position du moment
// (CombatSituation), et disparaissent dès que leur condition ne tient plus.
// Le Fighter (données persistantes) n'est jamais modifié par la simulation.

/**
 * Valeur de combat d'une statistique. Un combattant de l'IA défini par un `score` (niveau
 * global, data/leagues/*.json) a ce score dans chaque compétence ; les autres, leurs stats.
 */
export function getCombatValue(fighter, statId) {
  if (typeof fighter.score === 'number' && getStatDefinition(statId)?.level) return fighter.score;
  return getStat(fighter, statId);
}

/** Endurance de combat d'un combattant de l'IA : valeur théorique ± variation (tirée une fois par combat). */
export function rollAIEndurance(fighter, rng = Math.random, rules = COMBAT_RULES) {
  const theoretical = getCombatValue(fighter, 'endurance');
  return theoretical * (1 + (rng() * 2 - 1) * rules.aiEnduranceVariation);
}

/**
 * Prépare un combattant pour la manche. `endurance` : valeur imposée (IA : tirée une fois par
 * combat) ; sinon son endurance. `fatigue` : fatigue au début de la manche. `isCaptain` :
 * +15 % sur toutes ses stats de combat pour la manche. `effects` : effets temporaires actifs
 * pour cette manche (CombatEffectService), [{ type, value, sourceItemId }] — ex. Hypocras :
 * bonus de dégâts finaux, appliqué au moment du coup ; ses statistiques ne changent pas.
 * `fatigueGain` : part de tout gain de fatigue pendant la manche (Légende vivante : 0,75).
 * `season` : saison de l'année du combat ('summer'…), ou null (banc d'essai, vitrine : aucun effet).
 */
export function createCombatUnit({
  fighter, side, tile, fatigue, endurance = null, isCaptain = false, effects = [], rules = COMBAT_RULES,
  talentEffects = [], venue = null, decisive = false, lastStandUsed = false, fatigueGain = 1, season = null,
}) {
  const productOf = (type) => talentEffects.filter((e) => e.type === type).reduce((factor, e) => factor * (e.factor ?? 1), 1);
  const caps = talentEffects.filter((e) => e.type === 'fatigueCap').map((e) => e.value);
  const captainFactor = isCaptain ? 1 + rules.bonuses.captain.allStats : 1;
  const stats = Object.fromEntries(LEVEL_STAT_IDS.map((statId) => [statId, getCombatValue(fighter, statId) * captainFactor]));
  if (endurance !== null) stats.endurance = endurance * captainFactor;
  // Talents : statistiques de combat en plus (Endurant ; Opiniâtre en manche décisive).
  for (const effect of talentEffects.filter((e) => e.type === 'combatStats' && (e.when !== 'decisive' || decisive))) {
    for (const statId of effect.stat === 'all' ? LEVEL_STAT_IDS : [effect.stat]) stats[statId] *= 1 + effect.value;
  }
  const sumOf = (type) => talentEffects.filter((e) => e.type === type).reduce((total, e) => total + (e.value ?? 0), 0);
  const lastStand = talentEffects.find((e) => e.type === 'lastStand') ?? null;
  return {
    id: fighter.id,
    side,
    classId: fighter.specialtyId,
    name: fighter.name,
    isCaptain,
    stats,
    endurance: stats.endurance,
    // PV de la manche : ceux du combattant au début de chaque manche (récupérés entre deux manches).
    hp: getStat(fighter, 'hp'),
    maxHp: getStatDefinition('hp').max,
    fatigue: Math.max(0, Math.min(100, Number(fatigue) || 0)),
    // Fatigue pendant la manche (combat/engine/RoundFatigue.js) : facteurs des talents (Souffle
    // long, Second souffle, Bon vivant) et part de gain de la compagnie (Légende vivante).
    fatigueEffort: productOf('fatigueEffort'),
    fatigueRecovery: productOf('fatigueRecovery'),
    fatigueCap: caps.length ? Math.min(...caps) : null,
    fatigueGain,
    x: tile.x,
    y: tile.y,
    status: 'active',
    targetId: null,
    state: 'idle',
    comboTargetId: null,
    comboHits: 0,
    // Effets temporaires de la manche et bonus de dégâts finaux qui en découle (fraction).
    effects: effects.map((effect) => ({ type: effect.type, value: effect.value, sourceItemId: effect.sourceItemId ?? null })),
    finalDamageBonus: effects.filter((effect) => effect.type === ITEM_EFFECT_TYPES.FINAL_DAMAGE_BONUS).reduce((sum, effect) => sum + effect.value, 0),
    // Talents (combat/engine/TalentCombat.js) : effets, lieu du combat (home / away), coups portés
    // et adversaires mis KO dans la manche, réductions et bonus propres.
    talentEffects: talentEffects.map((effect) => ({ ...effect })),
    venue,
    strikes: 0,
    knockdowns: 0,
    damageTakenReduction: sumOf('damageTaken'),
    speedBonus: sumOf('moveSpeed'),
    fatigueShift: sumOf('fatigueThreshold'),
    comboExtra: sumOf('comboHits'),
    lucky: talentEffects.some((e) => e.type === 'luckyRoll'),
    // Saison de l'année (v0.70, ClimateService) : efficacité de sa classe (Hastier en été, Runner
    // en automne : 0,9), sauf talent qui l'en protège. Multiplie ses dégâts finaux ; ses
    // statistiques ne changent pas. `talentEffects` ne contient déjà que les effets actifs.
    season,
    seasonFactor: combatSeasonFactor(fighter.specialtyId, season, talentEffects),
    // Survie à 1 PV (Inébranlable : une fois par combat ; Immortel : une fois par manche).
    lastStand: lastStand ? { per: lastStand.per, invulnerableTicks: lastStand.invulnerableTicks ?? 0, talentId: lastStand.talentId, available: lastStand.per === 'round' || !lastStandUsed } : null,
    invulnerableUntil: -1,
  };
}
