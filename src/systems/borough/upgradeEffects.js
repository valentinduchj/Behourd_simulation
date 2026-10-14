import { formatChance } from '../activities/format.js';

// Types d'effets des améliorations du Bourg. Chaque type modifie une copie de la définition
// d'une activité du Centre — c'est cette activité « effective » que le jeu utilise partout
// (résolution quotidienne, places, affichage) : aucune logique parallèle.
//
//   applyToActivity(activity, effect, level)  modifie `activity` (copie) pour `level` achats
//   isMaxed(activity, effect)                 vrai si un achat de plus n'aurait plus d'effet
//   describeCurrent(activity, effect)         valeur actuelle, pour l'interface

export const UPGRADE_EFFECT_TYPES = {
  // Gain par réussite : la récompense de l'activité (stat ou deniers) augmente.
  activityRewardAmount: {
    applyToActivity(activity, effect, level) {
      const bonus = effect.amount * level;
      const reward = { ...activity.reward };
      if (reward.amount !== undefined && reward.amount !== null) reward.amount += bonus;
      else {
        reward.min += bonus;
        reward.max += bonus;
      }
      activity.reward = reward;
    },
    isMaxed: () => false,
  },
  // Probabilité de réussite : +amount (en points) par niveau, 100 % au plus.
  activitySuccessChance: {
    applyToActivity(activity, effect, level) {
      activity.successChance = Math.min(1, activity.successChance + effect.amount * level);
    },
    isMaxed: (activity) => activity.successChance >= 1,
    describeCurrent: (activity) => `réussite ${formatChance(activity.successChance)}`,
  },
  // Places : +amount par niveau (une activité sans limite le reste).
  activityCapacity: {
    applyToActivity(activity, effect, level) {
      if (activity.capacity !== null && activity.capacity !== undefined) activity.capacity += effect.amount * level;
    },
    isMaxed: (activity) => activity.capacity === null || activity.capacity === undefined,
    describeCurrent: (activity) => `${activity.capacity} places`,
  },
};

export function getUpgradeEffectType(type) {
  const effectType = UPGRADE_EFFECT_TYPES[type];
  if (!effectType) throw new Error(`Type d'effet d'amélioration inconnu : ${type}`);
  return effectType;
}
