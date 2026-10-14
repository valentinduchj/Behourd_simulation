/** Probabilité (0 à 1) → « 35 % ». */
export function formatChance(chance) {
  return `${Math.round(chance * 100)} %`;
}
