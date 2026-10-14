import { createRng } from '../../utils/random.js';
import { createRandomTeam } from '../../systems/game/teamFactory.js';
import { CENTRE_LAYOUT } from '../../data/centreLayout.js';
import { CentreScene } from '../../centre/CentreScene.js';
import { CentreRenderer } from '../../centre/render/CentreRenderer.js';
import { TavernScene } from '../../tavern/TavernScene.js';
import { TavernRenderer } from '../../tavern/TavernRenderer.js';
import { BoroughScene } from '../../borough/BoroughScene.js';
import { BoroughRenderer } from '../../borough/BoroughRenderer.js';
import { createArena } from '../../combat/Arena.js';
import { Combatant } from '../../combat/Combatant.js';
import { IsoRenderer } from '../../combat/render/IsoRenderer.js';
import { createCombatUnit } from '../../combat/engine/CombatUnit.js';
import { simulateRound } from '../../combat/engine/CombatManager.js';
import { CombatPlayback } from '../../combat/presentation/CombatPlayback.js';
import { buildLicePresentation } from '../../combat/presentation/LicePresentation.js';
import { collectVfx, resolveVfxLevel } from '../../combat/presentation/vfx.js';
import { LICE_DECORATIONS } from '../../data/liceDecorations.js';
import { COMBAT_PLAYBACK } from '../../data/combatRules.js';

// Scènes de l'écran principal, rendues EN DIRECT par les moteurs du jeu (Centre, Taverne,
// Bourg, La Lice) avec une compagnie de démonstration générée pour l'occasion : rien n'est lu
// ni écrit dans la partie du joueur (il n'y en a pas forcément).
//
// Une scène : { frame(time, dt), resize(), dispose() }. Ajouter une scène : une fabrique dans
// SHOWCASE_SCENES, puis une séquence dans data/mainMenuShowcase.js.

/** Compagnie de démonstration : deux clubs générés (graine fixe par séquence). */
export function createShowcaseCast(seed) {
  const rng = createRng(`vitrine:${seed}`);
  return { home: createRandomTeam({ rng }), away: createRandomTeam({ rng }), rng };
}

/** Partie minimale vue par le Centre (présentation) : effectif, club, aucune amélioration. */
function showcaseSession(team, fighters) {
  const byId = new Map(fighters.map((fighter) => [fighter.id, fighter]));
  return { playerFighters: fighters, playerTeam: team, upgrades: {}, getFighter: (id) => byId.get(id) ?? null, markDirty() {} };
}

// Répartition des combattants du camp : deux par lieu, pour montrer chaque animation.
const CAMP_PLAN = ['river', 'river', 'banquet', 'banquet', 'lice', 'lice', 'dummies', 'dummies', 'hay', 'hay', 'forest', 'forest'];

/** Cadres de caméra des plans du camp (cases). */
function campFocus(focus) {
  if (focus === 'pole') {
    const { area } = CENTRE_LAYOUT.enclosures.find((e) => e.id === 'combat-pole');
    return { x: area.x - 0.6, y: area.y - 0.8, w: area.w + 1.2, h: area.h + 1.2 };
  }
  return null;
}

export const SHOWCASE_SCENES = {
  /** Le camp : chaque lieu occupé ; caméra sur un lieu, sur le Pôle Combat ou sur tout le camp. */
  centre(canvas, { focus = 'overview', walker = false } = {}, { seed }) {
    const { home, away } = createShowcaseCast(seed);
    const fighters = [...home.fighters, ...away.fighters].slice(0, CAMP_PLAN.length);
    fighters.forEach((fighter, i) => { fighter.activityId = CAMP_PLAN[i] ?? null; });
    const scene = new CentreScene(showcaseSession(home.team, fighters));
    const renderer = new CentreRenderer(canvas, scene);
    renderer.resize();
    const custom = campFocus(focus);
    if (custom) renderer.cameraTarget = custom;
    else if (focus && focus !== 'overview') renderer.focusActivity(focus);
    renderer.camera = { ...renderer.cameraTarget };
    let start = null;
    let walked = false;
    return {
      frame(time) {
        start ??= time;
        // Vue d'ensemble : un combattant quitte la Rivière pour le Banquet (déplacement à pied).
        if (walker && !walked && time - start > 0.9) {
          walked = true;
          fighters[0].activityId = 'banquet';
        }
        renderer.render(time);
      },
      resize: () => renderer.resize(),
      dispose() {},
    };
  },

  /** La Taverne : recrues qui flânent, tavernier, clients. */
  tavern(canvas, options, { seed }) {
    const { away } = createShowcaseCast(seed);
    const candidates = away.fighters.slice(0, 4).map((fighter) => ({ id: fighter.id, fighter }));
    const scene = new TavernScene(candidates, { seed: `vitrine:${seed}` });
    const renderer = new TavernRenderer(canvas, scene);
    renderer.resize();
    let last = null;
    return {
      frame(time) {
        // Accéléré : les recrues bougent dès les premières secondes.
        scene.update(last === null ? 0 : (time - last) * 1.6);
        last = time;
        renderer.render(time);
      },
      resize: () => renderer.resize(),
      dispose() {},
    };
  },

  /** Le Bourg, survolé lentement d'un bout à l'autre. */
  borough(canvas, { pan = true } = {}, { duration }) {
    const scene = new BoroughScene();
    const renderer = new BoroughRenderer(canvas, scene);
    renderer.showLabels = false;
    renderer.resize();
    let start = null;
    return {
      frame(time) {
        start ??= time;
        if (pan) {
          const t = Math.min(1, (time - start) / Math.max(1, duration));
          const w = scene.width * 0.62;
          const h = scene.height * 0.62;
          renderer.fit(scene.width, scene.height, { x: (scene.width - w) * (0.1 + 0.8 * t), y: (scene.height - h) * (0.75 - 0.5 * t), w, h });
        }
        renderer.render(time);
      },
      resize: () => renderer.resize(),
      dispose() {},
    };
  },

  /**
   * La Lice : une vraie manche simulée par le moteur de combat (size contre size), rejouée
   * à partir du premier contact, caméra rapprochée.
   */
  combat(canvas, { size = 1 } = {}, { seed, vfxSetting = 'full' }) {
    const { home, away, rng } = createShowcaseCast(seed);
    const arena = createArena();
    // Lignes de départ face à face, au centre de la lice (contact rapide).
    const rows = { 1: [3], 2: [3, 4], 3: [2, 3, 5], 4: [2, 3, 4, 5] }[size] ?? [1, 2, 3, 4, 5, 6].slice(0, size);
    // Classes variées : on prend les combattants à partir d'un rang tiré au sort.
    const pickFrom = (fighters) => {
      const offset = Math.floor(rng() * fighters.length);
      return rows.map((_, i) => fighters[(offset + i) % fighters.length]);
    };
    const sides = [
      { team: home.team, fighters: pickFrom(home.fighters), side: 'A', x: 5 },
      { team: away.team, fighters: pickFrom(away.fighters), side: 'B', x: 7 },
    ];
    const units = sides.flatMap(({ fighters, side, x }) => fighters.map((fighter, i) => createCombatUnit({ fighter, side, tile: { x, y: rows[i] }, fatigue: 0 })));
    const simulation = simulateRound({ arena, units, rng });
    const playback = new CombatPlayback(simulation);
    const byId = new Map(sides.flatMap(({ team, fighters }, sideIndex) => fighters.map((fighter) => [fighter.id, { fighter, team, sideIndex }])));
    const combatants = simulation.initial.map((unit) => {
      const { fighter, team, sideIndex } = byId.get(unit.id);
      return new Combatant({ fighter, team, sideIndex, position: { x: unit.x + 0.5, y: unit.y + 0.5 } });
    });
    const decoration = LICE_DECORATIONS[Math.floor(rng() * LICE_DECORATIONS.length)];
    const presentation = buildLicePresentation(null, {
      arena, teamAId: home.team.id, teamBId: away.team.id, decorationId: decoration?.id ?? null, crowdSize: 18,
    });
    const renderer = new IsoRenderer(canvas);
    renderer.setPresentation(presentation);
    renderer.resize();
    // Caméra : cadre serré sur les combattants debout (même principe que le rejeu d'une manche),
    // posé d'emblée dès la première image puis glissant avec la mêlée.
    const frameArea = (units) => {
      const standing = units.filter((u) => !u.ko);
      const list = standing.length ? standing : units;
      const cx = list.reduce((s, u) => s + u.x + 0.5, 0) / list.length;
      const cy = list.reduce((s, u) => s + u.y + 0.5, 0) / list.length;
      const w = Math.max(5, Math.max(...list.map((u) => u.x)) - Math.min(...list.map((u) => u.x)) + 3.5);
      const h = Math.max(4.2, Math.max(...list.map((u) => u.y)) - Math.min(...list.map((u) => u.y)) + 3.5);
      // Le haut de l'écran correspond aux petits x et y : léger décalage pour la hauteur des sprites.
      return { x: cx - w / 2 - 0.6, y: cy - h / 2 - 0.6, w, h };
    };
    renderer.setArena(arena);
    renderer.setCameraTarget(frameArea(simulation.initial));
    renderer.cameraFocus = { ...renderer.cameraTarget };
    renderer.fit(renderer.scenery.width, renderer.scenery.height, renderer.cameraFocus);
    // Rejeu : juste avant la fin de l'introduction ; un duel est un peu ralenti pour durer toute la séquence.
    let playTime = COMBAT_PLAYBACK.introSeconds - 0.25;
    let last = null;
    const level = resolveVfxLevel(vfxSetting);
    const scene = { arena, combatants };
    return {
      frame(time) {
        if (last !== null) playTime = Math.min(playback.duration, playTime + (time - last) * (size <= 1 ? 0.85 : 1.1));
        last = time;
        const frame = playback.frameAt(playTime);
        const units = new Map(frame.units.map((unit) => [unit.id, unit]));
        for (const combatant of combatants) {
          const unit = units.get(combatant.id);
          combatant.position = { x: unit.x + 0.5, y: unit.y + 0.5 };
          combatant.view = { ...unit, badges: [] };
          combatant.state = unit.state;
        }
        renderer.setCameraTarget(frameArea(frame.units));
        renderer.effects = frame.effects;
        renderer.vfx = collectVfx(playback, playTime, { level, arenaHeight: arena.height });
        renderer.render(scene, time);
      },
      resize: () => renderer.resize(),
      dispose() {},
    };
  },
};

/** Crée la scène `sceneId` dans `canvas` (erreur si la scène est inconnue). */
export function createShowcaseScene(sceneId, canvas, options, context) {
  const factory = SHOWCASE_SCENES[sceneId];
  if (!factory) throw new Error(`Scène de vitrine inconnue : ${sceneId}`);
  return factory(canvas, options ?? {}, context);
}
