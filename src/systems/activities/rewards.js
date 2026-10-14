import { getStatDefinition } from '../../data/stats.js';
import { randInt } from '../../utils/random.js';
import { addResource } from '../economy/wallet.js';
import { improveStat, formatStatImprovement, describeStatAtBest } from '../fighters/stats.js';

/** Quantité d'une récompense : fixe (`amount`) ou tirée entre `min` et `max`. */
export function resolveAmount(reward, rng = Math.random) {
  if (reward.amount !== undefined && reward.amount !== null) return reward.amount;
  return randInt(rng, reward.min, reward.max);
}

/** « 10 », ou « 10 à 30 » pour un tirage ; `sign` précède chaque nombre. */
function amountText(reward, sign = '') {
  if (reward.amount !== undefined && reward.amount !== null) return `${sign}${reward.amount}`;
  return `${sign}${reward.min} à ${sign}${reward.max}`;
}

// Types de récompense des activités.
//   apply(reward, { session, fighter, rng }) → { amount, text, limitText }
//       amount : quantité réellement obtenue (0 si une borne est atteinte)
//   describe(reward) → libellé court, ex. « +10 PV », « −10 à 30 FAT »
export const REWARD_TYPES = {
  stat: {
    apply(reward, { session, fighter, rng }) {
      const amount = improveStat(fighter, reward.stat, resolveAmount(reward, rng));
      if (amount > 0) session.markDirty();
      return {
        amount,
        text: formatStatImprovement(reward.stat, amount),
        limitText: describeStatAtBest(reward.stat),
      };
    },
    describe(reward) {
      const def = getStatDefinition(reward.stat);
      return `${amountText(reward, def.polarity > 0 ? '+' : '−')} ${def.short}`;
    },
  },
  resource: {
    apply(reward, { session, rng }) {
      const amount = resolveAmount(reward, rng);
      addResource(session, reward.resource, amount);
      return { amount, text: `+${amount} ${reward.resource}`, limitText: '' };
    },
    describe: (reward) => `${amountText(reward, '+')} ${reward.resource}`,
  },
};

export function getRewardType(type) {
  const rewardType = REWARD_TYPES[type];
  if (!rewardType) throw new Error(`Type de récompense inconnu : ${type}`);
  return rewardType;
}

export function describeReward(reward) {
  return getRewardType(reward.type).describe(reward);
}
