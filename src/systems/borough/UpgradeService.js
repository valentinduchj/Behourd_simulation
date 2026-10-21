import { BOROUGH_ARTISANS, BOROUGH_UPGRADES } from '../../data/borough.js';
import { ACTIVITIES } from '../../data/activities.js';
import { canAfford, getResource, spendResource } from '../economy/wallet.js';
import { getUpgradeEffectType } from './upgradeEffects.js';
import { checkAchievements } from '../achievements/AchievementService.js';
import { upgradeDiscount } from '../talents/TalentEffects.js';

// Améliorations du Bourg : coûts, achats et effets. Seul le nombre d'achats de chaque
// amélioration est enregistré (session.upgrades[id]) ; le coût, les effets et les places
// s'en déduisent.
//
//   coût actuel = baseCost × 3 × 4 × … (un facteur par achat déjà fait, voir getUpgradeCost)

const UPGRADES_BY_ID = new Map(BOROUGH_UPGRADES.map((upgrade) => [upgrade.id, upgrade]));

export function listArtisans() {
  return BOROUGH_ARTISANS;
}

export function getArtisan(artisanId) {
  return BOROUGH_ARTISANS.find((artisan) => artisan.id === artisanId) ?? null;
}

export function getUpgrade(upgradeId) {
  return UPGRADES_BY_ID.get(upgradeId) ?? null;
}

export function listUpgradesOf(artisanId) {
  return BOROUGH_UPGRADES.filter((upgrade) => upgrade.artisanId === artisanId);
}

/** Nombre d'achats (= niveau) d'une amélioration. */
export function getPurchaseCount(session, upgradeId) {
  return session.upgrades?.[upgradeId] ?? 0;
}

/**
 * Prix de l'achat suivant, pour un nombre d'achats déjà faits (règle commune à toutes les
 * améliorations, data/borough.js › UPGRADE_COST_PROGRESSION) : chaque prix est le précédent
 * × un multiplicateur qui augmente à chaque achat (×3, ×4, ×5…).
 *   ex. 300 : 300 → 900 → 3 600 → 18 000
 */
export function getUpgradeCost(upgrade, purchaseCount) {
  // Prix fixés achat par achat (data/borough.js › costs) : ils remplacent la progression.
  if (upgrade.costs?.length) return upgrade.costs[Math.min(purchaseCount, upgrade.costs.length - 1)];
  const { firstMultiplier, step } = upgrade.costProgression;
  let cost = upgrade.baseCost;
  for (let n = 0; n < purchaseCount; n++) cost *= firstMultiplier + n * step;
  return Math.round(cost);
}

/** Vrai si l'amélioration a atteint son nombre d'achats maximal (maxLevel). */
export function isAtMaxLevel(session, upgradeId) {
  const upgrade = getUpgrade(upgradeId);
  return upgrade?.maxLevel != null && getPurchaseCount(session, upgradeId) >= upgrade.maxLevel;
}

export function getCurrentCost(session, upgradeId) {
  const upgrade = getUpgrade(upgradeId);
  const cost = getUpgradeCost(upgrade, getPurchaseCount(session, upgradeId));
  // Économe (v1.2) : réduction de la compagnie, non cumulable.
  const discount = upgradeDiscount(session);
  return discount ? Math.round(cost * (1 - discount)) : cost;
}

/**
 * Activité du Centre avec les améliorations achetées (copie ; la définition de base
 * n'est jamais modifiée). C'est elle que le jeu utilise pour les places, la probabilité
 * et les gains.
 */
export function applyUpgradesToActivity(session, baseActivity) {
  const activity = { ...baseActivity, reward: { ...baseActivity.reward } };
  if (!session) return activity;
  for (const upgrade of BOROUGH_UPGRADES) {
    if (upgrade.effect.activityId !== baseActivity.id) continue;
    const level = getPurchaseCount(session, upgrade.id);
    if (level > 0) getUpgradeEffectType(upgrade.effect.type).applyToActivity(activity, upgrade.effect, level);
  }
  return activity;
}

/** Activité du Centre (par identifiant) avec les améliorations de la partie. */
export function getEffectiveActivity(session, activityId) {
  const base = ACTIVITIES.find((activity) => activity.id === activityId);
  return base ? applyUpgradesToActivity(session, base) : null;
}

/** { ok, reason, cost } — l'amélioration peut-elle être achetée maintenant ? */
export function canPurchaseUpgrade(session, upgradeId) {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) return { ok: false, reason: 'Amélioration inconnue.', cost: null };
  const cost = getCurrentCost(session, upgradeId);
  const effectType = getUpgradeEffectType(upgrade.effect.type);
  const activity = getEffectiveActivity(session, upgrade.effect.activityId);
  if (isAtMaxLevel(session, upgradeId) || (activity && effectType.isMaxed(activity, upgrade.effect))) return { ok: false, reason: 'Maximum atteint.', cost };
  if (!canAfford(session, upgrade.currency, cost)) {
    return { ok: false, reason: `Deniers insuffisants (il en manque ${cost - getResource(session, upgrade.currency)}).`, cost };
  }
  return { ok: true, reason: null, cost };
}

/**
 * Achat : débite le coût actuel, puis le compteur de l'amélioration augmente de 1 (son
 * effet s'applique aussitôt, son coût suivant augmente selon la progression). Renvoie { ok, reason, cost, level }.
 */
export function purchaseUpgrade(session, upgradeId) {
  const check = canPurchaseUpgrade(session, upgradeId);
  if (!check.ok) return { ...check, level: getPurchaseCount(session, upgradeId) };
  const upgrade = getUpgrade(upgradeId);
  if (!spendResource(session, upgrade.currency, check.cost)) return { ok: false, reason: 'Deniers insuffisants.', cost: check.cost, level: getPurchaseCount(session, upgradeId) };
  session.upgrades[upgradeId] = getPurchaseCount(session, upgradeId) + 1;
  session.markDirty();
  // Succès : Premier chantier, Grand bâtisseur.
  checkAchievements(session);
  return { ok: true, reason: null, cost: check.cost, level: session.upgrades[upgradeId] };
}
