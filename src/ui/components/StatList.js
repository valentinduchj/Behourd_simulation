import { h } from '../../utils/dom.js';
import { STAT_DEFINITIONS, STAT_GROUPS } from '../../data/stats.js';
import { getStatCap, isAtPotentialCap } from '../../systems/fighters/stats.js';

function StatRow(fighter, def, compact) {
  const value = fighter.stats[def.id] ?? def.base;
  const percent = Math.max(0, Math.min(100, ((value - def.min) / (def.max - def.min)) * 100));
  // Plafond du potentiel (compétences) : zone hachurée au-delà, sans chiffre.
  const cap = getStatCap(fighter, def.id);
  const capPercent = cap < def.max ? Math.max(0, Math.min(100, ((cap - def.min) / (def.max - def.min)) * 100)) : null;
  const capped = isAtPotentialCap(fighter, def.id);
  const capTitle = capped ? ' — au plafond de son potentiel : ne progresse plus' : capPercent !== null ? ' — zone hachurée : hors de portée de son potentiel' : '';
  return h(
    'div',
    { class: `stat-row ${def.polarity < 0 ? 'is-inverse' : ''} ${capped ? 'is-capped' : ''}`.trim(), title: `${def.label} — ${def.description}${capTitle}` },
    h('dt', {}, compact ? def.short : def.label),
    h(
      'dd',
      {},
      h('span', { class: 'stat-bar' },
        h('span', { class: `stat-bar-fill stat-${def.id}`, style: { width: `${percent}%` } }),
        capPercent !== null ? h('span', { class: 'stat-cap-zone', style: { left: `${capPercent}%` }, 'aria-hidden': 'true' }) : null),
      h('span', { class: 'stat-value' }, compact ? String(value) : `${value} / ${def.max}`),
    ),
  );
}

/**
 * Statistiques d'un combattant, générées depuis data/stats.js.
 * compact : libellés courts sur deux colonnes ; sinon regroupées (État / Compétences).
 */
export function StatList(fighter, { compact = false } = {}) {
  if (compact) {
    return h('dl', { class: 'stat-list stat-list-compact' }, STAT_DEFINITIONS.map((def) => StatRow(fighter, def, true)));
  }
  return h(
    'div',
    { class: 'stat-groups' },
    STAT_GROUPS.map((group) => {
      const defs = STAT_DEFINITIONS.filter((def) => def.kind === group.id);
      if (!defs.length) return null;
      return h(
        'div',
        { class: 'stat-group' },
        h('h4', { class: 'stat-group-title' }, group.label),
        h('dl', { class: 'stat-list' }, defs.map((def) => StatRow(fighter, def, false))),
      );
    }),
  );
}
