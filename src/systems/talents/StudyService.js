import { STUDY_RULES } from '../../data/scriptorium.js';
import { createId } from '../../utils/id.js';
import { createRng } from '../../utils/random.js';
import { getPotential } from '../fighters/PotentialService.js';
import { getFighterTalents, getTalent, rollRarity, pickTalentOfRarity, setFighterTalentAt } from './TalentService.js';
import { TALENT_RULES } from '../../data/talents.js';
import { getActiveOdds, getDeskCount } from './ScriptoriumUpgradeService.js';
import { canAfford, spendResource } from '../economy/wallet.js';
import { adjustStudyDuration } from './TalentEffects.js';
import { checkAchievements, recordTalentDiscovered } from '../achievements/AchievementService.js';
import { isOnPeregrination, PEREGRINATION_REASON } from '../expeditions/journeys.js';

// Le Scriptorium — étude des talents, sans interface.
//
// Une étude est enregistrée avec la partie (session.studies) :
//   { id, fighterId, startDay, duration, endDay, status, talentId, closedOnDay, notified,
//     ceremonyShown (révélation montrée au Scriptorium : présentation), mode ('first' | 'second' |
//     'replace', v0.72), slot (place révélée ou remplacée : 0 ou 1), cost, previousTalentId }
//   status : 'active' (en cours) | 'choosing' (v1.2.3 : étude finie, trois talents proposés,
//            choices) | 'completed' (talent choisi) | 'interrupted' | 'cancelled' (combattant
//            parti de la compagnie)
// v1.2.3 : à la fin de l'étude, la famille est tirée, puis STUDY_CHOICE_COUNT talents différents de
// cette famille ; le joueur en choisit un (chooseStudyTalent). Tant qu'un choix attend, la journée
// ne peut pas passer (HubScreen.advanceDay).
// Tout se déduit de ces données et du calendrier du jeu (jamais du temps réel) : un combattant
// est « en étude » tant qu'une étude active le concerne ; il est alors indisponible pour le
// Centre et les combats (vérifié par la logique de jeu, pas seulement par l'affichage).

// Études terminées gardées en mémoire (les plus récentes).
const HISTORY_LIMIT = 50;
/** Talents proposés à la fin d'une étude (même famille). */
export const STUDY_CHOICE_COUNT = 3;

/** Durée d'étude d'un combattant (jours), d'après son potentiel (0 à 3). */
export function getStudyDuration(fighter, rules = STUDY_RULES) {
  const base = rules.durationByPotential[getPotential(fighter)] ?? rules.durationByPotential[0];
  // Talents Studieux (jours en moins) et Érudit (moitié moins longtemps).
  return adjustStudyDuration(fighter, base);
}

function studiesOf(session) {
  if (!Array.isArray(session.studies)) session.studies = [];
  return session.studies;
}

const isPlayerFighter = (session, fighterId) => session.playerFighters.some((fighter) => fighter.id === fighterId);

/** Études en cours (combattants toujours dans la compagnie). */
export function getActiveStudies(session) {
  // (Appelé pour chaque combattant de chaque manche, IA comprise : sortie rapide sans étude.)
  if (!studiesOf(session).some((study) => study.status === 'active')) return [];
  return studiesOf(session).filter((study) => study.status === 'active' && isPlayerFighter(session, study.fighterId));
}

/** Étude en cours d'un combattant (ou la première étude en cours si aucun n'est précisé), ou null. */
export function getActiveStudy(session, fighterId = null) {
  return getActiveStudies(session).find((study) => fighterId === null || study.fighterId === fighterId) ?? null;
}

const idOf = (fighterOrId) => (typeof fighterOrId === 'string' ? fighterOrId : fighterOrId?.id);

/** Le combattant est-il en étude au Scriptorium ? */
export function isStudying(session, fighterOrId) {
  const id = idOf(fighterOrId);
  return Boolean(id) && getActiveStudy(session, id) !== null;
}

/**
 * Absent du camp : en étude au Scriptorium, ou (v0.98) parti en pérégrination avec le Baron.
 * Il n'a alors ni activité au Centre, ni place dans un combat.
 */
export function isAway(session, fighterOrId) {
  return isStudying(session, fighterOrId) || isOnPeregrination(session, fighterOrId);
}

/**
 * Disponibilité d'un combattant pour les activités du Centre et les combats : indisponible
 * pendant une étude ou une pérégrination. (Les combattants des clubs de l'IA ne partent jamais.)
 */
export function isFighterAvailable(session, fighterOrId) {
  return !isAway(session, fighterOrId);
}

export const STUDYING_REASON = 'En étude au Scriptorium : indisponible jusqu’à la fin de son étude.';

/** Pourquoi le combattant est absent (étude ou pérégrination), ou null. */
export function awayReason(session, fighterOrId) {
  if (isStudying(session, fighterOrId)) return STUDYING_REASON;
  if (isOnPeregrination(session, fighterOrId)) return PEREGRINATION_REASON;
  return null;
}

/** Places libres au Bureau d'étude. */
export function getFreeDesks(session) {
  return Math.max(0, getDeskCount(session) - getActiveStudies(session).length);
}

/**
 * Ce que révélera une étude de ce combattant (v0.72 : deux talents par combattant) :
 *   'first'   aucun talent : son premier talent — gratuit ;
 *   'second'  un talent : son second talent, qui s'ajoute au premier — gratuit ;
 *   'replace' deux talents : un nouveau talent REMPLACE celui qu'on choisit (premier ou second) —
 *             STUDY_RULES.replaceCost deniers.
 * Renvoie { mode, cost, slots } (slots : places qu'on peut remplacer, [] sinon).
 */
export function getStudyPlan(session, fighter, rules = STUDY_RULES) {
  const count = getFighterTalents(session, fighter).length;
  if (count >= TALENT_RULES.maxPerFighter) return { mode: 'replace', cost: rules.replaceCost, slots: Array.from({ length: TALENT_RULES.maxPerFighter }, (_, i) => i) };
  return { mode: count === 0 ? 'first' : 'second', cost: 0, slots: [] };
}

/** Prix d'une étude pour ce combattant : gratuite tant qu'il a une place libre, sinon STUDY_RULES.replaceCost. */
export function getStudyCost(session, fighter, rules = STUDY_RULES) {
  return getStudyPlan(session, fighter, rules).cost;
}

/**
 * Le combattant peut-il commencer une étude ? { ok, reason, cost, plan }. `slot` : talent à
 * remplacer (0 : premier, 1 : second), exigé quand il a déjà ses deux talents ; sans `slot`, la
 * réponse dit seulement s'il peut étudier (choix de la place à faire ensuite).
 */
export function canStartStudy(session, fighterId, { slot = null, rules = STUDY_RULES } = {}) {
  const fighter = session.playerFighters.find((f) => f.id === fighterId);
  if (!fighter) return { ok: false, reason: 'Seuls les combattants de la compagnie peuvent étudier.', cost: 0, plan: null };
  const plan = getStudyPlan(session, fighter, rules);
  const { cost } = plan;
  if (isStudying(session, fighterId)) return { ok: false, reason: 'Ce combattant étudie déjà.', cost, plan };
  if (getPendingTalentChoices(session).some((study) => study.fighterId === fighterId)) return { ok: false, reason: 'Choisissez d’abord le talent de sa dernière étude.', cost, plan };
  if (isOnPeregrination(session, fighterId)) return { ok: false, reason: PEREGRINATION_REASON, cost, plan };
  if (getFreeDesks(session) <= 0) return { ok: false, reason: 'Le Bureau d’étude est complet : interrompez une étude ou attendez sa fin.', cost, plan };
  if (slot !== null && !plan.slots.includes(slot)) return { ok: false, reason: 'Ce talent ne peut pas être remplacé.', cost, plan };
  if (cost > 0 && !canAfford(session, 'deniers', cost)) return { ok: false, reason: `Deniers insuffisants : remplacer un talent coûte ${cost} deniers.`, cost, plan };
  return { ok: true, reason: null, cost, plan };
}

/**
 * Lance une étude : le combattant quitte son activité du Centre et devient indisponible. Début
 * (jour du calendrier), durée et fin sont enregistrés. Premier et second talent : gratuits. Un
 * combattant qui a ses deux talents choisit celui à remplacer (`slot`), paie l'étude (jamais
 * remboursée) et GARDE ce talent jusqu'à la révélation du nouveau.
 * Renvoie { ok, reason, study }.
 */
export function startStudy(session, fighterId, { slot = null, rules = STUDY_RULES } = {}) {
  const check = canStartStudy(session, fighterId, { slot, rules });
  if (!check.ok) return { ...check, study: null };
  if (check.plan.mode === 'replace' && slot === null) return { ok: false, reason: 'Choisissez le talent à remplacer.', cost: check.cost, study: null };
  const fighter = session.getFighter(fighterId);
  // Paiement au lancement effectif (contrôle du solde ici, pas seulement dans l'interface).
  if (check.cost > 0 && !spendResource(session, 'deniers', check.cost)) return { ok: false, reason: 'Deniers insuffisants.', study: null };
  const startDay = session.calendar.currentDay;
  const duration = getStudyDuration(fighter, rules);
  const replaced = check.plan.mode === 'replace' ? slot : null;
  const study = {
    id: createId('study'), fighterId, startDay, duration, endDay: startDay + duration,
    status: 'active', talentId: null, closedOnDay: null, notified: false,
    // mode : 'first' | 'second' | 'replace' ; slot : place révélée (0 ou 1) ou remplacée.
    mode: check.plan.mode, slot: replaced ?? (fighter.talents?.length ?? 0),
    cost: check.cost, previousTalentId: replaced === null ? null : fighter.talents[replaced] ?? null, rarity: null,
  };
  fighter.activityId = null;
  studiesOf(session).push(study);
  session.markDirty();
  return { ok: true, reason: null, study };
}

function trimHistory(session) {
  const closed = studiesOf(session).filter((study) => study.status !== 'active' && study.status !== 'choosing');
  if (closed.length <= HISTORY_LIMIT) return;
  const drop = new Set(closed.slice(0, closed.length - HISTORY_LIMIT));
  session.studies = studiesOf(session).filter((study) => !drop.has(study));
}

/**
 * Interrompt l'étude en cours d'un combattant (ou la seule en cours) : aucun talent n'est révélé,
 * le temps passé est perdu, le Bureau se libère et le combattant redevient disponible.
 * Renvoie { ok, reason, study }.
 */
export function interruptStudy(session, fighterId = null) {
  const study = getActiveStudy(session, fighterId);
  if (!study) return { ok: false, reason: 'Aucune étude en cours.', study: null };
  study.status = 'interrupted';
  study.closedOnDay = session.calendar.currentDay;
  trimHistory(session);
  session.markDirty();
  return { ok: true, reason: null, study };
}

/** Avancement d'une étude : { elapsed, remaining (jours), ratio (0 à 1), endDay }. */
export function getStudyProgress(session, study) {
  const elapsed = Math.max(0, Math.min(study.duration, session.calendar.currentDay - study.startDay));
  return { elapsed, remaining: Math.max(0, study.endDay - session.calendar.currentDay), ratio: study.duration ? elapsed / study.duration : 1, endDay: study.endDay };
}

/**
 * Termine les études arrivées à leur date de fin (calendrier du jeu) : un talent est révélé, une
 * seule fois (l'étude passe à 'completed'). Appelé chaque jour et au chargement d'une partie (une
 * sauvegarde ouverte après la date de fin termine l'étude sans rejouer de journée). Une étude dont
 * le combattant a quitté la compagnie est annulée. `report` : carnet de bord de la journée (la
 * révélation y est annoncée) ; sans carnet, elle sera annoncée à l'écran (takeUnnotifiedReveals).
 * Renvoie les événements 'talent.revealed'.
 */
export function completeDueStudies(session, { report = null } = {}) {
  const today = session.calendar.currentDay;
  const events = [];
  let changed = false;
  for (const study of studiesOf(session)) {
    if (study.status !== 'active') continue;
    if (!isPlayerFighter(session, study.fighterId)) {
      study.status = 'cancelled';
      study.closedOnDay = today;
      changed = true;
      continue;
    }
    if (study.endDay > today) continue;
    const fighter = session.getFighter(study.fighterId);
    // Place visée : celle à remplacer, ou la prochaine place libre. Étude d'avant la v0.72 (sans
    // `mode`) : payante = remplacement du talent unique (place 0), gratuite = premier talent.
    const owned = [...(fighter.talents ?? [])];
    const legacyReplace = !study.mode && study.cost > 0;
    const slot = study.mode === 'replace' || legacyReplace ? Math.min(study.slot ?? 0, Math.max(0, owned.length - 1)) : null;
    // Le talent gardé (l'autre place) n'est jamais tiré : pas de doublon. Celui qu'on remplace peut revenir.
    const exclude = owned.filter((_, index) => index !== slot);
    // Tirage À LA FIN DE L'ÉTUDE, avec l'artefact actif à ce moment : famille, puis (v1.2.3)
    // trois talents différents de cette famille, au choix du joueur.
    const odds = getActiveOdds(session);
    const rng = createRng(`study:${study.id}`);
    const rarity = rollRarity(odds, rng);
    const choices = [];
    let fallback = false;
    for (let i = 0; i < STUDY_CHOICE_COUNT; i++) {
      const pick = pickTalentOfRarity('study', rarity, rng, { exclude: [...exclude, ...choices] });
      if (!pick.talent) break;
      if (pick.fallback) fallback = true;
      choices.push(pick.talent.id);
    }
    study.status = 'choosing';
    study.choices = choices;
    study.targetSlot = slot;
    study.rarity = rarity;
    study.rarityFallback = fallback;
    study.odds = { ...odds };
    study.choiceDay = today;
    changed = true;
    const event = {
      type: 'talent.choice', fighterId: fighter.id, name: fighter.name, rarity, choices: [...choices],
      choiceNames: choices.map((id) => getTalent(id)?.name ?? id), replace: slot !== null,
      previousTalentName: slot !== null && owned[slot] ? getTalent(owned[slot])?.name ?? owned[slot] : null,
    };
    events.push(event);
    report?.add(event);
  }
  if (changed) {
    trimHistory(session);
    session.markDirty();
    // Succès : Révélation, Doublement doué, Touché par les dieux…
    checkAchievements(session, { report });
  }
  return events;
}

/**
 * Études finies dont le talent attend le choix du joueur (v1.2.3), de la plus ancienne à la plus
 * récente. Celle d'un combattant parti de la compagnie est annulée au passage.
 */
export function getPendingTalentChoices(session) {
  const pending = [];
  for (const study of studiesOf(session)) {
    if (study.status !== 'choosing') continue;
    if (!isPlayerFighter(session, study.fighterId)) {
      study.status = 'cancelled';
      study.closedOnDay = session.calendar.currentDay;
      session.markDirty?.();
      continue;
    }
    pending.push(study);
  }
  return pending;
}

/**
 * Le joueur choisit le talent d'une étude finie (un seul, parmi ses `choices`). Le talent prend la
 * place prévue (ajout, ou remplacement choisi au départ de l'étude). Renvoie { ok, reason, talent,
 * event } — event : 'talent.revealed' (comme une révélation).
 */
export function chooseStudyTalent(session, studyId, talentId) {
  const study = studiesOf(session).find((s) => s.id === studyId);
  if (!study || study.status !== 'choosing') return { ok: false, reason: 'Aucun talent à choisir pour cette étude.' };
  if (!(study.choices ?? []).includes(talentId)) return { ok: false, reason: 'Ce talent ne fait pas partie des trois proposés.' };
  const fighter = session.getFighter(study.fighterId);
  if (!fighter || !isPlayerFighter(session, study.fighterId)) return { ok: false, reason: 'Ce combattant a quitté la compagnie.' };
  const owned = [...(fighter.talents ?? [])];
  const slot = study.targetSlot ?? null;
  const previous = slot === null ? null : owned[slot] ?? null;
  const granted = setFighterTalentAt(session, fighter, talentId, slot);
  if (!granted) return { ok: false, reason: 'Ce talent ne peut pas lui être donné.' };
  const today = session.calendar.currentDay;
  study.slot = slot ?? Math.max(0, (fighter.talents?.length ?? 1) - 1);
  study.status = 'completed';
  study.talentId = granted.id;
  study.previousTalentId = previous;
  study.closedOnDay = today;
  study.notified = true;
  // Succès : talent découvert (compteur des talents ordinaires), puis succès d'état.
  recordTalentDiscovered(session, granted.id);
  trimHistory(session);
  session.markDirty();
  checkAchievements(session);
  const event = {
    type: 'talent.revealed', fighterId: fighter.id, name: fighter.name, talentId: granted.id, talentName: granted.name,
    rarity: study.rarity, previousTalentId: previous, previousTalentName: previous ? getTalent(previous)?.name ?? previous : null,
    slot: study.slot, second: slot === null && study.slot === 1,
  };
  return { ok: true, reason: null, talent: granted, event };
}

/**
 * Révélations pas encore montrées au Scriptorium (cérémonie visuelle, lot VFX 4) : celles des
 * `maxAgeDays` derniers jours, renvoyées une seule fois puis marquées comme montrées (présentation
 * seulement ; une ancienne sauvegarde ne rejoue pas son historique). [{ fighterId, name, talentId,
 * talentName, rarity }].
 */
export function takeUnseenRevealCeremonies(session, { maxAgeDays = 30 } = {}) {
  const today = session.calendar.currentDay;
  const ceremonies = [];
  for (const study of studiesOf(session)) {
    if (study.status !== 'completed' || study.ceremonyShown || !study.talentId) continue;
    study.ceremonyShown = true;
    if (today - (study.closedOnDay ?? today) > maxAgeDays) continue;
    const talent = getTalent(study.talentId);
    ceremonies.push({
      fighterId: study.fighterId, name: session.getFighter(study.fighterId)?.name ?? 'Un combattant',
      talentId: study.talentId, talentName: talent?.name ?? study.talentId, rarity: talent?.rarity ?? study.rarity ?? 'common',
    });
  }
  if (ceremonies.length) session.markDirty();
  return ceremonies;
}

/**
 * Révélations pas encore annoncées (terminées au chargement d'une partie) : renvoyées une seule
 * fois, puis marquées comme annoncées. [{ fighterId, name, talentId, talentName }].
 */
export function takeUnnotifiedReveals(session) {
  const reveals = [];
  for (const study of studiesOf(session)) {
    if (study.status !== 'completed' || study.notified || !study.talentId) continue;
    study.notified = true;
    const fighter = session.getFighter(study.fighterId);
    reveals.push({ fighterId: study.fighterId, name: fighter?.name ?? 'Un combattant', talentId: study.talentId, talentName: getTalent(study.talentId)?.name ?? study.talentId });
  }
  if (reveals.length) session.markDirty();
  return reveals;
}
