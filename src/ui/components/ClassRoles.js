import { h } from '../../utils/dom.js';
import { SPECIALTIES } from '../../data/specialties.js';
import { getStatDefinition } from '../../data/stats.js';
import { COMBAT_RULES } from '../../data/combatRules.js';

// Rappel des rôles du béhourd (combat Joueur contre IA, v0.65) : la formation en schéma (lice
// vue de dessus : un Lutteur contre chaque barrière, un Hastier derrière chacun, le Runner au
// centre qui file dans le dos adverse) et le bonus de position de chaque classe. Tout est déduit
// des règles (COMBAT_RULES.bonuses, reachByClass, offenseStatByClass) : rien n'est écrit en dur.

export const ROLE_ORDER = Object.freeze(['lutteur', 'hastier', 'runner']);

const pct = (value) => `${Math.round(Math.abs(value) * 100)} %`;
const short = (statId) => getStatDefinition(statId).short;
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Rôle de chaque classe en une phrase, d'après les règles. */
export function roleText(classId, rules = COMBAT_RULES) {
  const { lutteurBarrier, hastierReach, hastierCrowded, runnerRear } = rules.bonuses;
  const reach = rules.reachByClass?.[classId] ?? rules.contactRange;
  if (classId === lutteurBarrier.classId) return `contre la barrière : +${pct(lutteurBarrier.bonus)} en ${short(lutteurBarrier.statId)} ; il y plaque sa cible, qui ne peut plus reculer`;
  if (classId === hastierReach.classId) return `frappe à ${reach} cases, derrière son Lutteur : +${pct(hastierReach.finalDamage)} à distance, −${pct(hastierCrowded.finalDamage)} si un adversaire est au contact`;
  if (classId === runnerRear.classId) return `au centre, il passe dans le dos adverse : +${pct(runnerRear.finalDamage)} par derrière, et il renverse en pleine course`;
  return '';
}

/** Phrase des casques fermés. */
export function blindSpotText(rules = COMBAT_RULES) {
  return `Casques fermés : chacun ne voit que devant lui (± ${rules.vision.halfAngle}°) ; un coup venu de l’angle mort fait +${pct(rules.bonuses.blindSpot.finalDamage)}.`;
}

/** Schéma de la formation : moitié de lice vue de dessus, barrières en haut et en bas. */
function formationSvg() {
  const W = 220;
  const H = 120;
  const node = (x, y, classId) => {
    const spec = SPECIALTIES[classId];
    return `<g class="cr-node" data-class="${escape(classId)}"><circle cx="${x}" cy="${y}" r="13" fill="${escape(spec.color)}"/><text x="${x}" y="${y + 5}" class="cr-icon">${escape(spec.icon)}</text></g>`;
  };
  const enemy = (x, y) => `<circle cx="${x}" cy="${y}" r="9" class="cr-enemy"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="class-roles-svg" role="img" aria-label="Formation : un Lutteur contre chaque barrière, un Hastier derrière chacun, le Runner au centre qui passe dans le dos adverse">`
    + '<defs><marker id="cr-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" class="cr-head"/></marker></defs>'
    + `<rect x="4" y="6" width="${W - 8}" height="5" class="cr-barrier"/><rect x="4" y="${H - 11}" width="${W - 8}" height="5" class="cr-barrier"/>`
    + `<line x1="${W / 2 + 18}" y1="14" x2="${W / 2 + 18}" y2="${H - 14}" class="cr-mid"/>`
    + enemy(W / 2 + 38, 24) + enemy(W / 2 + 38, H - 24) + enemy(W / 2 + 46, H / 2)
    + `<path d="M${W / 2 - 4} ${H / 2} C ${W / 2 + 30} ${H / 2 - 30}, ${W - 20} ${H / 2 - 26}, ${W - 26} ${H / 2 + 4}" class="cr-run" marker-end="url(#cr-head)"/>`
    + node(W / 2 - 12, 24, 'lutteur') + node(W / 2 - 12, H - 24, 'lutteur')
    + node(W / 2 - 46, 30, 'hastier') + node(W / 2 - 46, H - 30, 'hastier')
    + node(W / 2 - 22, H / 2, 'runner')
    + '</svg>';
}

/**
 * Rappel des rôles. options : { compact } (version réduite, ex. pendant le combat).
 */
export function ClassRoles({ compact = false, rules = COMBAT_RULES } = {}) {
  const figure = h('div', { class: 'class-roles-figure' });
  figure.innerHTML = formationSvg();
  return h(
    'aside',
    { class: `class-roles ${compact ? 'is-compact' : ''}`.trim(), 'aria-label': 'Rôles des classes' },
    figure,
    h(
      'div',
      { class: 'class-roles-legend' },
      h('p', { class: 'class-roles-title' }, 'La formation du béhourd'),
      h('ul', { class: 'class-roles-list' }, ROLE_ORDER.map((classId) => h(
        'li',
        { 'data-class': classId },
        h('span', { class: 'class-roles-dot', style: { background: SPECIALTIES[classId].color } }),
        h('b', {}, `${SPECIALTIES[classId].icon} ${SPECIALTIES[classId].name}`),
        ` (${short(rules.offenseStatByClass[classId])}) ${roleText(classId, rules)}`,
      ))),
      h('p', { class: 'class-roles-blind' }, `🪖 ${blindSpotText(rules)}`),
      compact ? null : h('p', { class: 'class-roles-stats' }, statsText(rules)),
    ),
  );
}

/**
 * Rappel des rôles sur une ligne (placement : chaque pixel de hauteur compte) ; le détail de
 * chaque rôle est dans l'infobulle.
 */
export function ClassRolesInline({ rules = COMBAT_RULES } = {}) {
  const label = { lutteur: 'contre la barrière', hastier: 'derrière, à 2 cases', runner: 'au centre, dans le dos' };
  const detail = [...ROLE_ORDER.map((classId) => `${SPECIALTIES[classId].name} : ${roleText(classId, rules)}`), blindSpotText(rules)].join('\n');
  return h(
    'p',
    { class: 'class-roles-inline', 'aria-label': 'Rôles des classes', title: detail },
    h('span', { class: 'class-roles-title' }, 'Formation'),
    h('span', { class: 'class-roles-inline-chain' }, ROLE_ORDER.map((classId) => `${SPECIALTIES[classId].icon} ${SPECIALTIES[classId].name} ${label[classId]}`).join(' · ')),
    h('span', { class: 'muted' }, '🪖 angle mort'),
  );
}

/** Rôle de chaque stat pour toutes les classes, et bonus du capitaine. */
function statsText(rules) {
  const { defense, random, combo } = rules.damage;
  return `Défense : moitié ${short(defense.statId)} + moitié stat de classe · ${short(random.statId)} : aléa (jusqu’à +${pct(random.cap)}) · `
    + `${short(combo.statId)} : combo sur la même cible (${combo.maxHits} coups au plus) · END : qui frappe en premier · 👑 Capitaine : +${pct(rules.bonuses.captain.allStats)} sur tout`;
}
