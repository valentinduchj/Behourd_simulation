import { SINGULAR_RULES, SINGULAR_BOONS, SINGULAR_REWARDS, getSingularBoon, getSingularReward, singularRewardValue } from '../../data/singularExpedition.js';
import { EXPEDITION_RULES, getExpeditionPlace } from '../../data/expeditions.js';
import { TALENTS, TALENT_RULES } from '../../data/talents.js';
import { SPECIALTY_IDS } from '../../data/specialties.js';
import { LEVEL_STAT_IDS } from '../../data/stats.js';
import { Fighter } from '../../models/Fighter.js';
import { createId } from '../../utils/id.js';
import { createRng, pick } from '../../utils/random.js';
import { generateFighterNames } from '../generation/NameGenerator.js';
import { generateTavernRecruit } from '../tavern/TavernRecruitmentGenerationService.js';
import { createArena } from '../../combat/Arena.js';
import { createCombatUnit } from '../../combat/engine/CombatUnit.js';
import { simulateRound } from '../../combat/engine/CombatManager.js';
import { getStat, setStat, improveStat } from '../fighters/stats.js';
import { getPotential } from '../fighters/PotentialService.js';
import { getCurrentSeason } from '../climate/ClimateService.js';
import { isCaptain } from '../roster/CaptainService.js';
import { isStudying } from '../talents/StudyService.js';
import { canHaveTalents, getTalent, setFighterTalentAt } from '../talents/TalentService.js';
import { combatEffectsOf, expeditionTraining, hasExpeditionBonusReward } from '../talents/TalentEffects.js';
import { addItem, removeItem } from '../inventory/InventoryService.js';
import { addResource } from '../economy/wallet.js';
import { recordTalentDiscovered, recordExpeditionDeparture, recordExpeditionReturn, recordSingularVictory } from '../achievements/AchievementService.js';
import { getActiveJourney } from './journeys.js';

// Expéditions singulières (v1.1), sans interface — règles : data/singularExpedition.js.
//
// Les dix adversaires sont tirés avec la proposition (offer.opponents, visibles avant de partir).
// L'expédition en cours vit dans session.expeditions.run (sauvegardée) :
//   { id, offerId, placeId, band, cost, reward, fighterIds: [3], ko: [ids], stage (0 → 10),
//     opponents, opponentHp (PV de l'adversaire du combat en cours, s'il a déjà battu quelqu'un),
//     hp / maxHp / startFatigue (v1.1.7 : PV gardés d'un combat à l'autre, fatigue du départ),
//     nextOpponentFatigue (Fumée des pins), boons: [{ id, fighterId, fightsLeft }], used: { [fighterId]: [boonId] },
//     rewards: [{ id, talentId? }], phase: 'fight' | 'choice' | 'victory' | 'defeat', options, history: [{ stage, fighterId, won }] }
// Aucun jour ne passe tant qu'elle dure (HubScreen.advanceDay y ramène).

const stateOf = (session) => {
  if (!session.expeditions || typeof session.expeditions !== 'object') session.expeditions = { seasonKey: null, offers: [], chosenOfferId: null, journeys: [] };
  return session.expeditions;
};

/** Expédition singulière en cours, ou null. */
export function getSingularRun(session) {
  const run = session?.expeditions?.run;
  return run && run.status === 'active' ? run : null;
}

// --- Adversaires ---

/** Talents de combat qu'un adversaire peut porter, pour une famille (sans saison ni condition de lieu). */
export function opponentTalentPool(rarity, rules = SINGULAR_RULES) {
  return TALENTS.filter((talent) => talent.rarity === rarity && !talent.season && talent.weight > 0 && talent.sources.includes('tavern')
    && talent.effects.every((effect) => rules.opponentEffectTypes.includes(effect.type) && !effect.season && !rules.opponentExcludedWhen.includes(effect.when)));
}

/** Étoiles du combat `index` (0 → 9) d'une tranche : montée régulière, par demi-étoile. */
export function opponentStars(band, index, rules = SINGULAR_RULES) {
  if (index >= rules.fights - 1) return band.bossStars;
  const raw = band.minStars + ((band.maxStars - band.minStars) * index) / (rules.fights - 2);
  return Math.max(band.minStars, Math.min(band.maxStars, Math.floor(raw * 2) / 2));
}

/** Les dix adversaires d'une expédition singulière : [{ fighter (données), stars, talents, boss }]. */
export function generateSingularOpponents(bandIndex, rng = Math.random, rules = SINGULAR_RULES) {
  const band = rules.bands[bandIndex] ?? rules.bands[0];
  const names = generateFighterNames(rules.fights, rng);
  return names.map((name, index) => {
    const stars = opponentStars(band, index, rules);
    const fighter = generateTavernRecruit({ specialtyId: pick(rng, SPECIALTY_IDS), name, starRange: { minStars: stars, maxStars: stars }, rng });
    const boss = index === rules.fights - 1;
    const talents = [];
    const count = boss ? band.bossTalents : index + 1 >= rules.talentFrom && rng() < rules.talentChance ? 1 : 0;
    for (let k = 0; k < count; k++) {
      // Famille voulue ; si elle n'a plus de talent de combat libre, la suivante (épique → rare → ordinaire).
      const wanted = boss ? band.bossRarity : pick(rng, band.rarities);
      const order = [wanted, ...['epic', 'rare', 'common'].filter((r) => r !== wanted)];
      const pool = order.map((rarity) => opponentTalentPool(rarity, rules).filter((talent) => !talents.includes(talent.id))).find((list) => list.length) ?? [];
      if (pool.length) talents.push(pick(rng, pool).id);
    }
    fighter.talents = talents;
    fighter.stats.fatigue = 0;
    return { fighter: fighter.toJSON(), stars, talents, boss };
  });
}

// --- Départ ---

/** PV du combattant dans l'expédition (ils ne se récupèrent pas d'un combat à l'autre). */
export function runHp(session, run, fighterId) {
  const kept = run.hp?.[fighterId];
  if (typeof kept === 'number') return kept;
  return getStat(session.getFighter(fighterId), 'hp');
}

/** PV au plus (ceux du combattant au départ). */
export function runMaxHp(session, run, fighterId) {
  return run.maxHp?.[fighterId] ?? getStat(session.getFighter(fighterId), 'hp');
}

function setRunHp(session, run, fighterId, value) {
  run.hp ??= {};
  run.hp[fighterId] = Math.max(0, Math.min(runMaxHp(session, run, fighterId), Math.round(value)));
}

/** Ce combattant peut-il partir en expédition singulière ? { ok, reason } */
export function canJoinSingular(session, fighterOrId, rules = SINGULAR_RULES) {
  const id = typeof fighterOrId === 'string' ? fighterOrId : fighterOrId?.id;
  const fighter = session.playerFighters.find((f) => f.id === id);
  if (!fighter) return { ok: false, reason: 'Seuls les combattants de la compagnie peuvent partir.' };
  if (getActiveJourney(session, fighter)) return { ok: false, reason: 'Déjà en expédition.' };
  if (isStudying(session, fighter)) return { ok: false, reason: 'En étude au Scriptorium.' };
  if (getStat(fighter, 'fatigue') >= rules.exhaustedFatigue) return { ok: false, reason: 'Épuisé (fatigue 100).' };
  return { ok: true, reason: null };
}

/**
 * Départ : trois combattants, Ferveurs dépensées (`cost`). Renvoie { ok, reason, run }.
 * (ExpeditionService.startExpedition vérifie l'offre et appelle cette fonction.)
 */
export function createSingularRun(session, offer, fighterIds, { cost, rules = SINGULAR_RULES, expeditionRules = EXPEDITION_RULES } = {}) {
  const ids = [...new Set(fighterIds ?? [])];
  if (ids.length !== rules.squadSize) return { ok: false, reason: `Choisissez ${rules.squadSize} combattants.`, run: null };
  for (const id of ids) {
    const check = canJoinSingular(session, id, rules);
    if (!check.ok) return { ...check, run: null };
  }
  if (getSingularRun(session)) return { ok: false, reason: 'Une expédition singulière est déjà en cours.', run: null };
  if (!removeItem(session, expeditionRules.currencyItemId, cost).ok) return { ok: false, reason: 'Ferveurs insuffisantes.', run: null };
  for (const id of ids) session.getFighter(id).activityId = null;
  const run = {
    id: createId('singular'), status: 'active', offerId: offer.id, placeId: offer.placeId, band: offer.band ?? 0, cost,
    reward: offer.reward ? { ...offer.reward } : null, fighterIds: ids, ko: [], stage: 0,
    opponents: JSON.parse(JSON.stringify(offer.opponents ?? [])), nextOpponentFatigue: 0,
    boons: [], used: {}, rewards: [], phase: 'fight', options: [], history: [], fights: 0,
    // v1.1.7 : PV de chacun (ne se récupèrent pas), PV au plus et fatigue du départ (récupérée
    // avant chaque combat) ; PV de l'adversaire du combat en cours s'il a déjà battu quelqu'un.
    hp: Object.fromEntries(ids.map((id) => [id, getStat(session.getFighter(id), 'hp')])),
    maxHp: Object.fromEntries(ids.map((id) => [id, getStat(session.getFighter(id), 'hp')])),
    startFatigue: Object.fromEntries(ids.map((id) => [id, getStat(session.getFighter(id), 'fatigue')])),
    opponentHp: null,
  };
  const state = stateOf(session);
  state.run = run;
  state.chosenOfferId = offer.id;
  session.markDirty();
  recordExpeditionDeparture(session, offer.placeId);
  return { ok: true, reason: null, run };
}

// --- Combats ---

/** Le combattant peut-il entrer en lice pour le prochain combat ? { ok, reason } */
export function canFightNext(session, fighterId, rules = SINGULAR_RULES) {
  const run = getSingularRun(session);
  if (!run || run.phase !== 'fight') return { ok: false, reason: 'Aucun combat à livrer.' };
  if (!run.fighterIds.includes(fighterId)) return { ok: false, reason: 'Ne fait pas partie de l’expédition.' };
  if (run.ko.includes(fighterId) || runHp(session, run, fighterId) <= 0) return { ok: false, reason: 'KO jusqu’à la fin de l’expédition.' };
  if (getStat(session.getFighter(fighterId), 'fatigue') >= rules.exhaustedFatigue) return { ok: false, reason: 'Épuisé (fatigue 100).' };
  return { ok: true, reason: null };
}

/** Combattants encore en état de combattre. */
export function fightersAbleToFight(session, run = getSingularRun(session), rules = SINGULAR_RULES) {
  if (!run) return [];
  return run.fighterIds.filter((id) => !run.ko.includes(id) && runHp(session, run, id) > 0 && getStat(session.getFighter(id), 'fatigue') < rules.exhaustedFatigue);
}

/**
 * Adversaire du combat en cours (Fighter), sa fatigue de départ (Fumée des pins) et ses PV (gardés
 * s'il a déjà battu un combattant : v1.1.7).
 */
export function currentOpponent(run) {
  const entry = run.opponents[run.stage];
  if (!entry) return null;
  const fighter = Fighter.fromJSON(entry.fighter);
  fighter.talents = [...(entry.talents ?? [])];
  const maxHp = getStat(fighter, 'hp');
  return { entry, fighter, fatigue: Math.min(100, run.nextOpponentFatigue ?? 0), hp: run.opponentHp ?? maxHp, maxHp };
}

/** Bonus en cours d'un combattant (les « pour les trois » compris). */
export function boonsOf(run, fighterId) {
  return run.boons.filter((b) => b.fighterId === fighterId || b.fighterId === null).map((b) => ({ ...b, def: getSingularBoon(b.id) })).filter((b) => b.def);
}

/** Effets de combat des bonus d'un combattant (format des talents, talentId « boon-… »). */
function boonEffects(run, fighterId) {
  const used = run.used?.[fighterId] ?? [];
  return boonsOf(run, fighterId).flatMap((b) => (b.def.effects ?? [])
    .filter((effect) => !(b.def.once && used.includes(b.id)))
    .map((effect) => ({ ...effect, talentId: `boon-${b.id}` })));
}

/**
 * Livre le combat en cours avec ce combattant : simulation (une manche, un contre un), PV gardés
 * (v1.1.7 : la fatigue repart de celle du départ), KO, étape suivante.
 * Renvoie { ok, reason, simulation, won, fighterId, opponent, run }.
 */
export function fightNext(session, fighterId, { rng = Math.random, rules = SINGULAR_RULES } = {}) {
  const check = canFightNext(session, fighterId, rules);
  if (!check.ok) return { ...check, simulation: null };
  const run = getSingularRun(session);
  const arena = createArena(rules.arenaId);
  const fighter = session.getFighter(fighterId);
  const opponent = currentOpponent(run);
  const season = getCurrentSeason(session).id;
  const [slotA] = arena.getDefaultTiles(0, 1);
  const [slotB] = arena.getDefaultTiles(1, 1);
  const talentEffects = [...(canHaveTalents(session, fighter) ? combatEffectsOf(fighter, { season }) : []), ...boonEffects(run, fighterId)];
  // Fatigue récupérée entre deux combats : chacun repart de sa fatigue du départ.
  const startFatigue = run.startFatigue?.[fighterId] ?? getStat(fighter, 'fatigue');
  const units = [
    { ...createCombatUnit({ fighter, side: 'A', tile: slotA, fatigue: startFatigue, isCaptain: isCaptain(session, fighter), talentEffects, season }), hp: runHp(session, run, fighterId) },
    { ...createCombatUnit({ fighter: opponent.fighter, side: 'B', tile: slotB, fatigue: opponent.fatigue, talentEffects: combatEffectsOf(opponent.fighter, { season }), season }), hp: opponent.hp },
  ];
  const simulation = simulateRound({ arena, units, rng });
  const won = simulation.winnerSide === 'A';
  const finalOf = (id) => simulation.final.find((unit) => unit.id === id);
  // PV gardés jusqu'à la fin de l'expédition ; la fatigue du combattant ne change pas.
  setRunHp(session, run, fighterId, won ? Math.max(1, finalOf(fighter.id)?.hp ?? 1) : 0);
  // Amulette de l'ours : une seule survie dans l'expédition.
  if ((simulation.lastStands ?? []).some((stand) => stand.unitId === fighterId)) {
    const amulet = boonsOf(run, fighterId).find((b) => b.def.once);
    if (amulet) (run.used[fighterId] ??= []).push(amulet.id);
  }
  run.history.push({ stage: run.stage, fighterId, won, opponentId: opponent.entry.fighter.id });
  run.fights += 1;
  // Bonus limités en nombre de combats (Gourde d'hypocras) : décomptés pour celui qui a combattu.
  for (const b of run.boons) if (b.fightsLeft && (b.fighterId === fighterId || b.fighterId === null)) b.fightsLeft -= 1;
  run.boons = run.boons.filter((b) => b.fightsLeft === null || b.fightsLeft === undefined || b.fightsLeft > 0);
  if (won) {
    for (const b of boonsOf(run, fighterId)) if (b.def.afterWin?.hp) setRunHp(session, run, fighterId, runHp(session, run, fighterId) + b.def.afterWin.hp);
    run.stage += 1;
    run.opponentHp = null;
    run.nextOpponentFatigue = 0;
    if (run.stage >= rules.fights) {
      run.phase = 'victory';
    } else {
      run.phase = 'choice';
      run.options = rollOptions(session, run, createRng(`${run.id}:choice:${run.stage}`), rules);
    }
  } else {
    run.ko.push(fighterId);
    // L'adversaire garde ses PV pour le combattant suivant.
    run.opponentHp = Math.max(1, Math.round(finalOf(opponent.fighter.id)?.hp ?? opponent.hp));
    if (!fightersAbleToFight(session, run, rules).length) endRun(session, run, 'defeat');
  }
  session.markDirty();
  return { ok: true, reason: null, simulation, won, fighterId, opponent, run };
}

// --- Entre deux combats : bonus temporaires et récompenses de fin ---

function weightedPick(entries, rng) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  return entries.find((entry) => (roll -= entry.weight) < 0) ?? entries[entries.length - 1];
}

/** Trois propositions (bonus et récompense de fin), toutes différentes et utiles. */
export function rollOptions(session, run, rng = Math.random, rules = SINGULAR_RULES) {
  const anyKo = run.ko.length > 0;
  // Un bonus « une fois » (Amulette de l'ours) n'est proposé que si quelqu'un peut encore le recevoir.
  const boons = SINGULAR_BOONS.filter((b) => (b.target !== 'ko' || anyKo)
    && (!b.once || optionTargets(session, run, { kind: 'boon', id: b.id }).length));
  const out = [];
  const take = (pool, kind, count) => {
    let left = pool.filter((entry) => !out.some((o) => o.id === entry.id));
    for (let i = 0; i < count && left.length; i++) {
      const entry = weightedPick(left, rng);
      out.push({ kind, id: entry.id });
      left = left.filter((other) => other.id !== entry.id);
    }
  };
  // Récompense de fin seulement après certains combats (3 au plus) ; sinon trois bonus.
  const withReward = (rules.choice.rewardAfter ?? []).includes(run.stage);
  const rewards = SINGULAR_REWARDS.filter((r) => !r.bands || r.bands.includes(run.band ?? 0));
  take(boons, 'boon', withReward ? rules.choice.boons : rules.choice.boons + rules.choice.rewards);
  if (withReward) take(rewards, 'reward', rules.choice.rewards);
  return out;
}

/** Cibles possibles d'une proposition ([] : aucune à choisir). */
export function optionTargets(session, run, option) {
  if (option.kind !== 'boon') return [];
  const def = getSingularBoon(option.id);
  if (def?.target === 'one') return run.fighterIds.filter((id) => !run.ko.includes(id) && !(def.once && run.boons.some((x) => x.id === def.id && x.fighterId === id)));
  if (def?.target === 'ko') return [...run.ko];
  return [];
}

/**
 * Garde une proposition (`index`) ; `targetId` : le combattant visé (bonus « un combattant » ou
 * « KO »). Renvoie { ok, reason }.
 */
export function chooseOption(session, index, targetId = null, { rules = SINGULAR_RULES } = {}) {
  const run = getSingularRun(session);
  if (!run || run.phase !== 'choice') return { ok: false, reason: 'Aucune proposition en cours.' };
  const option = run.options[index];
  if (!option) return { ok: false, reason: 'Proposition inconnue.' };
  const targets = optionTargets(session, run, option);
  if (targets.length && !targets.includes(targetId)) return { ok: false, reason: 'Choisissez le combattant.' };
  if (option.kind === 'boon') {
    const def = getSingularBoon(option.id);
    const now = def.now ?? {};
    const fighterIds = def.target === 'all' ? run.fighterIds.filter((id) => !run.ko.includes(id)) : targetId ? [targetId] : [];
    if (now.revive) {
      run.ko = run.ko.filter((id) => id !== targetId);
      setRunHp(session, run, targetId, now.hp ?? 1);
    } else if (now.hp) {
      for (const id of fighterIds) setRunHp(session, run, id, runHp(session, run, id) + now.hp);
    }
    if (now.opponentFatigue) run.nextOpponentFatigue = Math.min(100, (run.nextOpponentFatigue ?? 0) + now.opponentFatigue);
    if (def.effects || def.afterWin) run.boons.push({ id: def.id, fighterId: def.target === 'all' ? null : targetId, fightsLeft: def.fights ?? null });
  } else {
    const def = getSingularReward(option.id);
    const entry = { id: def.id };
    // Parchemin : le talent est tiré tout de suite (connu jusqu'à la victoire).
    if (def.talentRarity) {
      const pool = TALENTS.filter((t) => t.rarity === def.talentRarity && t.weight > 0 && t.sources.includes('tavern'));
      entry.talentId = pick(createRng(`${run.id}:parchemin:${run.stage}`), pool).id;
    }
    run.rewards.push(entry);
  }
  run.options = [];
  run.phase = 'fight';
  // Plus personne en état d'entrer en lice (KO ou épuisés à 100) : l'expédition est perdue.
  if (!fightersAbleToFight(session, run, rules).length) endRun(session, run, 'defeat');
  session.markDirty();
  return { ok: true, reason: null };
}

// --- Fin ---

function endRun(session, run, outcome) {
  run.phase = outcome;
  if (outcome !== 'victory') {
    run.status = outcome === 'abandoned' ? 'abandoned' : 'lost';
    stateOf(session).lastRun = { id: run.id, placeId: run.placeId, outcome: run.status, stage: run.stage, fighterIds: [...run.fighterIds] };
    stateOf(session).run = null;
  }
  session.markDirty();
}

/** Abandon : l'expédition est perdue (Ferveurs comprises), chacun rentre avec sa fatigue. */
export function abandonRun(session) {
  const run = getSingularRun(session);
  if (!run) return { ok: false, reason: 'Aucune expédition en cours.' };
  endRun(session, run, 'abandoned');
  return { ok: true, reason: null };
}

/**
 * Ce qu'il faut attribuer à la victoire : [{ key, kind: 'talent' | 'potential' | 'skills', talentId?,
 * value?, eligible: [fighterIds], source: 'card' | rewardId }].
 */
export function getVictoryClaims(session, run = session.expeditions?.run) {
  if (!run || run.phase !== 'victory') return [];
  const claims = [];
  const all = run.fighterIds;
  // Talent : à l'un des trois qui peut avoir des talents et ne l'a pas déjà (v1.1.7 : même s'il en a
  // deux — il remplace alors celui de son choix).
  const talentClaim = (key, talentId, source) => ({
    key, kind: 'talent', talentId, source,
    eligible: all.filter((id) => canHaveTalents(session, session.getFighter(id)) && !(session.getFighter(id).talents ?? []).includes(talentId)),
  });
  if (run.reward?.type === 'talent') claims.push(talentClaim('card', run.reward.talentId, 'card'));
  if (run.reward?.type === 'potential') claims.push({ key: 'card', kind: 'potential', value: run.reward.value ?? 1, source: 'card', eligible: all.filter((id) => getPotential(session.getFighter(id)) < EXPEDITION_RULES.peregrination.potentialMax) });
  run.rewards.forEach((entry, index) => {
    const def = getSingularReward(entry.id);
    if (def?.talentRarity) claims.push(talentClaim(`reward-${index}`, entry.talentId, def.id));
    if (def?.potential) claims.push({ key: `reward-${index}`, kind: 'potential', value: def.potential, source: def.id, eligible: all.filter((id) => getPotential(session.getFighter(id)) < EXPEDITION_RULES.peregrination.potentialMax) });
    if (def?.skills) claims.push({ key: `reward-${index}`, kind: 'skills', value: singularRewardValue(def.skills, run.band), source: def.id, eligible: [...all] });
  });
  return claims;
}

/** Le combattant a-t-il besoin de remplacer un talent pour recevoir celui-ci ? */
export function claimNeedsSlot(session, fighterId) {
  return (session.getFighter(fighterId)?.talents ?? []).filter((id) => getTalent(id)).length >= TALENT_RULES.maxPerFighter;
}

/**
 * Plan des talents attribués (v1.1.7), dans l'ordre des récompenses : chaque combattant peut en
 * recevoir plusieurs, en remplaçant à chaque fois le talent de son choix (une place une seule fois).
 * `assignments[key]` : { fighterId | null (non attribué), slot }. Renvoie { ok, reason, steps } —
 * steps[key] : { needsSlot, talents (ses talents à ce moment, pour choisir la place) }.
 */
export function planTalentClaims(session, claims, assignments = {}) {
  const virtual = new Map();
  const replaced = new Map();
  const steps = {};
  let reason = null;
  for (const claim of claims.filter((c) => c.kind === 'talent')) {
    const id = assignments[claim.key]?.fighterId;
    if (!id) continue;
    if (!virtual.has(id)) virtual.set(id, (session.getFighter(id)?.talents ?? []).filter((t) => getTalent(t)));
    const talents = virtual.get(id);
    const needsSlot = talents.length >= TALENT_RULES.maxPerFighter;
    steps[claim.key] = { needsSlot, talents: [...talents] };
    if (talents.includes(claim.talentId)) { reason ??= 'Ce combattant a déjà ce talent.'; continue; }
    if (!needsSlot) { talents.push(claim.talentId); continue; }
    const slot = assignments[claim.key]?.slot;
    const used = replaced.get(id) ?? new Set();
    if (![0, 1].includes(slot)) { reason ??= 'Choisissez le talent remplacé.'; continue; }
    if (used.has(slot)) { reason ??= 'Ce talent vient déjà d’être remplacé : choisissez l’autre.'; continue; }
    used.add(slot);
    replaced.set(id, used);
    talents[slot] = claim.talentId;
  }
  return { ok: !reason, reason, steps };
}

/**
 * Victoire : récompense de la carte, récompenses de fin, Compagnon du Baron, Voyageur aguerri.
 * `assignments` : { [claimKey]: { fighterId, slot? } } (talent, potentiel, compétences).
 * Renvoie { ok, reason, summary: [lignes] }.
 */
export function claimVictory(session, assignments = {}, { grantCardReward, rules = EXPEDITION_RULES, report = null } = {}) {
  const run = session.expeditions?.run;
  if (!run || run.phase !== 'victory') return { ok: false, reason: 'L’expédition n’est pas gagnée.' };
  const claims = getVictoryClaims(session, run);
  // Talents : un combattant peut en recevoir plusieurs (place remplacée au choix) ; v1.1.7.
  const plan = planTalentClaims(session, claims, assignments);
  if (!plan.ok) return { ok: false, reason: plan.reason };
  // Potentiel : pas plus de flammes que la place qui reste (3 au plus).
  const flames = {};
  for (const claim of claims.filter((c) => c.kind === 'potential')) {
    const id = assignments[claim.key]?.fighterId;
    if (id) flames[id] = (flames[id] ?? 0) + claim.value;
  }
  if (Object.entries(flames).some(([id, n]) => getPotential(session.getFighter(id)) + n > rules.peregrination.potentialMax)) return { ok: false, reason: 'Ce combattant ne peut pas recevoir autant de potentiel (3 flammes au plus).' };
  // Chaque récompense : un combattant, ou « ne pas attribuer » (choix du joueur, v1.1.7).
  for (const claim of claims) {
    const pickOf = assignments[claim.key];
    if (claim.eligible.length && !pickOf) return { ok: false, reason: 'Choisissez qui reçoit chaque récompense (ou de ne pas l’attribuer).' };
    if (pickOf?.fighterId && !claim.eligible.includes(pickOf.fighterId)) return { ok: false, reason: 'Ce combattant ne peut pas recevoir cette récompense.' };
  }
  const summary = [];
  // Récompense de la carte (deniers, recrue : comme au retour d'une pérégrination).
  if (run.reward && ['deniers', 'recruit'].includes(run.reward.type)) summary.push(grantCardReward(run.reward));
  const byKey = new Map(claims.map((claim) => [claim.key, claim]));
  const applyClaim = (claim) => {
    const pickOf = assignments[claim.key];
    const fighter = pickOf ? session.getFighter(pickOf.fighterId) : null;
    if (!fighter) return;
    if (claim.kind === 'talent') {
      const slot = plan.steps[claim.key]?.needsSlot ? pickOf.slot : null;
      const previous = slot === null ? null : fighter.talents[slot];
      if (setFighterTalentAt(session, fighter, claim.talentId, slot)) {
        recordTalentDiscovered(session, claim.talentId);
        summary.push({ type: 'talent', fighterId: fighter.id, name: fighter.name, talentId: claim.talentId, previousId: previous });
      }
    } else if (claim.kind === 'potential') {
      const before = getPotential(fighter);
      fighter.potential = Math.min(rules.peregrination.potentialMax, before + claim.value);
      summary.push({ type: 'potential', fighterId: fighter.id, name: fighter.name, before, potential: fighter.potential });
    } else if (claim.kind === 'skills') {
      const gains = Object.fromEntries(LEVEL_STAT_IDS.map((statId) => [statId, improveStat(fighter, statId, claim.value)]));
      summary.push({ type: 'skills', fighterId: fighter.id, name: fighter.name, gains });
    }
  };
  if (byKey.has('card')) applyClaim(byKey.get('card'));
  // Récompenses de fin.
  run.rewards.forEach((entry, index) => {
    const def = getSingularReward(entry.id);
    if (!def) return;
    const band = run.band ?? 0;
    if (def.deniers) { const n = singularRewardValue(def.deniers, band); addResource(session, 'deniers', n); summary.push({ type: 'deniers', amount: n, source: def.id }); }
    if (def.ferveurs) { const n = singularRewardValue(def.ferveurs, band); addItem(session, rules.currencyItemId, n); summary.push({ type: 'ferveurs', amount: n }); }
    if (def.refund) { const n = Math.floor(run.cost * def.refund); if (n) addItem(session, rules.currencyItemId, n); summary.push({ type: 'ferveurs', amount: n }); }
    if (def.item) { const n = singularRewardValue(def.item.quantity, band); addItem(session, def.item.id, n); summary.push({ type: 'item', itemId: def.item.id, quantity: n }); }
    if (def.recruit) summary.push(grantCardReward({ type: 'recruit', minPotential: def.recruit.minPotential }, `${run.id}:recrue:${index}`));
    if (byKey.has(`reward-${index}`)) applyClaim(byKey.get(`reward-${index}`));
  });
  // Compagnon du Baron (l'un des trois) : seconde récompense de la tranche, jamais un talent.
  const companion = run.fighterIds.map((id) => session.getFighter(id)).find((f) => f && hasExpeditionBonusReward(f));
  if (companion) {
    const band = rules.costBands[run.band] ?? rules.costBands[0];
    const pool = band.rewards.filter((r) => r.type !== 'talent' && (r.type !== 'potential' || getPotential(companion) < rules.peregrination.potentialMax));
    if (pool.length) summary.push({ ...grantCardReward(null, `${run.id}:bonus`, { pool, fighter: companion }), bonus: true, name: companion.name, fighterId: companion.id });
  }
  // Voyageur aguerri : +N dans chaque compétence de combat.
  for (const id of run.fighterIds) {
    const f = session.getFighter(id);
    const points = f ? expeditionTraining(f) : 0;
    if (points) summary.push({ type: 'skills', fighterId: f.id, name: f.name, gains: Object.fromEntries(LEVEL_STAT_IDS.map((statId) => [statId, improveStat(f, statId, points)])), training: true });
  }
  run.status = 'won';
  stateOf(session).lastRun = { id: run.id, placeId: run.placeId, outcome: 'won', stage: run.stage, fighterIds: [...run.fighterIds], summary };
  stateOf(session).run = null;
  session.markDirty();
  recordExpeditionReturn(session, { report });
  recordSingularVictory(session, run, { report });
  return { ok: true, reason: null, summary };
}

export function placeOfRun(run) {
  return getExpeditionPlace(run.placeId);
}

