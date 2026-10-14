import { h } from '../utils/dom.js';
import { createRng } from '../utils/random.js';
import { formatDateTime } from '../utils/format.js';
import { SCREENS } from '../core/screenIds.js';
import { createRandomGame } from '../systems/game/newGame.js';
import { advanceDay } from '../systems/time/TimeSystem.js';
import { addResource, getDeniers } from '../systems/economy/wallet.js';
import { STAT_DEFINITIONS } from '../data/stats.js';
import { getLeagueName } from '../systems/league/LeagueService.js';
import { calculateClubLevel } from '../systems/fighters/ratings.js';
import { clubEditorTool } from './tools/clubEditorTool.js';
import { aiBenchTool } from './tools/aiBenchTool.js';
import { DefinitionList } from '../ui/components/DefinitionList.js';
import { confirmModal } from '../ui/components/Modal.js';
import { showToast } from '../ui/components/Toast.js';

/**
 * Registre des outils du module Admin.
 * Un outil : { id, label, description, status: 'ready' | 'planned', render(ctx) → HTMLElement }
 * ctx = { services, navigate, refresh }
 * Pour ajouter un outil : l'ajouter à ce tableau (ou l'importer depuis son propre fichier).
 */
export const ADMIN_TOOLS = [
  {
    id: 'overview',
    label: 'Vue d’ensemble',
    description: 'État général du jeu et de l’environnement.',
    status: 'ready',
    render({ services }) {
      const { session } = services.gameState;
      return DefinitionList([
        ['Version', services.config.version],
        ['Environnement', services.platform.getEnvironmentLabel()],
        ['Stockage persistant', services.storage.persistent ? 'Oui' : 'Non (mémoire seulement)'],
        ['Sauvegardes', String(services.saves.listSaves().length)],
        ['Partie en cours', session ? session.playerTeam?.name ?? '—' : 'Aucune'],
        ['Ligue', session?.playerLeague ? `${getLeagueName(session.playerLeague)} (${session.playerLeague.teamIds.length} clubs)` : '—'],
        ['Niveau du club', session ? calculateClubLevel(session.playerFighters).toFixed(2) : '—'],
        ['Jour', session ? String(session.calendar.currentDay) : '—'],
        ['Deniers', session ? String(getDeniers(session)) : '—'],
        ['Combattants', session ? String(session.playerFighters.length) : '—'],
        ['Non sauvegardée', session ? (session.dirty ? 'Oui' : 'Non') : '—'],
      ]);
    },
  },
  clubEditorTool,
  {
    id: 'stats-editor',
    label: 'Statistiques',
    description: 'Modifier les statistiques des combattants de la partie en cours (ex. monter la fatigue pour tester le Banquet).',
    status: 'ready',
    render({ services }) {
      const { session } = services.gameState;
      if (!session) return h('p', { class: 'muted' }, 'Aucune partie en cours.');
      return h(
        'table',
        { class: 'assign-table admin-stats-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Combattant'), STAT_DEFINITIONS.map((def) => h('th', {}, def.short)))),
        h('tbody', {}, session.playerFighters.map((fighter) => h(
          'tr',
          {},
          h('td', {}, fighter.name),
          STAT_DEFINITIONS.map((def) => h('td', {}, h('input', {
            class: 'input input-num', type: 'number', min: 0, max: def.max, value: fighter.stats[def.id],
            'aria-label': `${def.label} de ${fighter.name}`,
            onchange: (event) => {
              const value = Math.max(0, Math.min(def.max, Math.round(Number(event.target.value) || 0)));
              event.target.value = value;
              fighter.stats[def.id] = value;
              session.markDirty();
            },
          }))),
        ))),
      );
    },
  },
  {
    id: 'resources',
    label: 'Ressources',
    description: 'Ajouter des deniers à la partie en cours.',
    status: 'ready',
    render({ services, refresh }) {
      const { session } = services.gameState;
      if (!session) return h('p', { class: 'muted' }, 'Aucune partie en cours.');
      const give = (amount) => () => {
        addResource(session, 'deniers', amount);
        showToast(`+${amount} deniers.`, 'success');
        refresh();
      };
      return h(
        'div',
        { class: 'admin-tool-body' },
        h('p', {}, `Trésor actuel : ${getDeniers(session)} deniers.`),
        h(
          'div',
          { class: 'button-row' },
          h('button', { type: 'button', class: 'btn', onclick: give(100) }, '+100 deniers'),
          h('button', { type: 'button', class: 'btn', onclick: give(1000) }, '+1000 deniers'),
        ),
      );
    },
  },
  {
    id: 'time',
    label: 'Temps',
    description: 'Faire passer plusieurs journées d’un coup (activités et événements compris).',
    status: 'ready',
    render({ services, refresh }) {
      const { session } = services.gameState;
      if (!session) return h('p', { class: 'muted' }, 'Aucune partie en cours.');
      const pass = (days) => () => {
        let successes = 0;
        for (let i = 0; i < days; i++) {
          successes += advanceDay(session).entries.filter((entry) => entry.status === 'success').length;
        }
        showToast(`${days} jours passés (${successes} réussites d’activité).`, 'success');
        refresh();
      };
      return h(
        'div',
        { class: 'admin-tool-body' },
        h('p', {}, `Jour actuel : ${session.calendar.currentDay}.`),
        h(
          'div',
          { class: 'button-row' },
          h('button', { type: 'button', class: 'btn', onclick: pass(1) }, '+1 jour'),
          h('button', { type: 'button', class: 'btn', onclick: pass(7) }, '+7 jours'),
          h('button', { type: 'button', class: 'btn', onclick: pass(30) }, '+30 jours'),
        ),
      );
    },
  },
  {
    id: 'quick-game',
    label: 'Partie de test',
    description: 'Génère instantanément une compagnie aléatoire et ouvre son écran de gestion.',
    status: 'ready',
    render({ services, navigate }) {
      const seedInput = h('input', { class: 'input', type: 'text', placeholder: 'Graine (optionnelle)', autocomplete: 'off' });
      const generate = () => {
        const session = createRandomGame({ rng: createRng(seedInput.value.trim()) });
        services.gameState.setSession(session);
        navigate(SCREENS.TEAM, { justCreated: true });
      };
      return h(
        'div',
        { class: 'admin-tool-body' },
        h('div', { class: 'inline-form' }, seedInput, h('button', { type: 'button', class: 'btn btn-primary', onclick: generate }, 'Générer et ouvrir')),
        h('p', { class: 'muted' }, 'Une même graine produit toujours la même compagnie (noms, couleurs, spécialités, apparences).'),
        services.gameState.hasSession()
          ? h('p', { class: 'warning-text' }, 'Attention : la partie en cours sera remplacée (sans sauvegarde automatique).')
          : null,
      );
    },
  },
  {
    id: 'combat-test',
    label: 'La Lice (aperçu)',
    description: 'Ouvre La Lice en vue isométrique avec des équipes réelles ou générées ; choix du décor et du nombre de spectateurs.',
    status: 'ready',
    render({ services, navigate }) {
      const hasSession = services.gameState.hasSession();
      return h(
        'div',
        { class: 'admin-tool-body' },
        h(
          'div',
          { class: 'button-row' },
          h('button', {
            type: 'button', class: 'btn btn-primary', disabled: !hasSession,
            onclick: () => navigate(SCREENS.COMBAT, { returnTo: SCREENS.ADMIN }),
          }, 'Compagnie du joueur contre adversaire'),
          h('button', {
            type: 'button', class: 'btn',
            onclick: () => navigate(SCREENS.COMBAT, { returnTo: SCREENS.ADMIN, randomSides: true }),
          }, 'Deux compagnies aléatoires'),
        ),
        hasSession ? null : h('p', { class: 'muted' }, 'Aucune partie en cours : seul le combat aléatoire est disponible.'),
      );
    },
  },
  aiBenchTool,
  {
    id: 'session',
    label: 'Inspecteur de session',
    description: 'Données brutes de la partie en cours, telles qu’elles seront sauvegardées.',
    status: 'ready',
    render({ services }) {
      const { session } = services.gameState;
      if (!session) return h('p', { class: 'muted' }, 'Aucune partie en cours.');
      const json = JSON.stringify(session.toJSON(), null, 2);
      return h(
        'div',
        { class: 'admin-tool-body' },
        h('button', {
          type: 'button', class: 'btn btn-sm',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(json);
              showToast('JSON copié dans le presse-papiers.', 'success');
            } catch {
              showToast('Copie impossible dans cet environnement.', 'error');
            }
          },
        }, 'Copier le JSON'),
        h('pre', { class: 'code-block' }, json),
      );
    },
  },
  {
    id: 'saves',
    label: 'Sauvegardes',
    description: 'Liste et maintenance des sauvegardes.',
    status: 'ready',
    render({ services, refresh }) {
      const saves = services.saves.listSaves();
      const { session } = services.gameState;
      return h(
        'div',
        { class: 'admin-tool-body' },
        saves.length
          ? h('ul', { class: 'plain-list' }, saves.map((save) => h('li', {},
            save.corrupted ? `⚠ Illisible (${save.id})` : `${save.teamName} — ${formatDateTime(save.savedAt)}`)))
          : h('p', { class: 'muted' }, 'Aucune sauvegarde.'),
        h(
          'div',
          { class: 'button-row' },
          h('button', {
            type: 'button', class: 'btn', disabled: !session,
            onclick: () => {
              services.saves.save(session);
              showToast('Partie sauvegardée.', 'success');
              refresh();
            },
          }, 'Sauvegarder la partie en cours'),
          h('button', {
            type: 'button', class: 'btn btn-danger', disabled: !saves.length,
            onclick: async () => {
              const ok = await confirmModal({
                title: 'Tout supprimer',
                message: `Supprimer définitivement les ${saves.length} sauvegarde(s) ?`,
                confirmLabel: 'Tout supprimer',
                danger: true,
              });
              if (!ok) return;
              services.saves.deleteAll();
              if (session) session.saveId = null;
              showToast('Sauvegardes supprimées.');
              refresh();
            },
          }, 'Supprimer toutes les sauvegardes'),
        ),
      );
    },
  },
  planned('fighter-creator', 'Création de combattants', 'Créer un combattant sur mesure (nom, spécialité, statistiques).'),
  planned('game-params', 'Paramètres du jeu', 'Ajuster à chaud les constantes de conception (taux de réussite, coûts, économie).'),
];

function planned(id, label, description) {
  return {
    id,
    label,
    description,
    status: 'planned',
    render: () => h('p', { class: 'muted' }, 'Outil prévu pour une prochaine itération.'),
  };
}
