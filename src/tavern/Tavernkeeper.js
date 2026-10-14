import { getNextRotation, getRecruitPriceForStars, getRecruitPriceTable } from '../systems/tavern/TavernRotationService.js';
import {
  canUpgradeTavern, getNextRotationStarRange, getNextTavernUpgrade, getTavernLevel, isTavernAtMaxLevel,
} from '../systems/tavern/TavernUpgradeService.js';
import { MAX_TAVERN_LEVEL } from '../systems/tavern/TavernLevelConfig.js';

// Le tavernier : personnage fixe derrière le comptoir. Il donne accès aux informations de
// rotation et à l'amélioration de la Taverne ; il ne décide rien lui-même (services).

export class Tavernkeeper {
  constructor({ x, y, spriteId }) {
    this.x = x;
    this.y = y;
    this.spriteId = spriteId;
    this.name = 'Le tavernier';
  }

  /**
   * Ce que le tavernier peut dire : { level, maxLevel, starRange (prochaine rotation),
   * nextRotation ({ day, inDays } | null), upgrade ({ level, cost, minStars, maxStars } | null), canUpgrade }.
   */
  dialogue(session) {
    return {
      level: getTavernLevel(session),
      maxLevel: MAX_TAVERN_LEVEL,
      atMax: isTavernAtMaxLevel(session),
      starRange: getNextRotationStarRange(session),
      nextRotation: getNextRotation(session),
      // Prix des recrues selon leurs étoiles, pour la plage de la prochaine rotation : [{ stars, price }]
      // (price null : selon sa valeur). Après l'amélioration : prix des nouvelles étoiles les plus hautes.
      priceTable: getRecruitPriceTable(getNextRotationStarRange(session)),
      upgradeTopPrice: isTavernAtMaxLevel(session) ? null : getRecruitPriceForStars(getNextTavernUpgrade(session).maxStars),
      upgrade: getNextTavernUpgrade(session),
      canUpgrade: canUpgradeTavern(session),
    };
  }
}
