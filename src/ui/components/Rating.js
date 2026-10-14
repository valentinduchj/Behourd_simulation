import { h } from '../../utils/dom.js';
import { RATING_CONFIG } from '../../data/ratings.js';
import { getStarRating } from '../../systems/rating/RatingService.js';

// Affichage des étoiles (avec demi-étoiles). Les seuils ne sont jamais reproduits ici :
// le nombre d'étoiles vient toujours de RatingService.getStarRating().

const formatStars = (stars) => String(stars).replace('.', ',');
const starsLabel = (stars) => `${formatStars(stars)} étoile${stars > 1 ? 's' : ''}`;

const fullStar = () => h('span', { class: 'star is-filled', 'aria-hidden': 'true' }, '★');
const halfStar = () => h('span', { class: 'star is-half', 'aria-hidden': 'true' }, '☆');
const emptyStar = () => h('span', { class: 'star', 'aria-hidden': 'true' }, '☆');

/** Étoiles pleines puis demi-étoile éventuelle. */
function earnedStars(stars) {
  const full = Math.floor(stars);
  return [
    ...Array.from({ length: full }, fullStar),
    stars - full >= 0.5 ? halfStar() : null,
  ].filter(Boolean);
}

/**
 * Niveau d'un club : toujours cinq emplacements, les étoiles vides montrant le maximum
 * (★★★½☆). Seul le nombre d'étoiles est exposé, jamais le niveau numérique.
 */
export function ClubStars(level, { className = '' } = {}) {
  const stars = getStarRating(level);
  const max = RATING_CONFIG.maxStars;
  const earned = earnedStars(stars);
  return h(
    'span',
    { class: `star-rating ${className}`.trim(), role: 'img', 'aria-label': `Niveau du club : ${starsLabel(stars)} sur ${max}`, 'data-stars': String(stars) },
    earned,
    Array.from({ length: max - earned.length }, emptyStar),
  );
}

/**
 * Niveau d'un combattant : uniquement les étoiles obtenues (★★½), sans étoiles vides.
 * Le plus bas palier (0 étoile) s'affiche ☆.
 */
export function FighterStars(level, { className = '' } = {}) {
  const stars = getStarRating(level);
  return h(
    'span',
    { class: `star-rating fighter-stars ${className}`.trim(), role: 'img', 'aria-label': `Niveau : ${stars ? starsLabel(stars) : 'aucune étoile'}`, 'data-stars': String(stars) },
    stars ? earnedStars(stars) : emptyStar(),
  );
}
