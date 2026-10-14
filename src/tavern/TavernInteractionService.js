import { calculateFighterLevel, getStarRating } from '../systems/rating/RatingService.js';
import { getTavernLevel } from '../systems/tavern/TavernUpgradeService.js';
import { describeExit, getExit } from '../systems/navigation/LocationNavigationService.js';
import { getFighterTalents } from '../systems/talents/TalentService.js';

// Interactions de la scène de la Taverne : quel personnage est sous le pointeur, et que
// dire de lui au survol. Les actions (ouvrir une fiche, parler au tavernier) sont décidées
// par l'écran ; ce service ne touche ni à la partie ni au dessin.
//
// Cible : { type: 'recruit', candidateId } | { type: 'keeper' } | { type: 'stats' } (pancarte des
// classements) | { type: 'trophies' } (armoire à trophées) | { type: 'exit', exitId } (la porte) | null.

/** « ★★½ » : étoiles d'un niveau, d'après le système central de notation. */
export function formatStars(stars) {
  const full = Math.floor(stars);
  const half = stars - full >= 0.5;
  return full === 0 && !half ? '☆' : `${'★'.repeat(full)}${half ? '½' : ''}`;
}

/** Étoiles d'un combattant (système central, jamais recalculées ici). */
export function starsOf(fighter) {
  return getStarRating(calculateFighterLevel(fighter));
}

export class TavernInteractionService {
  constructor(scene, renderer, session) {
    this.scene = scene;
    this.renderer = renderer;
    this.session = session;
  }

  /** Cible sous un point de l'écran (coordonnées client) : le personnage le plus en avant. */
  targetAt(clientX, clientY) {
    const rect = this.renderer.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const targets = [
      ...this.scene.characters.map((c) => ({ target: { type: 'recruit', candidateId: c.candidateId }, depth: c.x + c.y })),
      { target: { type: 'keeper' }, depth: this.scene.keeper.x + this.scene.keeper.y },
    ].sort((a, b) => b.depth - a.depth);
    for (const { target } of targets) {
      const box = this.renderer.figureBox(target);
      if (!box) continue;
      const halfWidth = box.h * 0.28;
      if (Math.abs(x - box.p.x) <= halfWidth && y <= box.p.y + box.h * 0.08 && y >= box.p.y - box.h) return target;
    }
    // La pancarte des statistiques et l'armoire à trophées, derrière les personnages.
    const inside = (box) => box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    if (inside(this.renderer.statsBoardBox?.())) return { type: 'stats' };
    if (inside(this.renderer.trophyCabinetBox?.())) return { type: 'trophies' };
    // La porte (sortie vers le Centre), derrière les personnages.
    const exit = this.renderer.exitAtPoint?.(x, y);
    return exit ? { type: 'exit', exitId: exit.id } : null;
  }

  /** Étiquette de survol : { title, subtitle } (spécialité et étoiles, ou le tavernier). */
  labelFor(target) {
    if (!target) return null;
    if (target.type === 'exit') return describeExit(getExit(target.exitId));
    if (target.type === 'keeper') return { title: 'Le tavernier', subtitle: `Taverne niveau ${getTavernLevel(this.session)}` };
    if (target.type === 'stats') return { title: 'Les classements', subtitle: 'Statistiques des combattants' };
    if (target.type === 'trophies') {
      const count = this.session.trophies?.length ?? 0;
      return { title: 'Armoire à trophées', subtitle: count ? `${count} trophée${count > 1 ? 's' : ''}` : 'Aucun titre pour l’instant' };
    }
    const character = this.scene.getCharacter(target.candidateId);
    if (!character) return null;
    const { specialty } = character.fighter;
    const talents = getFighterTalents(this.session, character.fighter).map((talent) => talent.name);
    return { title: `${specialty?.icon ?? ''} ${specialty?.name ?? ''}`.trim(), subtitle: [formatStars(starsOf(character.fighter)), ...talents].join(' · ') };
  }

  /** Texte de la ligne d'aide sous la scène. */
  hintFor(target) {
    if (!target) return null;
    if (target.type === 'exit') {
      const label = describeExit(getExit(target.exitId));
      return label ? `La porte — sortir de la Taverne (${label.title}).` : null;
    }
    if (target.type === 'keeper') return 'Le tavernier — cliquez pour connaître la prochaine rotation et améliorer la Taverne.';
    if (target.type === 'stats') return 'La pancarte des classements — cliquez pour voir les meilleurs combattants des Ligues.';
    if (target.type === 'trophies') return 'L’armoire à trophées — cliquez pour admirer le palmarès de votre compagnie.';
    const character = this.scene.getCharacter(target.candidateId);
    if (!character) return null;
    const label = this.labelFor(target);
    return `${character.fighter.name} — ${label.title} ${label.subtitle}. Cliquez pour voir sa fiche de recrutement.`;
  }
}
