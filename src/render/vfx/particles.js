import { createRng } from '../../utils/random.js';
import { drawLabel } from '../figures.js';
import { drawHeldItem } from '../../centre/render/heldItems.js';

// Moteur de particules commun (lice, Centre, Bourg, Taverne) — présentation seulement.
//
// Une particule est une fonction pure de l'âge de son effet : rien n'est mémorisé d'une image à
// l'autre. Chaque effet a sa graine : il est identique d'une image à l'autre.
//
// Particule : { shape, layer, x, y, z, … } en coordonnées de scène (cases ; z = hauteur, 1 =
// largeur d'une case). Formes : 'spark' (traînée, px/py/pz), 'puff' (bouffée), 'flash' (éclair),
// 'text' (texte flottant), 'glyph' (icône : 🔨, 🍺…, avec rotation `angle`) ; lot 4 : 'rune',
// 'ring' (anneau au sol), 'shield', 'drop', 'page', 'pennant', 'rays', 'item' (objet dessiné).

const SPARK_TRAIL_SECONDS = 0.04;
const lerp = ([min, max], t) => min + (max - min) * t;

/**
 * Particules d'une gerbe (étincelles ou bouffées) `age` secondes après son déclenchement.
 * emitter : { x, y, dirX, dirY, damage, seed } ; def : réglages (data/vfx.js) ;
 * level : { count } (multiplicateur du niveau d'effets).
 */
export function burstParticles(emitter, age, def, level, { heightOffset = 0 } = {}) {
  const out = [];
  const rng = createRng(emitter.seed);
  const wanted = Math.min(def.count.max, Math.round(def.count.base + (emitter.damage ?? 0) * def.count.perDamage));
  const count = Math.round(wanted * level.count);
  const baseAngle = emitter.dirX || emitter.dirY ? Math.atan2(emitter.dirY, emitter.dirX) : 0;
  for (let i = 0; i < count; i++) {
    // Tirages toujours dans le même ordre : la particule i est identique d'une image à l'autre.
    const angle = baseAngle + (rng() * 2 - 1) * def.spread;
    const speed = lerp(def.speed, rng());
    const rise = lerp(def.rise, rng());
    const size = lerp(def.size, rng());
    const color = def.colors[Math.floor(rng() * def.colors.length)];
    const life = def.life * (0.75 + 0.25 * rng());
    if (age < 0 || age > life) continue;
    const at = (a) => ({
      x: emitter.x + Math.cos(angle) * speed * a,
      y: emitter.y + Math.sin(angle) * speed * a,
      z: Math.max(0, def.height + heightOffset + rise * a - 0.5 * def.gravity * a * a),
    });
    const p = at(age);
    const progress = age / life;
    const outline = def.outline ?? null;
    if (def.shape === 'spark') {
      const prev = at(Math.max(0, age - SPARK_TRAIL_SECONDS));
      out.push({ shape: 'spark', layer: def.layer, ...p, px: prev.x, py: prev.y, pz: prev.z, size, color, outline, alpha: 1 - progress });
    } else if (def.shape === 'drop' || def.shape === 'page') {
      // Goutte (sueur, encre) ou page qui vole en tournoyant (`spin`, tours par seconde).
      out.push({ shape: def.shape, layer: def.layer, ...p, size, color, outline, angle: angle + age * (def.spin ?? 0), alpha: 1 - progress * progress });
    } else {
      out.push({ shape: 'puff', layer: def.layer, ...p, size: size * (1 + (def.grow ?? 0) * progress), color, outline, alpha: 0.85 * (1 - progress * progress) });
    }
  }
  return out;
}

/**
 * Dessine les particules d'une couche. view : IsoView (tile.w) ; toScreen(x, y) : coordonnées
 * de scène → écran (pieds, z = 0).
 */
export function drawParticles(view, particles, layer, toScreen) {
  if (!particles?.length) return;
  const { ctx } = view;
  const unit = view.tile.w;
  const screen = (x, y, z) => {
    const p = toScreen(x, y);
    return { x: p.x, y: p.y - z * unit };
  };
  ctx.save();
  ctx.lineCap = 'round';
  for (const particle of particles) {
    if (particle.layer !== layer || particle.alpha <= 0) continue;
    ctx.globalAlpha = Math.min(1, particle.alpha);
    const p = screen(particle.x, particle.y, particle.z);
    if (particle.shape === 'spark') {
      const q = screen(particle.px, particle.py, particle.pz);
      const width = Math.max(1.5, particle.size * unit);
      const streak = () => {
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(p.x + (p.x - q.x) * 0.2, p.y + (p.y - q.y) * 0.2);
        ctx.stroke();
      };
      // Contour sombre d'abord (lisible sur le sable), puis l'étincelle.
      if (particle.outline) {
        ctx.strokeStyle = particle.outline;
        ctx.lineWidth = width + 2;
        streak();
      }
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = width;
      streak();
    } else if (particle.shape === 'puff') {
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, particle.size * unit, particle.size * unit * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      if (particle.outline) {
        ctx.strokeStyle = particle.outline;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else if (particle.shape === 'flash') {
      const radius = particle.size * unit;
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      gradient.addColorStop(0, `rgba(${particle.color}, 0.95)`);
      gradient.addColorStop(1, `rgba(${particle.color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.shape === 'text') {
      // shiftX : décalage à l'écran (en cases), pour ne pas recouvrir le chiffre des dégâts.
      drawLabel(ctx, particle.text, p.x + (particle.shiftX ?? 0) * unit, p.y, Math.max(12, particle.size * unit), { color: particle.color });
    } else if (particle.shape === 'glyph') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(particle.angle ?? 0);
      ctx.font = `${Math.max(14, Math.round(particle.size * unit))}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(particle.text, 0, 0);
      ctx.restore();
    } else {
      SHAPES[particle.shape]?.(ctx, p, particle, unit, screen);
    }
  }
  ctx.restore();
}

/** Remplit puis cerne le tracé courant (contour facultatif). */
function fillStroke(ctx, fill, stroke, width) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

// Formes du lot 4 (talents et moments forts). p : point à l'écran (hauteur comprise) ;
// screen(x, y, z) : autre point de scène → écran (anneaux posés au sol).
const SHAPES = {
  /** Rune ✦ : étoile à quatre branches, remplie à la couleur de la famille, cernée. */
  rune(ctx, p, particle, unit) {
    const r = Math.max(4, particle.size * unit);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(particle.angle ?? 0);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const radius = i % 2 === 0 ? r : r * 0.32;
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.closePath();
    fillStroke(ctx, particle.color, particle.outline, Math.max(1.5, r * 0.18));
    ctx.restore();
  },

  /** Anneau posé à plat (halo, lueur du capitaine, onde) : ellipse du plan du sol. */
  ring(ctx, p, particle, unit) {
    const r = Math.max(2, particle.size * unit);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = Math.max(1.5, (particle.width ?? 0.05) * unit);
    ctx.stroke();
  },

  /** Bouclier (survie à 1 PV) : écu doré cerné. */
  shield(ctx, p, particle, unit) {
    const s = Math.max(5, particle.size * unit);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.8, p.y - s);
    ctx.lineTo(p.x + s * 0.8, p.y - s);
    ctx.lineTo(p.x + s * 0.8, p.y - s * 0.1);
    ctx.quadraticCurveTo(p.x + s * 0.6, p.y + s * 0.7, p.x, p.y + s);
    ctx.quadraticCurveTo(p.x - s * 0.6, p.y + s * 0.7, p.x - s * 0.8, p.y - s * 0.1);
    ctx.closePath();
    fillStroke(ctx, particle.color, particle.outline ?? '#5a3b0a', Math.max(1.5, s * 0.14));
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 0.75);
    ctx.lineTo(p.x, p.y + s * 0.7);
    ctx.moveTo(p.x - s * 0.55, p.y - s * 0.2);
    ctx.lineTo(p.x + s * 0.55, p.y - s * 0.2);
    ctx.strokeStyle = 'rgba(90, 59, 10, 0.7)';
    ctx.lineWidth = Math.max(1, s * 0.1);
    ctx.stroke();
  },

  /** Goutte (sueur, encre) : larme pointe en haut. */
  drop(ctx, p, particle, unit) {
    const s = Math.max(2, particle.size * unit);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 1.4);
    ctx.quadraticCurveTo(p.x + s, p.y - s * 0.1, p.x, p.y + s * 0.8);
    ctx.quadraticCurveTo(p.x - s, p.y - s * 0.1, p.x, p.y - s * 1.4);
    ctx.closePath();
    fillStroke(ctx, particle.color, particle.outline, 1);
  },

  /** Page qui vole : petit feuillet qui tournoie (son angle l'écrase d'un côté). */
  page(ctx, p, particle, unit) {
    const s = Math.max(3, particle.size * unit);
    const squash = Math.abs(Math.cos(particle.angle ?? 0)) * 0.8 + 0.2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((particle.angle ?? 0) * 0.3);
    ctx.beginPath();
    ctx.rect(-s * squash, -s * 0.7, s * 2 * squash, s * 1.4);
    fillStroke(ctx, particle.color, particle.outline, 1);
    ctx.restore();
  },

  /** Fanion qui claque au bout de sa hampe (manche gagnée). `wave` : phase de l'ondulation. */
  pennant(ctx, p, particle, unit) {
    const s = Math.max(6, particle.size * unit);
    const wave = particle.wave ?? 0;
    ctx.strokeStyle = '#3a2614';
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + s * 0.9);
    ctx.lineTo(p.x, p.y - s * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 0.7);
    const tipX = p.x + s * 1.3;
    const tipY = p.y - s * 0.35 + Math.sin(wave) * s * 0.18;
    ctx.quadraticCurveTo(p.x + s * 0.65, p.y - s * 0.75 + Math.sin(wave + 1) * s * 0.2, tipX, tipY);
    ctx.quadraticCurveTo(p.x + s * 0.65, p.y - s * 0.05 + Math.sin(wave + 1.6) * s * 0.2, p.x, p.y);
    ctx.closePath();
    fillStroke(ctx, particle.color, particle.outline ?? 'rgba(40, 24, 10, 0.7)', Math.max(1, s * 0.07));
  },

  /** Rayons de lumière autour d'un point (révélation) : remplis, cernés, qui tournent lentement. */
  rays(ctx, p, particle, unit) {
    const r = Math.max(10, particle.size * unit);
    const count = particle.count ?? 10;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(particle.angle ?? 0);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const half = Math.PI / count / 2.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18 * 0.6);
      ctx.lineTo(Math.cos(a - half) * r, Math.sin(a - half) * r * 0.6);
      ctx.lineTo(Math.cos(a + half) * r, Math.sin(a + half) * r * 0.6);
      ctx.closePath();
      fillStroke(ctx, particle.color, particle.outline, 1.5);
    }
    ctx.restore();
  },

  /** Objet dessiné (livre, plume : centre/render/heldItems.js), tourné de `angle`. */
  item(ctx, p, particle, unit) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(particle.angle ?? 0);
    drawHeldItem(ctx, particle.item, Math.max(8, particle.size * unit));
    ctx.restore();
  },
};
