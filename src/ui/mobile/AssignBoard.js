import { h } from '../../utils/dom.js';
import { CENTRE_LAYOUT } from '../../data/centreLayout.js';
import { STAT_DEFINITIONS } from '../../data/stats.js';
import { FATIGUE_RULES } from '../../data/fatigue.js';
import {
  listActivities, getAssignedFighters, getFreeSlots, getActivityClosure, isTrainingUseless,
} from '../../systems/activities/ActivityService.js';
import { isStudying } from '../../systems/talents/StudyService.js';
import { isOnPeregrination } from '../../systems/expeditions/journeys.js';
import { isStatMaxed } from '../../systems/fighters/stats.js';
import { getFatigueState, fatigueLevelClass } from '../../systems/fighters/FatigueService.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { FighterSprite } from '../components/FighterSprite.js';
import { FighterStars } from '../components/Rating.js';
import { FighterName } from '../components/CaptainCrown.js';
import { haptic } from './Haptics.js';

// Affectations sur téléphone (v0.95, maquette « Affectations B · par lieu ») : une colonne par
// lieu (la cour, puis chaque activité) avec ses combattants. On touche un combattant — sa fiche
// (classe, étoiles, compétences, fatigue) s'affiche en haut — puis le lieu où l'envoyer ; les
// lieux possibles sont soulignés, les autres grisés (complet, fermé pour la saison, épuisé).
// Les règles restent celles d'ActivityService (CentreScreen.assign).

const SKILLS = STAT_DEFINITIONS.filter((def) => def.kind === 'skill');
// Compétence clé de chaque classe (mise en avant, comme sur les cartes du combat).
const KEY_SKILL = Object.freeze({ lutteur: 'wrestling', hastier: 'polearm', runner: 'percussion' });
const statShort = (id) => STAT_DEFINITIONS.find((def) => def.id === id)?.short ?? id;

/** Effet en quelques lettres : « LUT +1 », « Fatigue − », « deniers ». */
export function shortEffect(activity) {
  const reward = activity.reward ?? {};
  if (reward.type === 'stat' && reward.stat === 'fatigue') return 'Fatigue −';
  if (reward.type === 'stat') return `${statShort(reward.stat)} +${reward.amount ?? 1}`;
  if (reward.type === 'resource') return reward.resource;
  return '';
}

/**
 * Peut-on envoyer `fighter` dans `activityId` (null : la cour) ? { ok, reason }.
 * (Mêmes refus que la liste déroulante de l'ordinateur ; ActivityService tranche à la fin.)
 */
export function canSendTo(session, fighter, activityId, { closed = false } = {}) {
  if (!fighter) return { ok: false, reason: null };
  if (closed) return { ok: false, reason: 'Centre fermé' };
  if (isStudying(session, fighter)) return { ok: false, reason: 'En étude' };
  if (isOnPeregrination(session, fighter)) return { ok: false, reason: 'En expédition' };
  if ((fighter.activityId ?? null) === activityId) return { ok: false, reason: 'Déjà ici' };
  if (!activityId) return { ok: true, reason: null };
  const activity = listActivities(session).find((a) => a.id === activityId);
  if (!activity) return { ok: false, reason: null };
  if (getActivityClosure(session, activityId)) return { ok: false, reason: 'Fermé' };
  if (getFreeSlots(session, activity) <= 0) return { ok: false, reason: 'Complet' };
  if (getFatigueState(fighter).id === 'exhausted' && activityId !== FATIGUE_RULES.centre.exhausted.refuge) return { ok: false, reason: 'Épuisé' };
  return { ok: true, reason: null };
}

/** Fiche du combattant choisi : classe, étoiles, compétences (plafonnées en rouge), fatigue. */
function selectedStrip(screen, fighter) {
  if (!fighter) {
    return h('div', { class: 'm-assign-strip is-empty' },
      h('span', {}, 'Touchez un combattant, puis le lieu où l’envoyer.'));
  }
  const state = getFatigueState(fighter);
  const keyStat = KEY_SKILL[fighter.specialtyId] ?? null;
  return h('div', { class: 'm-assign-strip', 'data-fighter-id': fighter.id, style: { '--spec-color': fighter.specialty?.color } },
    FighterSprite(fighter, { size: 40, team: screen.session.playerTeam }),
    h('div', { class: 'm-assign-who' },
      h('strong', {}, FighterName(fighter, { session: screen.session })),
      h('span', {}, fighter.specialty?.name ?? '', ' ', FighterStars(calculateFighterLevel(fighter)))),
    h('div', { class: 'm-assign-stats', 'aria-label': 'Compétences' }, SKILLS.map((def) => h('span', {
      class: `m-assign-stat ${isStatMaxed(fighter, def.id) ? 'is-maxed' : ''} ${def.id === keyStat ? 'is-key' : ''}`.replace(/\s+/g, ' ').trim(),
      title: isStatMaxed(fighter, def.id) ? `${def.label} : ne peut plus progresser` : def.label,
    }, h('small', {}, def.short), h('b', {}, String(Math.round(fighter.stats[def.id] ?? def.base ?? 0)))))),
    h('span', { class: `m-assign-fatigue ${fatigueLevelClass(fighter)}` }, h('small', {}, 'FAT'), h('b', {}, String(Math.round(fighter.stats.fatigue ?? 0))), ` ${state.label}`),
    h('button', { type: 'button', class: 'm-assign-cancel', 'aria-label': 'Annuler la sélection', onclick: () => screen.select(null) }, '✕'));
}

/** Le tableau des lieux. `screen` : CentreScreen (session, selectedId, select(), assign(), closed). */
export function AssignBoard(screen) {
  const { session } = screen;
  const selected = screen.selectedId ? session.getFighter(screen.selectedId) : null;
  const fighters = session.playerFighters;
  const chip = (fighter) => {
    const studying = isStudying(session, fighter) || isOnPeregrination(session, fighter);
    return h('button', {
      type: 'button', class: `m-assign-chip ${fighter.id === screen.selectedId ? 'is-selected' : ''} ${studying ? 'is-studying' : ''}`.replace(/\s+/g, ' ').trim(),
      'data-fighter-id': fighter.id, 'aria-pressed': String(fighter.id === screen.selectedId),
      style: { '--spec-color': fighter.specialty?.color },
      onclick: (event) => {
        event.stopPropagation();
        haptic('tap');
        screen.select(fighter.id === screen.selectedId ? null : fighter.id);
      },
    },
    h('span', { class: `m-assign-dot ${fatigueLevelClass(fighter)}`, 'aria-hidden': 'true' }),
    h('span', { class: 'm-assign-name' }, fighter.name),
    studying ? h('span', { class: 'm-assign-tag', title: 'En étude au Scriptorium' }, '📜') : null,
    isOnPeregrination(session, fighter) ? h('span', { class: 'm-assign-tag', title: 'En expédition' }, '🧭') : null);
  };
  const column = ({ id, icon, name, effect, places, assigned, closedReason = null, useless = false }) => {
    const check = canSendTo(session, selected, id, { closed: screen.closed });
    const target = Boolean(selected) && check.ok;
    const dimmed = Boolean(selected) && !check.ok && (selected.activityId ?? null) !== id;
    return h('section', {
      class: `m-assign-col ${target ? 'is-target' : ''} ${dimmed ? 'is-dimmed' : ''} ${closedReason ? 'is-closed' : ''}`.replace(/\s+/g, ' ').trim(),
      'data-activity': id ?? 'rest', role: target ? 'button' : null, tabindex: target ? '0' : null,
      'aria-label': target ? `Envoyer ${selected.name} : ${name}` : name,
      onclick: () => {
        if (!target) {
          if (selected && check.reason && check.reason !== 'Déjà ici') haptic('warning');
          return;
        }
        haptic('select');
        screen.assign(selected.id, id);
      },
    },
    h('header', { class: 'm-assign-head' },
      h('span', { class: 'm-assign-icon', 'aria-hidden': 'true' }, icon),
      h('strong', {}, name)),
    h('p', { class: 'm-assign-meta' }, h('span', {}, effect), h('b', {}, places)),
    closedReason ? h('p', { class: 'm-assign-note' }, closedReason) : null,
    dimmed && check.reason && !closedReason ? h('p', { class: 'm-assign-note' }, check.reason) : null,
    useless ? h('p', { class: 'm-assign-note is-useless' }, 'Potentiel atteint') : null,
    h('div', { class: 'm-assign-chips' }, assigned.map(chip)));
  };
  const rest = fighters.filter((f) => !f.activityId);
  const columns = [
    column({ id: null, icon: CENTRE_LAYOUT.rest.icon, name: 'Au repos', effect: '—', places: String(rest.length), assigned: rest }),
    ...listActivities(session).map((activity) => {
      const assigned = getAssignedFighters(session, activity.id);
      const closure = getActivityClosure(session, activity.id);
      return column({
        id: activity.id, icon: activity.icon, name: activity.name, effect: shortEffect(activity),
        places: Number.isFinite(activity.capacity) && activity.capacity ? `${assigned.length} / ${activity.capacity}` : String(assigned.length),
        assigned, closedReason: closure ? 'Fermé pour la saison' : null,
        useless: Boolean(selected) && isTrainingUseless(selected, activity),
      });
    }),
  ];
  return h('div', { class: 'm-assign' },
    selectedStrip(screen, selected),
    screen.closed ? h('p', { class: 'm-assign-closed', role: 'status' }, '⚔ Journée de combat : le Centre est fermé.') : null,
    h('div', { class: 'm-assign-board' }, columns));
}
