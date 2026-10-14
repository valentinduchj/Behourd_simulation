import { TROPHY_ORDER, TROPHY_TYPES } from '../../data/trophies.js';

// Palmarès et trophées de la compagnie du joueur (session.trophies : source de vérité ; l'armoire
// de la Taverne n'en est que l'image). Les clubs de l'IA n'ont pas de trophées : leurs titres
// restent dans leur historique (session.clubHistory).
//
// Un trophée est remis au moment où la victoire est confirmée (fin de saison, finale de Coupe) ;
// son identifiant est celui du titre (compétition + saison ou édition) : une même victoire ne
// donne jamais deux trophées, même après un chargement.

const leagueTrophyId = (leagueId, season) => `league:${leagueId}:${season}`;
const cupTrophyId = (editionId) => `cup:${editionId}`;

/** Remet un trophée (sans doublon). Renvoie le trophée ajouté, ou null (déjà remis, type inconnu). */
function award(session, { id, competition, season, editionId = null, day = null }) {
  if (!TROPHY_TYPES[competition]) return null;
  session.trophies ??= [];
  if (session.trophies.some((trophy) => trophy.id === id)) return null;
  const trophy = {
    id, clubId: session.player.teamId, competition, season, editionId,
    order: session.trophies.length + 1, day: day ?? session.calendar?.currentDay ?? null,
  };
  session.trophies.push(trophy);
  session.markDirty?.();
  return trophy;
}

/** Fin de saison : la compagnie du joueur championne d'une Ligue reçoit son trophée. */
export function awardLeagueTitle(session, { leagueId, season, position }) {
  if (position !== 1) return null;
  return award(session, { id: leagueTrophyId(leagueId, season), competition: leagueId, season, editionId: `${leagueId}:saison-${season}` });
}

/** Finale de Coupe de France gagnée par la compagnie du joueur. */
export function awardCupTitle(session, cup) {
  if (!cup?.winnerId || cup.winnerId !== cup.playerTeamId) return null;
  return award(session, { id: cupTrophyId(cup.editionId), competition: 'cup', season: cup.season ?? session.season?.number ?? 1, editionId: cup.editionId });
}

/**
 * Sauvegarde antérieure aux trophées : ils sont retrouvés dans les données déjà enregistrées
 * (titres de Ligue de l'historique de la compagnie, Coupes gagnées du palmarès). Idempotent.
 * Renvoie le nombre de trophées ajoutés.
 */
export function ensureTrophies(session) {
  let added = 0;
  const history = session.clubHistory?.[session.player.teamId] ?? [];
  for (const entry of [...history].sort((a, b) => a.season - b.season)) {
    if (entry.kind === 'cup' || entry.finalPosition !== 1) continue;
    if (awardLeagueTitle(session, { leagueId: entry.leagueId, season: entry.season, position: 1 })) added += 1;
  }
  for (const entry of session.frenchCupHistory ?? []) {
    if (entry.playerStatus !== 'champion') continue;
    if (award(session, { id: cupTrophyId(entry.editionId), competition: 'cup', season: entry.season ?? null, editionId: entry.editionId })) added += 1;
  }
  return added;
}

/** Trophées de la compagnie, dans l'ordre où ils ont été gagnés. */
export function listTrophies(session) {
  return [...(session.trophies ?? [])].sort((a, b) => a.order - b.order);
}

/** Palmarès regroupé par compétition : [{ type, trophies: [trophée…] }] (compétitions gagnées seulement). */
export function groupTrophies(session) {
  const trophies = listTrophies(session);
  return TROPHY_ORDER
    .map((competition) => ({ type: TROPHY_TYPES[competition], trophies: trophies.filter((t) => t.competition === competition) }))
    .filter((group) => group.trophies.length);
}
