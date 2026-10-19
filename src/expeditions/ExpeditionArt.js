// Illustrations des expéditions (v0.98) : une scène peinte par lieu, en SVG (portrait 200 × 260).
// Thèmes : forest (forêt profonde et monts), peaks (sommets enneigés et lac), ruins (abbaye en
// ruine), fortress (château perché), coast (falaises, mer, tour), fjord, highlands (landes, loch,
// pierres levées), monastery (monastères sur des pitons). Palettes : dawn, day, dusk, mist.
// Le dessin dépend du lieu (graine) : deux lieux du même thème ne se ressemblent pas tout à fait.

const PALETTES = {
  dawn: { skyTop: '#f3a37c', skyBottom: '#fbe1b8', sun: '#fff1c9', far: '#b7869a', mid: '#6f6f8f', near: '#3e4e5c', ground: '#2c3a2e', water: '#8fb3c9', mist: 'rgba(255, 236, 214, 0.55)' },
  day: { skyTop: '#6fa8d6', skyBottom: '#d9ecf5', sun: '#fffbe6', far: '#9fb4c8', mid: '#5f7f6a', near: '#38563f', ground: '#2a3f2c', water: '#5d9cc4', mist: 'rgba(255, 255, 255, 0.45)' },
  dusk: { skyTop: '#4b3b6e', skyBottom: '#e98a5a', sun: '#ffd27a', far: '#7a5a7e', mid: '#4e3f5e', near: '#2c2538', ground: '#1f1a26', water: '#7c6a9a', mist: 'rgba(255, 190, 150, 0.35)' },
  mist: { skyTop: '#8e9ea3', skyBottom: '#d6dcd6', sun: '#f4f6ee', far: '#a9b4b0', mid: '#748580', near: '#4a5a52', ground: '#34423a', water: '#9fb2b4', mist: 'rgba(240, 244, 238, 0.7)' },
};

function seeded(text) {
  let s = 0;
  for (const ch of String(text)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  s = s || 1;
  return () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 4294967296;
  };
}

const f = (n) => Math.round(n * 10) / 10;

/** Ligne de crêtes (montagnes) : points de x 0 à 200, sommets entre yMin et yMax. */
function ridge(rand, { yMin, yMax, peaks = 4, base = 260 }) {
  const pts = [[0, f(yMin + rand() * (yMax - yMin))]];
  for (let i = 1; i <= peaks * 2; i++) {
    const x = (200 / (peaks * 2)) * i;
    const up = i % 2 === 1;
    const y = up ? yMin + rand() * (yMax - yMin) * 0.6 : yMin + (yMax - yMin) * (0.55 + rand() * 0.45);
    pts.push([f(x), f(y)]);
  }
  return `M0 ${base} ${pts.map(([x, y]) => `L${x} ${y}`).join(' ')} L200 ${base} Z`;
}

/** Collines douces. */
function hills(rand, { y, amp = 14, base = 260 }) {
  let d = `M0 ${base} L0 ${f(y + rand() * amp)}`;
  for (let x = 0; x < 200; x += 50) d += ` Q${f(x + 25)} ${f(y - amp + rand() * amp)} ${x + 50} ${f(y + rand() * amp)}`;
  return `${d} L200 ${base} Z`;
}

function pine(x, y, h, color) {
  const w = h * 0.42;
  return `<path d="M${f(x)} ${f(y - h)} L${f(x + w * 0.5)} ${f(y - h * 0.55)} L${f(x + w * 0.32)} ${f(y - h * 0.55)} L${f(x + w * 0.62)} ${f(y - h * 0.18)} L${f(x + w * 0.1)} ${f(y - h * 0.18)} L${f(x + w * 0.1)} ${f(y)} L${f(x - w * 0.1)} ${f(y)} L${f(x - w * 0.1)} ${f(y - h * 0.18)} L${f(x - w * 0.62)} ${f(y - h * 0.18)} L${f(x - w * 0.32)} ${f(y - h * 0.55)} L${f(x - w * 0.5)} ${f(y - h * 0.55)} Z" fill="${color}"/>`;
}

function forestRow(rand, { y, count, hMin, hMax, color }) {
  let out = '';
  for (let i = 0; i < count; i++) out += pine(rand() * 210 - 5, y + rand() * 8, hMin + rand() * (hMax - hMin), color);
  return out;
}

function snowCaps(rand, d, color = '#f4f6f8') {
  // Neige : on reprend la crête et on la coupe à une hauteur (clip simple par rectangle).
  return `<g clip-path="url(#snowclip)"><path d="${d}" fill="${color}" opacity="0.92"/></g>`;
}

function ruinsArches(x, y, s, color, light) {
  // Façade d'abbaye gothique en ruine : deux tours, arcs brisés.
  return `<g fill="${color}">
    <rect x="${f(x)}" y="${f(y - s * 1.2)}" width="${f(s * 0.22)}" height="${f(s * 1.2)}"/>
    <rect x="${f(x + s * 0.9)}" y="${f(y - s * 1.05)}" width="${f(s * 0.22)}" height="${f(s * 1.05)}"/>
    <path d="M${f(x + s * 0.22)} ${f(y)} L${f(x + s * 0.22)} ${f(y - s * 0.62)} Q${f(x + s * 0.36)} ${f(y - s * 0.95)} ${f(x + s * 0.5)} ${f(y - s * 0.62)} L${f(x + s * 0.5)} ${f(y)} Z"/>
    <path d="M${f(x + s * 0.56)} ${f(y)} L${f(x + s * 0.56)} ${f(y - s * 0.5)} Q${f(x + s * 0.72)} ${f(y - s * 0.86)} ${f(x + s * 0.86)} ${f(y - s * 0.5)} L${f(x + s * 0.9)} ${f(y - s * 0.4)} L${f(x + s * 0.9)} ${f(y)} Z"/>
  </g>
  <g fill="${light}" opacity="0.85">
    <path d="M${f(x + s * 0.27)} ${f(y)} L${f(x + s * 0.27)} ${f(y - s * 0.55)} Q${f(x + s * 0.36)} ${f(y - s * 0.8)} ${f(x + s * 0.45)} ${f(y - s * 0.55)} L${f(x + s * 0.45)} ${f(y)} Z"/>
    <path d="M${f(x + s * 0.61)} ${f(y)} L${f(x + s * 0.61)} ${f(y - s * 0.45)} Q${f(x + s * 0.71)} ${f(y - s * 0.72)} ${f(x + s * 0.81)} ${f(y - s * 0.45)} L${f(x + s * 0.81)} ${f(y)} Z"/>
    <rect x="${f(x + s * 0.05)}" y="${f(y - s * 1.0)}" width="${f(s * 0.08)}" height="${f(s * 0.18)}" rx="${f(s * 0.04)}"/>
  </g>`;
}

function castle(x, y, s, color, light) {
  return `<g fill="${color}">
    <rect x="${f(x)}" y="${f(y - s * 0.55)}" width="${f(s)}" height="${f(s * 0.55)}"/>
    <rect x="${f(x + s * 0.38)}" y="${f(y - s * 1.05)}" width="${f(s * 0.28)}" height="${f(s * 1.05)}"/>
    ${[0, 0.2, 0.4, 0.6, 0.8].map((k) => `<rect x="${f(x + s * k)}" y="${f(y - s * 0.65)}" width="${f(s * 0.12)}" height="${f(s * 0.1)}"/>`).join('')}
    ${[0.38, 0.52].map((k) => `<rect x="${f(x + s * k)}" y="${f(y - s * 1.15)}" width="${f(s * 0.1)}" height="${f(s * 0.1)}"/>`).join('')}
  </g>
  <rect x="${f(x + s * 0.47)}" y="${f(y - s * 0.9)}" width="${f(s * 0.06)}" height="${f(s * 0.12)}" fill="${light}"/>`;
}

function tower(x, y, s, color) {
  return `<g fill="${color}"><path d="M${f(x)} ${f(y)} L${f(x + s * 0.08)} ${f(y - s)} L${f(x + s * 0.4)} ${f(y - s)} L${f(x + s * 0.48)} ${f(y)} Z"/>
    <path d="M${f(x + s * 0.06)} ${f(y - s)} l${f(s * 0.06)} ${f(-s * 0.1)} l${f(s * 0.06)} ${f(s * 0.06)} l${f(s * 0.08)} ${f(-s * 0.12)} l${f(s * 0.06)} ${f(s * 0.1)} l${f(s * 0.08)} ${f(-s * 0.04)} L${f(x + s * 0.42)} ${f(y - s)} Z"/></g>`;
}

function stones(x, y, s, color) {
  return [0, 1, 2, 3].map((i) => `<rect x="${f(x + i * s * 0.32)}" y="${f(y - s * (0.55 + (i % 2) * 0.15))}" width="${f(s * 0.16)}" height="${f(s * (0.55 + (i % 2) * 0.15))}" rx="${f(s * 0.05)}" fill="${color}"/>`).join('');
}

function pillar(x, y, w, h, color, monastery, light) {
  return `<path d="M${f(x)} ${f(y)} Q${f(x - w * 0.1)} ${f(y - h * 0.5)} ${f(x + w * 0.1)} ${f(y - h)} L${f(x + w * 0.9)} ${f(y - h * 1.02)} Q${f(x + w * 1.1)} ${f(y - h * 0.5)} ${f(x + w)} ${f(y)} Z" fill="${color}"/>
  ${monastery ? `<g><rect x="${f(x + w * 0.2)}" y="${f(y - h - w * 0.32)}" width="${f(w * 0.6)}" height="${f(w * 0.32)}" fill="#d9c7a8"/><path d="M${f(x + w * 0.15)} ${f(y - h - w * 0.32)} L${f(x + w * 0.5)} ${f(y - h - w * 0.56)} L${f(x + w * 0.85)} ${f(y - h - w * 0.32)} Z" fill="#9a3b2a"/><rect x="${f(x + w * 0.44)}" y="${f(y - h - w * 0.24)}" width="${f(w * 0.1)}" height="${f(w * 0.14)}" fill="${light}"/></g>` : ''}`;
}

/** Scène SVG d'un lieu (chaîne) : thème et palette du lieu, variations selon son identifiant. */
export function expeditionArtSvg(place) {
  const p = PALETTES[place.palette] ?? PALETTES.day;
  const rand = seeded(place.id);
  const id = `xp-${place.id}`;
  const sunX = f(30 + rand() * 140);
  const sunY = f(48 + rand() * 30);
  let scene = '';
  const farRidge = ridge(rand, { yMin: 70, yMax: 130, peaks: 3 });
  switch (place.theme) {
    case 'forest':
      scene += `<path d="${ridge(rand, { yMin: 95, yMax: 140, peaks: 3 })}" fill="${p.far}"/>`;
      scene += `<path d="${hills(rand, { y: 150 })}" fill="${p.mid}"/>`;
      scene += forestRow(rand, { y: 168, count: 16, hMin: 34, hMax: 54, color: p.mid });
      scene += `<rect y="150" width="200" height="40" fill="${p.mist}"/>`;
      scene += forestRow(rand, { y: 214, count: 11, hMin: 60, hMax: 92, color: p.near });
      scene += `<path d="M86 260 Q98 222 102 206 Q106 222 120 260 Z" fill="#9b8a6a" opacity="0.7"/>`;
      scene += forestRow(rand, { y: 262, count: 6, hMin: 90, hMax: 130, color: p.ground });
      break;
    case 'peaks':
      scene += `<defs><clipPath id="snowclip"><rect y="0" width="200" height="${f(108 + rand() * 12)}"/></clipPath></defs>`;
      scene += `<path d="${farRidge}" fill="${p.far}"/>${snowCaps(rand, farRidge)}`;
      scene += `<path d="${ridge(rand, { yMin: 120, yMax: 170, peaks: 4 })}" fill="${p.mid}"/>`;
      scene += `<rect y="186" width="200" height="30" fill="${p.water}"/><rect y="186" width="200" height="3" fill="${p.mist}"/>`;
      scene += `<path d="${hills(rand, { y: 214, amp: 8 })}" fill="${p.near}"/>`;
      scene += forestRow(rand, { y: 236, count: 9, hMin: 40, hMax: 70, color: p.ground });
      break;
    case 'ruins':
      scene += `<path d="${ridge(rand, { yMin: 120, yMax: 150, peaks: 2 })}" fill="${p.far}"/>`;
      scene += `<path d="${hills(rand, { y: 176, amp: 10 })}" fill="${p.mid}"/>`;
      scene += ruinsArches(48, 196, 100, p.near, p.skyBottom);
      scene += `<rect y="196" width="200" height="12" fill="${p.mist}"/>`;
      scene += `<path d="${hills(rand, { y: 214, amp: 6 })}" fill="${p.ground}"/>`;
      scene += forestRow(rand, { y: 250, count: 4, hMin: 60, hMax: 90, color: p.ground });
      break;
    case 'fortress':
      scene += `<path d="${farRidge}" fill="${p.far}"/>`;
      scene += `<path d="M0 260 L0 200 L60 170 L92 112 L112 108 L140 160 L200 190 L200 260 Z" fill="${p.mid}"/>`;
      scene += castle(80, 116, 46, p.near, p.sun);
      scene += `<rect y="176" width="200" height="22" fill="${p.mist}"/>`;
      scene += `<path d="${hills(rand, { y: 220, amp: 8 })}" fill="${p.ground}"/>`;
      break;
    case 'coast':
      scene += `<rect y="150" width="200" height="110" fill="${p.water}"/>`;
      scene += `<path d="M0 150 Q100 146 200 150" stroke="${p.mist}" stroke-width="3" fill="none"/>`;
      scene += `<path d="M120 260 L126 168 Q150 150 176 160 L200 168 L200 260 Z" fill="${p.mid}"/>`;
      scene += tower(150, 160, 46, p.near);
      scene += `<path d="M0 260 L0 182 Q40 170 70 196 L92 260 Z" fill="${p.near}"/>`;
      scene += [0, 1, 2, 3].map((i) => `<path d="M${10 + i * 48} ${226 + i * 6} q12 -4 24 0" stroke="#ffffff" stroke-opacity="0.6" fill="none"/>`).join('');
      break;
    case 'fjord':
      scene += `<defs><clipPath id="snowclip"><rect y="0" width="200" height="98"/></clipPath></defs>`;
      scene += `<path d="${farRidge}" fill="${p.far}"/>${snowCaps(rand, farRidge)}`;
      scene += `<path d="M0 260 L0 90 L40 104 L74 180 L74 260 Z" fill="${p.mid}"/><path d="M200 260 L200 80 L156 98 L124 182 L124 260 Z" fill="${p.mid}"/>`;
      scene += `<path d="M74 180 L124 182 L140 260 L58 260 Z" fill="${p.water}"/>`;
      scene += `<path d="M90 222 q10 -8 20 0 l-3 5 h-14 Z" fill="${p.near}"/><path d="M100 202 v20" stroke="${p.near}" stroke-width="1.5"/><path d="M100 204 l9 9 h-9 Z" fill="#c8202f"/>`;
      scene += forestRow(rand, { y: 250, count: 5, hMin: 40, hMax: 70, color: p.ground });
      break;
    case 'highlands':
      scene += `<path d="${hills(rand, { y: 120, amp: 22 })}" fill="${p.far}"/>`;
      scene += `<rect y="168" width="200" height="22" fill="${p.water}"/>`;
      scene += `<path d="${hills(rand, { y: 182, amp: 12 })}" fill="${p.mid}"/>`;
      scene += stones(46, 212, 40, p.near);
      scene += `<rect y="150" width="200" height="40" fill="${p.mist}"/>`;
      scene += `<path d="${hills(rand, { y: 228, amp: 6 })}" fill="#6a4a6a"/>`;
      scene += `<path d="${hills(rand, { y: 242, amp: 4 })}" fill="${p.ground}"/>`;
      break;
    case 'monastery':
      scene += `<path d="${hills(rand, { y: 150, amp: 16 })}" fill="${p.far}"/>`;
      scene += pillar(20, 260, 46, 150, p.mid, true, p.sun);
      scene += pillar(82, 260, 40, 186, p.near, true, p.sun);
      scene += pillar(140, 260, 50, 128, p.mid, false, p.sun);
      scene += `<rect y="206" width="200" height="54" fill="${p.mist}"/>`;
      scene += forestRow(rand, { y: 260, count: 6, hMin: 40, hMax: 64, color: p.ground });
      break;
    default:
      scene += `<path d="${farRidge}" fill="${p.far}"/><path d="${hills(rand, { y: 190 })}" fill="${p.near}"/>`;
  }
  // Oiseaux.
  const birds = Array.from({ length: 3 }, () => {
    const bx = f(20 + rand() * 160);
    const by = f(40 + rand() * 40);
    return `<path d="M${bx} ${by} q4 -4 8 0 q4 -4 8 0" stroke="${p.near}" stroke-width="1.3" fill="none"/>`;
  }).join('');
  return `<svg class="xp-art-svg" viewBox="0 0 200 260" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${place.name}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.skyTop}"/><stop offset="1" stop-color="${p.skyBottom}"/></linearGradient>
  <radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${p.sun}" stop-opacity="0.9"/><stop offset="1" stop-color="${p.sun}" stop-opacity="0"/></radialGradient></defs>
  <rect width="200" height="260" fill="url(#${id}-sky)"/>
  <circle cx="${sunX}" cy="${sunY}" r="46" fill="url(#${id}-glow)"/><circle cx="${sunX}" cy="${sunY}" r="13" fill="${p.sun}"/>
  ${birds}
  ${scene.replaceAll('snowclip', `${id}-snow`)}
</svg>`;
}
