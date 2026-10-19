import { EXPEDITION_RULES, EXPEDITION_PLACES, getExpeditionPlace } from '../../data/expeditions.js';
import { TALENTS, TALENT_RULES } from '../../data/talents.js';
import { SPECIALTY_IDS } from '../../data/specialties.js';
import { createId } from '../../utils/id.js';
import { createRng, randInt, pick } from '../../utils/random.js';
import { seasonStartDay, seasonProgress } from '../climate/ClimateService.js';
import { getItemQuantity, removeItem } from '../inventory/InventoryService.js';
import { addResource } from '../economy/wallet.js';
import { getPotential } from '../fighters/PotentialService.js';
import { isStudying } from '../talents/StudyService.js';
import { canHaveTalents, getTalent, setFighterTalentAt } from '../talents/TalentService.js';
import { recordTalentDiscovered, recordExpeditionDeparture, recordExpeditionReturn } from '../achievements/AchievementService.js';
import { expeditionDaysCut, expeditionDiscount, expeditionTraining, hasExpeditionBonusReward } from '../talents/TalentEffects.js';
import { improveStat } from '../fighters/stats.js';
import { LEVEL_STAT_IDS } from '../../data/stats.js';
import { firstNameOf, generateFighterNames } from '../generation/NameGenerator.js';
import { generateTavernRecruit } from '../tavern/TavernRecruitmentGenerationService.js';
import { getNextRotationStarRange } from '../tavern/TavernUpgradeService.js';
import { getActiveJourney, isOnPeregrination, PEREGRINATION_REASON } from './journeys.js';
import { generateSingularOpponents, createSingularRun, getSingularRun, claimVictory } from './SingularRunService.js';

// Les expéditions du Baron (v0.98 ; récompenses v0.99), sans interface. État enregistré avec
// la partie :
//   session.expeditions = {
//     seasonKey  premier jour de la saison des propositions (climat : 25 jours)
//     offers     [{ id, band, kind: 'peregrination' | 'singular', placeId, cost, duration, reward }]
//                reward : { type: 'deniers', amount } | { type: 'talent', rarity, talentId }
//                       | { type: 'potential', value } | { type: 'recruit', minPotential }
//     chosenOfferId   l'expédition entreprise cette saison (une seule), ou null
//     journeys   expéditions (systems/expeditions/journeys.js)
//   }
// Les propositions se renouvellent au premier jour de chaque saison (ou à la première visite).
// Toute expédition emmène un combattant ; la récompense est donnée à son retour.

const HISTORY_LIMIT = 30;
// Marcheur : une expédition ne dure jamais moins que cela.
const MIN_DURATION = 10;

function stateOf(session) {
  if (!session.expeditions || typeof session.expeditions !== 'object') {
    session.expeditions = { seasonKey: null, offers: [], chosenOfferId: null, journeys: [] };
  }
  const state = session.expeditions;
  if (!Array.isArray(state.offers)) state.offers = [];
  if (!Array.isArray(state.journeys)) state.journeys = [];
  return state;
}

/** Ferveurs de la Reine dans Le Coffre. */
export function getFerveurs(session, rules = EXPEDITION_RULES) {
  return getItemQuantity(session, rules.currencyItemId);
}

/** Le Baron propose-t-il de partir ? (au moins une Ferveur dans Le Coffre) */
export function canTalkExpeditions(session, rules = EXPEDITION_RULES) {
  return getFerveurs(session, rules) >= 1 || Boolean(getSingularRun(session));
}

function pickWeighted(entries, rng) {
  const total = entries.reduce((sum, entry) => sum + (entry.weight ?? 1), 0);
  let roll = rng() * total;
  return entries.find((entry) => (roll -= entry.weight ?? 1) < 0) ?? entries[entries.length - 1];
}

/** Talents qu'une expédition peut rapporter, pour une famille (les exotiques : expédition seulement). */
export function expeditionTalentPool(rarity) {
  return TALENTS.filter((talent) => talent.rarity === rarity && talent.weight > 0
    && (rarity !== 'exotic' || talent.sources.includes('expedition')));
}

/** Récompense tirée pour une tranche (données : EXPEDITION_RULES.costBands[].rewards). */
export function rollReward(band, rng = Math.random) {
  const entry = pickWeighted(band.rewards, rng);
  switch (entry.type) {
    case 'deniers': return { type: 'deniers', amount: randInt(rng, entry.min, entry.max) };
    case 'talent': {
      const talent = pickWeighted(expeditionTalentPool(entry.rarity), rng);
      return { type: 'talent', rarity: entry.rarity, talentId: talent?.id ?? null };
    }
    case 'potential': return { type: 'potential', value: entry.value ?? 1 };
    case 'recruit': return { type: 'recruit', minPotential: entry.minPotential ?? 1 };
    default: return { type: entry.type };
  }
}

/** Trois propositions (une par tranche de coût), lieux tous différents, récompense connue. */
export function generateOffers(rng = Math.random, rules = EXPEDITION_RULES, places = EXPEDITION_PLACES) {
  const free = [...places];
  return rules.costBands.map((band, index) => {
    const place = free.splice(Math.floor(rng() * free.length), 1)[0] ?? places[index % places.length];
    const kind = pickWeighted(rules.kinds, rng).id;
    const offer = {
      id: createId('expedition'), band: index, kind, placeId: place.id, cost: randInt(rng, band.min, band.max),
      duration: randInt(rng, rules.durationDays.min, rules.durationDays.max), reward: rollReward(band, rng),
    };
    // Expédition singulière (v1.1) : dix combats, adversaires connus d'avance ; pas de durée.
    if (kind === 'singular') {
      offer.duration = null;
      offer.opponents = generateSingularOpponents(index, rng);
    }
    return offer;
  });
}

/**
 * Propositions d'avant la v0.99 (Pérégrination : +potentiel ; singulière : rien) : une saison
 * sans expédition entreprise est simplement retirée ; sinon, les propositions reçoivent une
 * récompense (pérégrination : son potentiel) et une durée.
 */
function upgradeLegacyOffers(state, key, rules, seed) {
  if (!state.offers.some((offer) => !offer.reward)) return false;
  if (!state.chosenOfferId) return true;
  const rng = createRng(`${seed}:v099`);
  for (const offer of state.offers) {
    if (offer.reward) continue;
    offer.duration ??= randInt(rng, rules.durationDays.min, rules.durationDays.max);
    offer.reward = offer.kind === 'peregrination' ? { type: 'potential', value: offer.gain ?? 1 } : rollReward(rules.costBands[offer.band] ?? rules.costBands[0], rng);
  }
  return false;
}

/**
 * Propositions de la saison en cours (renouvelées au changement de saison) : { offers,
 * chosenOfferId, seasonKey, daysLeft }. `rng` : tirage (par défaut lié à la saison et à la partie).
 */
export function ensureSeasonOffers(session, { rng = null, rules = EXPEDITION_RULES } = {}) {
  const state = stateOf(session);
  const key = seasonStartDay(session.calendar.currentDay);
  const seed = `expeditions:${session.saveId ?? session.player?.teamId ?? ''}:${key}`;
  const legacy = state.seasonKey === key && upgradeLegacyOffers(state, key, rules, seed);
  if (state.seasonKey !== key || !state.offers.length || legacy) {
    state.seasonKey = key;
    state.offers = generateOffers(rng ?? createRng(legacy ? `${seed}:v099` : seed), rules);
    state.chosenOfferId = null;
    session.markDirty?.();
  }
  // Expéditions singulières d'avant la v1.1 : leurs dix adversaires sont tirés à la première visite.
  for (const offer of state.offers) {
    if (offer.kind === 'singular' && !offer.opponents?.length) {
      offer.opponents = generateSingularOpponents(offer.band ?? 0, createRng(`${offer.id}:adversaires`));
      offer.duration = null;
      session.markDirty?.();
    }
  }
  return { offers: state.offers, chosenOfferId: state.chosenOfferId, seasonKey: state.seasonKey, daysLeft: seasonProgress(session.calendar.currentDay).remaining + 1 };
}

export function getOffer(session, offerId) {
  return stateOf(session).offers.find((offer) => offer.id === offerId) ?? null;
}

/** Coût réel d'une proposition (talent Éclaireur dans la compagnie : moins cher, 1 au moins). */
export function getOfferCost(session, offer) {
  return Math.max(1, offer.cost - expeditionDiscount(session));
}

/** Durée réelle de l'expédition pour ce combattant (talent Marcheur : plus courte). */
export function getJourneyDuration(fighter, offer) {
  return Math.max(MIN_DURATION, offer.duration - expeditionDaysCut(fighter));
}

/** Une proposition peut-elle être choisie ? { ok, reason } (sans combattant). */
export function canChooseOffer(session, offerId, rules = EXPEDITION_RULES) {
  const state = stateOf(session);
  const offer = getOffer(session, offerId);
  if (!offer) return { ok: false, reason: 'Expédition inconnue.' };
  if (getSingularRun(session)) return { ok: false, reason: 'Une expédition singulière est en cours.' };
  if (state.chosenOfferId) return { ok: false, reason: state.chosenOfferId === offerId ? 'Expédition entreprise cette saison.' : 'Une seule expédition par saison : les autres reviendront à la saison prochaine.' };
  const cost = getOfferCost(session, offer);
  if (getFerveurs(session, rules) < cost) return { ok: false, reason: `Il faut ${cost} Ferveur${cost > 1 ? 's' : ''} de la Reine.` };
  return { ok: true, reason: null };
}

/** Le combattant a-t-il besoin de remplacer un talent pour recevoir celui de l'offre ? */
export function needsTalentSlot(session, fighter, offer) {
  // Expédition singulière : le talent s'attribue à la victoire, pas au départ.
  return offer?.kind !== 'singular' && offer?.reward?.type === 'talent' && (fighter?.talents ?? []).filter((id) => getTalent(id)).length >= TALENT_RULES.maxPerFighter;
}

/**
 * Ce combattant peut-il partir pour cette expédition ? { ok, reason }. Sans `offer` : seulement
 * les conditions communes (de la compagnie, ni parti, ni en étude).
 */
export function canSendOnExpedition(session, fighterOrId, offer = null, rules = EXPEDITION_RULES) {
  const id = typeof fighterOrId === 'string' ? fighterOrId : fighterOrId?.id;
  const fighter = session.playerFighters.find((f) => f.id === id);
  if (!fighter) return { ok: false, reason: 'Seuls les combattants de la compagnie peuvent partir.' };
  if (isOnPeregrination(session, fighter)) return { ok: false, reason: PEREGRINATION_REASON };
  if (isStudying(session, fighter)) return { ok: false, reason: 'En étude au Scriptorium.' };
  const reward = offer?.reward;
  if (reward?.type === 'potential' && getPotential(fighter) >= rules.peregrination.potentialMax) return { ok: false, reason: 'Potentiel déjà au plus haut.' };
  if (reward?.type === 'talent') {
    if (!canHaveTalents(session, fighter)) return { ok: false, reason: 'Ne peut pas recevoir de talent.' };
    if ((fighter.talents ?? []).includes(reward.talentId)) return { ok: false, reason: 'A déjà ce talent.' };
  }
  return { ok: true, reason: null };
}

/** v0.98 : la pérégrination (gain de potentiel) — même règle, offre facultative. */
export function canSendOnPeregrination(session, fighterOrId, rules = EXPEDITION_RULES) {
  return canSendOnExpedition(session, fighterOrId, { reward: { type: 'potential' } }, rules);
}

/**
 * Départ en expédition : les Ferveurs sont dépensées, le combattant quitte son activité et
 * devient indisponible jusqu'au jour de son retour. `replaceSlot` : talent remplacé au retour
 * (0 ou 1) quand la récompense est un talent et qu'il en a déjà deux. Renvoie { ok, reason, journey }.
 */
export function startExpedition(session, offerId, fighterId, { replaceSlot = null, rules = EXPEDITION_RULES } = {}) {
  const choose = canChooseOffer(session, offerId, rules);
  if (!choose.ok) return { ...choose, journey: null };
  const offer = getOffer(session, offerId);
  // Expédition singulière (v1.1) : trois combattants (`fighterId` : leurs identifiants), dix combats.
  if (offer.kind === 'singular') {
    const started = createSingularRun(session, offer, Array.isArray(fighterId) ? fighterId : [fighterId], { cost: getOfferCost(session, offer) });
    return { ...started, journey: null };
  }
  const check = canSendOnExpedition(session, fighterId, offer, rules);
  if (!check.ok) return { ...check, journey: null };
  const fighter = session.getFighter(fighterId);
  const slotNeeded = needsTalentSlot(session, fighter, offer);
  if (slotNeeded && ![0, 1].includes(replaceSlot)) return { ok: false, reason: 'Choisissez le talent qu’il remplacera.', journey: null };
  const cost = getOfferCost(session, offer);
  if (!removeItem(session, rules.currencyItemId, cost).ok) return { ok: false, reason: 'Ferveurs insuffisantes.', journey: null };
  fighter.activityId = null;
  const startDay = session.calendar.currentDay;
  const duration = getJourneyDuration(fighter, offer);
  const journey = {
    id: createId('journey'), offerId, band: offer.band, kind: offer.kind, placeId: offer.placeId, fighterId, startDay,
    duration, endDay: startDay + duration, reward: { ...offer.reward }, cost,
    replaceSlot: slotNeeded ? replaceSlot : null, status: 'active', potentialBefore: getPotential(fighter), potentialAfter: null,
  };
  const state = stateOf(session);
  state.journeys.push(journey);
  state.chosenOfferId = offerId;
  session.markDirty();
  // Succès Pèlerins d'Europe : lieux différents où l'on a envoyé quelqu'un.
  recordExpeditionDeparture(session, offer.placeId);
  return { ok: true, reason: null, journey };
}

/** v0.98 : nom d'origine du départ (toute expédition, désormais). */
export function startPeregrination(session, offerId, fighterId, rules = EXPEDITION_RULES) {
  return startExpedition(session, offerId, fighterId, { rules });
}

/** Expéditions en cours (combattants toujours dans la compagnie). */
export function getActiveJourneys(session) {
  const own = new Set(session.playerFighters.map((f) => f.id));
  return stateOf(session).journeys.filter((journey) => journey.status === 'active' && own.has(journey.fighterId));
}

export { getActiveJourney, isOnPeregrination };

/**
 * Recrue ramenée d'expédition : générée selon la Taverne du moment, potentiel au moins
 * `minPotential`, offerte (0 denier) et gardée aux rotations jusqu'à son engagement.
 */
export function createExpeditionRecruit(session, journey, { minPotential = 1, rng = createRng(`expedition-recruit:${journey.id}`) } = {}) {
  const used = new Set([...session.playerFighters, ...session.recruitment.candidates.map((c) => c.fighter)].map((f) => firstNameOf(f.name)));
  const [name] = generateFighterNames(1, rng, used);
  const fighter = generateTavernRecruit({ specialtyId: pick(rng, SPECIALTY_IDS), name, starRange: getNextRotationStarRange(session), rng, day: session.calendar.currentDay });
  fighter.potential = Math.max(minPotential, getPotential(fighter));
  const candidate = { id: createId('recruit'), fighter, cost: 0, gift: { placeId: journey.placeId, byId: journey.fighterId } };
  session.recruitment.candidates = [...session.recruitment.candidates, candidate];
  return candidate;
}

/** Donne une récompense d'expédition ; renvoie le détail pour le carnet de bord. */
function grantReward(session, journey, fighter, reward, rules) {
  switch (reward.type) {
    case 'deniers':
      addResource(session, 'deniers', reward.amount);
      return { type: 'deniers', amount: reward.amount };
    case 'talent': {
      const talent = getTalent(reward.talentId);
      if (!talent) return { type: 'talent', talentId: reward.talentId, granted: false };
      const talents = (fighter.talents ?? []).filter((id) => getTalent(id));
      if (talents.includes(talent.id)) return { type: 'talent', talentId: talent.id, rarity: talent.rarity, granted: false };
      const slot = talents.length >= TALENT_RULES.maxPerFighter ? (journey.replaceSlot ?? talents.length - 1) : null;
      const previousId = slot === null ? null : talents[slot] ?? null;
      const granted = Boolean(setFighterTalentAt(session, fighter, talent.id, slot));
      if (granted) recordTalentDiscovered(session, talent.id);
      return { type: 'talent', talentId: talent.id, rarity: talent.rarity, granted, previousId };
    }
    case 'recruit': {
      const candidate = createExpeditionRecruit(session, journey, { minPotential: reward.minPotential ?? 1 });
      return { type: 'recruit', candidateId: candidate.id, recruitName: candidate.fighter.name, potential: getPotential(candidate.fighter) };
    }
    case 'potential':
    default: {
      const before = getPotential(fighter);
      const after = Math.min(rules.peregrination.potentialMax, before + (reward.value ?? 1));
      fighter.potential = after;
      journey.potentialAfter = after;
      return { type: 'potential', before, potential: after };
    }
  }
}

/**
 * Phase quotidienne : les expéditions arrivées à leur jour de retour se terminent — le combattant
 * revient avec la récompense annoncée, et le carnet de bord le raconte.
 */
export function completeDueJourneys(session, { report = null, rules = EXPEDITION_RULES } = {}) {
  const state = session.expeditions;
  if (!state?.journeys?.length) return [];
  const today = session.calendar.currentDay;
  const events = [];
  for (const journey of state.journeys) {
    if (journey.status !== 'active' || journey.endDay > today) continue;
    const fighter = session.playerFighters.find((f) => f.id === journey.fighterId);
    journey.status = 'completed';
    if (!fighter) continue;
    const before = getPotential(fighter);
    const planned = journey.reward ?? { type: 'potential', value: journey.gain ?? rules.peregrination.potentialGain };
    const reward = grantReward(session, journey, fighter, planned, rules);
    journey.rewardResult = reward;
    // Compagnon du Baron : seconde récompense de la même tranche (jamais un talent ; pas de
    // potentiel s'il est déjà au plus haut).
    let bonusReward = null;
    if (hasExpeditionBonusReward(fighter)) {
      const band = rules.costBands[journey.band ?? getOffer(session, journey.offerId)?.band ?? 0] ?? rules.costBands[0];
      const pool = band.rewards.filter((r) => r.type !== 'talent' && (r.type !== 'potential' || getPotential(fighter) < rules.peregrination.potentialMax));
      if (pool.length) {
        const extra = rollReward({ rewards: pool }, createRng(`expedition-bonus:${journey.id}`));
        bonusReward = grantReward(session, { ...journey, id: `${journey.id}:bonus` }, fighter, extra, rules);
        journey.bonusResult = bonusReward;
      }
    }
    // Voyageur aguerri : quelques points dans chaque compétence de combat (plafond du potentiel).
    const points = expeditionTraining(fighter);
    const training = points ? Object.fromEntries(LEVEL_STAT_IDS.map((statId) => [statId, improveStat(fighter, statId, points)])) : null;
    const event = {
      type: 'expedition.return', fighterId: fighter.id, name: fighter.name, placeId: journey.placeId, kind: journey.kind ?? 'peregrination',
      days: journey.duration, reward, bonusReward, training, before, potential: getPotential(fighter),
    };
    events.push(event);
    report?.add(event);
    recordExpeditionReturn(session, { report });
  }
  // Historique borné (les plus récentes gardées).
  const done = state.journeys.filter((journey) => journey.status !== 'active');
  if (done.length > HISTORY_LIMIT) state.journeys = [...state.journeys.filter((journey) => journey.status === 'active'), ...done.slice(-HISTORY_LIMIT)];
  if (events.length) session.markDirty();
  return events;
}

/**
 * Victoire d'une expédition singulière : récompenses (SingularRunService.claimVictory), avec les
 * récompenses de la carte données comme au retour d'une pérégrination (deniers, recrue).
 */
export function claimSingularVictory(session, assignments = {}, { report = null, rules = EXPEDITION_RULES } = {}) {
  const run = session.expeditions?.run;
  if (!run) return { ok: false, reason: 'Aucune expédition en cours.' };
  const grantCardReward = (reward, seedKey = run.id, { pool = null, fighter = null } = {}) => {
    const picked = pool ? rollReward({ rewards: pool }, createRng(seedKey)) : reward;
    const who = fighter ?? session.getFighter(run.fighterIds[0]);
    return grantReward(session, { id: seedKey, placeId: run.placeId, fighterId: who.id, replaceSlot: null }, who, picked, rules);
  };
  return claimVictory(session, assignments, { grantCardReward, rules, report });
}

export { getSingularRun };

export function placeOf(offerOrJourney) {
  return getExpeditionPlace(offerOrJourney.placeId);
}
