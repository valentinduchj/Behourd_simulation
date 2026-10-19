import { h } from '../../utils/dom.js';
import { EXPEDITION_KINDS, EXPEDITION_REWARDS, getExpeditionPlace } from '../../data/expeditions.js';
import { TALENT_RARITIES } from '../../data/talents.js';
import {
  ensureSeasonOffers, canChooseOffer, canSendOnExpedition, startExpedition, getFerveurs, getActiveJourneys, needsTalentSlot,
  getOfferCost, getJourneyDuration,
} from '../../systems/expeditions/ExpeditionService.js';
import { getPotential } from '../../systems/fighters/PotentialService.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { getTalent, getFighterTalents } from '../../systems/talents/TalentService.js';
import { expeditionArtSvg } from '../../expeditions/ExpeditionArt.js';
import { openModal, confirmModal } from './Modal.js';
import { showToast } from './Toast.js';
import { FighterSprite } from './FighterSprite.js';
import { FighterStars } from './Rating.js';
import { PotentialFlames } from './Potential.js';
import { FighterName } from './CaptainCrown.js';
import { TalentBadge, TalentBadges } from './TalentBadge.js';
import { spectatorUrl } from '../../render/spectators.js';
import { FighterClassTags } from './SpecialtyBadge.js';
import { SINGULAR_RULES } from '../../data/singularExpedition.js';
import { canJoinSingular, getSingularRun } from '../../systems/expeditions/SingularRunService.js';
import { Fighter } from '../../models/Fighter.js';
import { getStat } from '../../systems/fighters/stats.js';

// Les expéditions proposées par le Baron (v0.98 ; récompenses v0.99) : trois cartes
// illustrées — un lieu sauvage ou médiéval d'Europe chacune — avec leur nature (Pérégrination,
// Expédition singulière), leur coût en Ferveurs, leur récompense (connue d'avance) et leur durée.
// Toute expédition emmène un combattant. Une seule par saison : les autres se grisent jusqu'aux
// propositions suivantes.

const FERVEUR_ICON = 'assets/sprites/items/ferveur_reine.svg';
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const deniers = (n) => `${n.toLocaleString('fr-FR')} deniers`;

/** Récompense d'une offre, en mots : « 750 deniers », « talent Fourbe (ordinaire) »… */
export function describeReward(reward) {
  switch (reward?.type) {
    case 'deniers': return deniers(reward.amount);
    case 'talent': {
      const talent = getTalent(reward.talentId);
      return `le talent ${talent?.name ?? '?'} (${(TALENT_RARITIES[reward.rarity]?.name ?? '').toLowerCase()})`;
    }
    case 'potential': return `+${reward.value ?? 1} potentiel`;
    case 'recruit': return `une recrue à la Taverne (potentiel ${reward.minPotential ?? 1} au moins)`;
    default: return '?';
  }
}

/** Récompense affichée sous la carte (étiquette de talent pour un talent). */
function RewardLine(reward) {
  const def = EXPEDITION_REWARDS[reward?.type];
  switch (reward?.type) {
    case 'deniers': return h('span', { class: 'xp-gain-main is-deniers' }, `${def.icon} ${deniers(reward.amount)}`);
    case 'talent': {
      const talent = getTalent(reward.talentId);
      return h('span', { class: 'xp-gain-main is-talent' }, talent ? TalentBadge(talent) : 'Talent');
    }
    case 'potential': return h('span', { class: 'xp-gain-main' }, `+${reward.value ?? 1} potentiel `, h('span', { 'aria-hidden': 'true' }, '🔥'));
    case 'recruit': return h('span', { class: 'xp-gain-main is-recruit' }, `${def.icon} Une recrue `, h('small', {}, `(🔥 ${reward.minPotential ?? 1}+)`));
    default: return h('span', { class: 'xp-gain-main' }, '?');
  }
}

/** Une carte d'expédition (illustration, nature, coût, lieu, récompense et durée). */
export function ExpeditionCard(session, offer, { chosenOfferId, onChoose }) {
  const place = getExpeditionPlace(offer.placeId);
  const kind = EXPEDITION_KINDS[offer.kind] ?? EXPEDITION_KINDS.peregrination;
  const check = canChooseOffer(session, offer.id);
  const chosen = chosenOfferId === offer.id;
  const locked = Boolean(chosenOfferId) && !chosen;
  const art = h('div', { class: 'xp-art' });
  art.innerHTML = expeditionArtSvg(place);
  // Talent Éclaireur dans la compagnie : coût réduit.
  const cost = getOfferCost(session, offer);
  const state = chosen ? 'is-chosen' : locked ? 'is-locked' : check.ok ? 'is-open' : 'is-poor';
  return h('article', {
    class: `xp-card is-${offer.kind} ${state}`, 'data-offer-id': offer.id, 'data-kind': offer.kind, 'data-reward': offer.reward?.type ?? '',
    style: { '--xp-kind': kind.color },
  },
  h('button', {
    type: 'button', class: 'xp-frame', disabled: !check.ok, title: check.reason ?? `${kind.name} : ${place.name}`,
    'aria-label': `${kind.name} — ${place.name}, ${plural(cost, 'Ferveur')} : ${describeReward(offer.reward)}`,
    onclick: () => onChoose(offer),
  },
  art,
  h('span', { class: 'xp-badge' }, `${kind.icon} ${kind.name}`),
  h('span', { class: `xp-cost ${cost < offer.cost ? 'is-discounted' : ''}`.trim(), title: cost < offer.cost ? `Coût en Ferveurs de la Reine (Éclaireur : ${offer.cost} → ${cost})` : 'Coût en Ferveurs de la Reine' }, h('img', { src: FERVEUR_ICON, alt: '', width: 18, height: 18 }), String(cost)),
  h('span', { class: 'xp-title' }, h('strong', {}, place.name), h('small', {}, place.region)),
  chosen ? h('span', { class: 'xp-stamp' }, 'Entreprise') : null),
  h('p', { class: 'xp-line' }, `« ${place.line} »`),
  h('p', { class: 'xp-gain' }, RewardLine(offer.reward), offer.kind === 'singular'
    ? h('span', { class: 'xp-gain-days is-fights' }, `⚔ ${SINGULAR_RULES.fights} combats`)
    : h('span', { class: 'xp-gain-days' }, `${offer.duration} jours`)),
  offer.kind === 'singular' && offer.opponents?.length
    ? h('button', { type: 'button', class: 'btn btn-sm xp-opponents-button', onclick: () => openOpponents(session, offer) }, '👁 Les dix adversaires')
    : null,
  locked ? h('p', { class: 'xp-note' }, 'Une seule expédition par saison') : !check.ok && !chosen ? h('p', { class: 'xp-note' }, check.reason) : null);
}

/**
 * Fenêtre du Baron : ses propositions de la saison et les expéditions en cours.
 * `onChange()` : après un départ (l'écran se met à jour).
 */
export function openExpeditionBoard(session, { onChange, onStartSingular } = {}) {
  let handle = null;
  const body = h('div', { class: 'xp-board' });
  const render = () => {
    const { offers, chosenOfferId, daysLeft } = ensureSeasonOffers(session);
    const journeys = getActiveJourneys(session);
    const run = getSingularRun(session);
    // (replaceChildren écrirait « null » : éléments absents retirés.)
    body.replaceChildren(...[
      h('header', { class: 'xp-head' },
        h('img', { class: 'artisan-portrait', src: spectatorUrl('expedition_captain'), alt: '', width: 44, height: 70 }),
        h('div', {},
          h('p', { class: 'xp-quote' }, chosenOfferId
            ? '« Nous sommes en route. Les autres chemins attendront la saison prochaine. »'
            : '« Trois routes s’ouvrent cette saison. Choisis-en une, et une seule. »'),
          h('p', { class: 'xp-purse' },
            h('img', { src: FERVEUR_ICON, alt: '', width: 20, height: 20 }),
            ` ${plural(getFerveurs(session), 'Ferveur')} de la Reine · nouvelles expéditions dans ${plural(daysLeft, 'jour')}`))),
      run ? h('p', { class: 'xp-run-banner' },
        `⚜ Expédition singulière en cours : combat ${Math.min(run.stage + 1, SINGULAR_RULES.fights)} / ${SINGULAR_RULES.fights}. `,
        h('button', { type: 'button', class: 'btn btn-sm btn-primary', onclick: () => { handle?.close(); onStartSingular?.(); } }, 'Reprendre ▸')) : null,
      h('div', { class: 'xp-cards' }, offers.map((offer) => ExpeditionCard(session, offer, { chosenOfferId, onChoose: (o) => (o.kind === 'singular' ? pickSquad(o) : pickFighter(o)) }))),
      journeys.length
        ? h('ul', { class: 'xp-journeys' }, journeys.map((journey) => {
          const fighter = session.getFighter(journey.fighterId);
          const reward = journey.reward ? ` · ${describeReward(journey.reward)}` : '';
          return h('li', {}, `🧭 ${fighter?.name ?? '?'} — ${getExpeditionPlace(journey.placeId)?.name ?? ''}${reward} · retour le jour ${journey.endDay}`);
        }))
        : null,
    ].filter(Boolean));
  };

  /** Choisir le combattant qui part (et, pour un talent, celui qu'il remplacera). */
  const pickFighter = (offer) => {
    const place = getExpeditionPlace(offer.placeId);
    const kind = EXPEDITION_KINDS[offer.kind] ?? EXPEDITION_KINDS.peregrination;
    let selected = null;
    let slot = null;
    let picker = null;
    const slotHost = h('div', { class: 'xp-slot-host' });
    const refreshConfirm = () => {
      const confirm = picker.element.querySelector('.modal-actions .btn-primary');
      const needsSlot = selected && needsTalentSlot(session, selected, offer);
      confirm.disabled = !selected || (needsSlot && slot === null);
      confirm.textContent = !selected ? 'Choisir un combattant' : needsSlot && slot === null ? 'Choisir le talent remplacé' : `Envoyer ${selected.name}`;
    };
    const renderSlots = () => {
      if (!selected || !needsTalentSlot(session, selected, offer)) {
        slotHost.replaceChildren();
        return;
      }
      const talents = getFighterTalents(session, selected);
      slotHost.replaceChildren(h('fieldset', { class: `study-slot-picker xp-slot-picker ${slot === null ? 'is-pending' : ''}`.trim() },
        h('legend', {}, `Talent que ${getTalent(offer.reward.talentId)?.name ?? 'le nouveau'} remplacera`),
        ...talents.map((talent, index) => h('label', { class: `study-slot ${slot === index ? 'is-selected' : ''}`.trim(), 'data-slot': String(index) },
          h('input', { type: 'radio', name: 'xp-slot', value: String(index), checked: slot === index, onchange: () => { slot = index; renderSlots(); refreshConfirm(); } }),
          h('span', { class: 'study-slot-rank' }, index === 0 ? 'Premier talent' : 'Second talent'),
          TalentBadge(talent, session)))));
    };
    const list = h('ul', { class: 'xp-fighters' }, session.playerFighters.map((fighter) => {
      const check = canSendOnExpedition(session, fighter, offer);
      const talents = getFighterTalents(session, fighter);
      return h('li', {}, h('button', {
        type: 'button', class: 'xp-fighter', 'data-fighter-id': fighter.id, disabled: !check.ok, 'aria-pressed': 'false', title: check.reason ?? null,
        onclick: (event) => {
          selected = fighter;
          slot = null;
          for (const b of list.querySelectorAll('.xp-fighter')) b.setAttribute('aria-pressed', String(b === event.currentTarget));
          renderSlots();
          refreshConfirm();
        },
      },
      FighterSprite(fighter, { size: 34, team: session.playerTeam }),
      h('span', { class: 'xp-fighter-who' },
        h('strong', {}, FighterName(fighter, { session })),
        h('span', {}, fighter.specialty?.name ?? '', ' ', FighterStars(calculateFighterLevel(fighter))),
        offer.reward?.type === 'talent' && talents.length ? h('span', { class: 'xp-fighter-talents' }, TalentBadges(fighter, session)) : null),
      h('span', { class: 'xp-fighter-pot' }, PotentialFlames(fighter, { className: 'is-compact' }),
        getJourneyDuration(fighter, offer) < offer.duration ? h('small', { class: 'xp-fighter-days' }, `🥾 ${plural(getJourneyDuration(fighter, offer), 'jour')}`) : null,
        check.ok ? null : h('small', {}, check.reason))));
    }));
    const rewardText = describeReward(offer.reward);
    const cost = getOfferCost(session, offer);
    picker = openModal({
      title: `${kind.icon} ${place.name} — qui part ?`,
      className: 'xp-picker-modal',
      body: h('div', {},
        h('p', { class: 'muted' }, `${kind.name} de ${plural(offer.duration, 'jour')} : le combattant est absent (ni Centre, ni combat) et revient avec ${rewardText}. Coût : ${plural(cost, 'Ferveur')}.`),
        offer.reward?.type === 'talent' ? h('p', { class: 'muted xp-picker-note' }, `Deux talents au plus par combattant : s’il en a déjà deux, choisissez celui que ${getTalent(offer.reward.talentId)?.name ?? 'le nouveau'} remplacera.`) : null,
        list,
        slotHost),
      actions: [
        { label: 'Annuler', value: null },
        {
          label: 'Choisir un combattant', variant: 'primary', disabled: true,
          onClick: async (modal) => {
            if (!selected) return;
            const replaced = slot === null ? null : getFighterTalents(session, selected)[slot];
            const ok = await confirmModal({
              title: `Partir : ${place.name}`,
              message: `${selected.name} part pour ${place.name} pendant ${plural(getJourneyDuration(selected, offer), 'jour')} (retour le jour ${session.calendar.currentDay + getJourneyDuration(selected, offer)}), contre ${plural(cost, 'Ferveur')} de la Reine. Il reviendra avec ${rewardText}${replaced ? `, qui remplacera ${replaced.name}` : ''}. C’est l’expédition de la saison.`,
              confirmLabel: 'Partir',
            });
            if (!ok) return;
            const result = startExpedition(session, offer.id, selected.id, { replaceSlot: slot });
            if (!result.ok) {
              showToast(result.reason, 'error');
              return;
            }
            showToast(`${selected.name} part en expédition : ${place.name}. Retour le jour ${result.journey.endDay}.`, 'success');
            modal.close(true);
            render();
            onChange?.();
          },
        },
      ],
    });
    return picker;
  };

  /** Expédition singulière : choisir les trois combattants. */
  const pickSquad = (offer) => {
    const place = getExpeditionPlace(offer.placeId);
    const cost = getOfferCost(session, offer);
    const selected = new Set();
    let picker = null;
    const refreshConfirm = () => {
      const confirm = picker.element.querySelector('.modal-actions .btn-primary');
      confirm.disabled = selected.size !== SINGULAR_RULES.squadSize;
      confirm.textContent = selected.size === SINGULAR_RULES.squadSize ? 'Partir à trois' : `Choisir ${SINGULAR_RULES.squadSize - selected.size} combattant${SINGULAR_RULES.squadSize - selected.size > 1 ? 's' : ''}`;
    };
    const list = h('ul', { class: 'xp-fighters' }, session.playerFighters.map((fighter) => {
      const check = canJoinSingular(session, fighter);
      return h('li', {}, h('button', {
        type: 'button', class: 'xp-fighter', 'data-fighter-id': fighter.id, disabled: !check.ok, 'aria-pressed': 'false', title: check.reason ?? null,
        onclick: (event) => {
          if (selected.has(fighter.id)) selected.delete(fighter.id);
          else if (selected.size < SINGULAR_RULES.squadSize) selected.add(fighter.id);
          event.currentTarget.setAttribute('aria-pressed', String(selected.has(fighter.id)));
          refreshConfirm();
        },
      },
      FighterSprite(fighter, { size: 34, team: session.playerTeam }),
      h('span', { class: 'xp-fighter-who' },
        h('strong', {}, FighterName(fighter, { session })),
        h('span', {}, fighter.specialty?.name ?? '', ' ', FighterStars(calculateFighterLevel(fighter))),
        (fighter.talents ?? []).length ? h('span', { class: 'xp-fighter-talents' }, TalentBadges(fighter, session)) : null),
      h('span', { class: 'xp-fighter-pot' }, h('small', { class: 'xp-fighter-fat' }, `FAT ${Math.round(getStat(fighter, 'fatigue'))}`), check.ok ? null : h('small', {}, check.reason))));
    }));
    picker = openModal({
      title: `⚜ ${place.name} — trois combattants`,
      className: 'xp-picker-modal xp-squad-modal',
      body: h('div', {},
        h('p', { class: 'muted' }, `Expédition singulière : ${SINGULAR_RULES.fights} duels d’affilée, une manche gagnante, dans une lice de forêt. Avant chaque combat, vous choisissez qui entre en lice ; la fatigue se garde ; un combattant battu est KO jusqu’à la fin. Les jours ne passent pas. Récompense : ${describeReward(offer.reward)}. Coût : ${plural(cost, 'Ferveur')}.`),
        list),
      actions: [
        { label: 'Annuler', value: null },
        {
          label: `Choisir ${SINGULAR_RULES.squadSize} combattants`, variant: 'primary', disabled: true,
          onClick: async (modal) => {
            if (selected.size !== SINGULAR_RULES.squadSize) return;
            const names = [...selected].map((id) => session.getFighter(id).name).join(', ');
            const ok = await confirmModal({
              title: `Partir : ${place.name}`,
              message: `${names} partent pour ${place.name}, contre ${plural(cost, 'Ferveur')} de la Reine. Dix combats à gagner ; si les trois tombent, l’expédition et les Ferveurs sont perdues. C’est l’expédition de la saison.`,
              confirmLabel: 'Partir',
            });
            if (!ok) return;
            const result = startExpedition(session, offer.id, [...selected]);
            if (!result.ok) {
              showToast(result.reason, 'error');
              return;
            }
            modal.close(true);
            handle?.close();
            onChange?.();
            onStartSingular?.();
          },
        },
      ],
    });
    return picker;
  };

  render();
  handle = openModal({ title: '⚔ Le Baron — expéditions de la saison', className: 'modal-wide xp-modal', body, actions: [{ label: 'Fermer', variant: 'primary' }] });
  return handle;
}

/** Potentiel du combattant (essais). */
export const potentialOf = (fighter) => getPotential(fighter);

/** Les dix adversaires d'une expédition singulière (rôle, étoiles, talents). */
export function openOpponents(session, offer) {
  const place = getExpeditionPlace(offer.placeId);
  return openModal({
    title: `👁 ${place?.name ?? ''} — les dix adversaires`,
    className: 'xp-opponents-modal',
    body: h('ol', { class: 'xp-opponents' }, (offer.opponents ?? []).map((entry, index) => {
      const fighter = Fighter.fromJSON(entry.fighter);
      fighter.talents = [...(entry.talents ?? [])];
      return h('li', { class: `xp-opponent ${entry.boss ? 'is-boss' : ''}`.trim() },
        h('span', { class: 'xp-opponent-number' }, entry.boss ? '👑' : String(index + 1)),
        FighterSprite(fighter, { size: 30 }),
        h('span', { class: 'xp-fighter-who' },
          h('strong', {}, fighter.name),
          h('span', { class: 'xp-opponent-tags' }, ...FighterClassTags(fighter, session), FighterStars(calculateFighterLevel(fighter)))),
        h('span', { class: 'xp-opponent-talents' }, (entry.talents ?? []).length ? TalentBadges(fighter, session) : h('small', { class: 'muted' }, 'sans talent')));
    })),
    actions: [{ label: 'Fermer', variant: 'primary' }],
  });
}
