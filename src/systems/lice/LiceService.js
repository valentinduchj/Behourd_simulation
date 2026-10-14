import { LICE_UPGRADE_CONFIG } from '../../data/liceUpgrades.js';
import { getAcquiredLiceUpgrades } from './LiceUpgradeConfig.js';
import { getLiceLevel } from './LiceUpgradeService.js';
import { MY_LICE_LAYOUT } from '../../data/myLiceLayout.js';

// Lice du club : ce que son niveau apporte aux autres systèmes (le lieu « Ma Lice » n'existe plus).
//   getLiceSpectatorBonus : bonus d'affluence, consommé par CrowdService (applyVenueBonus)
//
//   getLiceArenaDecoration : terrain des combats de Ligue à domicile (la lice du joueur est la
//                          source du décor : base de data/myLiceLayout.js › arena + éléments
//                          des améliorations acquises)
// Le choix domicile / extérieur est fait ailleurs (systems/league/MatchLocationService.js).

/** Bonus neutre : aucune amélioration. */
export const NEUTRAL_SPECTATOR_BONUS = Object.freeze({ multiplier: 1, flat: 0 });

/** Bonus d'affluence d'une lice de niveau `level` : multiplicateurs multipliés, ajouts additionnés. */
export function getSpectatorBonusForLevel(level, config = LICE_UPGRADE_CONFIG) {
  return getAcquiredLiceUpgrades(level, config).reduce((bonus, upgrade) => ({
    multiplier: bonus.multiplier * (upgrade.spectatorBonus?.multiplier ?? 1),
    flat: bonus.flat + (upgrade.spectatorBonus?.flat ?? 0),
  }), { ...NEUTRAL_SPECTATOR_BONUS });
}

/** Bonus d'affluence de la lice du joueur. */
export function getLiceSpectatorBonus(session, config = LICE_UPGRADE_CONFIG) {
  return getSpectatorBonusForLevel(getLiceLevel(session, config), config);
}

/**
 * Décor du terrain de combat à domicile, au format de data/liceDecorations.js : la base de la
 * lice du joueur, les éléments ajoutés par ses améliorations acquises (visualUpgrade.arenaProps)
 * et des bannières aux couleurs de sa compagnie. Identifiant propre au niveau : la disposition
 * est la même à chaque match à domicile tant que la lice ne change pas.
 */
export function getLiceArenaDecoration(session, { layout = MY_LICE_LAYOUT, config = LICE_UPGRADE_CONFIG } = {}) {
  const base = layout.arena;
  const level = getLiceLevel(session, config);
  const colors = session?.playerTeam?.emblem.resolvedColors() ?? {};
  const clubBanners = [{ color: colors.primary, emblem: colors.secondary }, { color: colors.secondary, emblem: colors.primary }]
    .filter((variant) => variant.color);
  const resolve = (entry) => (entry.type === 'clubBanner'
    ? { ...entry, type: clubBanners.length ? 'banner' : null, variants: clubBanners }
    : entry);
  const extras = getAcquiredLiceUpgrades(level, config).map((upgrade) => upgrade.visualUpgrade?.arenaProps ?? {});
  const props = Object.fromEntries(['back', 'front'].map((zone) => [zone, [...(base.props[zone] ?? []), ...extras.flatMap((extra) => extra[zone] ?? [])].map(resolve)]));
  return { ...base, id: `lice_home:${level}`, home: true, level, props };
}
