import { h } from '../../utils/dom.js';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../../data/achievements.js';
import { countUnlocked, getAchievementProgress, getAchievementState } from '../../systems/achievements/AchievementService.js';
import { getClimateSeason } from '../../systems/climate/ClimateService.js';
import { openModal } from './Modal.js';

// Fenêtre des succès (v0.73, refondue en v0.73.2), ouverte depuis l'encart « Sauvegarde / Menu
// principal » : la Salle des exploits. Des médaillons rangés par catégorie — dorés une fois
// obtenus, de fer tant qu'ils restent à conquérir. Ni numéro ni difficulté ne sont montrés au
// joueur. Les exploits difficiles gardent leur condition secrète (une phrase d'ambiance à la
// place) jusqu'à ce qu'ils soient obtenus.

const FILTERS = Object.freeze([
  Object.freeze({ id: 'all', label: 'Tous' }),
  Object.freeze({ id: 'unlocked', label: 'Obtenus' }),
  Object.freeze({ id: 'locked', label: 'À conquérir' }),
]);

const CATEGORY_ORDER = ['combat', 'competition', 'fighters', 'economy', 'upgrades', 'centre', 'world'];

/** Exploit secret (condition cachée tant qu'il n'est pas obtenu) : les plus difficiles. */
export function isSecretAchievement(achievement) {
  return achievement?.difficulty === 'hard';
}

/** Quand un succès a été obtenu : « Jour 34 · été de l'an 1 ». */
export function describeUnlock(record) {
  if (!record) return null;
  const season = getClimateSeason(record.climateSeason);
  return [`Jour ${record.day}`, season ? `${season.name.toLowerCase()} de l’an ${record.year ?? 1}` : `an ${record.year ?? 1}`].join(' · ');
}

/** Médaillon : icône dans un écu rond (doré obtenu, de fer verrouillé, scellé s'il est secret). */
function Medallion(achievement, { unlocked, secret }) {
  return h('span', { class: `achievement-medal ${unlocked ? 'is-gold' : 'is-iron'} ${secret && !unlocked ? 'is-sealed' : ''}`.trim(), 'aria-hidden': 'true' },
    h('span', { class: 'achievement-medal-face' }, secret && !unlocked ? '?' : achievement.icon),
    unlocked ? h('span', { class: 'achievement-medal-shine' }) : null);
}

function AchievementCard(session, achievement, record) {
  const unlocked = Boolean(record);
  const secret = isSecretAchievement(achievement);
  const hidden = secret && !unlocked;
  const progress = unlocked || secret ? null : getAchievementProgress(session, achievement.id);
  return h('article', {
    class: `achievement-card ${unlocked ? 'is-unlocked' : 'is-locked'} ${hidden ? 'is-secret' : ''}`.trim(),
    'data-achievement': achievement.id,
  },
  Medallion(achievement, { unlocked, secret }),
  h('div', { class: 'achievement-body' },
    h('p', { class: 'achievement-name' }, achievement.name),
    hidden
      ? h('p', { class: 'achievement-desc achievement-teaser' }, h('span', { class: 'achievement-secret-tag' }, '🔒 Exploit secret'), ' ', achievement.teaser ?? 'Continuez à jouer pour le découvrir…')
      : h('p', { class: 'achievement-desc' }, achievement.description),
    unlocked ? h('p', { class: 'achievement-date' }, `✦ Obtenu · ${describeUnlock(record)}`) : null,
    progress ? h('div', { class: 'achievement-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(progress.goal), 'aria-valuenow': String(progress.value) },
      h('span', { class: 'achievement-progress-fill', style: { width: `${Math.round((progress.value / progress.goal) * 100)}%` } }),
      h('span', { class: 'achievement-progress-label' }, `${progress.value.toLocaleString('fr-FR')} / ${progress.goal.toLocaleString('fr-FR')}`)) : null));
}

/** Ouvre la fenêtre des succès de la partie. */
export function openAchievements(session, { onClose = null } = {}) {
  const state = getAchievementState(session);
  let filter = 'all';
  const body = h('div', { class: 'achievements-panel' });
  const render = () => {
    const { unlocked, total } = countUnlocked(session);
    const ratio = total ? unlocked / total : 0;
    // Le plus récent : le jour le plus tardif ; le même jour, le dernier inscrit.
    const latest = Object.entries(state.unlocked).map((entry, index) => [...entry, index]).sort((a, b) => (b[1].day ?? 0) - (a[1].day ?? 0) || b[2] - a[2])[0];
    const latestEntry = latest ? ACHIEVEMENTS.find((a) => a.id === latest[0]) : null;
    const shown = ACHIEVEMENTS.filter((entry) => filter === 'all' || (filter === 'unlocked') === Boolean(state.unlocked[entry.id]));
    const sections = CATEGORY_ORDER.map((id) => ACHIEVEMENT_CATEGORIES[id]).filter(Boolean)
      .map((category) => ({ category, entries: shown.filter((entry) => entry.category === category.id) }))
      .filter((section) => section.entries.length);
    body.replaceChildren(
      h('div', { class: 'achievements-hero' },
        h('span', { class: 'achievements-hero-medal', 'aria-hidden': 'true' }, '🏆'),
        h('div', { class: 'achievements-hero-text' },
          h('p', { class: 'achievements-kicker' }, 'Salle des exploits'),
          h('p', { class: 'achievements-count' }, h('strong', {}, String(unlocked)), ` / ${total} exploits accomplis`),
          h('div', { class: 'achievements-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(unlocked) },
            h('span', { class: 'achievements-bar-fill', style: { width: `${Math.round(ratio * 100)}%` } })),
          h('p', { class: 'achievements-latest' }, latestEntry ? `Dernier exploit : ${latestEntry.icon} ${latestEntry.name}` : 'Votre légende reste à écrire.'))),
      h('div', { class: 'achievements-filters', role: 'tablist', 'aria-label': 'Afficher' },
        ...FILTERS.map((f) => h('button', {
          type: 'button', role: 'tab', class: `achievements-tab ${filter === f.id ? 'is-active' : ''}`.trim(), 'aria-selected': String(filter === f.id),
          onclick: () => { filter = f.id; render(); },
        }, f.label))),
      sections.length
        ? h('div', { class: 'achievements-sections' }, sections.map(({ category, entries }) => h('section', { class: 'achievements-section' },
          h('h3', { class: 'achievements-section-title' }, h('span', { 'aria-hidden': 'true' }, category.icon), ` ${category.label}`,
            h('span', { class: 'achievements-section-count' }, `${entries.filter((e) => state.unlocked[e.id]).length} / ${entries.length}`)),
          h('div', { class: 'achievements-grid' }, entries.map((entry) => AchievementCard(session, entry, state.unlocked[entry.id]))))))
        : h('p', { class: 'muted achievements-empty' }, filter === 'unlocked' ? 'Aucun exploit pour l’instant : la lice vous attend.' : 'Tous les exploits sont accomplis. Chapeau bas !'),
    );
  };
  render();
  return openModal({ title: '🏅 Succès', className: 'modal-wide achievements-modal', body, actions: [{ label: 'Fermer', variant: 'primary' }], onClose });
}
