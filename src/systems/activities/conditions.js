import { getStatDefinition } from '../../data/stats.js';
import { canImproveStat, describeStatAtBest } from '../fighters/stats.js';

// Conditions des activités, vérifiées chaque jour avant le tirage de réussite.
//   check(condition, { session, fighter }) → booléen
//   describe(condition)                     → règle lisible
//   failText(condition)                     → raison affichée quand la condition échoue
export const CONDITION_TYPES = {
  // La statistique peut encore progresser (PV < 100, fatigue > 0…).
  statCanImprove: {
    check: (condition, { fighter }) => canImproveStat(fighter, condition.stat),
    describe(condition) {
      const def = getStatDefinition(condition.stat);
      return def.polarity > 0 ? `${def.short} < ${def.max}` : `${def.short} > ${def.min}`;
    },
    failText: (condition) => describeStatAtBest(condition.stat),
  },
};

export function getConditionType(type) {
  const conditionType = CONDITION_TYPES[type];
  if (!conditionType) throw new Error(`Type de condition inconnu : ${type}`);
  return conditionType;
}

/** Première condition non remplie, ou null. */
export function findUnmetCondition(conditions, context) {
  return (conditions ?? []).find((condition) => !getConditionType(condition.type).check(condition, context)) ?? null;
}
