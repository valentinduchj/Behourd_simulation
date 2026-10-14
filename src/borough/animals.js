import { patrolAt } from './BoroughScene.js';

// Animaux d'ambiance du Bourg — présentation seulement, fonctions pures du temps (aucun état) :
//   chiens   tournée avec arrêts (data/boroughLayout.js `dogs`) : marche, puis à chaque arrêt
//            il s'assoit, renifle, se couche ou regarde autour de lui ;
//   oiseaux  petites bandes posées qui picorent et sautillent, puis s'envolent un instant vers
//            un autre coin et s'y posent (`birds` : deux points, durées).

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };

/** Chien à l'instant `time` : { x, y, state: 'walk' | 'stand' | 'sit' | 'lie' | 'sniff' | 'look', facing, settle }. */
export function dogAt(dog, time) {
  const step = patrolAt(dog, time);
  const facing = step.dir.x - step.dir.y >= 0 ? 1 : -1;
  if (step.walking) return { x: step.x, y: step.y, state: 'walk', facing, settle: 0 };
  const { index, elapsed, duration } = step.stop;
  const state = dog.poses?.[index % dog.poses.length] ?? 'stand';
  // Il prend la pose en douceur, puis se relève avant de repartir.
  const settle = Math.min(smooth(elapsed / 0.6), smooth((duration - elapsed) / 0.6));
  return { x: step.x, y: step.y, state, facing: state === 'look' && Math.sin(time * 0.9 + dog.phase) > 0.3 ? -facing : facing, settle };
}

/**
 * Oiseaux d'une bande à l'instant `time` : [{ x, y, z (cases), flying, peck, facing }].
 * flock : { spots: [a, b], count, stay, flight, phase }.
 */
export function flockAt(flock, time) {
  const { spots, count = 3, stay = 9, flight = 1.6, phase = 0 } = flock;
  const cycle = 2 * (stay + flight);
  const out = [];
  for (let i = 0; i < count; i++) {
    // Chaque oiseau décolle un peu après les autres.
    const local = ((time + phase - i * 0.18) % cycle + cycle) % cycle;
    const spread = { x: Math.sin(i * 2.4 + 1) * 0.32, y: Math.cos(i * 1.7 + 2) * 0.24 };
    const leg = local < stay + flight ? 0 : 1;
    const t = local - leg * (stay + flight);
    const from = spots[leg];
    const to = spots[1 - leg];
    if (t < stay) {
      // Posé : il picore, sautille de temps en temps.
      const hopCycle = (t + i * 0.7) % 1.9;
      const hop = hopCycle < 0.25 ? Math.sin((hopCycle / 0.25) * Math.PI) : 0;
      const drift = Math.floor((t + i * 0.7) / 1.9);
      out.push({
        x: from.x + spread.x + Math.sin(drift * 1.3 + i) * 0.08 * Math.min(1, hop + 0.4),
        y: from.y + spread.y + Math.cos(drift * 0.9 + i) * 0.06,
        z: 0.08 * hop, flying: false, peck: hop === 0 && Math.sin(time * 6 + i * 2) > 0.4,
        facing: Math.sin(drift * 2.1 + i) >= 0 ? 1 : -1,
      });
    } else {
      // En vol : un arc court jusqu'à l'autre coin.
      const u = smooth((t - stay) / flight);
      out.push({
        x: from.x + spread.x + (to.x - from.x) * u,
        y: from.y + spread.y + (to.y - from.y) * u,
        z: Math.sin(u * Math.PI) * 1.1 + 0.05, flying: true, peck: false,
        facing: (to.x - from.x) - (to.y - from.y) >= 0 ? 1 : -1, flap: Math.sin(time * 26 + i),
      });
    }
  }
  return out;
}

/** Dessine un chien, les pattes en (x, y) ; `size` : longueur du corps (px). */
export function drawDog(ctx, x, y, { state, facing = 1, settle = 0, time = 0, phase = 0, size, coat = '#8a5a2e', patch = '#e8d6b4' }) {
  const s = size;
  const f = facing;
  const k = state === 'walk' || state === 'stand' || state === 'look' ? 0 : settle;
  const outline = 'rgba(40, 24, 10, 0.75)';
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.42, s * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(f, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const walk = state === 'walk';
  const swing = walk ? Math.sin(time * 9 + phase) : 0;
  const bob = walk ? Math.abs(Math.sin(time * 9 + phase)) * s * 0.025 : 0;
  // Hauteur du corps : debout, assis (arrière abaissé), couché (au ras du sol).
  const lie = state === 'lie' ? k : 0;
  const sit = state === 'sit' ? k : 0;
  const bodyY = -s * (0.36 - 0.2 * lie) - bob;
  const tilt = -0.45 * sit;
  const legLen = s * 0.3 * (1 - 0.85 * lie);

  // Pattes (les deux de derrière plus sombres).
  ctx.strokeStyle = coat;
  ctx.lineWidth = Math.max(2, s * 0.07);
  for (const [lx, side] of [[-0.2, -1], [0.18, -1], [-0.24, 1], [0.22, 1]]) {
    if (lie > 0.6) continue;
    const back = lx < 0;
    const legTop = bodyY + s * 0.08 + (back ? s * 0.12 * sit : 0);
    const reach = walk ? swing * side * (back ? -1 : 1) * s * 0.07 : 0;
    ctx.globalAlpha = side < 0 ? 0.8 : 1;
    ctx.beginPath();
    ctx.moveTo(s * lx, legTop);
    // Assis, les pattes arrière restent repliées sous le corps.
    ctx.lineTo(s * lx + reach + (back ? s * 0.05 * sit : 0), back && sit > 0.5 ? Math.min(0, legTop + legLen * 0.3) : 0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Queue : remue à l'arrêt.
  const wag = state === 'walk' ? Math.sin(time * 6) * 0.3 : Math.sin(time * 13 + phase) * 0.5;
  ctx.strokeStyle = coat;
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, bodyY - s * 0.03 + s * 0.1 * sit);
  ctx.quadraticCurveTo(-s * 0.46, bodyY - s * 0.12 + s * 0.1 * sit, -s * 0.48 + wag * s * 0.08, bodyY - s * (0.24 - 0.2 * lie) + s * 0.12 * sit);
  ctx.stroke();

  // Corps.
  ctx.save();
  ctx.translate(-s * 0.18, bodyY + s * 0.06);
  ctx.rotate(tilt);
  ctx.translate(s * 0.18, -s * 0.06);
  ctx.fillStyle = coat;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.33, s * 0.14, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = patch;
  ctx.beginPath();
  ctx.ellipse(s * 0.1, s * 0.05, s * 0.14, s * 0.06, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Tête : relevée (assis), au sol (reniflant), posée sur les pattes (couché).
  const sniff = state === 'sniff' ? k : 0;
  const headX = s * (0.34 + 0.04 * sit);
  const headY = bodyY - s * (0.12 + 0.12 * sit) + s * 0.26 * sniff + s * 0.06 * lie + (sniff ? Math.sin(time * 10) * s * 0.015 : 0);
  ctx.fillStyle = coat;
  ctx.strokeStyle = outline;
  ctx.beginPath();
  ctx.arc(headX, headY, s * 0.11, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(headX + s * 0.1, headY + s * 0.03, s * 0.07, s * 0.045, 0.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1a120a';
  ctx.beginPath();
  ctx.arc(headX + s * 0.17, headY + s * 0.02, s * 0.018, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(headX + s * 0.04, headY - s * 0.025, s * 0.014, 0, TAU);
  ctx.fill();
  // Oreille.
  ctx.fillStyle = '#5a3b1e';
  ctx.beginPath();
  ctx.moveTo(headX - s * 0.04, headY - s * 0.08);
  ctx.lineTo(headX - s * 0.1, headY + s * 0.04);
  ctx.lineTo(headX - s * 0.01, headY + s * 0.01);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Dessine un oiseau (posé ou en vol), au point (x, y) au sol ; `lift` : hauteur à l'écran (px). */
export function drawGroundBird(ctx, x, y, { lift = 0, flying = false, peck = false, facing = 1, flap = 0, size, color = '#7a5a3a', breast = '#c9a46a' }) {
  const s = size;
  ctx.save();
  // Ombre au sol (plus petite et plus pâle en vol).
  ctx.fillStyle = `rgba(0, 0, 0, ${flying ? 0.12 : 0.2})`;
  ctx.beginPath();
  ctx.ellipse(x, y, s * (flying ? 0.35 : 0.45), s * 0.14, 0, 0, TAU);
  ctx.fill();
  ctx.translate(x, y - lift);
  ctx.scale(facing, 1);
  ctx.strokeStyle = 'rgba(30, 20, 10, 0.8)';
  ctx.lineWidth = 1;
  if (flying) {
    const wing = s * (0.2 + 0.5 * (flap * 0.5 + 0.5));
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = Math.max(1.2, s * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s * 0.3 - wing);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.3 - wing * 0.3, 0, -s * 0.3);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.3 - wing * 0.3, s * 0.7, -s * 0.3 - wing);
    ctx.stroke();
    ctx.restore();
    return;
  }
  // Corps, queue, tête (baissée quand il picore), bec.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-s * 0.35, -s * 0.3);
  ctx.lineTo(-s * 0.6, -s * 0.42);
  ctx.lineTo(-s * 0.55, -s * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.3, s * 0.38, s * 0.22, -0.15, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = breast;
  ctx.beginPath();
  ctx.ellipse(s * 0.1, -s * 0.24, s * 0.2, s * 0.12, 0, 0, TAU);
  ctx.fill();
  const hx = s * (peck ? 0.42 : 0.3);
  const hy = -s * (peck ? 0.18 : 0.52);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(hx, hy, s * 0.15, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e0b43a';
  ctx.beginPath();
  ctx.moveTo(hx + s * 0.13, hy - s * 0.03);
  ctx.lineTo(hx + s * 0.3, hy + (peck ? s * 0.08 : 0));
  ctx.lineTo(hx + s * 0.13, hy + s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(hx + s * 0.05, hy - s * 0.04, s * 0.03, 0, TAU);
  ctx.fill();
  ctx.restore();
}
