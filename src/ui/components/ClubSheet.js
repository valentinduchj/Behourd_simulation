import { h } from '../../utils/dom.js';
import { calculateClubLevel, selectTopFighters } from '../../systems/fighters/ratings.js';
import { RATING_CONFIG } from '../../data/ratings.js';
import { openModal } from './Modal.js';
import { EmblemView } from './EmblemView.js';
import { FighterSprite } from './FighterSprite.js';
import { SpecialtyBadge, FighterClassTags } from './SpecialtyBadge.js';
import { ClubStars, FighterStars } from './Rating.js';
import { ClubHistory } from './ClubHistory.js';
import { ClubPalmares } from './ClubPalmares.js';
import { ClubRosterHistory } from './ClubRosterHistory.js';
import { FighterName } from './CaptainCrown.js';
import { TalentBadges } from './TalentBadge.js';
import { getProgressionIndicator, getIndicatorArrows } from '../../systems/clubs/AIProgressionService.js';
import { PROGRESSION_NONE } from '../../data/aiProgression.js';

/**
 * Fiche d'un club vue par le joueur : emblème, niveau et effectif.
 * Aucun score numérique n'est affiché, seulement des étoiles.
 */
export function openClubSheet(session, team) {
  const fighters = session.getFightersOfTeam(team.id);
  const ranked = selectTopFighters(fighters, fighters.length);
  const topCount = Math.min(RATING_CONFIG.clubTopCount, ranked.length);
  // Club adverse : progression de ses combattants sur 30 jours (indicateurs du service).
  const isAI = !team.ownerId;
  const today = session.calendar.currentDay;
  const indicatorOf = (fighter) => (isAI ? getProgressionIndicator(session, fighter.id, today) : PROGRESSION_NONE);
  const progressionMark = (fighter) => {
    const indicator = indicatorOf(fighter);
    if (indicator === PROGRESSION_NONE) return null;
    return h('span', {
      class: `progression-mark ${indicator === 'DOWN' ? 'is-down' : 'is-up'}`,
      'data-indicator': indicator,
      title: indicator === 'DOWN' ? 'En baisse' : 'En progression',
    }, getIndicatorArrows(indicator));
  };

  const roster = h(
    'ul',
    { class: 'club-roster' },
    ranked.map(({ fighter, level }, index) => h(
      'li',
      { class: index < topCount ? 'is-top' : '' },
      FighterSprite(fighter, { size: 44, team }),
      h('span', { class: 'club-roster-who' }, FighterName(fighter, { session, className: 'club-roster-name' }), progressionMark(fighter),
        // v1.2.1 : talents de combat (clubs de l'IA comme compagnie du joueur).
        (fighter.talents ?? []).length ? h('span', { class: 'club-roster-talents' }, ...TalentBadges(fighter, session)) : null),
      // [Elite] [Classe] dans une même cellule (la grille de l'effectif garde ses colonnes).
      h('span', { class: 'class-tags' }, ...FighterClassTags(fighter, session)),
      FighterStars(level),
    )),
  );

  const toggle = h('button', {
    type: 'button',
    class: 'btn btn-sm',
    'aria-pressed': 'false',
    onclick: () => {
      const shown = roster.classList.toggle('show-progression');
      toggle.setAttribute('aria-pressed', String(shown));
      toggle.textContent = shown ? 'Masquer la progression' : 'Montrer la progression';
    },
  }, 'Montrer la progression');
  const progressionControl = isAI
    ? h('div', { class: 'club-progression-control' }, toggle, h('p', { class: 'muted' }, 'progression sur les 30 derniers jours'))
    : null;

  const body = h(
    'div',
    { class: 'club-sheet' },
    h(
      'div',
      { class: 'club-sheet-head' },
      EmblemView(team.emblem, { size: 72, title: `Emblème de ${team.name}` }),
      h(
        'div',
        {},
        h('p', { class: 'eyebrow' }, team.ownerId ? 'Votre compagnie' : 'Club adverse'),
        ClubStars(calculateClubLevel(fighters)),
        h('p', { class: 'muted' }, `${fighters.length} combattant${fighters.length > 1 ? 's' : ''}. Le niveau du club repose sur ses ${topCount} meilleurs.`),
      ),
      // Palmarès (en haut à droite) : distinctions cumulées, déduites de l'historique du club.
      ClubPalmares(session, team.id),
    ),
    progressionControl,
    roster,
    ClubHistory(session, team.id),
    isAI ? ClubRosterHistory(session, team.id) : null,
  );

  return openModal({ title: team.name, body, className: 'modal-wide', actions: [{ label: 'Fermer', variant: 'primary' }] });
}
