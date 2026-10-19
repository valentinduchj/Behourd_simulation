// Glisser pour fermer (v0.93, téléphone) : un volet qui monte du bas se referme en le tirant
// vers le bas ; le menu (volet de droite) en le poussant vers la droite. Le volet suit le doigt,
// puis se referme s'il a été tiré assez loin (ou assez vite), sinon il revient en place.
// Vers le bas, le geste ne part que de l'en-tête ou d'un contenu déjà en haut de sa liste :
// faire défiler la liste reste possible.

const THRESHOLD = 0.25; // part de la hauteur (ou largeur) au-delà de laquelle le volet se ferme
const MIN_DISTANCE = 70; // px
const FLICK_SPEED = 0.6; // px / ms : un geste vif ferme même sur une courte distance…
const FLICK_MIN = 40; // px : …à condition d'aller au moins jusque-là
const SLOP = 10; // px avant de décider que c'est un glissé

function scrolledAncestor(target, panel) {
  for (let el = target; el && el !== panel; el = el.parentElement) {
    if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

/**
 * Branche le geste sur `panel`. direction : 'down' (volet du bas) ou 'right' (volet de droite).
 * `onClose()` ferme pour de bon ; `isActive()` dit si le volet est ouvert. Renvoie detach().
 */
export function attachSwipeClose(panel, { direction = 'down', onClose, isActive = () => true } = {}) {
  let start = null;
  let dragging = false;
  let swallowClick = false;

  const offset = (event) => (direction === 'down' ? event.clientY - start.y : event.clientX - start.x);
  const across = (event) => (direction === 'down' ? event.clientX - start.x : event.clientY - start.y);
  const size = () => (direction === 'down' ? panel.offsetHeight : panel.offsetWidth);
  const place = (px) => { panel.style.transform = direction === 'down' ? `translateY(${px}px)` : `translateX(${px}px)`; };
  const settle = (px, after) => {
    panel.style.transition = 'transform 0.18s ease-out';
    place(px);
    setTimeout(() => {
      panel.style.transition = '';
      panel.style.transform = '';
      after?.();
    }, 190);
  };

  const onDown = (event) => {
    if (event.pointerType === 'mouse' || !isActive()) return;
    if (direction === 'down' && scrolledAncestor(event.target, panel)) return;
    start = { x: event.clientX, y: event.clientY, t: performance.now(), id: event.pointerId };
    dragging = false;
  };
  const onMove = (event) => {
    if (!start || event.pointerId !== start.id) return;
    const d = offset(event);
    if (!dragging) {
      if (Math.abs(d) < SLOP && Math.abs(across(event)) < SLOP) return;
      // Il faut aller dans le sens de la fermeture, plus que de travers.
      if (d <= 0 || Math.abs(across(event)) > Math.abs(d)) { start = null; return; }
      dragging = true;
      panel.style.transition = 'none';
    }
    place(Math.max(0, d));
    event.preventDefault();
  };
  const onUp = (event) => {
    if (!start || event.pointerId !== start.id) return;
    const d = Math.max(0, offset(event));
    const speed = d / Math.max(1, performance.now() - start.t);
    const wasDragging = dragging;
    start = null;
    dragging = false;
    if (!wasDragging) return;
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    if (d > Math.max(MIN_DISTANCE, size() * THRESHOLD) || (speed > FLICK_SPEED && d >= FLICK_MIN)) settle(size(), onClose);
    else settle(0);
  };
  const onClick = (event) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.stopPropagation();
    event.preventDefault();
  };

  panel.classList.add('is-swipeable');
  panel.addEventListener('pointerdown', onDown);
  panel.addEventListener('pointermove', onMove);
  panel.addEventListener('pointerup', onUp);
  panel.addEventListener('pointercancel', onUp);
  panel.addEventListener('click', onClick, true);
  return () => {
    panel.removeEventListener('pointerdown', onDown);
    panel.removeEventListener('pointermove', onMove);
    panel.removeEventListener('pointerup', onUp);
    panel.removeEventListener('pointercancel', onUp);
    panel.removeEventListener('click', onClick, true);
  };
}
