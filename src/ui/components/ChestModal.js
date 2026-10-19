import { h } from '../../utils/dom.js';
import { assetUrl } from '../../utils/assets.js';
import { ITEM_USE_CONTEXTS } from '../../data/items.js';
import { listInventory, destroyItem } from '../../systems/inventory/InventoryService.js';
import { canUseItem, describeUsage, getItemTargets, useItem } from '../../systems/items/ConsumableService.js';
import { getStat } from '../../systems/fighters/stats.js';
import { openModal } from './Modal.js';
import { showToast } from './Toast.js';
import { FighterSprite } from './FighterSprite.js';
import { SpecialtyBadge, FighterClassTags } from './SpecialtyBadge.js';

// Le Coffre : objets du joueur (empilés), avec « Utiliser » et « Détruire ». L'affichage
// ne contient aucune règle : ce qui est utilisable, et sur qui, vient de ConsumableService.
//
// options : { session, context (ITEM_USE_CONTEXTS), match (placement), eligibleFighterIds
//   (placement : combattants alignés), onChange() après chaque modification, onClose(changed) }

const CONTEXT_TITLES = Object.freeze({
  [ITEM_USE_CONTEXTS.OUTSIDE_COMBAT]: 'Le Coffre',
  [ITEM_USE_CONTEXTS.PLACEMENT]: 'Le Coffre — avant la manche',
});

const CONTEXT_HINTS = Object.freeze({
  [ITEM_USE_CONTEXTS.OUTSIDE_COMBAT]: 'Vos consommables, rangés ici après chaque achat dans le Bourg.',
  [ITEM_USE_CONTEXTS.PLACEMENT]: 'Donnez un consommable à l’un des combattants alignés pour cette manche.',
});

/** Le Coffre est-il fermé dans ce contexte ? (combats de la Coupe de France) */
export function isChestLocked({ match = null } = {}) {
  return match?.isolated === true;
}

export function openChest(options) {
  const { session, context = ITEM_USE_CONTEXTS.OUTSIDE_COMBAT, onChange, onClose } = options;
  // Coupe de France (combat isolé) : Le Coffre est fermé, quel que soit le chemin d'accès.
  if (isChestLocked(options)) {
    showToast('Le Coffre reste fermé pendant la Coupe de France.', 'info');
    return null;
  }
  let changed = false;
  const body = h('div', { class: 'chest' });
  const notify = () => {
    changed = true;
    render();
    onChange?.();
  };
  const render = () => {
    const items = listInventory(session);
    body.replaceChildren(
      h('p', { class: 'muted' }, CONTEXT_HINTS[context] ?? ''),
      items.length
        ? h('ul', { class: 'chest-list' }, items.map((item) => renderItem(item)))
        : h('p', { class: 'chest-empty' }, 'Le Coffre est vide. Le Boulanger, dans le Bourg, vend des consommables.'),
    );
  };
  const renderItem = (item) => {
    const usable = canUseItem(session, item.id, { ...options, context });
    return h(
      'li',
      { class: 'chest-item', 'data-item': item.id },
      ItemImage(item, 56),
      h('div', { class: 'chest-item-info' },
        h('p', { class: 'chest-item-name' }, item.name, h('span', { class: 'chest-item-qty' }, `×${item.quantity}`)),
        h('p', { class: 'chest-item-desc' }, item.description),
        h('p', { class: 'muted chest-item-usage' }, describeUsage(item.definition)),
        usable.ok || item.definition.keepsake ? null : h('p', { class: 'chest-item-reason' }, usable.reason)),
      h('div', { class: 'chest-item-actions' },
        // Objet à garder (Ferveurs de la Reine) : pas de bouton « Utiliser ».
        item.definition.keepsake ? null : h('button', {
          type: 'button', class: 'btn btn-primary btn-sm', disabled: !usable.ok, title: usable.reason ?? `Donner ${item.name} à un combattant`,
          onclick: () => pickFighter(item),
        }, 'Utiliser'),
        h('button', { type: 'button', class: 'btn btn-danger btn-sm', onclick: () => askDestroy(item) }, 'Détruire')),
    );
  };

  /** Choix du combattant, puis confirmation. */
  const pickFighter = (item) => {
    const targets = getItemTargets(session, item.id, { ...options, context });
    let selected = null;
    let handle;
    const list = h('ul', { class: 'chest-targets' }, targets.map((target) => h('li', {}, h(
      'button',
      {
        type: 'button',
        class: 'chest-target',
        'data-fighter-id': target.fighter.id,
        disabled: !target.ok,
        title: target.reason ?? null,
        'aria-pressed': 'false',
        onclick: (event) => {
          selected = target.fighter;
          for (const button of list.querySelectorAll('.chest-target')) button.setAttribute('aria-pressed', String(button === event.currentTarget));
          const confirm = handle.element.querySelector('.modal-actions .btn-primary');
          confirm.disabled = false;
          confirm.textContent = `Donner à ${selected.name}`;
        },
      },
      FighterSprite(target.fighter, { size: 36, team: session.playerTeam }),
      h('span', { class: 'chest-target-who' }, target.fighter.name, ...FighterClassTags(target.fighter)),
      h('span', { class: 'muted' }, `Fatigue ${Math.round(getStat(target.fighter, 'fatigue'))} / 100`),
      target.ok ? null : h('span', { class: 'chest-item-reason' }, target.reason),
    ))));
    handle = openModal({
      title: `${item.name} — à quel combattant ?`,
      body: h('div', {}, h('p', { class: 'muted' }, item.description), list),
      className: 'chest-target-modal',
      actions: [
        { label: 'Annuler', value: null },
        {
          label: 'Choisissez un combattant', variant: 'primary', disabled: true,
          onClick: (modal) => {
            if (!selected) return;
            const result = useItem(session, item.id, selected.id, { ...options, context });
            if (!result.ok) {
              showToast(result.reason, 'warning');
              return;
            }
            modal.close(true);
            showToast(`${item.name} : ${result.message} (reste ×${result.quantity})`, 'success');
            notify();
          },
        },
      ],
    });
  };

  /** Destruction : quantité à retirer, avec confirmation. */
  const askDestroy = (item) => {
    const input = h('input', { class: 'input chest-destroy-qty', type: 'number', min: 1, max: item.quantity, value: 1, step: 1 });
    openModal({
      title: `Détruire — ${item.name}`,
      body: h('div', { class: 'modal-form' },
        h('p', {}, `Vous en possédez ×${item.quantity}. Combien voulez-vous en détruire ? Les objets détruits sont perdus définitivement.`),
        h('label', { class: 'field-label' }, 'Quantité à détruire', input)),
      actions: [
        { label: 'Annuler', value: null },
        {
          label: 'Détruire', variant: 'danger',
          onClick: (modal) => {
            const quantity = Math.max(1, Math.min(item.quantity, Math.floor(Number(input.value) || 1)));
            const result = destroyItem(session, item.id, quantity);
            if (!result.ok) {
              showToast(result.reason, 'warning');
              return;
            }
            modal.close(true);
            showToast(`${quantity} × ${item.name} détruit${quantity > 1 ? 's' : ''}.`, 'info');
            notify();
          },
        },
      ],
    });
  };

  render();
  return openModal({
    title: CONTEXT_TITLES[context] ?? 'Le Coffre',
    body,
    className: 'modal-wide chest-modal',
    actions: [{ label: 'Fermer', variant: 'primary' }],
    onClose: () => onClose?.(changed),
  });
}

/** Image d'un objet (sprite des données). */
export function ItemImage(item, size = 48) {
  return h('img', { class: 'item-image', src: assetUrl(item.sprite), alt: '', width: size, height: size });
}
