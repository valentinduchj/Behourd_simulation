/** Éclaircit (amount > 0) ou assombrit (amount < 0) une couleur #rrggbb. */
export function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift) => {
    const c = (value >> shift) & 0xff;
    const next = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

/** #rrggbb (ou #rgb) → { r, g, b } (0–255) ; null si la couleur n'est pas hexadécimale. */
export function parseHex(hex) {
  if (typeof hex !== 'string' || hex[0] !== '#') return null;
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  if (full.length !== 7) return null;
  const value = parseInt(full.slice(1), 16);
  return Number.isNaN(value) ? null : { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

const toHex = ({ r, g, b }) => `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`;

/** Mélange deux couleurs #rrggbb : t = 0 → a, t = 1 → b. */
export function mixColors(a, b, t) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  return toHex({ r: ca.r + (cb.r - ca.r) * t, g: ca.g + (cb.g - ca.g) * t, b: ca.b + (cb.b - ca.b) * t });
}

/** #rrggbb → { h (0–360), s (0–1), l (0–1) } ; null si la couleur n'est pas hexadécimale. */
export function toHsl(hex) {
  const c = parseHex(hex);
  if (!c) return null;
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/** { h, s, l } → #rrggbb (s et l bornés entre 0 et 1). */
export function fromHsl({ h, s, l }) {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = Math.max(0, Math.min(1, s));
  const ll = Math.max(0, Math.min(1, l));
  if (ss === 0) return toHex({ r: ll * 255, g: ll * 255, b: ll * 255 });
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const channel = (t) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return toHex({ r: channel(hh + 1 / 3) * 255, g: channel(hh) * 255, b: channel(hh - 1 / 3) * 255 });
}
