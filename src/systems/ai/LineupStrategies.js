import { calculateFighterLevel } from '../fighters/ratings.js';
import { averageDuelStrength } from '../../combat/engine/ai/duelEstimate.js';
import { COMBAT_RULES } from '../../data/combatRules.js';

// Choix des combattants d'une manche (5 parmi l'effectif disponible), selon le profil d'IA
// (data/aiProfiles.js › lineup). Une stratégie reçoit :
//   { own, opponents, size, fatigueOf(fighter), unitOf(fighter), score: { own, opponent }, rng,
//     formation? (quotas de classes du profil ; par défaut COMBAT_RULES.formation) }
//   own / opponents : combattants DISPONIBLES (hors KO du combat) des deux camps
// et renvoie les combattants retenus.
//
// v0.65 : les stratégies réfléchies composent la FORMATION du béhourd (COMBAT_RULES.formation :
// 2 Lutteurs, 2 Hastiers, 1 Runner) dans leur ordre de préférence, puis complètent avec les
// meilleurs restants si une classe manque.

const byLevel = (a, b) => calculateFighterLevel(b) - calculateFighterLevel(a);

/**
 * Les `size` premiers de `ranked` (déjà triés par préférence) en respectant la formation :
 * chaque classe jusqu'à son quota, puis les meilleurs restants.
 */
export function withFormation(ranked, size, formation) {
  formation = formation ?? COMBAT_RULES.formation;
  const quota = { ...formation };
  const picked = [];
  for (const fighter of ranked) {
    if (picked.length >= size) break;
    if ((quota[fighter.specialtyId] ?? 0) > 0) {
      quota[fighter.specialtyId] -= 1;
      picked.push(fighter);
    }
  }
  for (const fighter of ranked) {
    if (picked.length >= size) break;
    if (!picked.includes(fighter)) picked.push(fighter);
  }
  // Ordre de préférence d'origine (lisible, et stable pour les tests).
  return ranked.filter((fighter) => picked.includes(fighter));
}

export const LINEUP_STRATEGIES = {
  /** Au hasard. */
  random({ own, size, rng }) {
    const pool = [...own];
    const out = [];
    while (pool.length && out.length < size) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out;
  },

  /** Les meilleurs niveaux, fatigue ignorée (sans souci de formation : IA « instinctive »). */
  best({ own, size }) {
    return [...own].sort(byLevel).slice(0, size);
  },

  /** Les moins fatigués, puis les meilleurs, en formation. */
  fresh({ own, size, fatigueOf, formation }) {
    return withFormation([...own].sort((a, b) => fatigueOf(a) - fatigueOf(b) || byLevel(a, b)), size, formation);
  },

  /**
   * Discipliné : la fatigue ne coûte rien sous le seuil du malus de dégâts ; les meilleurs
   * niveaux passent d'abord tant qu'ils sont sous ce seuil, les plus fatigués ensuite, en formation.
   */
  disciplined({ own, size, fatigueOf, formation, threshold = COMBAT_RULES.fatigueDamage.threshold }) {
    const over = (fighter) => Math.max(0, fatigueOf(fighter) - threshold);
    return withFormation([...own].sort((a, b) => over(a) - over(b) || byLevel(a, b)), size, formation);
  },

  /**
   * Tout donner : les meilleurs niveaux, en formation, sans regarder la fatigue — sauf les
   * épuisés (au-delà de `exhausted`), relégués en fin de liste.
   */
  allIn({ own, size, fatigueOf, formation, exhausted = 70 }) {
    const ranked = [...own].sort((a, b) => (fatigueOf(a) > exhausted) - (fatigueOf(b) > exhausted) || byLevel(a, b));
    return withFormation(ranked, size, formation);
  },

  /**
   * Rotation : personne ne s'use. Les combattants sous `fresh` de fatigue passent d'abord (les
   * meilleurs en tête), les plus fatigués ne reviennent que faute de remplaçants.
   */
  rotation({ own, size, fatigueOf, formation, fresh = COMBAT_RULES.fatigueDamage.threshold - 10 }) {
    const ranked = [...own].sort((a, b) => (fatigueOf(a) > fresh) - (fatigueOf(b) > fresh) || (fatigueOf(a) > fresh ? fatigueOf(a) - fatigueOf(b) : byLevel(a, b)));
    return withFormation(ranked, size, formation);
  },

  /** Rapport de force : les plus efficaces contre l'effectif adverse disponible (stats, fatigue comprises), en formation. */
  duel({ own, opponents, size, unitOf, formation }) {
    const enemies = opponents.map(unitOf);
    const ranked = own
      .map((fighter) => ({ fighter, value: averageDuelStrength(unitOf(fighter), enemies) }))
      .sort((a, b) => b.value - a.value || byLevel(a.fighter, b.fighter))
      .map((entry) => entry.fighter);
    return withFormation(ranked, size, formation);
  },

  /**
   * Stratège : prévoit la composition adverse (ses 5 combattants les plus frais) et s'y oppose ;
   * en tête au score, il ménage aussi ses combattants fatigués pour la suite du combat.
   */
  strategist({ own, opponents, size, unitOf, fatigueOf, score, formation }) {
    const expected = LINEUP_STRATEGIES.fresh({ own: opponents, size, fatigueOf }).map(unitOf);
    const leading = score.own > score.opponent;
    const ranked = own
      .map((fighter) => ({
        fighter,
        value: averageDuelStrength(unitOf(fighter), expected) - (leading ? fatigueOf(fighter) / 100 : 0),
      }))
      .sort((a, b) => b.value - a.value || byLevel(a.fighter, b.fighter))
      .map((entry) => entry.fighter);
    return withFormation(ranked, size, formation);
  },
};

/** Combattants de manche (estimations) d'une liste. */
const unitsOf = (fighters, unitOf) => fighters.map(unitOf);

/**
 * Élite (v1.2.2, mesuré au banc d'essai) : SANS quotas de classes — imposer 2 Lutteurs,
 * 2 Hastiers et 1 Runner coûtait environ 9 points de victoires face aux autres comportements.
 */
Object.assign(LINEUP_STRATEGIES, {
  /** Les 5 qui gagnent le mieux leurs duels contre l'effectif adverse disponible (stats, fatigue, talents). */
  eliteDuel({ own, opponents, size, unitOf }) {
    const enemies = unitsOf(opponents, unitOf);
    return own
      .map((fighter) => ({ fighter, value: averageDuelStrength(unitOf(fighter), enemies) }))
      .sort((a, b) => b.value - a.value || byLevel(a.fighter, b.fighter))
      .slice(0, size)
      .map((entry) => entry.fighter);
  },
  /**
   * Prévoit la composition adverse (les `size` adversaires les plus forts contre son effectif),
   * s'y oppose, et ménage ses combattants au-delà de `tired` de fatigue (pénalité progressive).
   */
  eliteStrategist({ own, opponents, size, unitOf, fatigueOf, tired = 40, tiredScale = 40 }) {
    const ownUnits = unitsOf(own, unitOf);
    const expected = opponents
      .map((fighter) => ({ fighter, value: averageDuelStrength(unitOf(fighter), ownUnits) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, size)
      .map((entry) => unitOf(entry.fighter));
    return own
      .map((fighter) => ({ fighter, value: averageDuelStrength(unitOf(fighter), expected) - Math.max(0, fatigueOf(fighter) - tired) / tiredScale }))
      .sort((a, b) => b.value - a.value || byLevel(a.fighter, b.fighter))
      .slice(0, size)
      .map((entry) => entry.fighter);
  },
});

export function selectLineup(strategyId, context) {
  return (LINEUP_STRATEGIES[strategyId] ?? LINEUP_STRATEGIES.fresh)(context);
}
