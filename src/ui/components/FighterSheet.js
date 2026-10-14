import { h } from '../../utils/dom.js';
import { GAME_CONFIG } from '../../config/gameConfig.js';
import { renameFighter } from '../../systems/roster/rosterSystem.js';
import { assignActivity, getEffectiveActivity, describeActivityEffect, formatChance } from '../../systems/activities/ActivityService.js';
import { openModal, confirmModal } from './Modal.js';
import { canDismiss, dismiss } from '../../systems/roster/RosterService.js';
import { getFighterAge } from '../../systems/fighters/PotentialService.js';
import { PotentialFlames, PotentialCap, formatAge } from './Potential.js';
import { CaptainCrown, FighterName } from './CaptainCrown.js';
import { isCaptain } from '../../systems/roster/CaptainService.js';
import { FighterSprite } from './FighterSprite.js';
import { SpecialtyBadge, FighterClassTags } from './SpecialtyBadge.js';
import { StatList } from './StatList.js';
import { ActivitySelect } from './ActivitySelect.js';
import { showToast } from './Toast.js';
import { FighterStars } from './Rating.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { getNextMedal, getUnlockedMedals } from '../../systems/fighters/CareerStatsService.js';
import { getActiveStudy, getStudyProgress } from '../../systems/talents/StudyService.js';
import { TalentBadges } from './TalentBadge.js';

/**
 * Carrière : mises à terre (adversaires mis KO par son coup fatal) et médailles obtenues,
 * côte à côte de Bronze à Diamant (cumulatives, déduites du compteur).
 */
function CareerBlock(fighter) {
  const takedowns = fighter.record.takedowns ?? 0;
  const medals = getUnlockedMedals(takedowns);
  const next = getNextMedal(takedowns);
  return h(
    'div',
    { class: 'career-block' },
    h('div', { class: 'career-takedowns', title: 'Statistique de carrière : adversaires mis KO par son coup fatal, depuis ses débuts.' },
      h('span', { class: 'career-takedowns-label' }, 'Mises à terre'),
      h('strong', { class: 'career-takedowns-value' }, String(takedowns))),
    h('div', { class: 'career-medals', 'aria-label': 'Médailles de carrière' },
      medals.length
        ? medals.map((medal) => h('span', {
          class: 'career-medal', 'data-medal': medal.id, style: { '--medal-color': medal.color },
          title: `Médaille ${medal.name === 'Or' ? 'd’Or' : medal.name === 'Argent' ? 'd’Argent' : `de ${medal.name}`} — ${medal.threshold} mises à terre`,
        }, h('span', { class: 'career-medal-icon', 'aria-hidden': 'true' }, medal.icon), h('span', { class: 'career-medal-name' }, medal.name)))
        : h('span', { class: 'muted career-medals-none' }, 'Aucune médaille pour l’instant.')),
    next ? h('p', { class: 'muted career-next' }, `Prochaine médaille : ${next.icon} ${next.name} à ${next.threshold} mises à terre (encore ${next.threshold - takedowns}).`) : null,
  );
}

/** Palmarès : combats et manches réellement disputés. */
function RecordTable(record) {
  const row = (label, data) => h('tr', {}, h('th', { scope: 'row' }, label),
    h('td', { class: 'num' }, String(data.played)), h('td', { class: 'num' }, String(data.won)), h('td', { class: 'num' }, String(data.lost)));
  return h(
    'table',
    { class: 'record-table' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { class: 'num' }, 'Joués'), h('th', { class: 'num' }, 'Gagnés'), h('th', { class: 'num' }, 'Perdus'))),
    h('tbody', {}, row('Combats', record.matches), row('Manches', record.rounds)),
  );
}

/**
 * Fiche d'un combattant : nom modifiable, spécialité, statistiques, activité.
 * onChange() est appelé après chaque modification (renommage, affectation).
 */
export function openFighterSheet(session, fighter, { onChange } = {}) {
  const team = session.playerTeam;
  const { specialty } = fighter;

  // Titre : nom puis couronne du capitaine (élément distinct, le nom n'est pas modifié).
  const titleName = h('span', { class: 'fighter-name-text' }, fighter.name);
  const title = h('h2', { class: 'modal-title fighter-name-line' }, titleName, isCaptain(session, fighter) ? CaptainCrown() : null);

  // --- Nom ---
  const nameInput = h('input', {
    id: 'fighter-name', class: 'input', type: 'text', value: fighter.name,
    maxlength: GAME_CONFIG.fighter.nameMaxLength, autocomplete: 'off', spellcheck: 'false',
  });
  const nameError = h('p', { class: 'form-error', role: 'alert' });
  const nameForm = h(
    'form',
    {
      class: 'rename-form',
      onsubmit: (event) => {
        event.preventDefault();
        const problem = renameFighter(session, fighter.id, nameInput.value);
        if (problem) {
          nameError.textContent = problem;
          return;
        }
        nameError.textContent = '';
        nameInput.value = fighter.name;
        titleName.textContent = fighter.name;
        showToast('Nom modifié.', 'success');
        onChange?.();
      },
    },
    h('label', { class: 'field-label', for: 'fighter-name' }, 'Nom du combattant'),
    h('div', { class: 'input-with-action' }, nameInput, h('button', { type: 'submit', class: 'btn' }, 'Renommer')),
    nameError,
  );
  nameInput.addEventListener('input', () => { nameError.textContent = ''; });

  // --- Activité ---
  const activityInfo = h('p', { class: 'muted activity-info' });
  const updateActivityInfo = () => {
    const study = getActiveStudy(session, fighter.id);
    if (study) {
      const { remaining, endDay } = getStudyProgress(session, study);
      activityInfo.textContent = `En étude au Scriptorium : indisponible pour le Centre et les combats encore ${remaining} jour${remaining > 1 ? 's' : ''} (fin le jour ${endDay}).`;
      return;
    }
    const activity = fighter.activityId ? getEffectiveActivity(session, fighter.activityId) : null;
    activityInfo.textContent = activity
      ? `${describeActivityEffect(activity)} · réussite ${formatChance(activity.successChance)} par jour`
      : 'Ne progresse pas. Affectez-le à un lieu du Centre.';
  };
  updateActivityInfo();
  const activitySelect = ActivitySelect(fighter, (activityId) => {
    const result = assignActivity(session, fighter.id, activityId);
    if (!result.ok) {
      showToast(result.reason, 'error');
      activitySelect.value = fighter.activityId ?? '';
      return;
    }
    updateActivityInfo();
    onChange?.();
  }, { id: 'fighter-activity', session });

  const level = calculateFighterLevel(fighter);

  const body = h(
    'div',
    { class: 'fighter-sheet' },
    h(
      'div',
      { class: 'fighter-sheet-head' },
      FighterSprite(fighter, { size: 104, team }),
      h(
        'div',
        { class: 'fighter-sheet-identity' },
        nameForm,
        h(
          'div',
          { class: 'fighter-sheet-specialty' },
          // Rôle, talent révélé (s'il y en a un), puis les étoiles.
          h('div', { class: 'fighter-card-tags' }, ...FighterClassTags(fighter, session), ...TalentBadges(fighter, session), FighterStars(level)),
          h(
            'div',
            { class: 'fighter-profile' },
            h('span', { class: 'fighter-profile-item fighter-age' }, h('span', { class: 'fighter-profile-label' }, 'Âge'), formatAge(getFighterAge(fighter))),
            h('span', { class: 'fighter-profile-item', title: 'Capacité d’évolution future du combattant (elle peut changer avec l’âge).' },
              h('span', { class: 'fighter-profile-label' }, 'Potentiel'), PotentialFlames(fighter),
              typeof fighter.potential === 'number' ? PotentialCap(fighter) : null),
          ),
          h('p', {}, specialty?.description ?? ''),
        ),
      ),
    ),
    h(
      'div',
      { class: 'fighter-sheet-grid' },
      h(
        'section',
        { class: 'sheet-section' },
        h('h3', { class: 'sheet-section-title' }, 'Caractéristiques'),
        StatList(fighter),
        h('p', { class: 'muted sheet-note' }, 'Les étoiles indiquent le niveau du combattant, calculé à partir de ses compétences.'),
      ),
      h(
        'section',
        { class: 'sheet-section' },
        h('h3', { class: 'sheet-section-title' }, h('label', { for: 'fighter-activity' }, 'Activité actuelle')),
        activitySelect,
        activityInfo,
        h('h3', { class: 'sheet-section-title palmares-title' }, 'Palmarès'),
        RecordTable(fighter.record),
        // Carrière : combattants du joueur seulement (ceux de l'IA ne sont pas suivis).
        fighter.teamId === session.player.teamId ? h('h3', { class: 'sheet-section-title career-title' }, 'Carrière') : null,
        fighter.teamId === session.player.teamId ? CareerBlock(fighter) : null,
      ),
    ),
  );

  const dismissal = canDismiss(session, fighter.id);
  const handle = openModal({
    title: fighter.name,
    body,
    className: 'modal-wide',
    actions: [
      {
        label: 'Congédier', variant: 'danger', disabled: !dismissal.ok, title: dismissal.reason,
        onClick: async (sheet) => {
          const confirmed = await confirmModal({
            title: 'Congédier ce combattant ?',
            message: h(
              'div',
              { class: 'dismiss-confirm' },
              h('p', { class: 'dismiss-name' }, h('strong', {}, FighterName(fighter, { session }))),
              h('p', {}, 'Cette action retirera définitivement ce combattant de votre équipe.'),
              isCaptain(session, fighter)
                ? h('p', { class: 'warning-text' }, 'C’est votre capitaine : le plus ancien membre de la compagnie deviendra capitaine.')
                : null,
            ),
            confirmLabel: 'Congédier',
            danger: true,
          });
          if (!confirmed) return;
          const result = dismiss(session, fighter.id);
          if (!result.ok) {
            showToast(result.reason, 'error');
            return;
          }
          sheet.close();
          showToast(`${fighter.name} a quitté ${team.name}.${result.newCaptain ? ` ${result.newCaptain.name} devient capitaine.` : ''}`, 'success');
          onChange?.();
        },
      },
      { label: 'Fermer', variant: 'primary' },
    ],
  });
  handle.element.querySelector('.modal-title').replaceWith(title);
  return handle;
}
