import { h } from '../../utils/dom.js';
import { EMBLEM_PATTERNS } from '../../data/emblemPatterns.js';
import { EMBLEM_COLOR_SLOTS, Emblem } from '../../models/Emblem.js';
import { SPECIALTIES, SPECIALTY_IDS } from '../../data/specialties.js';
import { RATING_CONFIG } from '../../data/ratings.js';
import { LEAGUE_CONFIG } from '../../data/leagues.js';
import { calculateClubLevel, getStarRating } from '../../systems/fighters/ratings.js';
import { EmblemView } from '../../ui/components/EmblemView.js';
import { FighterSprite } from '../../ui/components/FighterSprite.js';
import { ClubStars, FighterStars } from '../../ui/components/Rating.js';
import { confirmModal } from '../../ui/components/Modal.js';
import { CaptainCrown } from '../../ui/components/CaptainCrown.js';
import { showToast } from '../../ui/components/Toast.js';
import { getLand, getLands } from '../../systems/geography/LandService.js';
import { getLocation, getLocationsOfLand } from '../../systems/geography/LocationService.js';

// État de l'outil, conservé entre deux affichages.
const state = { leagueDefId: null, clubId: null };

/**
 * Module Admin › Gestion des clubs : modifie les clubs de l'IA (base de clubs).
 * Les modifications sont enregistrées dans ce navigateur et s'appliquent aussi
 * aux parties en cours ; l'export produit un fichier pour data/leagues/.
 */
export const clubEditorTool = {
  id: 'clubs',
  label: 'Gestion des clubs',
  description: 'Modifier les clubs des trois divisions et de la réserve : composition, nom, emblème, couleurs, Terre et lieu, combattants (score caché au joueur).',
  status: 'ready',
  render({ services, refresh }) {
    const db = services.clubs;
    const leagues = db.listPools();
    if (!leagues.length) return h('p', { class: 'muted' }, 'Aucune ligue ne déclare de fichier de clubs.');
    if (!leagues.some((def) => def.id === state.leagueDefId)) state.leagueDefId = leagues[0].id;
    const clubs = db.getClubsData(state.leagueDefId);
    if (!clubs.some((club) => club.id === state.clubId)) state.clubId = clubs[0]?.id ?? null;
    const club = state.clubId ? db.getClubData(state.clubId) : null;
    const leagueDef = leagues.find((d) => d.id === state.leagueDefId);
    const expected = db.getExpectedClubCount(state.leagueDefId); // null : réserve, effectif libre
    const countOk = expected === null || clubs.length === expected;
    const { session } = services.gameState;
    // Un club engagé dans la partie en cours ne peut pas être retiré (il a un calendrier et un classement).
    const engaged = (clubId) => Boolean(session?.getLeagueOfTeam(clubId));
    const currentDivision = (clubId) => session?.getLeagueOfTeam(clubId);

    const divisionBar = h(
      'div',
      { class: 'club-editor-toolbar' },
      h('label', { class: 'field-label', for: 'admin-league-select' }, 'Division'),
      h(
        'select',
        {
          id: 'admin-league-select', class: 'select',
          onchange: (event) => { state.leagueDefId = event.target.value; state.clubId = null; refresh(); },
        },
        leagues.map((def) => h('option', { value: def.id, selected: def.id === state.leagueDefId }, def.name)),
      ),
      h('span', { class: `club-count ${countOk ? '' : 'is-wrong'}`.trim() },
        expected === null
          ? `${clubs.length} club${clubs.length > 1 ? 's' : ''} hors championnat`
          : `${clubs.length} / ${expected} clubs${leagueDef.playerStart ? ' (+ la compagnie du joueur)' : ''}`),
      h('button', {
        type: 'button', class: 'btn btn-sm',
        onclick: () => {
          const added = db.addClub(state.leagueDefId);
          state.clubId = added.id;
          showToast(`${added.name} ajouté à ${leagueDef.name}.`, 'success');
          refresh();
        },
      }, 'Ajouter un club'),
      club ? h('button', {
        type: 'button', class: 'btn btn-sm btn-danger', disabled: engaged(club.id),
        title: engaged(club.id) ? 'Ce club est engagé dans la partie en cours.' : null,
        onclick: async () => {
          const ok = await confirmModal({ title: 'Retirer le club', message: `Retirer ${club.name} de ${leagueDef.name} (et ses combattants) ?`, confirmLabel: 'Retirer', danger: true });
          if (!ok) return;
          db.removeClub(club.id);
          state.clubId = null;
          refresh();
        },
      }, 'Retirer ce club') : null,
    );
    const compositionNote = h(
      'p',
      { class: `muted club-editor-note ${countOk ? '' : 'is-wrong'}`.trim() },
      expected === null
        ? 'Clubs engagés dans aucune division d’une nouvelle partie. Ils complètent une division en sous-effectif (reprise d’une ancienne sauvegarde).'
        : countOk && LEAGUE_CONFIG.initialDistribution === 'level'
        ? `Groupe de ${expected} clubs. Dans une nouvelle partie, les clubs des trois divisions sont répartis selon leur niveau : les plus forts en Ligue 1, les plus faibles en Ligue 3. Dans une partie en cours, les clubs suivent les montées et descentes ; les modifications (nom, emblème, combattants) s’y appliquent immédiatement.`
        : countOk
        ? 'Composition initiale des nouvelles parties. Dans une partie en cours, les clubs suivent les montées et descentes ; les modifications (nom, emblème, combattants) s’y appliquent immédiatement.'
        : `Une nouvelle partie exige ${expected} clubs dans ${leagueDef.name} : ajustez la composition avant de lancer une partie.`,
    );

    const toolbar = h(
      'div',
      { class: 'club-editor-toolbar' },
      h('label', { class: 'field-label', for: 'admin-club-select' }, 'Club'),
      h(
        'select',
        {
          id: 'admin-club-select', class: 'select',
          onchange: (event) => { state.clubId = event.target.value; refresh(); },
        },
        clubs.map((c) => {
          const division = currentDivision(c.id);
          const suffix = division && division.id !== state.leagueDefId ? ` — actuellement en ${division.id.replace('league_', 'Ligue ')}` : '';
          return h('option', { value: c.id, selected: c.id === state.clubId }, `${c.name}${suffix}`);
        }),
      ),
      h('span', { class: `club-editor-source ${db.hasLocalChanges(state.leagueDefId) ? 'is-modified' : ''}`.trim() },
        db.hasLocalChanges(state.leagueDefId) ? 'Modifications locales actives' : `Données du fichier ${leagues.find((d) => d.id === state.leagueDefId).clubsFile}`),
      h('button', { type: 'button', class: 'btn btn-sm', onclick: () => exportFile(db, leagues.find((d) => d.id === state.leagueDefId)) }, 'Exporter le fichier JSON'),
      h('button', {
        type: 'button', class: 'btn btn-sm btn-danger', disabled: !db.hasLocalChanges(state.leagueDefId),
        onclick: async () => {
          const ok = await confirmModal({
            title: 'Revenir au fichier',
            message: 'Abandonner toutes les modifications locales des clubs et recharger les données du fichier ?',
            confirmLabel: 'Revenir au fichier', danger: true,
          });
          if (!ok) return;
          db.resetToFile(state.leagueDefId);
          showToast('Clubs rechargés depuis le fichier.');
          refresh();
        },
      }, 'Revenir au fichier'),
    );

    if (!club) return h('div', { class: 'admin-tool-body' }, divisionBar, compositionNote, toolbar, h('p', { class: 'muted' }, 'Aucun club.'));

    const save = (patch) => { db.updateClub(club.id, patch); refresh(); };
    const saveFighter = (fighterId, patch) => { db.updateFighter(club.id, fighterId, patch); refresh(); };
    const team = db.getTeam(club.id);
    const fighters = db.getFightersOfClub(club.id);
    const clubLevel = calculateClubLevel(fighters);

    const identity = h(
      'div',
      { class: 'club-editor-identity' },
      h(
        'div',
        { class: 'club-editor-form' },
        h('label', { class: 'field-label', for: 'admin-club-name' }, 'Nom du club'),
        h('input', {
          id: 'admin-club-name', class: 'input', type: 'text', value: club.name, maxlength: 48,
          onchange: (event) => {
            const name = event.target.value.trim().replace(/\s+/g, ' ');
            if (name.length < 2) {
              showToast('Le nom doit contenir au moins 2 caractères.', 'error');
              event.target.value = club.name;
              return;
            }
            save({ name });
          },
        }),
        h('p', { class: 'field-label' }, 'Emblème'),
        h('div', { class: 'pattern-list pattern-list-compact' }, EMBLEM_PATTERNS.map((pattern) => h(
          'button',
          {
            type: 'button', 'aria-pressed': String(pattern.id === club.emblem),
            class: `pattern-option ${pattern.id === club.emblem ? 'is-active' : ''}`.trim(),
            onclick: () => save({ emblem: pattern.id }),
          },
          EmblemView(new Emblem({ patternId: pattern.id, colors: club.colors }), { size: 32, title: pattern.label }),
          h('span', {}, pattern.label),
        ))),
        h('p', { class: 'field-label' }, 'Couleurs'),
        h('div', { class: 'club-editor-colors' }, EMBLEM_COLOR_SLOTS.map((slot) => h(
          'label',
          { class: 'color-input' },
          h('input', {
            type: 'color', value: club.colors[slot.key],
            onchange: (event) => save({ colors: { [slot.key]: event.target.value } }),
          }),
          h('span', {}, slot.label),
          h('code', {}, club.colors[slot.key]),
        ))),
        // Localisation : Terre puis lieu (data/geography/). Changer de Terre place le club sur
        // le premier lieu de club de cette Terre.
        h('div', { class: 'club-editor-location' },
          h('label', { class: 'field-label', for: 'admin-club-land' }, 'Terre'),
          h('select', {
            id: 'admin-club-land', class: 'select',
            onchange: (event) => {
              const options = getLocationsOfLand(event.target.value);
              const first = options.find((location) => location.type === 'club') ?? options[0];
              if (first) save({ locationId: first.id });
            },
          }, getLands().map((land) => h('option', { value: land.id, selected: land.id === team.landId }, land.name))),
          h('label', { class: 'field-label', for: 'admin-club-location' }, 'Lieu'),
          h('select', {
            id: 'admin-club-location', class: 'select',
            onchange: (event) => save({ locationId: event.target.value }),
          }, getLocationsOfLand(team.landId).map((location) => h('option', { value: location.id, selected: location.id === team.locationId },
            `${location.name}${location.type === 'start' ? ' (lieu de départ)' : ''}`)))),
      ),
      h(
        'aside',
        { class: 'club-editor-preview' },
        h('p', { class: 'eyebrow' }, 'Aperçu'),
        EmblemView(team.emblem, { size: 120, title: club.name }),
        h('p', { class: 'club-editor-preview-name' }, club.name),
        h('p', { class: 'club-editor-preview-location' },
          h('span', { class: 'land-pill', style: { '--land-color': getLand(team.landId)?.color } }, getLand(team.landId)?.shortName),
          ` ${getLocation(team.locationId)?.name ?? ''}`),
        ClubStars(clubLevel),
        h('p', { class: 'muted' }, `Admin : niveau ${clubLevel.toFixed(2)} (moyenne des ${Math.min(RATING_CONFIG.clubTopCount, fighters.length)} meilleurs scores).`),
      ),
    );

    const roster = h(
      'table',
      { class: 'assign-table club-editor-roster' },
      h('thead', {}, h('tr', {},
        h('th', {}, 'Sprite'), h('th', {}, 'Nom'), h('th', { title: 'Un seul capitaine par club' }, 'Capitaine'), h('th', {}, 'Spécialité'), h('th', {}, 'Score'), h('th', {}, 'Vu par le joueur'), h('th', {}, ''))),
      h('tbody', {}, club.fighters.map((data) => {
        const fighter = db.getFighter(data.id);
        return h(
          'tr',
          {},
          h('td', {}, FighterSprite(fighter, { size: 40, team })),
          h('td', {}, h('input', {
            class: 'input', type: 'text', value: data.name, maxlength: 40, 'aria-label': 'Nom du combattant',
            onchange: (event) => {
              const name = event.target.value.trim().replace(/\s+/g, ' ');
              if (name.length < 2) { event.target.value = data.name; return; }
              saveFighter(data.id, { name });
            },
          })),
          h('td', { class: 'captain-cell' }, h('label', { class: 'captain-choice' },
            h('input', {
              type: 'radio', name: `captain-${club.id}`, checked: data.captain === true, 'aria-label': `Capitaine : ${data.name}`,
              onchange: () => { db.setCaptain(club.id, data.id); refresh(); },
            }),
            data.captain === true ? CaptainCrown() : null)),
          h('td', {}, h(
            'select',
            { class: 'select select-sm', 'aria-label': 'Spécialité', onchange: (event) => saveFighter(data.id, { specialty: event.target.value }) },
            SPECIALTY_IDS.map((id) => h('option', { value: id, selected: id === data.specialty }, SPECIALTIES[id].name)),
          )),
          h('td', {}, h('input', {
            class: 'input input-num', type: 'number', min: 0, max: 100, step: 1, value: data.score, 'aria-label': 'Score',
            onchange: (event) => saveFighter(data.id, { score: Number(event.target.value) }),
          })),
          h('td', { title: `${getStarRating(data.score)} étoile(s)` }, FighterStars(data.score)),
          h('td', {}, h('button', {
            type: 'button', class: 'btn btn-sm btn-danger',
            onclick: async () => {
              const ok = await confirmModal({ title: 'Supprimer le combattant', message: `Retirer ${data.name} de ${club.name} ?`, confirmLabel: 'Supprimer', danger: true });
              if (!ok) return;
              db.removeFighter(club.id, data.id);
              refresh();
            },
          }, 'Supprimer')),
        );
      })),
    );

    return h(
      'div',
      { class: 'admin-tool-body club-editor' },
      divisionBar,
      compositionNote,
      toolbar,
      identity,
      h('h3', { class: 'sheet-section-title' }, `Combattants (${club.fighters.length})`),
      h('p', { class: 'muted' }, 'Le sprite est attribué au hasard à la création et ne peut pas être modifié. Le score (0–100) n’est jamais montré au joueur.'),
      roster,
      h('div', { class: 'button-row' }, h('button', {
        type: 'button', class: 'btn btn-primary',
        onclick: () => {
          const added = db.addFighter(club.id);
          showToast(`${added.name} ajouté à ${club.name}.`, 'success');
          refresh();
        },
      }, 'Ajouter un combattant')),
      h('p', { class: 'muted' }, 'Les modifications sont enregistrées dans ce navigateur et s’appliquent immédiatement, y compris aux parties en cours. Pour les rendre permanentes, exportez le fichier et remplacez celui de data/leagues/.'),
    );
  },
};

function exportFile(db, leagueDef) {
  const blob = new Blob([db.exportLeague(leagueDef.id)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: leagueDef.clubsFile.split('/').pop() });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`Fichier ${leagueDef.clubsFile.split('/').pop()} exporté.`, 'success');
}
