import { h } from '../../utils/dom.js';
import { audioDirector } from '../../audio/AudioDirector.js';

// Annonce d'un succès obtenu (v0.73, refondue en v0.73.2) : bandeau doré avec médaillon, reflet
// et la condition enfin révélée (même pour un exploit secret). Ni numéro ni difficulté.
// Plusieurs succès d'un coup s'annoncent l'un après l'autre.

const DURATION = 5600;
const STAGGER = 900;
let nextAt = 0;

/** Affiche l'annonce d'un succès (file d'attente : jamais deux en même temps au même endroit). */
export function showAchievementToast(achievement) {
  const root = document.getElementById('toast-root');
  if (!root || !achievement) return;
  const now = Date.now();
  const delay = Math.max(0, nextAt - now);
  nextAt = Math.max(now, nextAt) + STAGGER;
  setTimeout(() => {
    const toast = h('div', { class: 'toast toast-achievement', role: 'status', 'aria-live': 'polite' },
      h('span', { class: 'achievement-medal is-gold achievement-toast-medal', 'aria-hidden': 'true' },
        h('span', { class: 'achievement-medal-face' }, achievement.icon ?? '🏅'),
        h('span', { class: 'achievement-medal-shine' })),
      h('span', { class: 'achievement-toast-text' },
        h('span', { class: 'achievement-toast-kicker' }, '✦ Exploit accompli ✦'),
        h('strong', { class: 'achievement-toast-name' }, achievement.name),
        h('span', { class: 'achievement-toast-desc' }, achievement.description)));
    root.append(toast);
    audioDirector.play('achievement');
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 300);
    }, DURATION);
  }, delay);
}
