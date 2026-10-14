import { h } from '../../utils/dom.js';

const openModals = [];

/**
 * Ouvre une fenêtre modale. Chaque action : { label, value, variant, onClick(handle), disabled, title }.
 * Sans onClick, cliquer ferme la modale avec `value`.
 */
export function openModal({ title, body, actions = [], dismissible = true, onClose, className = '' }) {
  const actionBar = h('div', { class: 'modal-actions' });
  const dialog = h(
    'div',
    { class: `modal ${className}`.trim(), role: 'dialog', 'aria-modal': 'true', 'aria-label': title ?? 'Fenêtre' },
    title ? h('h2', { class: 'modal-title' }, title) : null,
    h('div', { class: 'modal-body' }, body),
    actionBar,
  );
  const backdrop = h('div', { class: 'modal-backdrop' }, dialog);
  const previousFocus = document.activeElement;
  let closed = false;

  const handle = {
    element: dialog,
    close(result) {
      if (closed) return;
      closed = true;
      openModals.splice(openModals.indexOf(handle), 1);
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      onClose?.(result);
    },
  };

  for (const action of actions) {
    actionBar.append(
      h(
        'button',
        {
          type: 'button',
          class: `btn ${action.variant ? `btn-${action.variant}` : ''}`.trim(),
          disabled: action.disabled ?? false,
          title: action.title ?? null,
          onclick: () => (action.onClick ? action.onClick(handle) : handle.close(action.value)),
        },
        action.label,
      ),
    );
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && dismissible && openModals.at(-1) === handle) handle.close(undefined);
  }
  document.addEventListener('keydown', onKeyDown);
  if (dismissible) {
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) handle.close(undefined);
    });
  }

  document.getElementById('modal-root').append(backdrop);
  openModals.push(handle);
  const focusTarget = dialog.querySelector('input, select, .btn-primary, button');
  focusTarget?.focus();
  return handle;
}

export function closeAllModals() {
  for (const handle of [...openModals]) handle.close(undefined);
}

export function alertModal(title, message) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: h('p', {}, message),
      actions: [{ label: 'Compris', variant: 'primary', value: true }],
      onClose: () => resolve(),
    });
  });
}

/** Choix multiple ; renvoie la `value` du choix, ou undefined si la modale est fermée. */
export function choiceModal({ title, message, choices }) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: typeof message === 'string' ? h('p', {}, message) : message,
      actions: choices.map((choice) => ({ label: choice.label, value: choice.value, variant: choice.variant })),
      onClose: resolve,
    });
  });
}

export async function confirmModal({ title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false }) {
  const result = await choiceModal({
    title,
    message,
    choices: [
      { label: cancelLabel, value: false },
      { label: confirmLabel, value: true, variant: danger ? 'danger' : 'primary' },
    ],
  });
  return result === true;
}

/**
 * Demande une saisie. `validate(value)` renvoie un message d'erreur (affiché sans
 * fermer la modale) ou null. Résout avec la valeur validée, ou null si annulé.
 */
export function promptModal({
  title, message, type = 'text', placeholder = '', confirmLabel = 'Valider', cancelLabel = 'Annuler', validate,
}) {
  return new Promise((resolve) => {
    const input = h('input', { class: 'input', type, placeholder, autocomplete: 'off', spellcheck: 'false' });
    const error = h('p', { class: 'form-error', role: 'alert' });
    let handle;

    const submit = async () => {
      const value = input.value;
      const problem = validate ? await validate(value) : null;
      if (problem) {
        error.textContent = problem;
        input.select();
        handle.element.classList.remove('shake');
        void handle.element.offsetWidth; // relance l'animation
        handle.element.classList.add('shake');
        return;
      }
      handle.close(value);
    };

    const form = h(
      'form',
      { class: 'modal-form', onsubmit: (event) => { event.preventDefault(); submit(); } },
      message ? h('p', {}, message) : null,
      input,
      error,
    );
    input.addEventListener('input', () => { error.textContent = ''; });

    handle = openModal({
      title,
      body: form,
      actions: [
        { label: cancelLabel, value: null },
        { label: confirmLabel, variant: 'primary', onClick: () => submit() },
      ],
      onClose: (value) => resolve(value ?? null),
    });
    input.focus();
  });
}
