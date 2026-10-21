import { h } from '../../utils/dom.js';
import { getSprite } from '../../data/sprites.js';
import { getClubSpriteUrl, loadSpriteSource, spriteUrl } from '../../render/sprites.js';
import { getFighterColorIntensity } from '../../systems/fighters/FatigueService.js';

/**
 * Sprite d'un combattant dans l'interface (cartes, fiches, listes).
 * Le cadre et le tabard prennent les couleurs du club (`team`, ou `colors` pour un club pas
 * encore créé) ; sans club, le sprite garde ses couleurs d'origine. La variante (armure,
 * casque, arme…) ne change jamais.
 * colorIntensity (0 à 1) : 1 = couleurs normales, 0 = noir et blanc. Par défaut, elle
 * découle de la fatigue (FatigueService) ; le rendu, lui, ignore la fatigue.
 */
export function FighterSprite(fighter, { size = 60, team = null, colors = team?.emblem.resolvedColors() ?? null, colorIntensity = getFighterColorIntensity(fighter) } = {}) {
  const intensity = Math.max(0, Math.min(1, colorIntensity));
  const img = h('img', {
    src: getClubSpriteUrl(fighter.spriteId, colors) ?? spriteUrl(fighter.spriteId),
    alt: '', width: Math.round(size * 0.62), height: Math.round(size * 0.93), draggable: 'false',
  });
  // Fichier source pas encore lu : l'image reste cachée jusqu'au tabard aux couleurs du club
  // (v1.1.7 : plus de tabard d'origine affiché un instant) ; à défaut, le sprite de base.
  if (colors && !img.src.startsWith('data:')) {
    img.style.visibility = 'hidden';
    loadSpriteSource(fighter.spriteId).then(() => {
      const url = getClubSpriteUrl(fighter.spriteId, colors);
      if (url) img.src = url;
      img.style.visibility = '';
    });
  }
  return h(
    'span',
    {
      class: `fighter-sprite ${intensity === 0 ? 'is-exhausted' : ''}`.trim(),
      style: { width: `${size}px`, height: `${size}px`, '--club-color': colors?.primary, '--color-intensity': String(intensity) },
      title: getSprite(fighter.spriteId)?.name,
      'data-sprite': fighter.spriteId,
    },
    img,
  );
}
