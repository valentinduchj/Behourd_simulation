import { h } from '../../utils/dom.js';
import { openModal } from './Modal.js';
import { getDisplayedMilestones, formatPatchDate } from '../../systems/patchNotes/PatchNoteService.js';

/**
 * Patch Notes : les versions majeures seulement (0.4, 0.5, 0.6…), de la plus récente à la plus
 * ancienne, chacune avec ses grosses évolutions (données : data/patchNotes.js › PATCH_MILESTONES ;
 * sélection : PatchNoteService). Aucun contenu n'est écrit ici.
 */
export function openPatchNotes({ currentVersion = null } = {}) {
  const milestones = getDisplayedMilestones({ currentVersion });
  const body = h(
    'div',
    { class: 'patch-notes' },
    milestones.length
      ? milestones.map((milestone) => h(
        'article',
        {
          class: `patch-note ${milestone.isCurrent ? 'is-current' : ''} ${milestone.inProgress ? 'is-in-progress' : ''}`.replace(/\s+/g, ' ').trim(),
          'data-version': milestone.version,
        },
        h(
          'header',
          { class: 'patch-note-header' },
          h('h3', { class: 'patch-note-version' }, `Version ${milestone.version}`),
          milestone.inProgress ? h('span', { class: 'patch-note-badge is-in-progress' }, 'En cours') : null,
          milestone.isCurrent ? h('span', { class: 'patch-note-badge' }, `Version actuelle : ${currentVersion}`) : null,
          milestone.date ? h('span', { class: 'patch-note-date' }, formatPatchDate(milestone.date)) : null,
        ),
        milestone.title ? h('p', { class: 'patch-note-title' }, milestone.title) : null,
        h('p', { class: 'patch-note-range' }, milestone.count > 1
          ? `Regroupe les versions ${milestone.from} à ${milestone.to}${milestone.inProgress ? ' (en cours)' : ''}.`
          : `Version ${milestone.from}.`),
        milestone.sections.map((section) => h(
          'section',
          { class: 'patch-note-section', 'data-section': section.key },
          h('h4', { class: 'patch-note-section-title' }, h('span', { 'aria-hidden': 'true' }, section.icon), ` ${section.label}`),
          h('ul', {}, section.items.map((item) => h('li', {}, item))),
        )),
      ))
      : h('p', { class: 'empty-state' }, 'Aucune note de version pour l’instant.'),
  );
  return openModal({
    title: 'Patch Notes',
    className: 'modal-wide patch-notes-modal',
    body,
    actions: [{ label: 'Fermer', variant: 'primary', value: true }],
  });
}
