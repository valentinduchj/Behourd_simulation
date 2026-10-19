import { h } from '../../utils/dom.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { getFatigueState, fatigueLevelClass } from '../../systems/fighters/FatigueService.js';
import { getStat } from '../../systems/fighters/stats.js';
import { FighterSprite } from '../components/FighterSprite.js';
import { FighterStars } from '../components/Rating.js';
import { FighterName } from '../components/CaptainCrown.js';
import { TalentBadges } from '../components/TalentBadge.js';
import { PotentialFlames } from '../components/Potential.js';
import { SkillLine } from '../components/PlacementFighterCard.js';
import { haptic } from './Haptics.js';

// Fiche rapide (v0.93, téléphone) : un appui long sur un combattant — dans une liste, une carte,
// ou sur la carte du Centre — affiche sa fiche en bulle : classe et étoiles, compétences,
// fatigue, potentiel, talents. Le toucher simple garde son rôle (sélectionner, cocher) ; après
// un appui long, le « clic » qui suit est ignoré. Un autre toucher referme la bulle.

const HOLD_MS = 450;
const MOVE_SLOP = 10;
let card = null;

export function hideQuickCard() {
  card?.remove();
  card = null;
}

/** La bulle d'un combattant, près du point (x, y) de l'écran. */
export function showQuickCard(session, fighter, { x, y, team = session?.playerTeam } = {}) {
  hideQuickCard();
  if (!fighter) return null;
  const fatigue = Math.round(getStat(fighter, 'fatigue'));
  const state = getFatigueState(fighter);
  card = h('div', { class: 'm-quick-card', role: 'dialog', 'aria-label': `Fiche rapide de ${fighter.name}`, style: { '--spec-color': fighter.specialty?.color } },
    h('div', { class: 'm-quick-band' }, h('span', {}, fighter.specialty?.name ?? ''), FighterStars(calculateFighterLevel(fighter))),
    h('div', { class: 'm-quick-body' },
      FighterSprite(fighter, { size: 56, team }),
      h('div', { class: 'm-quick-text' },
        h('strong', { class: 'm-quick-name' }, FighterName(fighter, { session })),
        h('span', { class: 'm-quick-line' }, `${fighter.age ?? '?'} ans · `, h('span', { class: `m-quick-fatigue ${fatigueLevelClass(fighter)}` }, `${state.label} · ${fatigue}`)),
        h('span', { class: 'm-quick-line' }, 'Potentiel ', PotentialFlames(fighter, { className: 'is-compact' })))),
    SkillLine(fighter),
    h('div', { class: 'm-quick-talents' }, TalentBadges(fighter, session)));
  document.body.append(card);
  // Au-dessus du doigt, dans l'écran.
  const w = card.offsetWidth;
  const hgt = card.offsetHeight;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, (x ?? window.innerWidth / 2) - w / 2));
  let top = (y ?? window.innerHeight / 2) - hgt - 18;
  if (top < 8) top = Math.min(window.innerHeight - hgt - 8, (y ?? 0) + 18);
  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
  haptic('select');
  return card;
}

/**
 * Appui long, par délégation sur `root` : éléments [data-fighter-id] (combattants de la partie)
 * et [data-candidate] (recrues de la Taverne). `resolveAt(x, y, event)` (facultatif) trouve un
 * combattant hors de ces éléments (carte du Centre). Renvoie detach().
 */
export function installQuickCards(root, getSession, { resolveAt = null } = {}) {
  let timer = null;
  let start = null;
  let fired = false;

  const resolve = (event) => {
    const session = getSession();
    if (!session) return null;
    const el = event.target.closest?.('[data-fighter-id], [data-candidate]');
    if (el?.dataset.fighterId) return session.getFighter(el.dataset.fighterId) ?? null;
    if (el?.dataset.candidate) return session.recruitment?.candidates?.find((c) => c.id === el.dataset.candidate)?.fighter ?? null;
    return resolveAt ? resolveAt(event.clientX, event.clientY, event) : null;
  };
  const cancel = () => { clearTimeout(timer); timer = null; start = null; };
  // Après un appui long, seul le « clic » qui le suit aussitôt est ignoré (un téléphone n'en
  // envoie souvent pas) : le toucher suivant du joueur doit, lui, agir.
  let releaseTimer = null;
  const onUp = () => {
    cancel();
    if (!fired) return;
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => { fired = false; }, 350);
  };
  const onDown = (event) => {
    if (event.pointerType === 'mouse') return;
    if (card && !card.contains(event.target)) hideQuickCard();
    cancel();
    fired = false;
    start = { x: event.clientX, y: event.clientY };
    const fighter = resolve(event);
    if (!fighter) return;
    timer = setTimeout(() => {
      fired = true;
      showQuickCard(getSession(), fighter, { x: start?.x, y: start?.y });
      timer = null;
    }, HOLD_MS);
  };
  const onMove = (event) => {
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_SLOP) cancel();
  };
  const onClick = (event) => {
    if (!fired) return;
    fired = false;
    event.stopPropagation();
    event.preventDefault();
  };
  // Pas de menu contextuel du navigateur sur un appui long.
  const onContext = (event) => { if (event.target.closest?.('[data-fighter-id], [data-candidate], canvas')) event.preventDefault(); };
  const onScroll = () => { cancel(); hideQuickCard(); };
  root.addEventListener('pointerdown', onDown, true);
  root.addEventListener('pointermove', onMove, true);
  root.addEventListener('pointerup', onUp, true);
  root.addEventListener('pointercancel', cancel, true);
  root.addEventListener('click', onClick, true);
  root.addEventListener('contextmenu', onContext, true);
  root.addEventListener('scroll', onScroll, true);
  return () => {
    cancel();
    hideQuickCard();
    root.removeEventListener('pointerdown', onDown, true);
    root.removeEventListener('pointermove', onMove, true);
    root.removeEventListener('pointerup', onUp, true);
    root.removeEventListener('pointercancel', cancel, true);
    root.removeEventListener('click', onClick, true);
    root.removeEventListener('contextmenu', onContext, true);
    root.removeEventListener('scroll', onScroll, true);
  };
}
