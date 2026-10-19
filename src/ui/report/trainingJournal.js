import { getStatDefinition } from '../../data/stats.js';
import { getSpecialty } from '../../data/specialties.js';
import { COMBAT_RULES, COMBAT_PLAYBACK } from '../../data/combatRules.js';
import { getBonusLabels } from '../../combat/presentation/bonusLabels.js';
import { TALENTS } from '../../data/talents.js';
import { currentLocale } from '../../i18n/i18n.js';

// Journal détaillé d'un combat de Ma Lice d'entraînement (v0.71). Il LIT les événements émis
// par le moteur (simulation.events) et les valeurs que le moteur a réellement appliquées
// (detail : attaque, défense, base, aléa, combo, fatigue, multiplicateur final et sa
// décomposition, valeur brute, arrondi) : aucun dégât n'est recalculé ici. Données temporaires,
// jamais ajoutées à l'historique du club.
//
// Entrée : { id, tick, time (s, sans l'introduction), kind, side?, title, lines: [texte], tone }
//   kind : 'start' | 'attack' | 'stun' | 'lastStand' | 'ko' | 'lull' | 'end'

const num = (value, digits = 1) => (Math.round(value * 10 ** digits) / 10 ** digits).toLocaleString(currentLocale(), { minimumFractionDigits: 0, maximumFractionDigits: digits });
const pct = (fraction) => `${fraction >= 0 ? '+' : '−'}${num(Math.abs(fraction) * 100)} %`;
const times = (factor) => `×${num(factor, 3)}`;
const short = (statId) => getStatDefinition(statId)?.short ?? statId;
const TALENT_NAMES = new Map(TALENTS.map((talent) => [talent.id, talent.name]));

/** Libellé d'une action selon la classe et la situation du coup. */
function actionOf(classId, ids = []) {
  if (classId === 'hastier') return ids.includes('reach') ? 'frappe à l’arme d’hast, à distance' : 'frappe à l’arme d’hast, au contact';
  if (classId === 'runner') return ids.includes('rear') ? 'charge dans le dos' : 'charge en percussion';
  return ids.includes('pinned') ? 'saisie contre la barrière' : 'saisie et coups de lutte';
}

/** Temps d'un tour du combat (s, sans l'introduction), milieu du tour. */
export function journalTime(tick, tickSeconds = COMBAT_PLAYBACK.tickSeconds) {
  return Math.max(0, (tick - 0.5) * tickSeconds);
}

/**
 * Journal d'une simulation : entrées chronologiques. ctx : { nameOf(id), sideLabel(side),
 * formatLabel, tickSeconds, maxEntries }.
 */
export function buildTrainingJournal(simulation, { nameOf, sideLabel = (side) => `Camp ${side}`, formatLabel = '', tickSeconds = COMBAT_PLAYBACK.tickSeconds, maxEntries = 800 } = {}) {
  const labels = getBonusLabels();
  const initial = simulation.initial ?? [];
  const unitById = new Map(initial.map((unit) => [unit.id, unit]));
  const name = (id) => nameOf?.(id) ?? unitById.get(id)?.name ?? id;
  const sideOf = (id) => unitById.get(id)?.side ?? null;
  const entries = [];
  let counter = 0;
  const add = (entry) => entries.push({ id: `j${counter++}`, ...entry });

  // Début du combat : placement et état initial de chacun.
  add({
    tick: 0, time: 0, kind: 'start', tone: 'info',
    title: `Début du combat${formatLabel ? ` — ${formatLabel}` : ''}`,
    lines: initial.map((unit) => `${sideLabel(unit.side)} · ${name(unit.id)} (${getSpecialty(unit.classId)?.name ?? unit.classId}${unit.isCaptain ? ', capitaine' : ''}) — ${unit.hp} PV, fatigue ${num(unit.fatigue, 0)}, case ${unit.x + 1}·${unit.y + 1}`),
  });

  const dealt = new Map();
  for (const event of simulation.events ?? []) {
    const time = journalTime(event.tick, tickSeconds);
    if (event.type === 'attack') {
      const d = event.detail ?? {};
      const m = d.modifiers ?? {};
      const attacker = unitById.get(event.unitId);
      const target = unitById.get(event.targetId);
      dealt.set(event.unitId, (dealt.get(event.unitId) ?? 0) + event.damage);
      const lines = [];
      lines.push(`Action : ${actionOf(attacker?.classId, m.positionIds ?? [])}.`);
      lines.push(m.untouchable ? 'Résultat : sans effet — la cible est intouchable (talent).' : d.dodged ? `Résultat : esquivé (talent ${TALENT_NAMES.get(d.dodgeTalentId) ?? ''}).` : 'Résultat : coup porté.');
      const defenseStats = (d.defenseStats ?? []).map(short);
      lines.push(`Attaque (${short(d.attackStat)}) : ${num(d.attack)} · Défense (½ ${defenseStats[0] ?? 'HAS'} + ½ ${defenseStats[1] ?? ''}) : ${num(d.defense)}.`);
      const included = [...(m.situation ?? []), ...(attacker?.isCaptain ? ['captain'] : [])].map((id) => labels[id]?.long ?? id);
      if (included.length) lines.push(`Déjà compris dans l’attaque : ${included.join(' ; ')}.`);
      lines.push(`Dégâts de base : ${COMBAT_RULES.damage.base} × ${num(d.attack)} ÷ ${num(d.defense)} = ${num(d.base, 2)}.`);
      lines.push(`Aléa ${pct(d.random ?? 0)} · combo ${pct(d.combo ?? 0)} (${d.comboHits ?? 1}e coup sur cette cible) → ${times(1 + (d.random ?? 0) + (d.combo ?? 0))}.`);
      if ((d.fatigueFactor ?? 1) < 1) lines.push(`Fatigue de l’attaquant : ${times(d.fatigueFactor)}.`);
      // Bonus final : position, objets, talents (additionnés), réduction de la cible, saison.
      const parts = [];
      if (m.position) parts.push(`position ${pct(m.position)} (${(m.positionIds ?? []).map((id) => labels[id]?.short ?? id).join(', ')})`);
      if (m.items) parts.push(`objet ${pct(m.items)}`);
      if (m.talents) parts.push(`talents ${pct(m.talents)} (${(m.talentIds ?? []).map((id) => TALENT_NAMES.get(id) ?? id).join(', ')})`);
      if (m.reduction) parts.push(`réduction de la cible ${pct(-m.reduction)}`);
      if ((m.season ?? 1) !== 1) parts.push(`saison ${times(m.season)}`);
      lines.push(parts.length ? `Bonus final : ${parts.join(' · ')} → ${times(d.finalMultiplier ?? 1)}.` : 'Bonus final : aucun (×1).');
      lines.push(`Dégâts finaux : ${num(d.raw ?? event.damage, 2)} → ${event.damage} PV (arrondi, ${COMBAT_RULES.minDamage} au moins) · ${name(event.targetId)} : ${event.hpAfter} PV restants.`);
      add({
        tick: event.tick, time, kind: 'attack', side: sideOf(event.unitId), tone: m.untouchable || d.dodged ? 'muted' : d.highlight ? 'highlight' : 'hit',
        title: `${name(event.unitId)} attaque ${name(event.targetId)} — ${event.damage} PV`, lines, target: target?.id ?? null,
      });
    } else if (event.type === 'stun') {
      add({ tick: event.tick, time, kind: 'stun', side: sideOf(event.byId), tone: 'warning', title: `${name(event.unitId)} est renversé par ${name(event.byId)}`, lines: ['Il perd son prochain tour.'] });
    } else if (event.type === 'heal') {
      add({ tick: event.tick, time, kind: 'lastStand', side: sideOf(event.unitId), tone: 'warning', title: `${name(event.byId)} soigne ${name(event.unitId)} (+${event.amount} PV)`, lines: [`Talent : ${TALENT_NAMES.get(event.talentId) ?? event.talentId}.`] });
    } else if (event.type === 'lastStand') {
      add({ tick: event.tick, time, kind: 'lastStand', side: sideOf(event.unitId), tone: 'warning', title: `${name(event.unitId)} survit à 1 PV`, lines: [`Talent : ${TALENT_NAMES.get(event.talentId) ?? event.talentId}.`] });
    } else if (event.type === 'ko') {
      add({ tick: event.tick, time, kind: 'ko', side: sideOf(event.byId), tone: 'ko', title: `${name(event.unitId)} est mis KO par ${name(event.byId)}`, lines: ['Éliminé : il quitte la lice pour ce combat.'] });
    } else if (event.type === 'lull') {
      add({ tick: event.tick, time, kind: 'lull', tone: 'muted', title: 'Temps mort', lines: ['Les deux camps reculent d’un pas et reprennent leur souffle.'] });
    } else if (event.type === 'end') {
      const standing = (side) => initial.filter((unit) => unit.side === side && !(simulation.knockedOut ?? []).includes(unit.id)).length;
      const totals = initial.map((unit) => `${name(unit.id)} : ${dealt.get(unit.id) ?? 0} PV infligés`);
      add({
        tick: event.tick, time, kind: 'end', tone: 'end',
        title: `Fin du combat — victoire du ${sideLabel(event.winnerSide)}`,
        lines: [`Debout : ${sideLabel('A')} ${standing('A')} · ${sideLabel('B')} ${standing('B')} — ${simulation.ticks} tours.`, ...totals],
      });
    }
  }
  // Mémoire bornée : le début et la fin restent, les attaques les plus anciennes cèdent la place.
  if (entries.length > maxEntries) {
    const head = entries[0];
    return [head, ...entries.slice(entries.length - maxEntries + 1)];
  }
  return entries;
}
