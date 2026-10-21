import { getStatDefinition } from '../../data/stats.js';
import { getSpecialty } from '../../data/specialties.js';
import { getActivity } from '../../systems/activities/ActivityService.js';
import { getLeagueName } from '../../systems/league/LeagueService.js';
import { getTalent } from '../../systems/talents/TalentService.js';
import { TALENT_RARITIES } from '../../data/talents.js';
import { getClimateSeason } from '../../systems/climate/ClimateService.js';
import { ordinal as ordinalOf } from '../../utils/format.js';
import { getExpeditionPlace } from '../../data/expeditions.js';

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Mise en forme des événements du carnet de bord (systems/report/DailyReportService.js).
// Chaque format renvoie { section, who?, text, detail?, tone?, group? } :
//   section  : identifiant de section (LOGBOOK_SECTIONS) ; null = pied de page
//   who      : nom mis en avant (combattant…)
//   tone     : 'good' | 'bad' | 'highlight' | 'neutral'
//   group    : les événements d'un même groupe sont réunis en une seule ligne (GROUP_FORMATS)
// Pour un nouveau type d'événement : ajouter un format ici (sinon il apparaît dans « Divers »).

export const LOGBOOK_SECTIONS = Object.freeze([
  { id: 'season', icon: '♛', title: 'Fin de saison' },
  { id: 'combat', icon: '⚔', title: 'Combat' },
  { id: 'league', icon: '🏆', title: 'Ma ligue' },
  { id: 'fighters', icon: '🔥', title: 'Combattants' },
  { id: 'centre', icon: '★', title: 'Centre' },
  { id: 'treasury', icon: '⛁', title: 'Trésor' },
  { id: 'tavern', icon: '🏰', title: 'Taverne' },
  { id: 'other', icon: '✎', title: 'Divers' },
]);

const fighterName = (session, id) => session.getFighter(id)?.name ?? 'Un combattant';
const activityName = (id) => getActivity(id)?.name ?? 'activité';
const teamName = (session, id) => session.getTeam(id)?.name ?? '?';
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Ce qu'un combattant rapporte d'expédition (v0.99 ; avant : toujours du potentiel). */
function expeditionRewardText(e, reward = e.reward ?? { type: 'potential' }) {
  switch (reward.type) {
    case 'deniers': return `+${reward.amount.toLocaleString('fr-FR')} deniers au Trésor.`;
    case 'talent': {
      const name = getTalent(reward.talentId)?.name ?? reward.talentId;
      const family = (TALENT_RARITIES[reward.rarity]?.name ?? '').toLowerCase();
      if (!reward.granted) return `le talent ${name} (${family}), qu’il avait déjà.`;
      const previous = reward.previousId ? getTalent(reward.previousId)?.name : null;
      return `nouveau talent ${name} (${family})${previous ? `, à la place de ${previous}` : ''}.`;
    }
    case 'recruit': return `${reward.recruitName} l’accompagne et attend à la Taverne (offert, potentiel ${'🔥'.repeat(reward.potential ?? 1)}).`;
    case 'potential':
    default: return reward.potential !== undefined && reward !== e.reward
      ? `potentiel ${'🔥'.repeat(reward.potential)} (+${reward.potential - reward.before}).`
      : `potentiel ${'🔥'.repeat(e.potential)} (+${e.potential - e.before}).`;
  }
}

/** Retour d'expédition complet : récompense, seconde récompense (Compagnon du Baron), entraînement. */
function expeditionReturnText(e) {
  const gains = e.training ? Object.values(e.training).reduce((sum, v) => sum + v, 0) : 0;
  return [
    expeditionRewardText(e),
    e.bonusReward ? `En plus (Compagnon du Baron) : ${expeditionRewardText(e, e.bonusReward)}` : null,
    e.training ? (gains ? `Voyageur aguerri : +${gains} points de compétences de combat.` : 'Voyageur aguerri : compétences déjà à leur plafond.') : null,
  ].filter(Boolean).join(' ');
}

function describeStatGain(statId, amount) {
  const def = getStatDefinition(statId);
  if (!def) return `+${amount}`;
  if (statId === 'hp') return `a récupéré ${amount} PV`;
  if (def.polarity < 0) return `a récupéré de la ${def.label.toLowerCase()} (−${amount})`;
  return `a gagné +${amount} en ${def.label}`;
}

export const LOGBOOK_FORMATS = {
  'match.result': (e, { session }) => {
    if (!e.opponentTeamId) return { section: 'combat', text: `Journée de championnat ${e.matchday} : votre compagnie était exempte.` };
    return {
      section: 'combat',
      tone: e.won ? 'good' : 'bad',
      who: e.won ? 'Victoire' : 'Défaite',
      text: `contre ${teamName(session, e.opponentTeamId)} — ${e.roundsFor} / ${e.roundsAgainst}`,
      detail: [
        `${e.points > 0 ? '+' : ''}${plural(e.points, 'point')} au classement`,
        e.location === 'HOME' ? '🏠 à domicile' : e.location === 'AWAY' ? '⚔ à l’extérieur' : null,
        e.homeReward ? (e.location === 'AWAY' ? `+${e.homeReward} deniers (victoire à l’extérieur)` : `+${e.homeReward} deniers (victoire à domicile)`) : null,
        e.auto ? 'combat disputé automatiquement' : null,
      ].filter(Boolean).join(' · '),
    };
  },
  // Saisons de l'année (v0.70) : une entrée par passage de saison (ClimateService).
  'climate.season': (e, { session }) => {
    const season = getClimateSeason(e.seasonId);
    const released = (e.released ?? []).map((r) => fighterName(session, r.fighterId));
    return {
      section: 'other',
      tone: 'highlight',
      who: `${season?.icon ?? ''} ${capitalize(season?.article ?? 'la saison')} commence`.trim(),
      text: `${season?.logbook ?? ''}${released.length ? ` ${released.join(', ')} ${released.length > 1 ? 'se retrouvent' : 'se retrouve'} sans activité.` : ''}`.trim(),
    };
  },
  // Succès (v0.73) : obtenus pendant la journée.
  'achievement.unlocked': (e) => ({ section: 'other', tone: 'highlight', who: `🏅 ${e.icon ?? ''} ${e.name}`.replace('  ', ' '), text: 'succès obtenu !' }),
  'calendar.matchday': (e, { session }) => ({
    section: 'combat',
    tone: 'highlight',
    who: `Journée de championnat ${e.matchday ?? ''}`.trim(),
    text: e.opponentTeamId
      ? `aujourd’hui contre ${teamName(session, e.opponentTeamId)}${e.location === 'HOME' ? ', à domicile' : e.location === 'AWAY' ? ', à l’extérieur' : ''}. Le Centre est fermé.`
      : 'aujourd’hui (exempt).',
  }),
  // Expéditions du Baron (v0.98 ; récompenses v0.99) : retour d'un combattant et ce qu'il rapporte.
  'expedition.return': (e) => ({
    section: e.reward?.type === 'deniers' ? 'treasury' : e.reward?.type === 'recruit' ? 'tavern' : 'fighters',
    tone: 'good',
    who: `🧭 ${e.name}`,
    text: `revient d’expédition (${getExpeditionPlace(e.placeId)?.name ?? 'au loin'}) : ${expeditionReturnText(e)}`,
  }),
  'fighter.potential': (e) => ({
    section: 'fighters',
    tone: e.change > 0 ? 'good' : 'bad',
    who: `${e.name} (${e.age} ans)`,
    text: e.change > 0 ? 'a gagné du potentiel !' : 'a perdu du potentiel.',
  }),
  'talent.income': (e) => ({
    section: 'treasury',
    tone: 'good',
    who: 'Talents',
    text: `: +${e.amount} denier${e.amount > 1 ? 's' : ''} (${[...new Set(e.details.map((d) => getTalent(d.talentId)?.name).filter(Boolean))].join(', ')}).`,
  }),
  'talent.revealed': (e) => ({
    section: 'fighters',
    tone: 'good',
    who: `📜 Étude terminée : ${e.name}`,
    text: `a révélé ${e.second ? 'son second talent' : 'le talent'} ${e.talentName}.${!e.previousTalentName ? '' : e.previousTalentId === e.talentId ? ' C’est le même qu’avant.' : ` Il remplace ${e.previousTalentName}.`}`,
  }),
  // v1.2.3 : étude finie, trois talents au choix.
  'talent.choice': (e) => ({
    section: 'fighters',
    tone: 'highlight',
    who: `📜 Étude terminée : ${e.name}`,
    text: `trois talents se révèlent (${e.choiceNames.join(', ')}). Choisissez-en un${e.previousTalentName ? ` (il remplacera ${e.previousTalentName})` : ''} avant de passer la journée.`,
  }),
  'ai.recruitment': (e, { session }) => ({
    section: 'league',
    text: `${getSpecialty(e.specialtyId)?.newRecruit ?? 'Un nouveau combattant'} a été recruté chez ${teamName(session, e.clubId)}.`,
  }),
  'queen.available': (e) => ({
    section: 'combat',
    tone: 'highlight',
    who: '♛ Combat de la Reine',
    text: `aujourd’hui : ${e.count} compagnies vous proposent un combat. Choisissez votre adversaire. Le Centre est fermé.`,
  }),
  'queen.result': (e, { session }) => ({
    section: 'combat',
    tone: e.won ? 'good' : 'bad',
    who: e.won ? 'Victoire (Combat de la Reine)' : 'Défaite (Combat de la Reine)',
    text: `contre ${teamName(session, e.opponentTeamId)} — ${e.roundsFor} / ${e.roundsAgainst}`,
    detail: `${e.won ? `+${e.reward} deniers de récompense${e.ferveurs ? ` · +${e.ferveurs} Ferveur${e.ferveurs > 1 ? 's' : ''} de la Reine` : ''}` : 'Aucune récompense'} · sans effet sur le championnat${e.auto ? ' · combat disputé automatiquement' : ''}`,
  }),
  'queen.missed': () => ({
    section: 'combat',
    tone: 'bad',
    who: 'Combat de la Reine manqué',
    text: ': aucun adversaire n’a été affronté, aucune récompense.',
  }),
  'centre.closed': () => ({ section: 'centre', text: 'Journée de combat : le Centre était fermé, aucun entraînement.' }),
  'activity.reward': (e, { session }) => {
    const who = fighterName(session, e.fighterId);
    if (e.reward.type === 'resource') {
      return { section: 'treasury', tone: 'good', who, text: `a rapporté ${e.reward.amount} ${e.reward.resource} (${activityName(e.activityId)}).` };
    }
    return { section: 'centre', tone: 'good', who, text: `${describeStatGain(e.reward.stat, e.reward.amount)} (${activityName(e.activityId)}).` };
  },
  'activity.failure': () => ({ group: 'failure' }),
  'activity.exhausted': (e, { session }) => ({ section: 'centre', tone: 'bad', who: fighterName(session, e.fighterId), text: `est épuisé (fatigue ${e.fatigue}) : il quitte ${activityName(e.activityId)} pour le ${activityName(e.refugeId)}.` }),
  'activity.blocked': () => ({ group: 'blocked' }),
  'tavern.rotation': (e) => ({
    section: 'tavern',
    tone: 'highlight',
    who: 'Nouvelle rotation de la Taverne',
    text: e.count > 1
      ? `: ${e.count} nouveaux combattants sont disponibles au recrutement.`
      : `: ${e.count} nouveau combattant est disponible au recrutement.`,
  }),
  'season.end': (e, { session }) => {
    const playerId = session.player.teamId;
    const ordinal = ordinalOf(e.rank, { feminine: true });
    const outcome = {
      promoted: `Promue en ${getLeagueName(e.leagueAfter)} !`,
      relegated: `Reléguée en ${getLeagueName(e.leagueAfter)}.`,
      stayed: `Reste en ${getLeagueName(e.leagueAfter)}.`,
    }[e.movement];
    const others = e.movements.filter((m) => m.teamId !== playerId && m.from && m.to);
    const left = e.movements.filter((m) => m.from && !m.to).length;
    const joined = e.movements.filter((m) => !m.from && m.to).length;
    const changes = [
      `${others.length} autres clubs changent de division.`,
      left ? `${left} club${left > 1 ? 's quittent' : ' quitte'} le championnat.` : '',
      joined ? `${joined} club${joined > 1 ? 's rejoignent' : ' rejoint'} le championnat.` : '',
    ].filter(Boolean).join(' ');
    return {
      section: 'season',
      tone: e.movement === 'promoted' ? 'good' : e.movement === 'relegated' ? 'bad' : 'highlight',
      who: `Saison ${e.season} terminée`,
      text: `: votre compagnie finit ${ordinal} de ${getLeagueName(e.leagueBefore)}. ${outcome}`,
      detail: `${changes} Elles s’appliqueront au lancement de la saison ${e.nextSeason}.`,
    };
  },
  'season.start': (e) => ({
    section: 'season',
    tone: 'highlight',
    who: `Saison ${e.season} lancée`,
    text: `: votre compagnie dispute la ${getLeagueName(e.leagueId)}.`,
  }),
  'save.autosaved': () => ({ section: null, text: 'Partie sauvegardée automatiquement.' }),
  'save.failed': (e) => ({ section: 'other', tone: 'bad', text: `Sauvegarde automatique impossible : ${e.message}` }),
};

/** Entraînement devenu inutile (compétence au plafond du potentiel, ActivityService.isTrainingUseless). */
export const USELESS_TRAINING_MESSAGE = 'Entraînement inutile : ce combattant a atteint son potentiel maximal.';
export const USELESS_AT_MAX_MESSAGE = 'Entraînement inutile : cette compétence est au maximum.';

/** « Entraînement inutile : Guillaume de Caen a atteint son potentiel maximal en HAS (Mannequins) ; … » */
export function uselessTrainingNote(session, e) {
  const def = e.statId ? getStatDefinition(e.statId) : null;
  // v1.1.8 : compétence à 100 (le maximum), et non au plafond du potentiel.
  if (e.atMax) return `Entraînement inutile : ${fighterName(session, e.fighterId)} est au maximum${def ? ` en ${def.short} (${def.max})` : ''} (${activityName(e.activityId)}) ; cet entraînement ne le fait plus progresser.`;
  return `Entraînement inutile : ${fighterName(session, e.fighterId)} a atteint son potentiel maximal${def ? ` en ${def.short}` : ''} (${activityName(e.activityId)}) ; cet entraînement ne le fait plus progresser.`;
}

// Lignes regroupées (lecture rapide).
export const GROUP_FORMATS = {
  failure: (entries, { session }) => ({
    section: 'centre',
    tone: 'neutral',
    who: 'Sans progrès aujourd’hui',
    text: `: ${entries.map((e) => `${fighterName(session, e.fighterId)} (${activityName(e.activityId)})`).join(', ')}.`,
  }),
  blocked: (entries, { session }) => ({
    section: 'centre',
    tone: 'neutral',
    who: 'Déjà au mieux',
    text: `: ${entries.map((e) => {
      const def = e.statId ? getStatDefinition(e.statId) : null;
      const limit = e.capped && def ? `entraînement inutile, ${def.short} au plafond de son potentiel`
        : def ? (def.polarity > 0 ? `${def.short} au maximum` : `${def.label.toLowerCase()} à ${def.min}`) : 'rien à gagner';
      return `${fighterName(session, e.fighterId)} (${activityName(e.activityId)}, ${limit})`;
    }).join(', ')}.`,
  }),
};

const fallbackFormat = (e) => ({ section: 'other', text: e.text ?? e.title ?? e.type });

/** Transforme les événements du carnet en lignes prêtes à afficher, par section. */
export function formatLogbook(report, ctx) {
  const lines = [];
  const groups = new Map();
  for (const entry of report.entries) {
    const format = LOGBOOK_FORMATS[entry.type] ?? fallbackFormat;
    const line = format(entry, ctx);
    if (line.group) {
      if (!groups.has(line.group)) groups.set(line.group, []);
      groups.get(line.group).push(entry);
    } else {
      lines.push(line);
    }
  }
  for (const [group, entries] of groups) lines.push((GROUP_FORMATS[group] ?? (() => fallbackFormat({ type: group })))(entries, ctx));

  const sections = LOGBOOK_SECTIONS
    .map((section) => ({ ...section, lines: lines.filter((line) => line.section === section.id) }))
    .filter((section) => section.lines.length);
  const footer = lines.filter((line) => line.section === null);
  return { sections, footer };
}

// ---------------------------------------------------------------------------------------------
// Carnet « Les Sceaux » (v0.64) : un sceau pour le combat du jour, les annonces à ne pas
// manquer, une tuile par domaine (on ouvre celle qui intéresse), les nouvelles des autres
// compagnies repliées. Présentation seulement : tout vient des événements du carnet.

// Tuiles, dans l'ordre d'affichage. Une tuile n'apparaît que si la journée a de quoi la remplir.
export const LOGBOOK_TILES = Object.freeze([
  Object.freeze({ id: 'points', icon: '🏆', title: 'Classement' }),
  Object.freeze({ id: 'deniers', icon: '⛁', title: 'Trésor' }),
  Object.freeze({ id: 'centre', icon: '★', title: 'Le Centre' }),
  Object.freeze({ id: 'achievements', icon: '🏅', title: 'Succès' }),
  Object.freeze({ id: 'talents', icon: '📜', title: 'Études' }),
  Object.freeze({ id: 'potential', icon: '🔥', title: 'Potentiel' }),
  Object.freeze({ id: 'expeditions', icon: '🧭', title: 'Expéditions' }),
  Object.freeze({ id: 'tavern', icon: '🏰', title: 'Taverne' }),
  Object.freeze({ id: 'other', icon: '✎', title: 'Divers' }),
]);

// Tuile ouverte à l'ouverture du carnet : la première présente dans cet ordre (le plus rare d'abord).
export const LOGBOOK_OPEN_FIRST = Object.freeze(['achievements', 'expeditions', 'talents', 'potential', 'centre', 'deniers', 'points', 'tavern', 'other']);

// Événements lus par le carnet « Les Sceaux » ; tout autre type va dans la tuile « Divers ».
const ANNOUNCEMENTS = new Set(['calendar.matchday', 'queen.available', 'queen.missed', 'season.end', 'season.start', 'save.failed', 'climate.season']);
const HANDLED = new Set([
  ...ANNOUNCEMENTS, 'match.result', 'queen.result', 'activity.reward', 'activity.failure', 'activity.blocked', 'activity.exhausted',
  'talent.income', 'talent.revealed', 'fighter.potential', 'tavern.rotation', 'ai.recruitment', 'centre.closed', 'save.autosaved',
  'achievement.unlocked', 'expedition.return',
]);

const sum = (values) => values.reduce((total, v) => total + (v ?? 0), 0);
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const locationLabel = (location) => (location === 'HOME' ? 'à domicile' : location === 'AWAY' ? 'à l’extérieur' : null);

/** Gain du Centre en abrégé : « LUT +1 », « FAT −32 », « PV +12 ». */
function statGainLabel(statId, amount) {
  const def = getStatDefinition(statId);
  const short = def?.short ?? statId;
  return def && def.polarity < 0 ? `${short} −${amount}` : `${short} +${amount}`;
}

/** Ce qui empêchait un combattant de progresser (« au mieux » : LUT au plafond, fatigue à 0…). */
function blockedNote(e) {
  const def = e.statId ? getStatDefinition(e.statId) : null;
  if (e.capped && def) return e.atMax ? `${def.short} au maximum (${def.max})` : `${def.short} au plafond de son potentiel`;
  if (def) return def.polarity > 0 ? `${def.short} au maximum` : `${def.label.toLowerCase()} à ${def.min}`;
  return 'rien à gagner';
}

/** Sceau du jour : le combat du joueur (championnat ou Reine), sinon le numéro du jour. */
function sealOf(report, ctx, hasCentre) {
  const { session } = ctx;
  const league = report.ofType('match.result');
  const queen = report.ofType('queen.result');
  const played = league.find((e) => e.opponentTeamId);
  if (played) {
    return {
      kind: played.won ? 'win' : 'loss', big: `${played.roundsFor}–${played.roundsAgainst}`, small: played.won ? 'Victoire' : 'Défaite',
      title: `${played.won ? 'Victoire' : 'Défaite'} contre ${teamName(session, played.opponentTeamId)}`, tone: played.won ? 'good' : 'bad',
      subtitle: [`Championnat, journée ${played.matchday}`, locationLabel(played.location), played.auto ? 'combat disputé automatiquement' : null].filter(Boolean).join(' · '),
    };
  }
  if (queen.length) {
    const q = queen[0];
    return {
      kind: q.won ? 'queen-win' : 'queen-loss', big: `${q.roundsFor}–${q.roundsAgainst}`, small: q.won ? 'Victoire' : 'Défaite',
      title: `${q.won ? 'Victoire' : 'Défaite'} contre ${teamName(session, q.opponentTeamId)}`, tone: q.won ? 'good' : 'bad',
      subtitle: ['♛ Combat de la Reine', q.won && q.ferveurs ? `🌸 +${q.ferveurs} Ferveur${q.ferveurs > 1 ? 's' : ''} de la Reine` : null, 'sans effet sur le championnat', q.auto ? 'combat disputé automatiquement' : null].filter(Boolean).join(' · '),
    };
  }
  if (league.length) {
    return { kind: 'rest', big: '—', small: 'Exempt', title: `Journée de championnat ${league[0].matchday} : exempt`, tone: 'neutral', subtitle: 'Votre compagnie ne combattait pas.' };
  }
  const combatToday = report.ofType('calendar.matchday').length || report.ofType('queen.available').length;
  // Premier jour d'une saison de l'année : elle donne son titre au jour (hors combat).
  const seasonStart = getClimateSeason(report.ofType('climate.season')[0]?.seasonId);
  return {
    kind: 'day', big: String(report.day), small: 'Jour', tone: 'neutral',
    title: combatToday ? 'Jour de combat' : seasonStart ? `${seasonStart.icon} ${capitalize(seasonStart.article)} commence` : hasCentre ? 'Journée au Centre' : 'Journée calme', subtitle: null,
  };
}

/**
 * Le carnet de la journée, prêt à afficher en « sceaux » :
 *   { day, seal: { kind, big, small, title, subtitle, tone }, notices: [ligne],
 *     tiles: [{ id, icon, title, value, label, tone, lines?, chips?, ledger? }], openTile,
 *     rumours: [ligne], footer: [texte] }
 * ligne : { who?, text, detail?, tone?, talentId? } ; chips : [{ who, text, tone, hint }] ;
 * ledger : [{ label, amount }].
 */
export function buildLogbookView(report, ctx) {
  const { session } = ctx;
  const of = (type) => report.ofType(type);
  const format = (entry) => (LOGBOOK_FORMATS[entry.type] ?? fallbackFormat)(entry, ctx);
  const tiles = [];
  const add = (id, data) => tiles.push({ ...LOGBOOK_TILES.find((tile) => tile.id === id), ...data });

  // Classement (championnat).
  const played = of('match.result').filter((e) => e.opponentTeamId);
  if (played.length) {
    const points = sum(played.map((e) => e.points));
    add('points', {
      value: signed(points), label: Math.abs(points) > 1 ? 'points' : 'point', tone: points > 0 ? 'good' : 'bad',
      lines: played.map((e) => ({ text: `${signed(e.points)} ${Math.abs(e.points) > 1 ? 'points' : 'point'} au classement : ${e.won ? 'victoire' : 'défaite'} contre ${teamName(session, e.opponentTeamId)} (journée ${e.matchday}).` })),
    });
  }

  // Trésor : toutes les rentrées de la journée, une seule fois.
  const ledger = [];
  for (const e of played) if (e.homeReward) ledger.push({ label: e.location === 'AWAY' ? 'Prime de victoire à l’extérieur' : 'Recette à domicile', amount: e.homeReward });
  for (const e of of('queen.result')) if (e.won && e.reward) ledger.push({ label: 'Récompense de la Reine', amount: e.reward });
  const byActivity = new Map();
  for (const e of of('activity.reward').filter((r) => r.reward.type === 'resource')) {
    const entry = byActivity.get(e.activityId) ?? { amount: 0, names: [] };
    entry.amount += e.reward.amount;
    entry.names.push(fighterName(session, e.fighterId));
    byActivity.set(e.activityId, entry);
  }
  for (const [activityId, entry] of byActivity) ledger.push({ label: `${activityName(activityId)} (${entry.names.join(', ')})`, amount: entry.amount });
  for (const e of of('talent.income')) {
    const names = [...new Set(e.details.map((d) => getTalent(d.talentId)?.name).filter(Boolean))];
    ledger.push({ label: `Talents${names.length ? ` (${names.join(', ')})` : ''}`, amount: e.amount });
  }
  if (ledger.length) add('deniers', { value: signed(sum(ledger.map((l) => l.amount))), label: 'deniers', tone: 'good', ledger });

  // Le Centre : une pastille par combattant affecté (ceux de la Forêt compris : deniers gagnés ou non).
  const gains = of('activity.reward').filter((e) => e.reward.type === 'stat');
  const earnings = of('activity.reward').filter((e) => e.reward.type === 'resource');
  const failures = of('activity.failure');
  const blocked = of('activity.blocked');
  const useless = blocked.filter((e) => e.capped);
  // Fatigue (v0.75) : les épuisés envoyés au Banquet, les fatigués qui ont manqué leur entraînement.
  const exhausted = of('activity.exhausted');
  // Échec : une activité qui rapporte des deniers « n'a rien gagné », les autres sont « sans progrès ».
  const failureLabel = (activityId) => (getActivity(activityId)?.reward?.type === 'resource' ? 'rien gagné' : 'sans progrès');
  if (gains.length || earnings.length || failures.length || blocked.length || exhausted.length) {
    add('centre', {
      value: String(gains.length), label: 'progrès', tone: gains.length ? 'good' : 'neutral',
      chips: [
        ...gains.map((e) => ({ who: fighterName(session, e.fighterId), text: statGainLabel(e.reward.stat, e.reward.amount), tone: e.reward.stat === 'fatigue' ? 'rest' : 'good', hint: activityName(e.activityId) })),
        ...earnings.map((e) => ({ who: fighterName(session, e.fighterId), text: `+${e.reward.amount} deniers`, tone: 'good', hint: activityName(e.activityId) })),
        ...failures.map((e) => ({ who: fighterName(session, e.fighterId), text: e.tired ? `${failureLabel(e.activityId)} (fatigué)` : failureLabel(e.activityId), tone: 'idle', hint: e.tired ? `${activityName(e.activityId)} : fatigué, il réussit moins souvent` : activityName(e.activityId) })),
        ...blocked.filter((e) => !e.capped).map((e) => ({ who: fighterName(session, e.fighterId), text: 'au mieux', tone: 'idle', hint: `${activityName(e.activityId)} : ${blockedNote(e)}` })),
        // Potentiel atteint : l'affectation reste visible, en gris foncé (information, pas alerte).
        ...useless.map((e) => ({ who: fighterName(session, e.fighterId), text: 'entraînement inutile', tone: 'useless', hint: `${activityName(e.activityId)} : ${e.atMax ? USELESS_AT_MAX_MESSAGE : USELESS_TRAINING_MESSAGE} (${blockedNote(e)})` })),
      ],
      // Une note explicite par combattant concerné, sous les pastilles.
      notes: useless.length || exhausted.length ? [...exhausted.map((e) => `${fighterName(session, e.fighterId)} ${format(e).text}`), ...useless.map((e) => uselessTrainingNote(session, e))] : null,
    });
  }

  // Études terminées (talents révélés).
  const reveals = of('talent.revealed');
  if (reveals.length) {
    const rarity = TALENT_RARITIES[reveals[0].rarity ?? getTalent(reveals[0].talentId)?.rarity];
    add('talents', {
      value: reveals.length === 1 ? rarity?.name ?? 'Nouveau' : String(reveals.length), label: reveals.length > 1 ? 'talents' : 'talent', tone: 'highlight',
      lines: reveals.map((e) => ({
        who: e.name, text: 'révèle', talentId: e.talentId,
        detail: !e.previousTalentName ? (e.second ? 'second talent' : null) : e.previousTalentId === e.talentId ? 'le même qu’avant' : `remplace ${e.previousTalentName}`,
      })),
    });
  }

  // Succès obtenus (v0.73).
  const achievements = of('achievement.unlocked');
  if (achievements.length) {
    add('achievements', {
      value: String(achievements.length), label: achievements.length > 1 ? 'succès obtenus' : 'succès obtenu', tone: 'highlight',
      lines: achievements.map(format),
    });
  }

  // Potentiel.
  const potential = [...of('fighter.potential'), ...of('expedition.return').filter((e) => (e.reward?.type ?? 'potential') === 'potential').map((e) => ({ ...e, change: e.potential - e.before }))];
  if (potential.length) {
    const ups = potential.filter((e) => e.change > 0).length;
    const downs = potential.length - ups;
    add('potential', {
      value: [ups ? `▲ ${ups}` : null, downs ? `▼ ${downs}` : null].filter(Boolean).join(' '), label: 'potentiel',
      tone: ups && !downs ? 'good' : downs && !ups ? 'bad' : 'highlight', lines: potential.map(format),
    });
  }

  // Retours d'expédition (v0.99) : deniers, talent, recrue (le potentiel est dans sa tuile).
  const returns = of('expedition.return').filter((e) => (e.reward?.type ?? 'potential') !== 'potential');
  if (returns.length) {
    add('expeditions', { value: String(returns.length), label: returns.length > 1 ? 'retours d’expédition' : 'retour d’expédition', tone: 'good', lines: returns.map(format) });
  }

  // Taverne.
  const rotations = of('tavern.rotation');
  if (rotations.length) {
    const count = sum(rotations.map((e) => e.count));
    add('tavern', { value: String(count), label: count > 1 ? 'recrues' : 'recrue', tone: 'highlight', lines: rotations.map(format) });
  }

  // Divers : tout événement que le carnet ne range nulle part ailleurs.
  const others = report.entries.filter((e) => !HANDLED.has(e.type));
  if (others.length) add('other', { value: String(others.length), label: 'divers', tone: 'neutral', lines: others.map(format) });

  const openTile = LOGBOOK_OPEN_FIRST.find((id) => tiles.some((tile) => tile.id === id)) ?? null;
  return {
    day: report.day,
    seal: sealOf(report, ctx, gains.length + failures.length + blocked.length > 0),
    // Combats en plus du premier (rare), annonces du jour, fin de saison : à ne pas manquer.
    notices: [
      ...of('queen.result').slice(played.length ? 0 : 1).map(format),
      // Ferveurs de la Reine gagnées (rangées dans Le Coffre).
      ...of('queen.result').filter((e) => e.won && e.ferveurs).map((e) => ({
        section: 'combat', tone: 'good', who: '🌸 Ferveurs de la Reine',
        text: `+${e.ferveurs} rangée${e.ferveurs > 1 ? 's' : ''} dans Le Coffre — le Baron saura quoi en faire.`,
      })),
      ...report.entries.filter((e) => ANNOUNCEMENTS.has(e.type)).map(format),
    ],
    tiles,
    openTile,
    rumours: of('ai.recruitment').map(format),
    footer: [...of('centre.closed'), ...of('save.autosaved')].map((e) => format(e).text),
  };
}
