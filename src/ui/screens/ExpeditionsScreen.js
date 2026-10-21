import { h } from '../../utils/dom.js';
import { ExpeditionScene } from '../../expeditions/ExpeditionScene.js';
import { ExpeditionRenderer } from '../../expeditions/ExpeditionRenderer.js';
import { HubScreen } from './HubScreen.js';
import { getVisibleExits, exitAtTile, getExitState, describeExit } from '../../systems/navigation/LocationNavigationService.js';
import { exitAtSignpost } from '../../render/exitMarkers.js';
import { getCurrentSeason } from '../../systems/climate/ClimateService.js';
import { openModal } from '../components/Modal.js';
import { openExpeditionBoard } from '../components/ExpeditionBoard.js';
import { canTalkExpeditions } from '../../systems/expeditions/ExpeditionService.js';
import { spectatorUrl } from '../../render/spectators.js';
import { createScenePacer } from '../../render/framePacing.js';
import { attachMapZoom } from '../mobile/MapZoom.js';
import { isMobileLayout } from '../mobile/mobileLayout.js';
import { SCREENS } from '../../core/screenIds.js';

const HINT = 'Cliquez sur le Baron (ou son camp, au-delà du pont). Le chemin du nord ramène au Bourg.';

/**
 * Les Expéditions (v0.96) : carte au-delà du Bourg — le marché au nord de la rivière, la
 * montagne au sud, où campe le Baron. Son dialogue (et les expéditions) viendront plus
 * tard : pour l'instant, il se présente.
 */
export class ExpeditionsScreen extends HubScreen {
  static hubLocationId = 'expeditions';
  // Interface mobile : carte en plein écran, le reste de la page dans ce volet.
  static mobileSheet = { label: 'Le Baron', tall: true };

  renderContent() {
    this.scene = new ExpeditionScene();
    this.canvas = h('canvas', { class: 'centre-canvas expeditions-canvas', 'aria-label': 'Les Expéditions en vue isométrique' });
    this.hint = h('p', { class: 'centre-hint', role: 'status' }, HINT);
    return h(
      'div',
      { class: 'hub-page' },
      h('header', { class: 'hub-page-header' },
        h('h1', {}, 'Les Expéditions'),
        h('p', { class: 'hub-page-subtitle' }, 'Au-delà du Bourg : le marché, la rivière, puis la montagne, où le Baron prépare ses expéditions.')),
      h('div', { class: 'centre-stage expeditions-stage' }, this.canvas),
      this.hint,
      h('h2', { class: 'hub-section-title' }, 'Le Baron'),
      h('article', { class: 'zone-card expedition-captain-card', style: { '--activity-color': '#9e1f2c' } },
        h('h3', { class: 'zone-card-title' }, h('span', { 'aria-hidden': 'true' }, '⚔'), 'Le Baron'),
        h('p', { class: 'zone-card-desc' }, 'Il campe au pied des montagnes, au-delà du pont. Ses expéditions arrivent bientôt.'),
        h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.openCaptain() }, 'Parler au Baron')),
    );
  }

  mounted() {
    super.mounted();
    // Téléphone : pincer pour zoomer, glisser pour se déplacer sur la carte.
    if (isMobileLayout()) this.mapZoom = attachMapZoom(this.canvas, () => this.renderer);
    this.renderer = new ExpeditionRenderer(this.canvas, this.scene);
    // Climat : sol, rivière (asséchée, gelée), neige des pics, arbres et météo de la saison.
    this.renderer.season = getCurrentSeason(this.session).id;
    this.renderer.setExits(getVisibleExits('EXPEDITIONS'));
    if (this.params.arrivalExitId) this.renderer.setArrival(this.params.arrivalExitId);
    this.renderer.resize();
    this.listen(window, 'resize', () => this.renderer.resize());
    this.listen(this.canvas, 'mousemove', (event) => {
      const { exit, captain } = this.targetAt(event);
      this.renderer.hoverCaptain = captain;
      this.renderer.hoverExitId = exit?.id ?? null;
      this.canvas.style.cursor = exit ? (getExitState(exit) === 'open' ? 'pointer' : 'not-allowed') : captain ? 'pointer' : 'default';
      const label = exit ? describeExit(exit) : null;
      this.hint.textContent = label ? `${label.title} — cliquez pour prendre le chemin.` : captain ? '⚔ Le Baron — cliquez pour lui parler.' : HINT;
    });
    this.listen(this.canvas, 'mouseleave', () => { this.renderer.hoverCaptain = false; this.renderer.hoverExitId = null; this.hint.textContent = HINT; });
    this.listen(this.canvas, 'click', (event) => {
      const { exit, captain } = this.targetAt(event);
      if (exit) {
        this.travel(exit.id);
        return;
      }
      if (captain) this.openCaptain();
    });
    const draw = createScenePacer();
    const frame = (now) => {
      if (draw(now)) this.renderer.render(now / 1000);
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  /** Ce que vise le pointeur : l'étiquette ou la zone du Baron, ou une sortie. */
  targetAt(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (this.renderer.labelAt(x, y)) return { exit: null, captain: true };
    const tile = this.renderer.pickTile(event.clientX, event.clientY);
    const exit = exitAtSignpost(this.renderer, this.renderer.exits ?? [], x, y) ?? (tile ? exitAtTile(this.renderer.exits, tile.x, tile.y) : null);
    return { exit, captain: !exit && Boolean(tile) && this.scene.targetAt(tile.x, tile.y) === 'captain' };
  }

  /**
   * Le Baron : avec au moins une Ferveur de la Reine, il propose ses expéditions de la saison
   * (ExpeditionBoard) ; sinon, il dit comment en obtenir.
   */
  openCaptain() {
    if (canTalkExpeditions(this.session)) {
      return openExpeditionBoard(this.session, { onChange: () => this.refreshStatus(), onStartSingular: () => this.navigate(SCREENS.SINGULAR) });
    }
    return openModal({
      title: '⚔ Le Baron',
      className: 'expedition-captain-modal',
      body: h('div', { class: 'artisan-panel-head' },
        h('img', { class: 'artisan-portrait', src: spectatorUrl('expedition_captain'), alt: '', width: 56, height: 90 }),
        h('div', {},
          h('p', {}, '« Les montagnes cachent bien des choses, et les routes du royaume plus encore. Mais je ne pars pas pour rien : rapporte-moi des Ferveurs de la Reine, et je t’emmènerai au-delà. »'),
          h('p', { class: 'muted' }, 'Les Ferveurs se gagnent en remportant les Combats de la Reine (une par étoile pleine de l’adversaire).'))),
      actions: [{ label: 'À bientôt, Baron', variant: 'primary' }],
    });
  }

  unmount() {
    cancelAnimationFrame(this.frameId);
    super.unmount();
  }
}
