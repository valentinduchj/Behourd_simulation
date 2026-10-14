import { LICE_UPGRADE_CONFIG } from '../../data/liceUpgrades.js';
import { canAfford, getResource, spendResource } from '../economy/wallet.js';
import { getLiceUpgradeForLevel, getMaxLiceLevel } from './LiceUpgradeConfig.js';

// Niveau de la lice du club : lecture et achat d'une amélioration (aucune interface pour l'instant). Seul `session.liceLevel` est
// enregistré ; bonus et visuels s'en déduisent (LiceService). Aucune valeur ici.

export function getLiceLevel(session, config = LICE_UPGRADE_CONFIG) {
  const level = Number(session.liceLevel);
  return Number.isInteger(level) && level >= config.startLevel ? level : config.startLevel;
}

/** Prochaine amélioration disponible, ou null (aucune définie, ou niveau maximal). */
export function getNextLiceUpgrade(session, config = LICE_UPGRADE_CONFIG) {
  return getLiceUpgradeForLevel(getLiceLevel(session, config) + 1, config);
}

/** { ok, reason, upgrade } — la lice peut-elle être améliorée maintenant ? */
export function canUpgradeLice(session, config = LICE_UPGRADE_CONFIG) {
  const upgrade = getNextLiceUpgrade(session, config);
  if (!upgrade) {
    const none = !config.upgrades.length;
    return { ok: false, reason: none ? 'Aucune amélioration n’est encore disponible.' : 'La lice est déjà au niveau maximal.', upgrade: null };
  }
  if (!canAfford(session, config.currency, upgrade.cost)) {
    return { ok: false, reason: `Deniers insuffisants (il en manque ${upgrade.cost - getResource(session, config.currency)}).`, upgrade };
  }
  return { ok: true, reason: null, upgrade };
}

/**
 * Achat de l'amélioration suivante : vérifications, paiement, niveau +1.
 * Renvoie { ok, reason, level, upgrade }. La sauvegarde est faite par l'appelant (écran).
 */
export function upgradeLice(session, config = LICE_UPGRADE_CONFIG) {
  const check = canUpgradeLice(session, config);
  if (!check.ok) return { ok: false, reason: check.reason, level: getLiceLevel(session, config), upgrade: check.upgrade };
  if (!spendResource(session, config.currency, check.upgrade.cost)) {
    return { ok: false, reason: 'Deniers insuffisants.', level: getLiceLevel(session, config), upgrade: check.upgrade };
  }
  session.liceLevel = check.upgrade.level;
  session.markDirty();
  return { ok: true, reason: null, level: session.liceLevel, upgrade: check.upgrade };
}

export function isLiceAtMaxLevel(session, config = LICE_UPGRADE_CONFIG) {
  return getLiceLevel(session, config) >= getMaxLiceLevel(config);
}
