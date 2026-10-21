import { getTalent } from './TalentService.js';

// Effets des talents — LECTURE centralisée pour tous les systèmes (activités, fatigue, économie,
// Taverne, Scriptorium, potentiel, plafonds, combat). Les effets sont décrits dans data/talents.js ;
// aucun système ne teste un talent par son nom : il demande ici les effets d'un TYPE donné.
// Un combattant d'un club de l'IA n'a jamais de talent (fighter.talents vide) : aucun effet.

/**
 * Un effet est-il actif ? Un effet saisonnier (`season` : 'summer' | 'autumn' | 'winter' |
 * 'spring', data/talents.js) ne vaut que pendant sa saison ; sans saison connue, il est ignoré.
 */
export function isEffectActive(effect, { season = null, daysSinceReturn = null } = {}) {
  // Retour du pèlerin (v1.0) : seulement pendant les N jours qui suivent un retour d'expédition.
  if (effect.afterJourney && !(daysSinceReturn !== null && daysSinceReturn >= 0 && daysSinceReturn <= effect.afterJourney)) return false;
  return !effect.season || effect.season === season;
}

/** Effets d'un type portés par les talents d'un combattant : [{ type, …params, talentId }]. */
export function effectsOf(fighter, type, context = {}) {
  const out = [];
  for (const id of fighter?.talents ?? []) {
    const talent = getTalent(id);
    if (!talent) continue;
    for (const effect of talent.effects ?? []) if (effect.type === type && isEffectActive(effect, context)) out.push({ ...effect, talentId: talent.id });
  }
  return out;
}

/** Somme des `value` des effets d'un type (filtrés par `accept`). */
export function sumEffect(fighter, type, accept = () => true, context = {}) {
  return effectsOf(fighter, type, context).filter(accept).reduce((sum, effect) => sum + (effect.value ?? 0), 0);
}

/** Le combattant porte-t-il un effet de ce type ? */
export function hasEffect(fighter, type) {
  return effectsOf(fighter, type).length > 0;
}

/** Effets d'un type dans toute la compagnie : [{ fighter, effect }]. */
function companyEffects(session, type) {
  return session.playerFighters.flatMap((fighter) => effectsOf(fighter, type).map((effect) => ({ fighter, effect })));
}

// --- Centre : activités ---

/**
 * Réussite quotidienne en plus pour un combattant dans une activité : ses propres talents
 * (toute activité, ou celle-ci), plus l'Écuyer des AUTRES combattants affectés au même lieu.
 */
export function activityChanceBonus(session, fighter, activityId, context = {}) {
  const own = sumEffect(fighter, 'activityChance', (e) => e.activityId === null || e.activityId === activityId, context);
  const squires = session.playerFighters
    .filter((other) => other !== fighter && other.activityId === activityId)
    .reduce((sum, other) => sum + sumEffect(other, 'allyActivityChance', undefined, context), 0);
  return own + squires;
}

/** Gain en plus à chaque réussite d'une activité (deniers, fatigue récupérée, points de compétence). */
export function activityRewardBonus(fighter, activityId) {
  return sumEffect(fighter, 'activityReward', (e) => e.activityIds.includes(activityId));
}

// --- Fatigue ---

/** Facteur de son effort pendant la manche (Souffle long : 0,8 ; sinon 1). */
export function fatigueEffortFactor(fighter) {
  return effectsOf(fighter, 'fatigueEffort').reduce((factor, e) => factor * e.factor, 1);
}

/** Facteur de sa récupération : souffle, au sol, temps mort, entre deux manches (Second souffle : 2 ; sinon 1). */
export function fatigueRecoveryFactor(fighter) {
  return effectsOf(fighter, 'fatigueRecovery').reduce((factor, e) => factor * e.factor, 1);
}

/** Décalage de ses seuils de fatigue (Sang-froid : 10 ; sinon 0) : malus de dégâts et états du Centre. */
export function fatigueThresholdShift(fighter) {
  return sumEffect(fighter, 'fatigueThreshold');
}

/** Plafond de fatigue du combattant (null : aucun). */
export function fatigueCapOf(fighter) {
  const caps = effectsOf(fighter, 'fatigueCap').map((e) => e.value);
  return caps.length ? Math.min(...caps) : null;
}

/** Part de fatigue reçue par la compagnie selon son effectif engagé (Légende vivante : 0,75 ; sinon 1). */
export function squadFatigueFactor(fighters) {
  const factors = fighters.flatMap((fighter) => effectsOf(fighter, 'squadFatigue').map((e) => e.factor));
  return factors.length ? Math.min(...factors) : 1;
}

// --- Économie ---

/**
 * Revenus quotidiens des talents : Collecteur (par combattant), Trésorier du roi (par combattant
 * affecté en Forêt, une seule fois pour la compagnie). Renvoie { amount, details: [{ talentId, amount }] }.
 */
export function dailyTalentIncome(session) {
  const details = [];
  for (const { effect } of companyEffects(session, 'dailyDeniers')) details.push({ talentId: effect.talentId, amount: effect.value });
  const foresters = companyEffects(session, 'foresterDeniers');
  if (foresters.length) {
    const best = Math.max(...foresters.map(({ effect }) => effect.value));
    const count = session.playerFighters.filter((f) => f.activityId === 'forest').length;
    if (count) details.push({ talentId: foresters[0].effect.talentId, amount: best * count });
  }
  return { amount: details.reduce((sum, d) => sum + d.amount, 0), details };
}

/** Multiplicateur de la recette des victoires à domicile (compagnie, non cumulable). */
export function homeRewardMultiplier(session) {
  const values = companyEffects(session, 'homeRewardMultiplier').map(({ effect }) => effect.value);
  return values.length ? Math.max(...values) : 1;
}

/** Deniers en plus d'une victoire à domicile, selon les combattants qui y ont combattu. */
export function homeWinBonus(participants) {
  return participants.reduce((sum, fighter) => sum + sumEffect(fighter, 'homeWinDeniers'), 0);
}

/** Quêteur (v1.2) : deniers en plus d'une victoire de championnat à l'extérieur. */
export function awayWinBonus(participants) {
  return participants.reduce((sum, fighter) => sum + sumEffect(fighter, 'awayWinDeniers'), 0);
}

/** Économe (v1.2) : réduction du prix des améliorations du Bourg (compagnie, non cumulable). */
export function upgradeDiscount(session) {
  const values = companyEffects(session, 'upgradeDiscount').map(({ effect }) => effect.value);
  return values.length ? Math.max(...values) : 0;
}

/** Endurci / Increvable (v1.2) : facteur de ses courbatures de fin de combat (le plus fort ; 1 sinon). */
export function sorenessFactor(fighter) {
  const factors = effectsOf(fighter, 'sorenessFactor').map((e) => e.factor);
  return factors.length ? Math.min(...factors) : 1;
}

/** Bonus (fraction) de la récompense d'un Combat de la Reine gagné, selon ceux qui y ont combattu. */
export function queenRewardBonus(participants) {
  return participants.reduce((sum, fighter) => sum + sumEffect(fighter, 'queenReward'), 0);
}

/** Dévot : Ferveurs en plus pour un Combat de la Reine gagné (non cumulable : la meilleure). */
export function queenFerveurBonus(participants) {
  return participants.reduce((best, fighter) => Math.max(best, sumEffect(fighter, 'queenFerveur')), 0);
}

/** Marcheur : jours d'expédition en moins pour ce combattant. */
export function expeditionDaysCut(fighter) {
  return sumEffect(fighter, 'expeditionDays');
}

/** Éclaireur : Ferveurs en moins sur le coût des expéditions (compagnie, non cumulable). */
export function expeditionDiscount(session) {
  return (session.playerFighters ?? []).reduce((best, fighter) => Math.max(best, sumEffect(fighter, 'expeditionDiscount')), 0);
}

/** Voyageur aguerri : points de compétence au retour d'expédition. */
export function expeditionTraining(fighter) {
  return sumEffect(fighter, 'expeditionTraining');
}

/** Compagnon du Baron : seconde récompense d'expédition ? */
export function hasExpeditionBonusReward(fighter) {
  return effectsOf(fighter, 'expeditionBonusReward').length > 0;
}

/** Réduction du prix des recrues (compagnie, non cumulable : la meilleure). */
export function recruitDiscount(session) {
  const values = companyEffects(session, 'recruitDiscount').map(({ effect }) => effect.value);
  return values.length ? Math.max(...values) : 0;
}

// --- Scriptorium ---

/** Durée d'étude après talents (Studieux : jours en moins ; Érudit : durée multipliée), 1 jour au moins. */
export function adjustStudyDuration(fighter, days) {
  let result = days;
  for (const effect of effectsOf(fighter, 'studyFactor')) result = Math.ceil(result * effect.value);
  result -= sumEffect(fighter, 'studyDays');
  return Math.max(1, result);
}

// --- Carrière : potentiel et plafond ---

/** Le potentiel du combattant peut-il baisser à cet âge ? (Vieux loup, Élu des dieux) */
export function canPotentialDrop(fighter, age) {
  return !effectsOf(fighter, 'potentialFloor').some((e) => age < e.minAge);
}

/**
 * Chances de hausse en plus à cet âge, et possibilité de hausse hors des tranches d'âge prévues :
 * { value, anyAge }.
 */
export function potentialBoost(fighter, age) {
  // Tranche d'âge de l'effet : jusqu'à maxAge (Précoce), à partir de minAge (Tardif, v1.2).
  const effects = effectsOf(fighter, 'potentialBoost').filter((e) => (e.maxAge === null || e.maxAge === undefined || age <= e.maxAge)
    && (e.minAge === null || e.minAge === undefined || age >= e.minAge));
  return { value: effects.reduce((sum, e) => sum + e.value, 0), anyAge: effects.some((e) => e.anyAge) };
}

/** Crans de plafond de compétences en plus (Prodige). */
export function skillCapSteps(fighter) {
  return sumEffect(fighter, 'skillCapSteps');
}

// --- Combat : profil passé au moteur (src/combat/engine/, sans partie) ---

/**
 * Effets de combat d'un combattant, copiés dans son unité de manche. Avec la saison du combat
 * (`{ season }`), les effets saisonniers actifs y sont ; le moteur ne voit que des effets valides.
 */
export const COMBAT_TYPES = ['finalDamage', 'damageTaken', 'aura', 'enemyContact', 'guardCaptain', 'combatStats', 'fatigueThreshold', 'comboHits', 'luckyRoll', 'moveSpeed', 'lastStand', 'fatigueEffort', 'fatigueRecovery', 'fatigueCap', 'seasonImmune', 'fatigueIgnore', 'allyHeal', 'preferWounded', 'auraGuard', 'dodgeChance'];
export function combatEffectsOf(fighter, context = {}) {
  return COMBAT_TYPES.flatMap((type) => effectsOf(fighter, type, context));
}
