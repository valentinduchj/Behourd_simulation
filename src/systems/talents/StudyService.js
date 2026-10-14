import { STUDY_RULES } from '../../data/scriptorium.js';
import { createId } from '../../utils/id.js';
import { createRng } from '../../utils/random.js';
import { getPotential } from '../fighters/PotentialService.js';
import { getFighterTalents, getTalent, rollTalentWithOdds, setFighterTalentAt } from './TalentService.js';
import { TALENT_RULES } from '../../data/talents.js';
import { getActiveOdds, getDeskCount } from './ScriptoriumUpgradeService.js';
import { canAfford, spendResource } from '../economy/wallet.js';
import { adjustStudyDuration } from './TalentEffects.js';
import { checkAchievements, recordTalentDiscovered } from '../achievements/AchievementService.js';

// Le Scriptorium — étude des talents, sans interface.
//
// Une étude est enregistrée avec la partie (session.studies) :
//   { id, fighterId, startDay, duration, endDay, status, talentId, closedOnDay, notified,
//     ceremonyShown (révélation montrée au Scriptorium : présentation), mode ('first' | 'second' |
//     'replace', v0.72), slot (place révélée ou remplacée : 0 ou 1), cost, previousTalentId }
//   status : 'active' (en cours) | 'completed' (talent révélé) | 'interrupted' | 'cancelled'
//            (combattant parti de la compagnie)
// Tout se déduit de ces données et du calendrier du jeu (jamais du temps réel) : un combattant
// est « en étude » tant qu'une étude active le concerne ; il est alors indisponible pour le
// Centre et les combats (vérifié par la logique de jeu, pas seulement par l'affichage).

// Études terminées gardées en mémoire (les plus récentes).
const HISTORY_LIMIT = 50;

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
 * Disponibilité d'un combattant pour les activités du Centre et les combats : indisponible
 * pendant une étude. (Les combattants des clubs de l'IA n'étudient jamais.)
 */
export function isFighterAvailable(session, fighterOrId) {
  return !isStudying(session, fighterOrId);
}

export const STUDYING_REASON = 'En étude au Scriptorium : indisponible jusqu’à la fin de son étude.';

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
  const closed = studiesOf(session).filter((study) => study.status !== 'active');
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
    // Tirage À LA RÉVÉLATION, avec l'artefact actif à ce moment : famille, puis talent.
    const odds = getActiveOdds(session);
    const { rarity, talent, fallback } = rollTalentWithOdds('study', odds, createRng(`study:${study.id}`), { exclude });
    const previous = slot === null ? null : owned[slot] ?? null;
    // Remplacement : le nouveau talent prend la place choisie ; sinon il s'ajoute.
    const granted = talent ? setFighterTalentAt(session, fighter, talent.id, slot) : null;
    study.slot = slot ?? Math.max(0, (fighter.talents?.length ?? 1) - 1);
    study.status = 'completed';
    study.talentId = granted?.id ?? null;
    study.rarity = rarity;
    study.rarityFallback = fallback;
    study.odds = { ...odds };
    study.previousTalentId = previous;
    study.closedOnDay = today;
    study.notified = Boolean(report);
    changed = true;
    if (!granted) continue;
    const event = {
      type: 'talent.revealed', fighterId: fighter.id, name: fighter.name, talentId: granted.id, talentName: granted.name,
      rarity, previousTalentId: previous, previousTalentName: previous ? getTalent(previous)?.name ?? previous : null,
      // v0.72 : place du talent (0 : premier, 1 : second) ; second : un second talent s'ajoute au premier.
      slot: study.slot, second: slot === null && study.slot === 1,
    };
    events.push(event);
    report?.add(event);
    // Succès : talent découvert (compteur des talents ordinaires).
    recordTalentDiscovered(session, granted.id);
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
