import { h } from '../../utils/dom.js';
import { openModal } from './Modal.js';
import { getDisplayedPatchNotes, formatPatchDate } from '../../systems/patchNotes/PatchNoteService.js';

/**
 * Patch Notes : historique des évolutions, de la plus récente à la plus ancienne (données :
 * data/patchNotes.js ; sélection : PatchNoteService). Aucun contenu n'est écrit ici.
 */
export function openPatchNotes({ currentVersion = null } = {}) {
  const notes = getDisplayedPatchNotes();
  const body = h(
    'div',
    { class: 'patch-notes' },
    notes.length
      ? notes.map((note) => h(
        'article',
        { class: `patch-note ${note.version === currentVersion ? 'is-current' : ''}`.trim(), 'data-version': note.version },
        h(
          'header',
          { class: 'patch-note-header' },
          h('h3', { class: 'patch-note-version' }, note.version),
          note.version === currentVersion ? h('span', { class: 'patch-note-badge' }, 'Version actuelle') : null,
          note.date ? h('span', { class: 'patch-note-date' }, formatPatchDate(note.date)) : null,
        ),
        note.title ? h('p', { class: 'patch-note-title' }, note.title) : null,
        note.sections.map((section) => h(
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
