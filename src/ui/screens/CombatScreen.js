import { h } from '../../utils/dom.js';
import { SCREENS } from '../../core/screenIds.js';
import { createArena } from '../../combat/Arena.js';
import { CombatSimulation } from '../../combat/CombatSimulation.js';
import { CombatLoop } from '../../combat/CombatLoop.js';
import { IsoRenderer } from '../../combat/render/IsoRenderer.js';
import { buildLicePresentation } from '../../combat/presentation/LicePresentation.js';
import { LICE_DECORATIONS } from '../../data/liceDecorations.js';
import { CROWD_LAYOUT } from '../../data/crowd.js';
import { crowdLabel, ordinal } from '../../utils/format.js';
import { getTeamPosition } from '../../systems/league/StandingsService.js';
import { FighterName } from '../components/CaptainCrown.js';
import { getLeagueName } from '../../systems/league/LeagueService.js';
import { CHAMPIONSHIP_MATCH } from '../../data/calendar.js';

/** Classement actuel d'un club : « 12e de Ligue 3 » (recalculé à chaque affichage). */
function rankLabel(session, teamId) {
  const standing = getTeamPosition(session, teamId);
  return standing ? `${ordinal(standing.position)} de ${getLeagueName(standing.leagueId)}` : 'Hors championnat';
}
import { createRandomTeam } from '../../systems/game/teamFactory.js';
import { autoSelectSquad } from '../../systems/match/MatchService.js';
import { getEventTitle } from '../../systems/calendar/scheduler.js';
import { BaseScreen } from './BaseScreen.js';
import { EmblemView } from '../components/EmblemView.js';
import { ClubStars } from '../components/Rating.js';
import { calculateClubLevel } from '../../systems/fighters/ratings.js';
import { CLIMATE_SEASONS } from '../../data/climate.js';

/**
 * La Lice — aperçu du prochain combat : les deux clubs déployés en vue isométrique.
 * Les combats eux-mêmes se disputent depuis le bouton « COMBATTRE » (MatchScreen).
 *
 * params : { returnTo, randomSides }
 */
export class CombatScreen extends BaseScreen {
  constructor(context) {
    super(context);
    this.simulation = new CombatSimulation({ arena: createArena(), sides: this.buildSides() });
    this.simulation.setup();
    this.decorationId = this.params.decorationId ?? null;
    this.crowdSize = this.params.crowdSize ?? null;
    this.seasonId = this.params.seasonId ?? null;
    this.buildPresentation();
  }

  /** Décor et foule (présentation seulement) : ceux du prochain combat, ou imposés depuis l'Admin. */
  buildPresentation() {
    const { session } = this.services.gameState;
    const [sideA, sideB] = this.simulation.sides;
    this.presentation = buildLicePresentation(session && !this.params.randomSides ? session : null, {
      arena: this.simulation.arena,
      teamAId: sideA.team.id,
      teamBId: sideB.team.id,
      matchday: this.nextCombat?.data.matchday ?? null,
      decorationId: this.decorationId,
      crowdSize: this.crowdSize ?? (this.params.randomSides ? 25 : null),
      seasonId: this.seasonId,
    });
    this.renderer?.setPresentation(this.presentation);
    if (this.ambiance) this.ambiance.textContent = `${this.presentation.decoration.name} · ${crowdLabel(this.presentation.crowdSize)}`;
  }

  /** Réglages d'aperçu (Module Admin) : décor et nombre de spectateurs. */
  renderPreviewControls() {
    const decorSelect = h(
      'select',
      {
        class: 'select', id: 'lice-decoration-select', 'aria-label': 'Décor de La Lice',
        onchange: (event) => { this.decorationId = event.target.value; this.buildPresentation(); },
      },
      LICE_DECORATIONS.map((decoration) => h('option', { value: decoration.id, selected: decoration.id === this.presentation.decoration.id }, decoration.name)),
    );
    const crowdInput = h('input', {
      class: 'input input-num', id: 'lice-crowd-input', type: 'number', min: 0, max: CROWD_LAYOUT.maxRendered, step: 1,
      value: this.presentation.crowdSize, 'aria-label': 'Nombre de spectateurs',
      onchange: (event) => {
        this.crowdSize = Math.max(0, Math.min(CROWD_LAYOUT.maxRendered, Math.round(Number(event.target.value) || 0)));
        event.target.value = this.crowdSize;
        this.buildPresentation();
      },
    });
    // Saison de l'année (v0.70) : habillage du décor, pour contrôler les quatre variantes.
    const seasonSelect = h(
      'select',
      {
        class: 'select', id: 'lice-season-select', 'aria-label': 'Saison',
        onchange: (event) => { this.seasonId = event.target.value || null; this.buildPresentation(); },
      },
      h('option', { value: '', selected: !this.seasonId }, 'Saison du jour'),
      CLIMATE_SEASONS.map((season) => h('option', { value: season.id, selected: season.id === this.seasonId }, `${season.icon} ${season.name}`)),
    );
    return h(
      'div',
      { class: 'lice-preview-controls panel' },
      h('label', { class: 'field-label', for: 'lice-decoration-select' }, 'Décor'), decorSelect,
      h('label', { class: 'field-label', for: 'lice-season-select' }, 'Saison'), seasonSelect,
      h('label', { class: 'field-label', for: 'lice-crowd-input' }, 'Spectateurs'), crowdInput,
      h('span', { class: 'muted' }, 'Aperçu : sans effet sur les combats.'),
    );
  }

  buildSides() {
    const { session } = this.services.gameState;
    const limit = this.services.config.combat.fightersPerSide;
    if (!session || this.params.randomSides) {
      return [createRandomTeam(), createRandomTeam()].map((side) => ({ ...side, fighters: side.fighters.slice(0, limit) }));
    }
    // Adversaire : celui du prochain combat de championnat.
    this.nextCombat = session.calendar.events
      .filter((e) => e.typeId === CHAMPIONSHIP_MATCH && e.status === 'scheduled')
      .sort((a, b) => a.day - b.day)[0] ?? null;
    const opponentTeam = this.nextCombat?.data.opponentTeamId ? session.getTeam(this.nextCombat.data.opponentTeamId) : null;
    const player = { team: session.playerTeam, fighters: autoSelectSquad(session, session.player.teamId) };
    const opponent = opponentTeam
      ? { team: opponentTeam, fighters: autoSelectSquad(session, opponentTeam.id) }
      : createRandomTeam();
    return [player, opponent].map((side) => ({ ...side, fighters: side.fighters.slice(0, limit) }));
  }

  render() {
    const [sideA, sideB] = this.simulation.sides;
    const { session } = this.services.gameState;
    this.canvas = h('canvas', { class: 'arena-canvas', 'aria-label': 'La Lice en vue isométrique' });
    this.info = h('p', { class: 'arena-info' }, 'Survolez un combattant pour l’identifier.');
    const subtitle = this.nextCombat && session
      ? `Prochain combat : jour ${this.nextCombat.day} — ${getEventTitle(this.nextCombat, session)}`
      : 'Aperçu';

    return h(
      'section',
      { class: 'screen screen-combat' },
      h('header', { class: 'screen-header' }, h('p', { class: 'eyebrow' }, subtitle), h('h1', {}, 'La Lice')),
      h(
        'header',
        { class: 'combat-header panel' },
        this.renderSide(sideA),
        h('span', { class: 'combat-versus' }, 'contre'),
        this.renderSide(sideB),
      ),
      this.params.returnTo === SCREENS.ADMIN ? this.renderPreviewControls() : null,
      h('div', { class: 'arena-wrap panel' }, this.canvas),
      h(
        'div',
        { class: 'combat-footer' },
        this.info,
        this.ambiance = h('p', { class: 'lice-ambiance muted' }, `${this.presentation.decoration.name} · ${crowdLabel(this.presentation.crowdSize)}`),
        h('p', { class: 'muted' }, 'Aperçu des effectifs. Le combat se dispute le jour venu avec le bouton « COMBATTRE ».'),
        h('button', { type: 'button', class: 'btn', onclick: () => this.leave() }, 'Retour'),
      ),
    );
  }

  renderSide({ team, fighters }) {
    const { session } = this.services.gameState;
    const roster = session ? session.getFightersOfTeam(team.id) : fighters;
    return h(
      'div',
      { class: 'combat-side' },
      EmblemView(team.emblem, { size: 44, title: team.name }),
      h(
        'div',
        {},
        h('strong', {}, team.name),
        session && !this.params.randomSides ? h('div', { class: 'match-team-rank' }, rankLabel(session, team.id)) : null,
        h('div', {}, ClubStars(calculateClubLevel(roster), { className: 'star-rating-sm' })),
      ),
    );
  }

  mounted() {
    const { settings } = this.services;
    this.renderer = new IsoRenderer(this.canvas);
    this.renderer.setPresentation(this.presentation);
    this.renderer.resize();

    this.loop = new CombatLoop({
      update: (dt) => this.simulation.update(dt),
      render: (time) => this.renderer.render(this.simulation, time),
      getSpeed: () => Number(settings.get('gameplay.speed')) || 1,
    });

    this.listen(window, 'resize', () => this.renderer.resize());
    this.listen(this.canvas, 'mousemove', (event) => this.setHover(this.renderer.pickArenaTile(event.clientX, event.clientY)));
    this.listen(this.canvas, 'mouseleave', () => this.setHover(null));
    this.loop.start();
  }

  unmount() {
    this.loop?.stop();
    super.unmount();
  }

  setHover(tile) {
    this.renderer.hoverTile = tile;
    const combatant = tile ? this.simulation.getCombatantAt(tile.x, tile.y) : null;
    this.renderer.highlightedId = combatant?.id ?? null;
    if (combatant) {
      this.info.replaceChildren(
        FighterName(combatant.fighter, { session: this.services.gameState.session }),
        ` — ${combatant.fighter.specialty?.name ?? ''} · ${combatant.team.name}`,
      );
    } else {
      this.info.textContent = 'Survolez un combattant pour l’identifier.';
    }
  }

  leave() {
    const fallback = this.services.gameState.hasSession() ? SCREENS.TEAM : SCREENS.MAIN_MENU;
    this.navigate(this.params.returnTo ?? fallback);
  }
}
