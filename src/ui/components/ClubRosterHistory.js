import { h } from '../../utils/dom.js';
import { getSpecialty } from '../../data/specialties.js';
import { ROSTER_EVENT_TYPES } from '../../data/aiRecruitment.js';
import { getClubRosterEvents } from '../../systems/clubs/AIRecruitmentService.js';

// Historique d'effectif d'un club de l'IA (entrées et sorties), du plus récent au plus ancien :
//   Jour 105 — Eudes (23 ans), nouvel hastier a été recruté.
//   Jour 117 — Jean (26 ans), a été congédié.
//   Jour 203 — Marc (36 ans), est parti du club (retraite).
// Nom, âge et spécialité sont ceux enregistrés au moment de l'événement.

const who = (event) => (event.fighterAge === null ? event.fighterName : `${event.fighterName} (${event.fighterAge} ans)`);

const ROSTER_EVENT_FORMATS = {
  [ROSTER_EVENT_TYPES.RECRUITMENT]: (e) => ({ className: 'is-in', text: `${who(e)}, ${getSpecialty(e.specialty)?.newRecruitShort ?? 'nouveau combattant'} a été recruté.` }),
  [ROSTER_EVENT_TYPES.DEPART_NIVEAU]: (e) => ({ className: 'is-out', text: `${who(e)}, a été congédié.` }),
  [ROSTER_EVENT_TYPES.DEPART_RETRAITE]: (e) => ({ className: 'is-retired', text: `${who(e)}, est parti du club (retraite).` }),
};

/** Phrase d'un événement d'effectif. */
export function describeRosterEvent(event) {
  return (ROSTER_EVENT_FORMATS[event.type] ?? (() => ({ className: '', text: who(event) })))(event);
}

export function ClubRosterHistory(session, clubId, { title = 'Mouvements de l’effectif' } = {}) {
  const events = [...getClubRosterEvents(session, clubId)].reverse();
  return h(
    'section',
    { class: 'club-roster-history' },
    h('h3', { class: 'sheet-section-title' }, title),
    events.length
      ? h('ol', { class: 'club-roster-events' }, events.map((event) => {
        const { className, text } = describeRosterEvent(event);
        return h(
          'li',
          { class: `club-roster-event ${className}`.trim(), 'data-type': event.type },
          h('span', { class: 'club-roster-event-day' }, `Jour ${event.day}`),
          h('span', { class: 'club-roster-event-text' }, text),
        );
      }))
      : h('p', { class: 'muted' }, 'Aucun mouvement depuis le début de la partie.'),
  );
}
