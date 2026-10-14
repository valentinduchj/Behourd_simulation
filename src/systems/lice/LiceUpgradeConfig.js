import { LICE_UPGRADE_CONFIG } from '../../data/liceUpgrades.js';

// Lecture de la configuration des améliorations de la lice (data/liceUpgrades.js). Toutes
// les fonctions acceptent une autre configuration (tests, futures lices adverses).

/** Améliorations triées par niveau. */
export function listLiceUpgrades(config = LICE_UPGRADE_CONFIG) {
  return [...config.upgrades].sort((a, b) => a.level - b.level);
}

/** Niveau maximal : celui de la dernière amélioration définie (ou le niveau de départ). */
export function getMaxLiceLevel(config = LICE_UPGRADE_CONFIG) {
  return listLiceUpgrades(config).at(-1)?.level ?? config.startLevel;
}

/** Amélioration qui mène au niveau `level`, ou null. */
export function getLiceUpgradeForLevel(level, config = LICE_UPGRADE_CONFIG) {
  return listLiceUpgrades(config).find((upgrade) => upgrade.level === level) ?? null;
}

/** Améliorations acquises à un niveau donné (toutes celles de niveau ≤ level). */
export function getAcquiredLiceUpgrades(level, config = LICE_UPGRADE_CONFIG) {
  return listLiceUpgrades(config).filter((upgrade) => upgrade.level <= level);
}
