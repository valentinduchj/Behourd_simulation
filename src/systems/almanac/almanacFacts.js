import { GAME_CONFIG } from '../../config/gameConfig.js';
import { ACTIVITIES } from '../../data/activities.js';
import { ARENAS, DEFAULT_ARENA_ID } from '../../data/arenas.js';
import { BOROUGH_ARTISANS, BOROUGH_SHOPS, BOROUGH_UPGRADES, CHANCE_UPGRADE_STEP, UPGRADE_COST_PROGRESSION } from '../../data/borough.js';
import { CALENDAR_CONFIG } from '../../data/calendar.js';
import { CAPTAIN_CONFIG } from '../../data/captain.js';
import { computeDamage, getDefenseValue } from '../../combat/engine/CombatDamageCalculator.js';
import { getUpgradeCost } from '../borough/UpgradeService.js';
import { getLands, getMapLands } from '../geography/LandService.js';
import { HOME_REWARD_BY_LICE_LEVEL } from '../../data/homeAway.js';
import { CAREER_MEDALS } from '../../data/careerMedals.js';
import { CLIMATE_SEASONS, CLIMATE_YEAR } from '../../data/climate.js';
import { getStartLocations } from '../geography/LocationService.js';
import { COMBAT_PLAYBACK, COMBAT_RULES, FIGHTER_AI_CONFIG } from '../../data/combatRules.js';
import { AGE_CONFIG, POTENTIAL_CONFIG } from '../../data/fighterProfile.js';
import { ITEM_USE_CONTEXTS, ITEMS, getItemDefinition } from '../../data/items.js';
import { LEAGUE_CONFIG, LEAGUE_DEFINITIONS, LEAGUE_RULES, SEASON_CONFIG } from '../../data/leagues.js';
import { MATCH_RULES } from '../../data/matchRules.js';
import { FATIGUE_RULES } from '../../data/fatigue.js';
import { QUEEN_COMBAT_CONFIG } from '../../data/queenCombat.js';
import { FRENCH_CUP_RULES } from '../../data/frenchCup.js';
import { RATING_CONFIG } from '../../data/ratings.js';
import { RECRUITMENT_CONFIG } from '../../data/recruitment.js';
import { TAVERN_LEVELS } from '../../data/tavern.js';
import { formatStarRange } from '../tavern/TavernLevelConfig.js';
import { ROSTER_RULES } from '../../data/roster.js';
import { SPECIALTIES, SPECIALTY_IDS } from '../../data/specialties.js';
import { STAT_DEFINITIONS, getStatDefinition } from '../../data/stats.js';
import { getRecruitPriceTable, getUnlockLevelForStars } from '../tavern/TavernRotationService.js';
import { TALENTS, TALENT_RARITIES, TALENT_RULES } from '../../data/talents.js';
import { ARTIFACTS, DESK_UPGRADE, NO_ARTIFACT, STUDY_RULES } from '../../data/scriptorium.js';
import { currentLocale, translateText } from '../../i18n/i18n.js';

// Faits de l'Almanach : valeurs LUES dans les règles du jeu (data/*.js, config), jamais
// recopiées. Les articles y font référence par leur clé, ex. « {{fatigue.threshold}} » ;
// si une règle change, l'Almanach change avec elle. Lecture seule : rien n'est modifié.
//
//   ALMANAC_FACTS        clé → texte
//   ALMANAC_TABLES       source → { columns, rows }       (bloc { type: 'table', source })
//   ALMANAC_COLLECTIONS  source → [{ icon, title, text, illustration, details }]
//                        (bloc { type: 'collection', source } : fiches illustrées)

const fr = (value) => String(Math.round(value * 100) / 100).replace('.', ',');
const pct = (value) => `${fr(value * 100)} %`;
const range = ({ min, max }) => (min === max ? `${min}` : `${min} à ${max}`);
const deniers = (n) => `${n.toLocaleString(currentLocale())} denier${n > 1 ? 's' : ''}`;
const statShort = (id) => getStatDefinition(id).short;
const statLabel = (id) => getStatDefinition(id).label;
const arena = ARENAS[DEFAULT_ARENA_ID];
const leagueName = (id) => LEAGUE_DEFINITIONS.find((d) => d.id === id)?.name ?? id;
const matchdays = (LEAGUE_CONFIG.teamCount % 2 ? LEAGUE_CONFIG.teamCount : LEAGUE_CONFIG.teamCount - 1) * (LEAGUE_CONFIG.singleRoundRobin ? 1 : 2);
const tavernRotation = CALENDAR_CONFIG.recurringEvents.find((e) => e.typeId === 'tavern');
const { bonuses, damage, fatigueDamage } = COMBAT_RULES;

/**
 * Exemple de l'article « Les attaques » : un Hastier (HAS 60) frappe un Lutteur (HAS 30,
 * LUT 45), puis le Lutteur riposte. Calculé avec la formule du jeu (aléa et combo à 0).
 */
function exampleHit() {
  const unit = (classId, has, lut) => ({ classId, fatigue: 0, stats: { polearm: has, wrestling: lut, percussion: 0, endurance: 30 } });
  const hastier = unit('hastier', 60, 0);
  const lutteur = unit('lutteur', 30, 45);
  return {
    forward: computeDamage(hastier, lutteur, { roll: 0, comboHits: 0 }).damage,
    back: computeDamage(lutteur, hastier, { roll: 0, comboHits: 0 }).damage,
    defense: getDefenseValue(lutteur),
  };
}

/** Récompense de base d'un Combat de la Reine (barème × multiplicateur), par étoiles. */
const queenReward = (stars) => QUEEN_COMBAT_CONFIG.rewardsByStars[stars] * QUEEN_COMBAT_CONFIG.rewardMultiplier;

/** Prix successifs d'une amélioration (règle commune du Bourg). */
export function upgradeCostSeries(baseCost, count = 4) {
  const { firstMultiplier, step } = UPGRADE_COST_PROGRESSION;
  const costs = [baseCost];
  for (let n = 0; costs.length < count; n++) costs.push(Math.round(costs.at(-1) * (firstMultiplier + n * step)));
  return costs;
}

function rewardText(activity) {
  const r = activity.reward;
  const amount = r.amount !== undefined ? `${r.amount}` : range(r);
  if (r.type === 'resource') return `+${amount} ${r.resource}`;
  const def = getStatDefinition(r.stat);
  return def.polarity < 0 ? `−${amount} ${def.short}` : `+${amount} ${def.short}`;
}

export const ALMANAC_FACTS = Object.freeze({
  // Le jeu
  'game.title': () => GAME_CONFIG.title,
  'game.version': () => GAME_CONFIG.version,
  'economy.startingDeniers': () => deniers(GAME_CONFIG.economy.startingDeniers),
  'roster.startSize': () => `${GAME_CONFIG.roster.size}`,
  'roster.max': () => `${ROSTER_RULES.maxTeamFighters}`,
  'roster.min': () => `${ROSTER_RULES.minTeamFighters}`,
  // Statistiques
  'stat.max': () => `${getStatDefinition('fatigue').max}`,
  'stat.hpMax': () => `${getStatDefinition('hp').max}`,
  'stat.skillStart': () => range(getStatDefinition('wrestling').start),
  'stat.levelCount': () => `${STAT_DEFINITIONS.filter((s) => s.level).length}`,
  'rating.clubTop': () => `${RATING_CONFIG.clubTopCount}`,
  'rating.maxStars': () => `${RATING_CONFIG.maxStars}`,
  // Fatigue
  'fatigue.max': () => `${getStatDefinition('fatigue').max}`,
  'fatigue.threshold': () => `${fatigueDamage.threshold}`,
  'fatigue.perPoint': () => pct(fatigueDamage.perPoint),
  'fatigue.example75': () => pct(Math.max(0, 1 - (75 - fatigueDamage.threshold) * fatigueDamage.perPoint)),
  'fatigue.zeroAt': () => `${Math.min(100, fatigueDamage.threshold + Math.round(1 / fatigueDamage.perPoint))}`,
  'fatigue.roundWinner': () => range(MATCH_RULES.fatigue.roundWinner),
  'fatigue.roundLoser': () => range(MATCH_RULES.fatigue.roundLoser),
  'fatigue.aiStart': () => range(COMBAT_RULES.aiStartingFatigue),
  // Fatigue pendant la manche (v0.66).
  'fatigue.effort': () => fr(COMBAT_RULES.roundFatigue.effortPerTick),
  'fatigue.hitGiven': () => fr(COMBAT_RULES.roundFatigue.perHitGiven),
  'fatigue.perDamage': () => fr(COMBAT_RULES.roundFatigue.perDamageTaken),
  'fatigue.koRecovery': () => fr(COMBAT_RULES.roundFatigue.koRecoveryPerTick),
  'fatigue.breathRecovery': () => fr(COMBAT_RULES.roundFatigue.breathRecoveryPerTick),
  'fatigue.betweenAligned': () => `${COMBAT_RULES.roundFatigue.betweenRounds.aligned}`,
  'fatigue.betweenBench': () => `${COMBAT_RULES.roundFatigue.betweenRounds.bench}`,
  'fatigue.breatheMin': () => `${FIGHTER_AI_CONFIG.breathe.minFatigue}`,
  'fatigue.banquet': () => range(ACTIVITIES.find((a) => a.id === 'banquet').reward),
  // Hors des manches (v0.75, data/fatigue.js) : courbatures et états.
  'fatigue.sorenessRound': () => `${FATIGUE_RULES.soreness.perRound}`,
  'fatigue.sorenessKo': () => `${FATIGUE_RULES.soreness.knockedOut}`,
  'fatigue.tiredFrom': () => `${FATIGUE_RULES.states.find((s) => s.id === 'tired').from}`,
  'fatigue.exhaustedFrom': () => `${FATIGUE_RULES.states.find((s) => s.id === 'exhausted').from}`,
  'fatigue.tiredChanceLoss': () => pct(1 - FATIGUE_RULES.centre.tired.chanceFactor),
  // Âge et potentiel
  'age.initial': () => range(AGE_CONFIG.initial),
  'age.perSeason': () => `${AGE_CONFIG.yearsPerSeason}`,
  'potential.max': () => `${POTENTIAL_CONFIG.max}`,
  'potential.interval': () => `${POTENTIAL_CONFIG.checkIntervalDays}`,
  // Capitaine
  'talent.tavernChance': () => pct(TALENT_RULES.tavernChance),
  'talent.max': () => `${TALENT_RULES.maxPerFighter}`,
  'study.desks': () => `${STUDY_RULES.desks}`,
  'study.replaceCost': () => deniers(STUDY_RULES.replaceCost),
  'study.deskUpgradeCost': () => deniers(DESK_UPGRADE.cost),
  'captain.bonus': () => pct(bonuses.captain.allStats),
  'captain.age': () => `${CAPTAIN_CONFIG.player.age}`,
  'captain.minPotential': () => `${CAPTAIN_CONFIG.player.minPotential}`,
  'captain.stats': () => range(CAPTAIN_CONFIG.player.statRange),
  // Exemple de coup calculé par le moteur lui-même (CombatDamageCalculator), sans aléa ni combo.
  'combat.exampleDamage': () => `${exampleHit().forward}`,
  'combat.exampleReturn': () => `${exampleHit().back}`,
  'combat.exampleDefense': () => fr(exampleHit().defense),
  // Combat
  'match.roundsToWin': () => `${MATCH_RULES.roundsToWin}`,
  'match.maxRounds': () => `${MATCH_RULES.roundsToWin * 2 - 1}`,
  'match.squad': () => `${MATCH_RULES.maxSquadSize}`,
  'match.perRound': () => `${MATCH_RULES.fightersPerRound}`,
  'lice.width': () => `${arena.width}`,
  'lice.height': () => `${arena.height}`,
  'lice.zone': () => `${arena.sides[0].area.w} × ${arena.sides[0].area.h}`,
  'placement.aiDelay': () => `${fr(COMBAT_PLAYBACK.aiPlacementDelayMs.min / 1000)} à ${fr(COMBAT_PLAYBACK.aiPlacementDelayMs.max / 1000)} s`,
  'combat.tick': () => `${fr(COMBAT_PLAYBACK.tickSeconds)} s`,
  'combat.speed': () => fr(COMBAT_RULES.moveTilesPerTick),
  'combat.hastierReach': () => `${COMBAT_RULES.reachByClass.hastier}`,
  'vision.angle': () => `± ${COMBAT_RULES.vision.halfAngle}°`,
  'combat.base': () => `${damage.base}`,
  'combat.randomCap': () => pct(damage.random.cap),
  'combat.comboMax': () => `${damage.combo.maxHits}`,
  'combat.comboPer10': () => pct(damage.combo.perPointPerHit * 10),
  'combat.minDamage': () => `${COMBAT_RULES.minDamage}`,
  'combat.aiEndurance': () => pct(COMBAT_RULES.aiEnduranceVariation),
  'bonus.lutteur': () => pct(bonuses.lutteurBarrier.bonus),
  'bonus.lutteurStat': () => statShort(bonuses.lutteurBarrier.statId),
  'bonus.hastier': () => pct(bonuses.hastierReach.finalDamage),
  'bonus.hastierCrowded': () => pct(Math.abs(bonuses.hastierCrowded.finalDamage)),
  'bonus.runner': () => pct(bonuses.runnerRear.finalDamage),
  'bonus.blind': () => pct(bonuses.blindSpot.finalDamage),
  'ai.decision': () => `${FIGHTER_AI_CONFIG.decisionInterval}`,
  'ai.retreatHp': () => pct(FIGHTER_AI_CONFIG.retreat.hpRatio),
  'winProbability.base': () => pct(MATCH_RULES.winProbability.base),
  'winProbability.perPoint': () => `${fr(MATCH_RULES.winProbability.perLevelPoint * 100)} point${MATCH_RULES.winProbability.perLevelPoint * 100 > 1 ? 's' : ''}`,
  // Championnat
  'league.count': () => `${LEAGUE_DEFINITIONS.length}`,
  'league.teams': () => `${LEAGUE_CONFIG.teamCount}`,
  'league.matchdays': () => `${matchdays}`,
  'league.promoted': () => `${LEAGUE_CONFIG.promotionCount}`,
  'league.relegated': () => `${LEAGUE_CONFIG.relegationCount}`,
  'league.start': () => leagueName(LEAGUE_DEFINITIONS.find((d) => d.playerStart).id),
  'land.count': () => String(getMapLands().length),
  'land.startCount': () => String(getStartLocations(getMapLands()[0].id).length),
  'land.far': () => getLands().find((land) => !land.countryId)?.name ?? 'Terre lointaine',
  'league.top': () => leagueName([...LEAGUE_DEFINITIONS].sort((a, b) => a.tier - b.tier)[0].id),
  'points.win': () => `${LEAGUE_RULES.points.win}`,
  'points.lossWithRound': () => `${LEAGUE_RULES.points.lossWithRound}`,
  'points.loss': () => `${LEAGUE_RULES.points.loss}`,
  'season.gap': () => range(SEASON_CONFIG.daysBetweenMatches),
  'calendar.strip': () => `${CALENDAR_CONFIG.stripDays}`,
  // Taverne
  'tavern.poolSize': () => `${RECRUITMENT_CONFIG.poolSize}`,
  'tavern.interval': () => `${tavernRotation?.interval ?? 7}`,
  'tavern.maxLevel': () => `${TAVERN_LEVELS.at(-1).level}`,
  'tavern.freeStars': () => `${String(TAVERN_LEVELS[0].maxStars).replace('.', ',')}★`,
  'tavern.startRange': () => formatStarRange(TAVERN_LEVELS[0]),
  'tavern.maxRange': () => formatStarRange(TAVERN_LEVELS.at(-1)),
  // Bourg
  'borough.multiplier': () => `×${UPGRADE_COST_PROGRESSION.firstMultiplier}`,
  'borough.chanceStep': () => pct(CHANCE_UPGRADE_STEP),
  'borough.exampleCosts': () => upgradeCostSeries(BOROUGH_UPGRADES.find((u) => u.id === 'forest-capacity').baseCost).map((c) => c.toLocaleString(currentLocale())).join(' → '),
  // Coffre
  'item.painPrice': () => deniers(BOROUGH_SHOPS.baker.find((o) => o.itemId === 'pain_meteil').price),
  'item.hypocrasPrice': () => deniers(BOROUGH_SHOPS.baker.find((o) => o.itemId === 'hypocras').price),
  'item.hypocrasBonus': () => pct(getItemDefinition('hypocras').effect.value),
  // Combats de la Reine
  'queen.interval': () => range(QUEEN_COMBAT_CONFIG.interval),
  'queen.options': () => `${QUEEN_COMBAT_CONFIG.opponentOptions}`,
  'queen.secondary': () => `${QUEEN_COMBAT_CONFIG.secondaryMatches}`,
  'queen.variation': () => pct(QUEEN_COMBAT_CONFIG.rewardVariation),
  'queen.multiplier': () => `×${QUEEN_COMBAT_CONFIG.rewardMultiplier}`,
  // Coupe de France
  'cup.teams': () => `${FRENCH_CUP_RULES.groupCount * FRENCH_CUP_RULES.groupSize}`,
  'cup.groups': () => `${FRENCH_CUP_RULES.groupCount}`,
  'cup.groupSize': () => `${FRENCH_CUP_RULES.groupSize}`,
  'cup.groupLetters': () => `${FRENCH_CUP_RULES.groupLetters[0]} à ${FRENCH_CUP_RULES.groupLetters[FRENCH_CUP_RULES.groupCount - 1]}`,
  'cup.direct': () => `${FRENCH_CUP_RULES.qualifiersPerGroup}`,
  'cup.extraCount': () => `${FRENCH_CUP_RULES.extraQualifiers.count}`,
  'cup.extraRank': () => `${FRENCH_CUP_RULES.extraQualifiers.rank}es`,
  'cup.bracket': () => `${FRENCH_CUP_RULES.bracketSize}`,
  'cup.rounds': () => FRENCH_CUP_RULES.knockoutRounds.join(', '),
  'cup.venue': () => FRENCH_CUP_RULES.venueName,
  'climate.yearLength': () => `${CLIMATE_YEAR.length} jours`,
  'climate.seasonLength': () => `${CLIMATE_YEAR.seasonLength} jours`,
  'cup.rewardGroups': () => deniers(FRENCH_CUP_RULES.rewards.groups),
  // Langue (v0.79) : nom du tour traduit avant d'être mis en minuscules.
  'cup.rewardKnockout': () => FRENCH_CUP_RULES.knockoutRounds.map((name, i) => `${translateText(name).toLowerCase()} ${translateText(deniers(FRENCH_CUP_RULES.rewards.knockout[i]))}`).join(', '),
});

const usageText = (item) => (!item.usableIn.length ? 'aucune : à garder' : item.usableIn.map((c) => (c === ITEM_USE_CONTEXTS.OUTSIDE_COMBAT ? 'hors combat' : 'pendant le placement')).join(' et '));

export const ALMANAC_TABLES = Object.freeze({
  // Rôle de chaque statistique.
  stats: () => ({
    columns: ['Statistique', 'Abrév.', 'Rôle'],
    rows: STAT_DEFINITIONS.map((s) => [s.label, s.short, ({
      hp: `Points de vie pendant une manche (${getStatDefinition('hp').max} au départ) : à 0, le combattant est KO.`,
      fatigue: `0 = reposé, ${s.max} = épuisé. Au-delà de ${fatigueDamage.threshold}, ses dégâts baissent ; fatigué, il s’entraîne moins bien ; épuisé, il ne va plus qu’au Banquet.`,
      wrestling: `Attaque du Lutteur ; donne un combo sur la même cible (toutes classes).`,
      polearm: `Attaque du Hastier ; moitié de la défense de tous les combattants.`,
      percussion: `Attaque du Runner ; part d’aléa des coups (jusqu’à +${pct(damage.random.cap)}).`,
      endurance: 'Ordre des coups : le plus endurant frappe en premier.',
    })[s.id] ?? s.description]),
  }),
  // Points du classement.
  points: () => ({
    columns: ['Résultat du combat', 'Points'],
    rows: [
      ['Victoire', `${LEAGUE_RULES.points.win}`],
      [`Défaite en ayant gagné une manche (${MATCH_RULES.roundsToWin - 1}–${MATCH_RULES.roundsToWin})`, `${LEAGUE_RULES.points.lossWithRound}`],
      [`Défaite sans manche gagnée (0–${MATCH_RULES.roundsToWin})`, `${LEAGUE_RULES.points.loss}`],
    ],
  }),
  // Divisions.
  leagues: () => ({
    columns: ['Division', 'Clubs', 'Montées', 'Descentes'],
    rows: [...LEAGUE_DEFINITIONS].sort((a, b) => a.tier - b.tier).map((d, i, all) => [
      `${d.name}${d.playerStart ? ' (départ)' : ''}`,
      `${LEAGUE_CONFIG.teamCount}`,
      i === 0 ? '—' : `${LEAGUE_CONFIG.promotionCount} premiers`,
      i === all.length - 1 ? '—' : `${LEAGUE_CONFIG.relegationCount} derniers`,
    ]),
  }),
  // Activités du Centre (valeurs de base, avant les améliorations du Bourg).
  activities: () => ({
    columns: ['Lieu', 'Places', 'Réussite', 'Gain par réussite'],
    rows: ACTIVITIES.map((a) => [`${a.icon} ${a.name}`, a.capacity === null ? 'illimitées' : `${a.capacity}`, pct(a.successChance), rewardText(a)]),
  }),
  // Améliorations du Bourg.
  upgrades: () => ({
    columns: ['Artisan', 'Lieu', 'Amélioration', 'Premier prix'],
    rows: BOROUGH_UPGRADES.map((u) => [BOROUGH_ARTISANS.find((a) => a.id === u.artisanId)?.name ?? u.artisanId, u.group, u.description, deniers(u.baseCost)]),
  }),
  // Progression des prix d'une amélioration (exemple avec les premiers prix existants).
  // Prix réels de chaque amélioration (règle commune ou prix fixés), regroupés par barème ;
  // « — » au-delà du nombre d'achats maximal.
  upgradeCosts: () => {
    const series = new Map();
    for (const u of BOROUGH_UPGRADES) {
      const costs = [0, 1, 2, 3].map((n) => (u.maxLevel != null && n >= u.maxLevel ? '—' : deniers(getUpgradeCost(u, n))));
      const key = costs.join('|');
      if (!series.has(key)) series.set(key, { names: new Set(), costs });
      series.get(key).names.add(`${u.name} (${u.group})`);
    }
    return {
      columns: ['Améliorations', '1er achat', '2e achat', '3e achat', '4e achat'],
      rows: [...series.values()].map((s) => [[...s.names].join(', '), ...s.costs]),
    };
  },
  // Consommables.
  items: () => ({
    columns: ['Objet', 'Prix', 'Utilisation', 'Effet'],
    rows: ITEMS.map((item) => {
      const offer = Object.values(BOROUGH_SHOPS).flat().find((o) => o.itemId === item.id);
      const effect = !item.effect ? 'Gagnée en battant un club aux Combats de la Reine (une par étoile pleine) ; servira auprès du Baron.'
        : item.effect.type === 'SET_FATIGUE' ? `Fatigue → ${item.effect.value}` : `+${pct(item.effect.value)} de dégâts finaux, manche suivante`;
      return [`${item.icon} ${item.name}`, offer ? deniers(offer.price) : '—', usageText(item), effect];
    }),
  }),
  // Évolution du potentiel selon l'âge.
  potential: () => ({
    columns: ['Âge', 'Évolution possible', 'Chances par vérification'],
    rows: POTENTIAL_CONFIG.ageBands.map((band) => [
      Number.isFinite(band.maxAge) ? `${band.minAge} à ${band.maxAge} ans` : `${band.minAge} ans et plus`,
      band.change > 0 ? '+1 flamme' : '−1 flamme',
      Object.entries(band.chances).map(([p, c]) => `${p} flamme${p > 1 ? 's' : ''} : ${pct(c)}`).join(' · '),
    ]),
  }),
  // Plafond des compétences selon le potentiel (libellés, sans chiffre).
  potentialCaps: () => ({
    columns: ['Potentiel', 'Plafond des compétences'],
    rows: Object.keys(POTENTIAL_CONFIG.skillCaps).map((p) => [
      Number(p) ? '🔥'.repeat(Number(p)) : 'Aucune flamme',
      POTENTIAL_CONFIG.skillCapLabels[p],
    ]),
  }),
  // Scriptorium : durée d'une étude selon le potentiel.
  studyDurations: () => ({
    columns: ['Potentiel', 'Durée de l’étude'],
    rows: Object.entries(STUDY_RULES.durationByPotential).map(([p, duration]) => [
      Number(p) ? '🔥'.repeat(Number(p)) : 'Aucune flamme',
      `${duration} jours`,
    ]),
  }),
  // Chances de chaque famille de talents, selon l'artefact actif (data/scriptorium.js).
  talentOdds: () => ({
    columns: ['Configuration', 'Prix', 'Ordinaire', 'Rare', 'Épique'],
    rows: [NO_ARTIFACT, ...ARTIFACTS].map((config) => [
      `${config.icon} ${config.name}`, config.cost ? deniers(config.cost) : 'Gratuit', pct(config.odds.common), pct(config.odds.rare), pct(config.odds.epic),
    ]),
  }),
  // Catalogue des talents (data/talents.js) : famille, domaine et effet, des ordinaires aux épiques.
  talents: () => ({
    columns: ['Talent', 'Famille', 'Domaine', 'Effet'],
    rows: ['common', 'rare', 'epic', 'exotic'].flatMap((rarity) => TALENTS.filter((talent) => talent.rarity === rarity)).map((talent) => [
      talent.name,
      TALENT_RARITIES[talent.rarity].name,
      talent.domain,
      talent.description,
    ]),
  }),
  // Saisons de l'année (data/climate.js) : jours, lieux fermés, efficacité des classes.
  climateSeasons: () => ({
    columns: ['Saison', 'Jours de l’année', 'Effets'],
    rows: CLIMATE_SEASONS.map((season, i) => [`${season.icon} ${season.name}`, `${i * CLIMATE_YEAR.seasonLength + 1} à ${(i + 1) * CLIMATE_YEAR.seasonLength}`, season.effectSummary]),
  }),
  // Médailles de carrière (mises à terre).
  careerMedals: () => ({
    columns: ['Médaille', 'Mises à terre'],
    rows: CAREER_MEDALS.map((medal) => [`${medal.icon} ${medal.name}`, `${medal.threshold}`]),
  }),
  // Recette d'une victoire de Ligue à domicile, selon le niveau de la lice.
  homeRewards: () => ({
    columns: ['Niveau de la lice', 'Victoire à domicile'],
    rows: Object.entries(HOME_REWARD_BY_LICE_LEVEL).map(([level, { min, max }]) => [`Niveau ${level}`, `${range({ min, max })} deniers`]),
  }),
  // Les Terres : régions et lieux de départ.
  lands: () => ({
    columns: ['Terre', 'Régions', 'Lieux de départ'],
    rows: getMapLands().map((land) => [land.name, land.regions.join(', '), getStartLocations(land.id).map((l) => l.name).join(', ')]),
  }),
  // Niveaux de la Taverne : coût et étoiles des recrues.
  tavernLevels: () => ({
    columns: ['Niveau', 'Coût', 'Recrues des rotations suivantes'],
    rows: TAVERN_LEVELS.map((def) => [
      `Niveau ${def.level}`,
      def.cost ? deniers(def.cost) : 'départ',
      formatStarRange(def),
    ]),
  }),
  // Prix d'une recrue selon ses étoiles (indépendant du niveau de la Taverne).
  recruitPrices: () => ({
    columns: ['Étoiles de la recrue', 'Proposées dès le niveau', 'Prix'],
    rows: getRecruitPriceTable({ minStars: TAVERN_LEVELS[0].minStars, maxStars: TAVERN_LEVELS.at(-1).maxStars }).map(({ stars, price }) => [
      `${String(stars).replace('.', ',')}★`,
      `Niveau ${getUnlockLevelForStars(stars).level}`,
      price === null ? 'selon sa valeur' : deniers(price),
    ]),
  }),
  // Origine des adversaires des Combats de la Reine.
  queenPools: () => ({
    columns: ['Origine', 'Chance'],
    rows: QUEEN_COMBAT_CONFIG.opponentPools.map((p) => [p.pool === 'reserve' ? 'Hors championnat' : leagueName(p.pool), `${p.weight} %`]),
  }),
  // Récompenses des Combats de la Reine.
  queenRewards: () => ({
    columns: ['Club adverse', 'Récompense (environ)'],
    rows: Object.keys(QUEEN_COMBAT_CONFIG.rewardsByStars).map(Number).sort((a, b) => a - b)
      .map((stars) => [`${'★'.repeat(stars)}${'☆'.repeat(RATING_CONFIG.maxStars - stars)}`, deniers(queenReward(stars))]),
  }),
  // Bonus de position en combat (v0.65).
  bonuses: () => ({
    columns: ['Bonus', 'Qui', 'Condition', 'Effet'],
    rows: [
      ['👑 Capitaine', 'Le capitaine', 'Toujours, à chaque manche', `+${pct(bonuses.captain.allStats)} sur toutes ses stats de combat`],
      ['🧱 Barrière', SPECIALTIES[bonuses.lutteurBarrier.classId].name, `À ${bonuses.lutteurBarrier.distance} case au plus de la barrière`, `+${pct(bonuses.lutteurBarrier.bonus)} en ${statShort(bonuses.lutteurBarrier.statId)}`],
      ['🤼 Plaqué', SPECIALTIES[bonuses.lutteurPin.classId].name, 'Sa cible est collée à la barrière', `Combo +${bonuses.lutteurPin.comboBoost} coup ; la cible ne peut plus reculer`],
      ['🔱 Distance', SPECIALTIES[bonuses.hastierReach.classId].name, `Il frappe à ${COMBAT_RULES.reachByClass.hastier} cases`, `+${pct(bonuses.hastierReach.finalDamage)} de dégâts finaux`],
      ['⛔ Mêlée', SPECIALTIES[bonuses.hastierCrowded.classId].name, 'Un adversaire est à son contact', `−${pct(Math.abs(bonuses.hastierCrowded.finalDamage))} de dégâts finaux`],
      ['💥 Dans le dos', SPECIALTIES[bonuses.runnerRear.classId].name, 'Sa cible ne le voit pas', `+${pct(bonuses.runnerRear.finalDamage)} de dégâts finaux ; en pleine course, la cible renversée perd ${bonuses.runnerRear.stunTicks} tour`],
      ['🪖 Angle mort', 'Tous', `L’attaquant est hors du champ de vision de sa cible (± ${COMBAT_RULES.vision.halfAngle}°)`, `+${pct(bonuses.blindSpot.finalDamage)} de dégâts finaux`],
    ],
  }),
});

export const ALMANAC_COLLECTIONS = Object.freeze({
  // Les trois spécialités, avec leur portrait.
  specialties: () => SPECIALTY_IDS.map((id) => {
    const spec = SPECIALTIES[id];
    const reach = COMBAT_RULES.reachByClass?.[id] ?? COMBAT_RULES.contactRange;
    return {
      id, icon: spec.icon, title: spec.name, text: spec.description,
      illustration: { kind: 'fighter', classId: id },
      details: [
        ['Attaque avec', `${statLabel(COMBAT_RULES.offenseStatByClass[id])} (${statShort(COMBAT_RULES.offenseStatByClass[id])})`],
        ['Allonge', reach > COMBAT_RULES.contactRange ? `${reach} cases` : 'au contact'],
        ['Place', spec.formationRole],
      ],
    };
  }),
  // Lieux du Centre (valeurs de base).
  activities: () => ACTIVITIES.map((a) => ({
    id: a.id, icon: a.icon, title: a.name, text: a.description, color: a.color,
    details: [
      ...(a.group ? [['Pôle', a.group]] : []),
      ['Places', a.capacity === null ? 'illimitées' : `${a.capacity}`],
      ['Réussite', pct(a.successChance)],
      ['Gain par réussite', rewardText(a)],
    ],
  })),
  // Artisans du Bourg.
  artisans: () => BOROUGH_ARTISANS.map((a) => ({
    id: a.id, icon: a.icon, title: a.name, text: a.description, color: a.color,
    illustration: { kind: 'artisan', artisanId: a.id },
    details: BOROUGH_SHOPS[a.id]
      ? [['Boutique', BOROUGH_SHOPS[a.id].map((o) => getItemDefinition(o.itemId)?.name).join(' · ')]]
      : [['Améliorations', [...new Set(BOROUGH_UPGRADES.filter((u) => u.artisanId === a.id).map((u) => u.group))].join(' · ')]],
  })),
  // Consommables.
  items: () => ITEMS.map((item) => {
    const offer = Object.values(BOROUGH_SHOPS).flat().find((o) => o.itemId === item.id);
    return {
      id: item.id, icon: item.icon, title: item.name, text: item.description,
      illustration: { kind: 'item', itemId: item.id },
      details: [['Prix', offer ? deniers(offer.price) : '—'], ['Utilisation', usageText(item)]],
    };
  }),
});

/** Valeur d'un fait, ou null si la clé est inconnue. */
export function getFact(key) {
  const fact = ALMANAC_FACTS[key];
  return fact ? fact() : null;
}
