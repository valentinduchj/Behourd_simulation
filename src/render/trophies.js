import { TROPHY_TYPES, PALMARES_RIBBONS } from '../data/trophies.js';

// Dessin des trophées (armoire de la Taverne, vue détaillée du palmarès). Chaque compétition a
// sa forme et son métal (data/trophies.js) :
//   Ligue 3  gobelet de bronze à pied court
//   Ligue 2  coupe d'argent à couvercle
//   Ligue 1  grande coupe d'or à anses enroulées, pied à deux étages
//   Coupe de France  calice d'or couronné, ruban bleu

const METALS = {
  gold: ['#fff1b8', '#e6be55', '#a8781f', '#6e4a10'],
  silver: ['#ffffff', '#d5dbe0', '#8e979f', '#4f565c'],
  bronze: ['#ffd9b0', '#cc8a4c', '#8a5428', '#4e2c12'],
};

function metalGradient(ctx, x, w, metal) {
  const [light, mid, dark] = METALS[metal] ?? METALS.gold;
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, dark);
  g.addColorStop(0.35, light);
  g.addColorStop(0.6, mid);
  g.addColorStop(1, dark);
  return g;
}

/**
 * Dessine le trophée d'une compétition, le pied centré en (x, y), haut de `size` px.
 * competition : 'league_1' | 'league_2' | 'league_3' | 'cup'.
 */
export function drawTrophy(ctx, x, y, { competition, size }) {
  const design = TROPHY_TYPES[competition]?.design ?? TROPHY_TYPES.league_3.design;
  const s = size;
  const outline = (METALS[design.metal] ?? METALS.gold)[3];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.strokeStyle = outline;
  const fill = (w) => metalGradient(ctx, x, w, design.metal);

  // Socle de bois.
  ctx.fillStyle = '#5a3b1e';
  ctx.fillRect(x - s * 0.24, y - s * 0.1, s * 0.48, s * 0.1);
  ctx.strokeStyle = '#2e1b0b';
  ctx.strokeRect(x - s * 0.24, y - s * 0.1, s * 0.48, s * 0.1);
  ctx.strokeStyle = outline;

  const shape = design.shape;
  const tall = shape === 'grandCup' || shape === 'crownCup';
  const footTop = y - s * 0.1;
  // Pied et tige.
  ctx.fillStyle = fill(s * 0.36);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.16, footTop);
  ctx.quadraticCurveTo(x, footTop - s * 0.1, x + s * 0.16, footTop);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (shape === 'grandCup') {
    ctx.beginPath();
    ctx.ellipse(x, footTop - s * 0.1, s * 0.1, s * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  const stemTop = footTop - s * (tall ? 0.3 : shape === 'goblet' ? 0.16 : 0.22);
  ctx.fillStyle = fill(s * 0.08);
  ctx.fillRect(x - s * 0.03, stemTop, s * 0.06, footTop - stemTop - s * 0.04);
  ctx.strokeRect(x - s * 0.03, stemTop, s * 0.06, footTop - stemTop - s * 0.04);
  ctx.beginPath();
  ctx.ellipse(x, stemTop + s * 0.02, s * 0.07, s * 0.025, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill(s * 0.14);
  ctx.fill();
  ctx.stroke();

  // Coupe.
  const bowlW = s * (shape === 'grandCup' ? 0.5 : shape === 'goblet' ? 0.34 : 0.42);
  const bowlH = s * (shape === 'grandCup' ? 0.32 : shape === 'goblet' ? 0.3 : 0.3);
  const rim = stemTop - bowlH;
  ctx.fillStyle = fill(bowlW);
  ctx.beginPath();
  if (shape === 'goblet') {
    ctx.moveTo(x - bowlW / 2, rim);
    ctx.lineTo(x - bowlW * 0.3, stemTop);
    ctx.lineTo(x + bowlW * 0.3, stemTop);
    ctx.lineTo(x + bowlW / 2, rim);
  } else {
    ctx.moveTo(x - bowlW / 2, rim);
    ctx.bezierCurveTo(x - bowlW / 2, stemTop - bowlH * 0.1, x - bowlW * 0.2, stemTop, x, stemTop);
    ctx.bezierCurveTo(x + bowlW * 0.2, stemTop, x + bowlW / 2, stemTop - bowlH * 0.1, x + bowlW / 2, rim);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Lèvre.
  ctx.beginPath();
  ctx.ellipse(x, rim, bowlW / 2, s * 0.035, 0, 0, Math.PI * 2);
  ctx.fillStyle = (METALS[design.metal] ?? METALS.gold)[2];
  ctx.fill();
  ctx.stroke();

  // Anses.
  if (shape !== 'goblet') {
    const big = shape === 'grandCup';
    ctx.lineWidth = Math.max(1.5, s * (big ? 0.035 : 0.028));
    ctx.strokeStyle = (METALS[design.metal] ?? METALS.gold)[2];
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * bowlW * 0.46, rim + bowlH * 0.15);
      ctx.bezierCurveTo(x + side * bowlW * (big ? 0.95 : 0.8), rim + bowlH * 0.05, x + side * bowlW * (big ? 0.9 : 0.75), rim + bowlH * 0.75, x + side * bowlW * 0.3, rim + bowlH * 0.8);
      if (big) ctx.arc(x + side * bowlW * 0.82, rim + bowlH * 0.1, s * 0.03, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.strokeStyle = outline;
  }

  // Ornement : gemme (Ligues), couvercle (Ligue 2), couronne et ruban (Coupe).
  if (design.gem) {
    ctx.fillStyle = design.gem;
    ctx.beginPath();
    ctx.ellipse(x, rim + bowlH * 0.45, s * 0.035, s * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (shape === 'lidCup') {
    ctx.fillStyle = fill(bowlW * 0.9);
    ctx.beginPath();
    ctx.moveTo(x - bowlW * 0.45, rim);
    ctx.quadraticCurveTo(x, rim - s * 0.16, x + bowlW * 0.45, rim);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, rim - s * 0.1, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (shape === 'crownCup') {
    const base = rim - s * 0.02;
    const cw = bowlW * 0.6;
    ctx.fillStyle = fill(cw);
    ctx.beginPath();
    ctx.moveTo(x - cw / 2, base);
    ctx.lineTo(x - cw / 2, base - s * 0.1);
    ctx.lineTo(x - cw / 4, base - s * 0.05);
    ctx.lineTo(x, base - s * 0.13);
    ctx.lineTo(x + cw / 4, base - s * 0.05);
    ctx.lineTo(x + cw / 2, base - s * 0.1);
    ctx.lineTo(x + cw / 2, base);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b8402f';
    for (const dx of [-cw / 2, 0, cw / 2]) {
      ctx.beginPath();
      ctx.arc(x + dx, base - s * (dx ? 0.1 : 0.13), s * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
    // Ruban bleu noué au pied de la coupe.
    ctx.fillStyle = design.ribbon;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.05, stemTop + s * 0.02);
    ctx.lineTo(x - s * 0.14, stemTop + s * 0.16);
    ctx.lineTo(x - s * 0.09, stemTop + s * 0.14);
    ctx.lineTo(x - s * 0.06, stemTop + s * 0.19);
    ctx.lineTo(x, stemTop + s * 0.04);
    ctx.lineTo(x + s * 0.06, stemTop + s * 0.19);
    ctx.lineTo(x + s * 0.09, stemTop + s * 0.14);
    ctx.lineTo(x + s * 0.14, stemTop + s * 0.16);
    ctx.lineTo(x + s * 0.05, stemTop + s * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e0b43a';
    ctx.beginPath();
    ctx.arc(x, stemTop + s * 0.035, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  // Reflet.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = Math.max(1, s * 0.018);
  ctx.beginPath();
  ctx.moveTo(x - bowlW * 0.28, rim + bowlH * 0.15);
  ctx.quadraticCurveTo(x - bowlW * 0.3, rim + bowlH * 0.55, x - bowlW * 0.12, rim + bowlH * 0.8);
  ctx.stroke();
  ctx.restore();
}

/**
 * Ruban de classement du palmarès (fiches de club) : rosette à bord crénelé, deux queues,
 * chiffre ou symbole au centre. Centré en x, bas des queues en y, haut de `size` px.
 * ribbon : 'second' | 'third' | 'cupFinalist' (data/trophies.js, PALMARES_RIBBONS).
 */
export function drawRibbon(ctx, x, y, { ribbon, size }) {
  const def = PALMARES_RIBBONS[ribbon] ?? PALMARES_RIBBONS.second;
  const { disc, rim, tails, text } = def.colors;
  const s = size;
  const cy = y - s * 0.62;
  const r = s * 0.3;
  ctx.save();
  ctx.lineJoin = 'round';
  // Queues, en V, derrière la rosette.
  ctx.fillStyle = tails;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = Math.max(1, s * 0.015);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + dir * s * 0.05, cy);
    ctx.lineTo(x + dir * s * 0.24, y);
    ctx.lineTo(x + dir * s * 0.15, y - s * 0.07);
    ctx.lineTo(x + dir * s * 0.07, y);
    ctx.lineTo(x - dir * s * 0.04, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Rosette crénelée.
  const teeth = 16;
  ctx.fillStyle = rim;
  ctx.beginPath();
  for (let i = 0; i <= teeth * 2; i += 1) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.14;
    ctx.lineTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.3, r * 0.1, x, cy, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, disc);
  g.addColorStop(1, disc);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, cy, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.stroke();
  // Chiffre (2, 3) ou étoile (finaliste).
  ctx.fillStyle = text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(r * 0.95)}px "Cinzel", Georgia, serif`;
  ctx.fillText(def.mark, x, cy + r * 0.04);
  ctx.restore();
}
