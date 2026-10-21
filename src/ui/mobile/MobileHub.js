import { h } from '../../utils/dom.js';
import { getSingularRun } from '../../systems/expeditions/SingularRunService.js';
import { getPendingTalentChoices } from '../../systems/talents/StudyService.js';
import { SCREENS } from '../../core/screenIds.js';
import { getEventType, QUEEN_COMBAT } from '../../data/calendar.js';
import { getEventTitle } from '../../systems/calendar/scheduler.js';
import { getPendingCombatEvent, getPendingQueenEvent, getUpcomingHighlights } from '../../systems/calendar/CalendarService.js';
import { isOffSeason } from '../../systems/league/SeasonService.js';
import { getSeasonForDay } from '../../systems/climate/ClimateService.js';
import { EmblemView } from '../components/EmblemView.js';
import { CalendarBar } from '../components/CalendarBar.js';
import { openModal } from '../components/Modal.js';
import { openPatchNotes } from '../components/PatchNotesModal.js';
import { countUnlocked } from '../../systems/achievements/AchievementService.js';
import { GAME_CONFIG } from '../../config/gameConfig.js';
import { openMenuDrawer } from './MenuDrawer.js';
import { openOptionsModal } from '../components/OptionsModal.js';
import { HUB_NAV_GROUPS } from '../hub/hubLocations.js';
import { attachSwipeClose } from './SwipeClose.js';

// Habillage mobile des écrans de la phase de gestion (v0.83, maquettes « B » et « C ») :
//   bandeau du haut  compagnie + jour (→ calendrier), prochain événement, deniers, menu ;
//   lieux            les cinq lieux du domaine, à gauche (écrans à carte) ;
//   dock flottant    Compagnie · Domaine · Coffre · Ligue ;
//   action du jour   bouton rond : « Jour suivant », « Combattre », « Reine », « Coupe » ;
//   volet            le contenu sous la carte (affectations, artisans, recrues…) remonte du bas.

const DOMAIN = HUB_NAV_GROUPS.find((group) => group.id === 'domain');

const ICONS = {
  team: '<path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6Z"/>',
  domain: '<path d="M3 20 12 4l9 16Z"/><path d="M12 20v-6"/>',
  chest: '<rect x="3" y="9" width="18" height="11" rx="1"/><path d="M3 9a9 5 0 0 1 18 0"/><path d="M12 12v3"/>',
  league: '<path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/><path d="M12 14v4M8 21h8"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  places: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z"/><circle cx="12" cy="10" r="2.2"/>',
  assign: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 8h5M19.5 5.5v5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};

export function icon(name, size = 20) {
  const el = h('span', { class: 'm-icon', 'aria-hidden': 'true' });
  el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return el;
}

/** Action du jour (bouton rond) selon le calendrier : passer la journée, combattre, Coupe. */
export function dayAction(session) {
  if (isOffSeason(session)) return { id: 'cup', label: 'Coupe de France', className: 'is-cup' };
  // Expédition singulière en cours (v1.1) : le temps est arrêté, le bouton y ramène.
  if (getSingularRun(session)) return { id: 'advance', label: 'Expédition', className: 'is-fight' };
  // Étude finie (v1.2.3) : le bouton ouvre le choix du talent (HubScreen.advanceDay).
  if (getPendingTalentChoices(session).length) return { id: 'advance', label: 'Choisir un talent', className: 'is-choice' };
  const championship = getPendingCombatEvent(session.calendar);
  const queen = getPendingQueenEvent(session.calendar);
  if (championship) return { id: 'fight', label: 'Combattre', className: 'is-fight' };
  if (queen) return { id: 'fight', label: 'Combat de la Reine', className: 'is-queen' };
  return { id: 'advance', label: 'Jour suivant', className: '' };
}

/** Texte de la pastille du prochain événement (ou du combat du jour). */
function nextEventText(session) {
  const { calendar } = session;
  if (isOffSeason(session)) return { text: 'Saison terminée : place à la Coupe de France', urgent: true };
  const today = getPendingCombatEvent(calendar) ?? getPendingQueenEvent(calendar);
  if (today) {
    return { text: today.typeId === QUEEN_COMBAT ? 'Aujourd’hui : Combat de la Reine' : `Aujourd’hui : ${getEventTitle(today, session)}`, urgent: true };
  }
  const [next] = getUpcomingHighlights(calendar, 1);
  if (!next) return null;
  return { text: `J-${calendar.daysUntil(next)} · ${getEventType(next.typeId).icon} ${getEventTitle(next, session)}`, urgent: false };
}

/**
 * Éléments flottants de l'écran mobile. `screen` : le HubScreen (navigation, Coffre, journée,
 * sauvegarde). Renvoie un fragment à poser dans la section `.hub`.
 */
/** Onglets sans bouton du jour (téléphone). */
export const HIDE_ADVANCE_ON = Object.freeze(['team', 'league']);

export function MobileHubChrome(screen) {
  const { session } = screen;
  const team = session.playerTeam;
  const activeId = screen.constructor.hubLocationId;
  const isDomain = DOMAIN.items.some((item) => item.id === activeId);
  const season = getSeasonForDay(session.calendar.currentDay);
  const event = nextEventText(session);
  const action = dayAction(session);

  const day = h('button', {
    type: 'button', class: 'm-hud m-hud-team mobile-day', 'aria-label': 'Calendrier',
    onclick: () => openCalendarModal(screen),
  },
  EmblemView(team.emblem, { size: 30, title: team.name }),
  h('span', { class: 'm-hud-team-text' },
    h('strong', {}, team.name),
    h('span', {}, `Jour ${session.calendar.currentDay} · ${season.icon} ${season.name}`)));

  const eventPill = event
    ? h('button', { type: 'button', class: `m-hud m-hud-event mobile-event ${event.urgent ? 'is-urgent' : ''}`.trim(), onclick: () => openCalendarModal(screen) }, event.text)
    : null;

  const right = h('div', { class: 'm-hud-right' },
    // Prochain événement (v0.92) : à droite, pour laisser le centre de la carte dégagé.
    eventPill,
    // Même élément que la carte « Trésor » : mis à jour par refreshStatus (achats, recrutement).
    h('span', { class: 'm-hud m-hud-deniers' }, screen.deniersEl),
    h('button', { type: 'button', class: 'm-hud m-round mobile-menu-button', 'aria-label': 'Menu', onclick: () => openMenuModal(screen) }, icon('menu')));

  // Les lieux du domaine (écrans à carte) : même identifiants que la colonne de droite (tutoriel).
  const places = isDomain
    ? h('nav', { class: 'm-places hub-nav-domain', 'aria-label': 'Le domaine' },
      DOMAIN.items.map((item) => h('button', {
        type: 'button', class: `m-place ${item.id === activeId ? 'is-active' : ''}`.trim(), 'data-hub-item': item.id,
        'aria-current': item.id === activeId ? 'page' : null,
        onclick: () => { if (item.id !== activeId) screen.navigate(item.screen, item.params); },
      }, h('span', { class: 'm-place-icon', 'aria-hidden': 'true' }, item.icon), h('span', {}, item.label))))
    : null;

  const dockItem = (id, label, iconName, onclick, active = false) => h('button', {
    type: 'button', class: `m-dock-item ${active ? 'is-active' : ''}`.trim(), 'data-hub-item': id,
    'aria-current': active ? 'page' : null, onclick,
  }, icon(iconName), h('span', {}, label));
  const dock = h('nav', { class: 'm-dock', 'aria-label': 'Navigation' },
    dockItem('team', 'Compagnie', 'team', () => screen.navigate(SCREENS.TEAM), activeId === 'team'),
    dockItem('domain', 'Domaine', 'domain', () => screen.navigate(SCREENS.CENTRE), isDomain),
    dockItem('chest', 'Coffre', 'chest', () => screen.openChest()),
    dockItem('league', 'Ligue', 'league', () => screen.navigate(SCREENS.LEAGUE), activeId === 'league'));

  const advance = h('button', {
    type: 'button', class: `m-advance mobile-advance ${action.className}`.trim(), 'data-action': action.id,
    onclick: () => (action.id === 'cup' ? screen.goToCup() : action.id === 'fight' ? screen.navigate(SCREENS.MATCH) : screen.advanceDay()),
  }, action.label);

  // v1.1.7 : le bouton du jour (« Jour suivant », « Combattre »…) n'apparaît pas sur les onglets
  // Compagnie et Ligue ; il revient sur les cartes du domaine (Centre, Bourg…).
  const showAdvance = !HIDE_ADVANCE_ON.includes(activeId);
  return [day, right, places, dock, showAdvance ? advance : null].filter(Boolean);
}

/**
 * Écran à carte (Centre, Bourg, Taverne, Scriptorium, Ma Lice) : la scène occupe tout l'écran ;
 * le reste de la page passe dans un volet qui remonte du bas. Renvoie le volet (ou null).
 */
export function decorateMapPage(page, { label, open = false, parts = null, tall = false } = {}) {
  const stage = page?.querySelector?.(':scope > .centre-stage, :scope > .training-stage');
  if (!stage) return null;
  page.classList.add('m-map-page');
  const content = h('div', { class: 'm-sheet-content' });
  for (const child of [...page.children]) if (child !== stage) content.append(child);
  // tall (v1.1.8 : Taverne, Bourg, Baron) : ouvert, le volet monte jusque sous le bandeau du haut.
  const sheet = h('section', { class: `m-sheet ${parts ? 'has-parts' : ''} ${tall ? 'is-tall' : ''}`.replace(/\s+/g, ' ').trim(), 'data-state': open ? 'open' : 'closed', 'aria-label': label });
  const close = h('button', { type: 'button', class: 'm-sheet-close', 'aria-label': 'Fermer' }, icon('close', 18));
  // Volet en parties (v0.92, Centre : « Lieux » et « Affectations ») : un bouton par partie,
  // à gauche de l'écran ; le volet n'affiche que la partie choisie (éléments data-sheet-part).
  const toggles = (parts ?? [{ id: null, label }]).map((part) => h('button', {
    type: 'button', class: 'm-sheet-toggle', 'data-part': part.id ?? '', 'aria-expanded': 'false',
  }, part.icon ? icon(part.icon, 18) : null, h('span', {}, part.label)));
  const setOpen = (value, partId = sheet.dataset.part || parts?.[0]?.id || '') => {
    sheet.dataset.state = value ? 'open' : 'closed';
    if (parts) sheet.dataset.part = partId;
    for (const toggle of toggles) {
      const current = !parts || toggle.dataset.part === partId;
      toggle.setAttribute('aria-expanded', String(Boolean(value) && current));
      toggle.classList.toggle('is-current', Boolean(value) && current);
    }
  };
  for (const toggle of toggles) {
    toggle.addEventListener('click', () => {
      const partId = toggle.dataset.part;
      const isOpenHere = sheet.dataset.state === 'open' && (!parts || sheet.dataset.part === partId);
      setOpen(!isOpenHere, partId);
    });
  }
  close.addEventListener('click', () => setOpen(false));
  // Poignée (v0.93) : le volet ouvert se referme en le tirant vers le bas.
  sheet.append(h('span', { class: 'm-grip', 'aria-hidden': 'true' }), h('div', { class: 'm-sheet-head' }, h('div', { class: 'm-sheet-toggles' }, toggles), close), content);
  sheet.setOpen = setOpen;
  attachSwipeClose(sheet, { direction: 'down', onClose: () => setOpen(false), isActive: () => sheet.dataset.state === 'open' });
  if (parts) sheet.dataset.part = parts[0].id;
  page.append(sheet);
  return sheet;
}

/** Le calendrier complet (frise, événements, action du jour) dans une fenêtre. */
export function openCalendarModal(screen) {
  const handle = openModal({
    title: 'Le calendrier',
    className: 'modal-wide m-calendar-modal',
    body: CalendarBar(screen.session, {
      onAdvance: () => { handle.close(); screen.advanceDay(); },
      onFight: () => { handle.close(); screen.navigate(SCREENS.MATCH); },
      onGoToCup: () => { handle.close(); screen.goToCup(); },
    }),
    actions: [{ label: 'Fermer', variant: 'primary' }],
  });
  return handle;
}

/** Menu : sauvegarde, succès, options, Almanach, menu principal. */
/** Menu (v0.90) : volet latéral — sauvegarde, Succès, Almanach, Options, Patch Notes, Menu principal. */
export function openMenuModal(screen) {
  const achieved = countUnlocked(screen.session);
  return openMenuDrawer({
    session: screen.session,
    onSave: () => screen.save(),
    items: [
      { id: 'achievements', glyph: 'achievements', label: 'Succès', side: `${achieved.unlocked} / ${achieved.total}`, onClick: () => screen.openAchievements() },
      { id: 'almanac', glyph: 'almanac', label: 'L’Almanach', onClick: () => screen.navigate(SCREENS.ALMANAC, { returnTo: screen.id }) },
      { id: 'options', glyph: 'options', label: 'Options', onClick: () => openOptionsModal(screen.services) },
      { id: 'patch-notes', glyph: 'notes', label: 'Patch Notes', side: GAME_CONFIG.version, onClick: () => openPatchNotes({ currentVersion: GAME_CONFIG.version }) },
    ],
    exits: [{ id: 'main-menu', glyph: 'exit', label: 'Menu principal', onClick: () => screen.backToMenu() }],
  });
}
