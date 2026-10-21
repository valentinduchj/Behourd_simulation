import { h } from '../../utils/dom.js';
import { TALENT_RARITIES } from '../../data/talents.js';
import { getTalent } from '../../systems/talents/TalentService.js';
import { chooseStudyTalent, getPendingTalentChoices } from '../../systems/talents/StudyService.js';
import { getClimateSeason } from '../../systems/climate/ClimateService.js';
import { openModal } from './Modal.js';
import { showToast } from './Toast.js';
import { TalentBadge } from './TalentBadge.js';
import { FighterSprite } from './FighterSprite.js';

// Fin d'une étude au Scriptorium (v1.2.3) : trois talents de la même famille, le joueur en choisit
// UN (StudyService.chooseStudyTalent). Tant qu'un choix attend, la journée ne passe pas.

const RARITY_PLURAL = { common: 'ordinaires', rare: 'rares', epic: 'épiques', exotic: 'exotiques' };

/**
 * Ouvre le choix du talent d'une étude finie (la plus ancienne en attente si `study` est absent).
 * `onChosen(result)` : après un choix validé. Renvoie le handle de la fenêtre, ou null.
 */
export function openTalentChoice(session, { study = null, onChosen = null } = {}) {
  const pending = study ?? getPendingTalentChoices(session)[0];
  if (!pending) return null;
  const fighter = session.getFighter(pending.fighterId);
  if (!fighter) return null;
  const rarity = TALENT_RARITIES[pending.rarity] ?? TALENT_RARITIES.common;
  const previous = pending.targetSlot !== null && pending.targetSlot !== undefined ? getTalent(fighter.talents?.[pending.targetSlot]) : null;
  const kept = (fighter.talents ?? []).filter((_, i) => i !== pending.targetSlot).map(getTalent).filter(Boolean);
  let selected = null;
  let modal = null;

  const cards = (pending.choices ?? []).map((id) => {
    const talent = getTalent(id);
    if (!talent) return null;
    const season = talent.season && talent.season !== 'all' ? getClimateSeason(talent.season) : null;
    return h('button', {
      type: 'button', class: 'talent-choice-card', 'data-talent': id, 'aria-pressed': 'false',
      style: { '--talent-color': rarity.color, '--talent-border': rarity.border },
      onclick: (event) => {
        selected = id;
        for (const card of event.currentTarget.parentElement.querySelectorAll('.talent-choice-card')) card.setAttribute('aria-pressed', String(card === event.currentTarget));
        const confirm = modal?.element.querySelector('.modal-actions .btn-primary');
        if (confirm) { confirm.disabled = false; confirm.textContent = `Choisir ${talent.name}`; }
      },
    },
    h('span', { class: 'talent-choice-badge' }, TalentBadge(talent, session)),
    h('span', { class: 'talent-choice-domain' }, season ? `${talent.domain} · ${season.icon} ${season.name.toLowerCase()}` : talent.domain),
    h('span', { class: 'talent-choice-desc' }, talent.description));
  }).filter(Boolean);

  modal = openModal({
    title: `📜 ${fighter.name} — étude terminée`,
    className: 'talent-choice-modal',
    body: h('div', { class: 'talent-choice' },
      h('div', { class: 'talent-choice-head' },
        FighterSprite(fighter, { size: 44, team: session.playerTeam }),
        h('p', {},
          `Trois talents ${RARITY_PLURAL[pending.rarity] ?? ''} se révèlent. Choisissez-en un : ce choix est définitif.`,
          previous ? h('strong', {}, ` Il remplacera ${previous.name}.`) : null,
          !previous && kept.length ? ` Il s’ajoutera à ${kept.map((t) => t.name).join(', ')}.` : null)),
      h('div', { class: 'talent-choice-cards' }, cards),
      h('p', { class: 'muted talent-choice-note' }, 'La journée ne passe pas tant que le talent n’est pas choisi.')),
    actions: [
      { label: 'Plus tard', value: null },
      {
        label: 'Choisissez un talent', variant: 'primary', disabled: true,
        onClick: (handle) => {
          if (!selected) return;
          const result = chooseStudyTalent(session, pending.id, selected);
          if (!result.ok) {
            showToast(result.reason, 'error');
            return;
          }
          handle.close(result);
          showToast(`${fighter.name} reçoit le talent ${result.talent.name}.`, 'success');
          onChosen?.(result);
        },
      },
    ],
  });
  return modal;
}
