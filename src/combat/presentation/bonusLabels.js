import { COMBAT_RULES } from '../../data/combatRules.js';
import { getStatDefinition } from '../../data/stats.js';
import { ITEMS, ITEM_EFFECT_TYPES } from '../../data/items.js';
import { TALENTS } from '../../data/talents.js';
import { CLIMATE_SEASONS } from '../../data/climate.js';

// Libellés des bonus de combat (présentation), déduits des règles :
//   short : étiquette au-dessus du combattant dans La Lice ; long : liste sous la lice.

const pct = (value) => `${Math.round(value * 100)} %`;
const short = (statId) => getStatDefinition(statId).short;

export function getBonusLabels(rules = COMBAT_RULES) {
  const { captain, lutteurBarrier, lutteurPin, hastierReach, hastierCrowded, runnerRear, blindSpot } = rules.bonuses;
  const signed = (value) => `${value > 0 ? '+' : '−'}${pct(Math.abs(value))}`;
  // Effets temporaires des objets (ex. Hypocras) : 'item:<id>', libellés tirés des données.
  const itemLabels = Object.fromEntries(ITEMS.filter((item) => item.effect.type === ITEM_EFFECT_TYPES.FINAL_DAMAGE_BONUS).map((item) => [`item:${item.id}`, {
    icon: item.icon,
    short: `${item.icon} +${pct(item.effect.value)}`,
    long: `${item.name} : +${pct(item.effect.value)} de dégâts finaux pendant cette manche`,
  }]));
  // Talents des combattants (data/talents.js) : 'talent:<id>'.
  const talentLabels = Object.fromEntries(TALENTS.map((talent) => [`talent:${talent.id}`, {
    icon: '✦',
    short: `✦ ${talent.name}`,
    long: `${talent.name} : ${talent.description}`,
  }]));
  // Saisons de l'année (data/climate.js) : 'season:<id>', malus d'efficacité d'une classe.
  const seasonLabels = Object.fromEntries(CLIMATE_SEASONS.filter((season) => Object.keys(season.classEfficiency).length).map((season) => [`season:${season.id}`, {
    icon: season.icon,
    short: `${season.icon} −${pct(Math.max(...Object.values(season.classEfficiency)))}`,
    long: `${season.name} : ${season.effectSummary}`,
  }]));
  return {
    ...itemLabels,
    ...talentLabels,
    ...seasonLabels,
    captain: { icon: '👑', short: `👑 +${pct(captain.allStats)}`, long: `Capitaine : +${pct(captain.allStats)} sur toutes ses stats` },
    // Bonus de position (v0.65).
    barrier: { icon: '🧱', short: `🧱 ${short(lutteurBarrier.statId)} +${pct(lutteurBarrier.bonus)}`, long: `Contre la barrière : +${pct(lutteurBarrier.bonus)} en ${short(lutteurBarrier.statId)}` },
    pinned: { icon: '🤼', short: '🤼 Plaqué', long: `Cible plaquée contre la barrière : combo +${lutteurPin.comboBoost} coup, elle ne peut plus reculer` },
    reach: { icon: '🔱', short: `🔱 ${signed(hastierReach.finalDamage)}`, long: `Frappe à distance : ${signed(hastierReach.finalDamage)} de dégâts` },
    crowded: { icon: '⛔', short: `⛔ ${signed(hastierCrowded.finalDamage)}`, long: `Adversaire au contact (arme d’hast encombrante) : ${signed(hastierCrowded.finalDamage)} de dégâts` },
    rear: { icon: '💥', short: `💥 ${signed(runnerRear.finalDamage)}`, long: `Dans le dos : ${signed(runnerRear.finalDamage)} de dégâts ; en pleine course, il renverse sa cible` },
    blind: { icon: '🪖', short: `🪖 ${signed(blindSpot.finalDamage)}`, long: `Angle mort (casque fermé) : ${signed(blindSpot.finalDamage)} de dégâts` },
  };
}
