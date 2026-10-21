import { AI_TALENT_RULES } from '../../data/aiTalents.js';
import { TALENTS } from '../../data/talents.js';
import { RESERVE_POOL } from '../../data/leagues.js';
import { COMBAT_TYPES } from '../talents/TalentEffects.js';
import { getTalent } from '../talents/TalentService.js';
import { selectTopFighters } from '../rating/RatingService.js';
import { getClubFighters } from './ClubService.js';
import { listAIClubs } from './AIRecruitmentService.js';
import { createRng, randInt } from '../../utils/random.js';

// Talents de combat des clubs de l'IA (v1.2.1, data/aiTalents.js) : tirés à la création des
// équipes, puis ajustés au plus juste à chaque fin de Coupe de France (après les retraites).
// Un combattant de la base de clubs garde ses talents dans aiFighterStates (la base n'est jamais
// modifiée) ; une recrue de la partie, sur elle-même.

/** Talents « de combat » d'une famille que l'IA peut recevoir (pas d'exotique, que des effets de manche). */
export function aiTalentPool(rarity, rules = AI_TALENT_RULES) {
  if (rules.excluded.includes(rarity)) return [];
  return TALENTS.filter((talent) => talent.rarity === rarity && rules.domains.includes(talent.domain)
    && talent.effects.every((effect) => COMBAT_TYPES.includes(effect.type)));
}

/** Règle du club : celle de sa division, ou celle des clubs hors championnat. */
export function clubTalentRule(session, clubId, rules = AI_TALENT_RULES) {
  const leagueId = session.getLeagueOfTeam(clubId)?.id ?? RESERVE_POOL.id;
  return rules.rules[leagueId] ?? rules.rules[RESERVE_POOL.id];
}

/** Fixe les talents d'un combattant de l'IA (et les enregistre dans la partie). */
export function setAIFighterTalents(session, fighter, talentIds) {
  const ids = [...new Set(talentIds)].slice(0, AI_TALENT_RULES.maxPerFighter);
  fighter.talents = ids;
  if (session.isBaseAIFighter(fighter.id)) {
    const state = (session.aiFighterStates[fighter.id] ??= {});
    state.talents = [...ids];
  }
}

const rarityOf = (id) => getTalent(id)?.rarity ?? null;
const hasRarity = (fighter, rarity) => (fighter.talents ?? []).some((id) => rarityOf(id) === rarity);

/**
 * Applique la règle d'un club. `mode` : 'create' (nombre tiré dans la fourchette) ou 'adjust'
 * (au plus juste : complété jusqu'au minimum, réduit au maximum ; un combattant sorti des cinq
 * premiers garde son talent sans compter ; une famille absente de la règle ne compte pas).
 * Renvoie [{ fighterId, talentId, action: 'add' | 'remove' }].
 */
export function applyClubTalentRule(session, clubId, rng = Math.random, { mode = 'adjust', rules = AI_TALENT_RULES } = {}) {
  const top = selectTopFighters(getClubFighters(session, clubId), rules.topCount).map((entry) => entry.fighter);
  const changes = [];
  for (const rule of clubTalentRule(session, clubId, rules)) {
    const holders = top.filter((fighter) => hasRarity(fighter, rule.rarity));
    const target = mode === 'create' && !holders.length
      ? randInt(rng, rule.min, rule.max)
      : Math.max(rule.min, Math.min(rule.max, holders.length));
    // Trop de combattants de cette famille parmi les cinq premiers : retraits au hasard.
    while (holders.length > target) {
      const fighter = holders.splice(randInt(rng, 0, holders.length - 1), 1)[0];
      const removed = fighter.talents.filter((id) => rarityOf(id) === rule.rarity);
      setAIFighterTalents(session, fighter, fighter.talents.filter((id) => rarityOf(id) !== rule.rarity));
      removed.forEach((talentId) => changes.push({ fighterId: fighter.id, talentId, action: 'remove' }));
    }
    // Pas assez : un talent à un combattant des cinq premiers qui a encore de la place.
    const pool = aiTalentPool(rule.rarity, rules);
    while (holders.length < target) {
      const candidates = top.filter((fighter) => !hasRarity(fighter, rule.rarity) && (fighter.talents ?? []).length < rules.maxPerFighter);
      if (!candidates.length || !pool.length) break;
      const fighter = candidates[randInt(rng, 0, candidates.length - 1)];
      const options = pool.filter((talent) => !(fighter.talents ?? []).includes(talent.id));
      const talent = options[randInt(rng, 0, options.length - 1)];
      setAIFighterTalents(session, fighter, [...(fighter.talents ?? []), talent.id]);
      holders.push(fighter);
      changes.push({ fighterId: fighter.id, talentId: talent.id, action: 'add' });
    }
  }
  return changes;
}

/**
 * Premier tirage (nouvelle partie, ou sauvegarde antérieure à la v1.2.1) : une seule fois, avec
 * un tirage propre à la partie (les autres tirages du monde ne sont pas décalés).
 * Renvoie le nombre de talents donnés.
 */
export function seedAITalents(session) {
  if (session.aiTalentsSeeded) return 0;
  // Graine tirée de la partie elle-même (compagnie du joueur) : même partie, mêmes talents.
  const rng = createRng(`talents-ia:${session.player?.teamId ?? ''}:${session.playerTeam?.name ?? ''}`);
  let given = 0;
  for (const clubId of listAIClubs(session)) given += applyClubTalentRule(session, clubId, rng, { mode: 'create' }).length;
  session.aiTalentsSeeded = true;
  return given;
}

/** Fin de Coupe de France (après les retraites) : chaque club de l'IA est ajusté à sa règle. */
export function reviewAITalents(session, rng = Math.random) {
  return listAIClubs(session).flatMap((clubId) => applyClubTalentRule(session, clubId, rng, { mode: 'adjust' }));
}
