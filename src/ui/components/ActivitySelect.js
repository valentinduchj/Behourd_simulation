import { h } from '../../utils/dom.js';
import { CENTRE_LAYOUT } from '../../data/centreLayout.js';
import {
  listActivities, getActivity, getActivityTitle, getAssignedFighters, getFreeSlots, isCentreClosed, getActivityClosure,
} from '../../systems/activities/ActivityService.js';
import { getCurrentSeason } from '../../systems/climate/ClimateService.js';
import { isStudying, STUDYING_REASON } from '../../systems/talents/StudyService.js';
import { isOnPeregrination, PEREGRINATION_REASON } from '../../systems/expeditions/journeys.js';
import { gameState } from '../../state/gameState.js';
import { getFatigueState } from '../../systems/fighters/FatigueService.js';
import { FATIGUE_RULES } from '../../data/fatigue.js';

const REST_VALUE = '';
const STUDY_LABEL = '📜 En étude';
const JOURNEY_LABEL = '🧭 En expédition';

/** Libellé de l'activité actuelle d'un combattant. */
export function activityLabel(activityId) {
  const activity = activityId ? getActivity(activityId) : null;
  return activity ? `${activity.icon} ${activity.name}` : `${CENTRE_LAYOUT.rest.icon} Au repos`;
}

/**
 * Liste déroulante d'affectation : onChange(activityId | null).
 * Les zones pleines sont indiquées et désactivées (et, pour un épuisé, toutes sauf le Banquet) ; toute la liste est désactivée
 * quand le Centre est fermé (journée de combat). `compact` : nom court du lieu (« Mannequins »
 * plutôt que « Pôle Combat — Mannequins »), pour les tableaux.
 */
export function ActivitySelect(fighter, onChange, { id, session, compact = false } = {}) {
  // En étude au Scriptorium : pas d'activité possible jusqu'à la fin de l'étude (StudyService).
  if (session && isStudying(session, fighter)) {
    return h('select', { id, class: 'select select-sm is-studying', disabled: true, title: STUDYING_REASON, 'aria-label': `Activité de ${fighter.name}` },
      h('option', { value: REST_VALUE, selected: true }, STUDY_LABEL));
  }
  // En pérégrination (v0.98) : parti avec le Baron, pas d'activité jusqu'à son retour.
  if (session && isOnPeregrination(session, fighter)) {
    return h('select', { id, class: 'select select-sm is-studying is-journey', disabled: true, title: PEREGRINATION_REASON, 'aria-label': `Activité de ${fighter.name}` },
      h('option', { value: REST_VALUE, selected: true }, JOURNEY_LABEL));
  }
  const closed = session ? isCentreClosed(session) : false;
  // Épuisé (v0.75) : seul le Banquet lui reste ouvert.
  const exhausted = Boolean(fighter.stats) && getFatigueState(fighter).id === 'exhausted';
  return h(
    'select',
    {
      id,
      class: 'select select-sm',
      disabled: closed,
      title: closed ? 'Journée de combat : le Centre est fermé.' : exhausted ? `${fighter.name} est épuisé : seul le Banquet peut le remettre sur pied.` : null,
      'aria-label': `Activité de ${fighter.name}`,
      onchange: (event) => onChange(event.target.value === REST_VALUE ? null : event.target.value),
    },
    h('option', { value: REST_VALUE, selected: !fighter.activityId }, activityLabel(null)),
    listActivities(session).map((activity) => {
      const current = fighter.activityId === activity.id;
      let suffix = '';
      let full = false;
      if (session && activity.capacity) {
        const count = getAssignedFighters(session, activity.id).length;
        full = getFreeSlots(session, activity) <= 0 && !current;
        suffix = full ? ' — complet' : ` (${count}/${activity.capacity})`;
      }
      // Saison : lieu fermé (rivière asséchée en été, forêt enneigée en hiver).
      if (session && getActivityClosure(session, activity.id)) {
        full = true;
        suffix = ` — fermé (${getCurrentSeason(session).name.toLowerCase()})`;
      }
      if (exhausted && activity.id !== FATIGUE_RULES.centre.exhausted.refuge && !current) {
        full = true;
        suffix = ' — épuisé';
      }
      return h('option', { value: activity.id, selected: current, disabled: full }, `${activity.icon} ${compact ? activity.name : getActivityTitle(activity)}${suffix}`);
    }),
  );
}

/** État actuel d'un combattant : son activité du Centre, le repos, ou son étude au Scriptorium. */
export function ActivityChip(fighter, session = gameState.session) {
  if (session && isStudying(session, fighter)) {
    return h('span', { class: 'activity-chip is-studying', title: STUDYING_REASON }, STUDY_LABEL);
  }
  if (session && isOnPeregrination(session, fighter)) {
    return h('span', { class: 'activity-chip is-studying is-journey', title: PEREGRINATION_REASON }, JOURNEY_LABEL);
  }
  const activity = fighter.activityId ? getActivity(fighter.activityId) : null;
  return h(
    'span',
    { class: `activity-chip ${activity ? '' : 'is-idle'}`.trim(), style: { '--activity-color': activity?.color } },
    activityLabel(fighter.activityId),
  );
}
