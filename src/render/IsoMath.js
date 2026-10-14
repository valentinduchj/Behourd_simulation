// Conversions grille ↔ écran pour une projection isométrique 2:1.
// `tile` = { w, h } : dimensions à l'écran d'une case (losange), avec h = w / 2.

export function gridToScreen(gx, gy, tile) {
  return {
    x: (gx - gy) * (tile.w / 2),
    y: (gx + gy) * (tile.h / 2),
  };
}

export function screenToGrid(sx, sy, tile) {
  const a = sx / (tile.w / 2);
  const b = sy / (tile.h / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
