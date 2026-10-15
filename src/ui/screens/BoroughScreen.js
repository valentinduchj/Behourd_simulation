import { h } from '../../utils/dom.js';
import { BoroughScene } from '../../borough/BoroughScene.js';
import { BoroughRenderer } from '../../borough/BoroughRenderer.js';
import {
  listArtisans, getArtisan, listUpgradesOf, getPurchaseCount, getCurrentCost, canPurchaseUpgrade, purchaseUpgrade, isAtMaxLevel,
} from '../../systems/borough/UpgradeService.js';
import { getEffectiveActivity, describeActivityEffect, formatChance } from '../../systems/activities/ActivityService.js';
import { getDeniers } from '../../systems/economy/wallet.js';
import { HubScreen } from './HubScreen.js';
import { getVisibleExits, exitAtTile, getExitState, describeExit } from '../../systems/navigation/LocationNavigationService.js';
import { exitAtSignpost } from '../../render/exitMarkers.js';
import { getCurrentSeason } from '../../systems/climate/ClimateService.js';
import { openModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { spectatorUrl } from '../../render/spectators.js';
import { buyItem, canBuyItem, hasShop, listShopOffers } from '../../systems/shop/ShopService.js';
import { getItemQuantity } from '../../systems/inventory/InventoryService.js';
import { describeUsage } from '../../systems/items/ConsumableService.js';
import { ItemImage } from '../components/ChestModal.js';
import { queueSceneEffect } from '../hub/pendingVfx.js';
import { currentLocale } from '../../i18n/i18n.js';

const HINT = 'Cliquez sur un artisan (ou sa zone) pour voir ses améliorations. Le chemin en haut à gauche ramène au Centre.';
const formatDeniers = (n) => `${n.toLocaleString(currentLocale())} denier${n > 1 ? 's' : ''}`;

/** Valeur actuelle de l'infrastructure concernée par une amélioration (activité améliorée). */
function currentValue(session, upgrade) {
  const activity = getEffectiveActivity(session, upgrade.effect.activityId);
  if (!activity) return '';
  switch (upgrade.effect.type) {
    case 'activitySuccessChance': return `réussite ${formatChance(activity.successChance)}`;
    case 'activityCapacity': return activity.capacity === null ? 'places illimitées' : `${activity.capacity} places`;
    default: return `${describeActivityEffect(activity)} par réussite`;
  }
}

/**
 * Le Bourg : carte du village où l'on améliore les infrastructures du Centre auprès de
 * trois artisans. Toutes les améliorations viennent des données (data/borough.js) et passent
 * par UpgradeService ; cet écran ne fait qu'afficher et transmettre les achats.
 */
export class BoroughScreen extends HubScreen {
  static hubLocationId = 'borough';

  renderContent() {
    this.scene = new BoroughScene();
    this.canvas = h('canvas', { class: 'centre-canvas borough-canvas', 'aria-label': 'Le Bourg en vue isométrique' });
    this.hint = h('p', { class: 'centre-hint', role: 'status' }, HINT);
    return h(
      'div',
      { class: 'hub-page' },
      h('header', { class: 'hub-page-header' },
        h('h1', {}, 'Le Bourg'),
        h('p', { class: 'hub-page-subtitle' }, 'Dépensez vos deniers auprès des artisans : améliorations définitives des infrastructures du Centre, ou consommables rangés dans Le Coffre.')),
      h('div', { class: 'centre-stage borough-stage' }, this.canvas),
      this.hint,
      h('h2', { class: 'hub-section-title' }, 'Artisans'),
      h('div', { class: 'zone-grid borough-artisans' }, listArtisans().map((artisan) => this.renderArtisanCard(artisan))),
    );
  }

  renderArtisanCard(artisan) {
    if (hasShop(artisan.id)) {
      const offers = listShopOffers(artisan.id);
      return h(
        'article',
        { class: 'zone-card artisan-card', style: { '--activity-color': artisan.color }, 'data-artisan': artisan.id },
        h('h3', { class: 'zone-card-title' }, h('span', { 'aria-hidden': 'true' }, artisan.icon), artisan.name),
        h('p', { class: 'zone-card-desc' }, artisan.description),
        h('p', { class: 'muted' }, `${offers.map((offer) => offer.item.name).join(' · ')} — ${offers.length} consommables`),
        h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.openArtisan(artisan.id) }, 'Voir la boutique'),
      );
    }
    const upgrades = listUpgradesOf(artisan.id);
    const groups = [...new Set(upgrades.map((u) => u.group))];
    return h(
      'article',
      { class: 'zone-card artisan-card', style: { '--activity-color': artisan.color }, 'data-artisan': artisan.id },
      h('h3', { class: 'zone-card-title' }, h('span', { 'aria-hidden': 'true' }, artisan.icon), artisan.name),
      h('p', { class: 'zone-card-desc' }, artisan.description),
      h('p', { class: 'muted' }, `${groups.join(' · ')} — ${upgrades.length} améliorations`),
      h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.openArtisan(artisan.id) }, 'Voir les améliorations'),
    );
  }

  mounted() {
    super.mounted();
    this.renderer = new BoroughRenderer(this.canvas, this.scene);
    // Saison de l'année (v0.70) : habillage du Bourg (sol, arbres, toits, feux, météo).
    this.renderer.season = getCurrentSeason(this.session).id;
    // Sorties : le chemin haut-gauche ramène au Centre (data/locations.js).
    this.renderer.setExits(getVisibleExits('BOURG'));
    if (this.params.arrivalExitId) this.renderer.setArrival(this.params.arrivalExitId);
    this.renderer.resize();
    this.listen(window, 'resize', () => this.renderer.resize());
    this.listen(this.canvas, 'mousemove', (event) => {
      const { exit, zone } = this.targetAt(event);
      this.renderer.hoverZone = zone;
      this.renderer.hoverExitId = exit?.id ?? null;
      this.canvas.style.cursor = exit ? (getExitState(exit) === 'open' ? 'pointer' : 'not-allowed') : zone ? 'pointer' : 'default';
      const label = exit ? describeExit(exit) : null;
      this.hint.textContent = label ? `${label.title} — cliquez pour prendre le chemin.`
        : zone ? `${zone.artisan.icon} ${zone.artisan.name} — ${zone.subtitle}. Cliquez pour voir ${hasShop(zone.artisanId) ? 'sa boutique' : 'ses améliorations'}.` : HINT;
    });
    this.listen(this.canvas, 'mouseleave', () => { this.renderer.hoverZone = null; this.renderer.hoverExitId = null; this.hint.textContent = HINT; });
    this.listen(this.canvas, 'click', (event) => {
      const { exit, zone } = this.targetAt(event);
      if (exit) {
        this.travel(exit.id);
        return;
      }
      if (zone) this.openArtisan(zone.artisanId);
    });
    const frame = (now) => {
      this.renderer.render(now / 1000);
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  /**
   * Ce que vise le pointeur : l'étiquette d'un artisan (elle ouvre son panneau comme sa zone),
   * le poteau ou le bout de chemin d'une sortie, sinon la zone d'artisan au sol.
   */
  targetAt(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const labelled = this.renderer.labelZoneAt(x, y);
    if (labelled) return { exit: null, zone: labelled };
    const tile = this.renderer.pickTile(event.clientX, event.clientY);
    const exit = exitAtSignpost(this.renderer, this.renderer.exits ?? [], x, y) ?? (tile ? exitAtTile(this.renderer.exits, tile.x, tile.y) : null);
    return { exit, zone: !exit && tile ? this.scene.zoneAt(tile.x, tile.y) : null };
  }

  unmount() {
    cancelAnimationFrame(this.frameId);
    super.unmount();
  }

  // --- Panneau d'un artisan ---

  openArtisan(artisanId) {
    const artisan = getArtisan(artisanId);
    const body = h('div', { class: 'artisan-panel' });
    const render = () => body.replaceChildren(...this.renderArtisanPanel(artisan, render));
    render();
    this.purchasesInPanel = 0;
    openModal({
      title: artisan.name, body, className: 'modal-wide artisan-modal', actions: [{ label: 'Fermer', variant: 'primary' }],
      // Effets visuels : l'artisan se met à l'ouvrage une fois sa fenêtre refermée (un chantier par achat).
      onClose: () => this.playWorkshop(artisan.id, this.purchasesInPanel),
    });
  }

  /** Coups de marteau et poussière à l'atelier d'un artisan (un par achat, à la suite). */
  playWorkshop(artisanId, count) {
    const zone = this.scene.zones.find((z) => z.artisanId === artisanId);
    if (!zone || !count || !this.renderer) return;
    const { effects } = this.renderer;
    for (let i = 0; i < Math.min(count, 3); i++) effects.add('hammer', { x: zone.stand.x, y: zone.stand.y }, { delay: 0.15 + i * effects.config.hammer.duration * 0.8 });
  }

  renderArtisanPanel(artisan, rerender) {
    if (hasShop(artisan.id)) return this.renderShopPanel(artisan, rerender);
    const upgrades = listUpgradesOf(artisan.id);
    const groups = [...new Set(upgrades.map((u) => u.group))];
    return [
      h(
        'header',
        { class: 'artisan-panel-head' },
        h('img', { class: 'artisan-portrait', src: spectatorUrl(artisan.spriteId), alt: '', width: 56, height: 90 }),
        h('div', {}, h('p', { class: 'artisan-panel-desc' }, artisan.description),
          h('p', { class: 'artisan-panel-purse' }, `Trésor : ${formatDeniers(getDeniers(this.session))}`)),
      ),
      ...groups.map((group) => h(
        'section',
        { class: 'upgrade-group' },
        h('h3', { class: 'sheet-section-title' }, group),
        h('ul', { class: 'upgrade-list' }, upgrades.filter((u) => u.group === group).map((upgrade) => this.renderUpgrade(upgrade, rerender))),
      )),
    ];
  }

  renderUpgrade(upgrade, rerender) {
    const level = getPurchaseCount(this.session, upgrade.id);
    const cost = getCurrentCost(this.session, upgrade.id);
    const check = canPurchaseUpgrade(this.session, upgrade.id);
    const maxed = isAtMaxLevel(this.session, upgrade.id);
    const levelText = upgrade.maxLevel != null ? `Niveau ${level} / ${upgrade.maxLevel}` : `Niveau ${level}`;
    return h(
      'li',
      { class: `upgrade-row ${check.ok ? '' : 'is-locked'}`.trim(), 'data-upgrade': upgrade.id },
      h('div', { class: 'upgrade-info' },
        h('p', { class: 'upgrade-name' }, upgrade.name, h('span', { class: 'upgrade-level' }, levelText)),
        h('p', { class: 'upgrade-desc' }, upgrade.description),
        h('p', { class: 'upgrade-current muted' }, `Actuellement : ${currentValue(this.session, upgrade)}`)),
      h('div', { class: 'upgrade-buy' },
        h('span', { class: 'upgrade-cost' }, maxed ? '—' : formatDeniers(cost)),
        h('button', {
          type: 'button', class: 'btn btn-primary btn-sm', disabled: !check.ok, title: check.reason ?? `Améliorer pour ${formatDeniers(cost)}`,
          onclick: () => this.buy(upgrade, rerender),
        }, 'Améliorer'),
        check.ok ? null : h('span', { class: 'upgrade-reason' }, check.reason)),
    );
  }

  // --- Boutique d'un artisan (consommables rangés dans Le Coffre) ---

  renderShopPanel(artisan, rerender) {
    return [
      h(
        'header',
        { class: 'artisan-panel-head' },
        h('img', { class: 'artisan-portrait', src: spectatorUrl(artisan.spriteId), alt: '', width: 56, height: 90 }),
        h('div', {}, h('p', { class: 'artisan-panel-desc' }, artisan.description),
          h('p', { class: 'artisan-panel-purse' }, `Trésor : ${formatDeniers(getDeniers(this.session))}`)),
      ),
      h('section', { class: 'upgrade-group' },
        h('h3', { class: 'sheet-section-title' }, 'Consommables'),
        h('ul', { class: 'upgrade-list shop-list' }, listShopOffers(artisan.id).map((offer) => this.renderOffer(artisan, offer, rerender)))),
    ];
  }

  renderOffer(artisan, offer, rerender) {
    const check = canBuyItem(this.session, artisan.id, offer.itemId);
    const owned = getItemQuantity(this.session, offer.itemId);
    return h(
      'li',
      { class: `upgrade-row shop-row ${check.ok ? '' : 'is-locked'}`.trim(), 'data-item': offer.itemId },
      ItemImage(offer.item, 52),
      h('div', { class: 'upgrade-info' },
        h('p', { class: 'upgrade-name' }, offer.item.name, h('span', { class: 'upgrade-level' }, `Dans le Coffre : ×${owned}`)),
        h('p', { class: 'upgrade-desc' }, offer.item.description),
        h('p', { class: 'upgrade-current muted' }, describeUsage(offer.item))),
      h('div', { class: 'upgrade-buy' },
        h('span', { class: 'upgrade-cost' }, formatDeniers(offer.price)),
        h('button', {
          type: 'button', class: 'btn btn-primary btn-sm', disabled: !check.ok, title: check.reason ?? `Acheter pour ${formatDeniers(offer.price)}`,
          onclick: () => this.buyOffer(artisan, offer, rerender),
        }, 'Acheter'),
        check.ok ? null : h('span', { class: 'upgrade-reason' }, check.reason)),
    );
  }

  buyOffer(artisan, offer, rerender) {
    const result = buyItem(this.session, artisan.id, offer.itemId);
    if (!result.ok) {
      showToast(result.reason, 'error');
      return;
    }
    if (this.services.settings.get('gameplay.autosave')) {
      try { this.services.saves.save(this.session); } catch { /* sauvegarde manuelle toujours possible */ }
    }
    showToast(`${offer.item.name} rangé dans Le Coffre (×${result.quantity}) — −${formatDeniers(result.price)}.`, 'success');
    rerender();
    this.refreshStatus();
  }

  buy(upgrade, rerender) {
    const result = purchaseUpgrade(this.session, upgrade.id);
    if (!result.ok) {
      showToast(result.reason, 'error');
      return;
    }
    // Sauvegarde de l'état (si la sauvegarde automatique est active).
    if (this.services.settings.get('gameplay.autosave')) {
      try { this.services.saves.save(this.session); } catch { /* sauvegarde manuelle toujours possible */ }
    }
    // Effets visuels : chantier à l'atelier (fenêtre refermée) et sur l'installation du Centre (prochaine visite).
    this.purchasesInPanel = (this.purchasesInPanel ?? 0) + 1;
    queueSceneEffect('centre', { kind: 'hammer', activityId: upgrade.effect.activityId });
    showToast(`${upgrade.group} — ${upgrade.name} : niveau ${result.level} (−${formatDeniers(result.cost)}).`, 'success');
    rerender();
    this.refreshStatus();
  }
}
