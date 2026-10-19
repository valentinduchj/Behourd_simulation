// Écran de démarrage de l'application Android (v0.85) : un bassinet du temps de Charles VI
// (bec de passereau, camail de mailles) posé dans l'herbe ; la végétation pousse autour et
// grimpe dessus (herbes, liane, fleurs), puis les lettres « BZW » apparaissent. Environ 4,6 s,
// la durée de son air (« Girls », v0.88) ; un toucher le passe. Dessin et animation en SVG + CSS
// (css/mobile.css, .splash).

const DURATION_MS = 4600;
const FADE_MS = 500;

/** Air du démarrage : joué tout de suite si le téléphone l'accepte, éteint en fondu à la fin. */
function playTune(src, volume) {
  if (!src || !(volume > 0) || typeof Audio === 'undefined') return null;
  try {
    const tune = new Audio(src);
    tune.volume = Math.min(1, volume);
    tune.play().catch(() => {});
    return tune;
  } catch {
    return null;
  }
}

function fadeOut(tune, ms) {
  if (!tune) return;
  const start = tune.volume;
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    tune.volume = start * (1 - k);
    if (k < 1) requestAnimationFrame(step);
    else tune.pause();
  };
  requestAnimationFrame(step);
}

/** Générateur pseudo-aléatoire fixe : la même prairie à chaque lancement. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function grass(rand) {
  const blades = [];
  for (let i = 0; i < 46; i++) {
    const x = 20 + i * 5.8 + rand() * 4;
    const h = 18 + rand() * 30 + (x > 70 && x < 230 ? 8 : 0);
    const lean = (rand() - 0.5) * 14;
    const tone = ['#3e7d3a', '#4f9a3f', '#2f6b2c', '#6aa84f'][Math.floor(rand() * 4)];
    const delay = (0.35 + rand() * 0.9).toFixed(2);
    blades.push(`<path class="splash-blade" style="animation-delay:${delay}s" d="M${x.toFixed(1)} 232 Q${(x + lean / 2).toFixed(1)} ${(232 - h / 2).toFixed(1)} ${(x + lean).toFixed(1)} ${(232 - h).toFixed(1)} Q${(x + lean / 2 + 2).toFixed(1)} ${(232 - h / 2).toFixed(1)} ${(x + 3).toFixed(1)} 232Z" fill="${tone}"/>`);
  }
  return blades.join('');
}

function flower(x, y, color, delay, scale = 1) {
  const size = scale * 1.35;
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="0" cy="${-4.5 * size}" rx="${2.6 * size}" ry="${4.2 * size}" fill="${color}" transform="rotate(${a})"/>`).join('');
  return `<g class="splash-flower" style="animation-delay:${delay}s" transform="translate(${x} ${y})">
    <path d="M0 0 L0 ${18 * size}" stroke="#3e7d3a" stroke-width="1.6"/>
    <g class="splash-bloom" style="animation-delay:${(delay + 0.25).toFixed(2)}s">${petals}<circle r="${2.4 * size}" fill="#f2c94c"/></g>
  </g>`;
}

const SVG = (rand) => `
<svg class="splash-art" viewBox="24 24 262 220" role="img" aria-label="Un bassinet de chevalier dans l’herbe fleurie">
  <defs>
    <pattern id="splash-mail" width="5" height="5" patternUnits="userSpaceOnUse">
      <rect width="5" height="5" fill="#8d949b"/>
      <circle cx="2.5" cy="2.5" r="1.6" fill="none" stroke="#5c636a" stroke-width="0.9"/>
    </pattern>
    <linearGradient id="splash-steel" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#e3e7ea"/><stop offset="0.45" stop-color="#b9c0c6"/><stop offset="1" stop-color="#7d858c"/>
    </linearGradient>
    <radialGradient id="splash-glow" cx="0.5" cy="0.6" r="0.6">
      <stop offset="0" stop-color="#5a3a1a" stop-opacity="0.85"/><stop offset="1" stop-color="#1a120a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="150" cy="150" rx="150" ry="110" fill="url(#splash-glow)"/>
  <g class="splash-helm">
    <ellipse cx="148" cy="226" rx="92" ry="9" fill="#0d0805" opacity="0.6"/>
    <!-- camail -->
    <path d="M84 160 Q78 196 70 222 Q148 236 214 222 Q204 196 198 170 Z" fill="url(#splash-mail)" stroke="#3a3f44" stroke-width="1.5"/>
    <!-- timbre pointu -->
    <path d="M86 166 Q84 92 150 34 Q186 74 202 132 L196 172 Q140 182 86 166Z" fill="url(#splash-steel)" stroke="#2a2e32" stroke-width="2"/>
    <path d="M150 36 Q132 90 128 170" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3"/>
    <!-- vervelles -->
    <g fill="#d8b56a" stroke="#6b4a10" stroke-width="0.6">
      <circle cx="92" cy="166" r="2"/><circle cx="108" cy="170" r="2"/><circle cx="124" cy="173" r="2"/><circle cx="140" cy="175" r="2"/><circle cx="156" cy="175" r="2"/><circle cx="172" cy="174" r="2"/><circle cx="188" cy="172" r="2"/>
    </g>
    <!-- mézail en bec de passereau -->
    <path d="M168 96 Q196 92 272 140 Q200 176 170 180 Q160 140 168 96Z" fill="url(#splash-steel)" stroke="#2a2e32" stroke-width="2"/>
    <path d="M176 112 L238 128" stroke="#1c1f22" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M182 120 L232 133" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>
    <g fill="#1c1f22">
      <circle cx="210" cy="150" r="1.7"/><circle cx="218" cy="148" r="1.7"/><circle cx="226" cy="146" r="1.7"/>
      <circle cx="206" cy="157" r="1.7"/><circle cx="214" cy="156" r="1.7"/><circle cx="222" cy="154" r="1.7"/><circle cx="230" cy="151" r="1.7"/>
      <circle cx="210" cy="163" r="1.7"/><circle cx="218" cy="162" r="1.7"/><circle cx="226" cy="159" r="1.7"/>
    </g>
    <!-- pivot du mézail -->
    <circle cx="158" cy="134" r="6" fill="#c9cfd4" stroke="#2a2e32" stroke-width="1.6"/>
    <circle cx="158" cy="134" r="2" fill="#2a2e32"/>
  </g>
  <!-- liane qui grimpe sur le timbre -->
  <path class="splash-vine" d="M96 224 Q90 196 100 176 Q112 152 104 128 Q100 108 118 88 Q130 74 140 62" fill="none" stroke="#3e7d3a" stroke-width="2.6" stroke-linecap="round"/>
  <g class="splash-leaves">
    <ellipse cx="102" cy="190" rx="6" ry="3" fill="#4f9a3f" transform="rotate(-30 102 190)"/>
    <ellipse cx="108" cy="150" rx="6" ry="3" fill="#6aa84f" transform="rotate(25 108 150)"/>
    <ellipse cx="108" cy="112" rx="6" ry="3" fill="#4f9a3f" transform="rotate(-35 108 112)"/>
    <ellipse cx="128" cy="78" rx="5" ry="2.6" fill="#6aa84f" transform="rotate(20 128 78)"/>
  </g>
  ${grass(rand)}
  ${flower(62, 206, '#e8e4da', 1.1)}
  ${flower(84, 214, '#c0302b', 1.3, 0.9)}
  ${flower(140, 62, '#c0302b', 1.9, 0.8)}
  ${flower(196, 216, '#7a3f9a', 1.5)}
  ${flower(230, 208, '#e2b43a', 1.25, 1.1)}
  ${flower(252, 216, '#e8e4da', 1.6, 0.85)}
  ${flower(44, 218, '#7a3f9a', 1.7, 0.8)}
  ${flower(118, 220, '#e2b43a', 1.45, 0.75)}
</svg>`;

/**
 * Affiche l'écran de démarrage par-dessus le jeu qui se charge, puis le retire (≈ 3,6 s, ou au
 * premier toucher). Renvoie une promesse résolue quand il a disparu.
 */
export function showSplash({ duration = DURATION_MS, tune = null, volume = 1 } = {}) {
  const root = document.createElement('div');
  root.className = 'splash';
  root.setAttribute('role', 'presentation');
  root.innerHTML = `${SVG(seeded(1386))}
    <div class="splash-word" aria-label="BZW"><span>B</span><span>Z</span><span>W</span></div>`;
  document.body.append(root);
  const music = playTune(tune, volume);
  return new Promise((resolve) => {
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      root.classList.add('is-leaving');
      // Passé d'un toucher : l'air s'éteint avec l'écran ; sinon il finit de lui-même.
      if (music && !music.ended) fadeOut(music, FADE_MS);
      setTimeout(() => { root.remove(); resolve(); }, FADE_MS);
    };
    root.addEventListener('pointerdown', close);
    setTimeout(close, duration);
  });
}
