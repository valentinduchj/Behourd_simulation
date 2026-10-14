// Placement alterné avant une manche Joueur contre IA :
//   le joueur (camp 'A') commence, puis l'IA (camp 'B'), puis le joueur… un combattant à la fois,
//   jusqu'à ce que tous soient posés. Un camp qui n'a plus personne à placer laisse l'autre continuer.
//   Une case par combattant, dans la zone de son camp ; un combattant posé est verrouillé
//   (ni déplacé, ni remplacé) pour toute la manche.

const SIDES = ['A', 'B'];
const sideIndexOf = (side) => (side === 'A' ? 0 : 1);
const key = (tile) => `${tile.x},${tile.y}`;

export class PlacementManager {
  /** fighters : { A: [fighterId], B: [fighterId] }. */
  constructor({ arena, fighters, firstSide = 'A' }) {
    this.arena = arena;
    this.fighters = { A: [...fighters.A], B: [...fighters.B] };
    this.placements = { A: new Map(), B: new Map() };
    this.history = [];
    this.nextSide = firstSide;
    this.locked = false;
  }

  /** Cases de la zone de placement d'un camp. */
  getZoneTiles(side) {
    const { area } = this.arena.getSide(sideIndexOf(side));
    const tiles = [];
    for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) tiles.push({ x, y });
    return tiles;
  }

  isOccupied(tile) {
    return SIDES.some((side) => [...this.placements[side].values()].some((placed) => key(placed) === key(tile)));
  }

  /** Cases libres de la zone d'un camp. */
  getAvailableTiles(side) {
    return this.getZoneTiles(side).filter((tile) => !this.isOccupied(tile));
  }

  /** Combattants d'un camp qui restent à placer. */
  getRemaining(side) {
    return this.fighters[side].filter((id) => !this.placements[side].has(id));
  }

  get isComplete() {
    return SIDES.every((side) => this.getRemaining(side).length === 0);
  }

  /** Camp qui doit placer maintenant (null quand tout le monde est placé). */
  get currentSide() {
    if (this.isComplete) return null;
    if (this.getRemaining(this.nextSide).length) return this.nextSide;
    return SIDES.find((side) => this.getRemaining(side).length) ?? null;
  }

  /** Vérifie un placement. { ok, reason } */
  canPlace(side, fighterId, tile) {
    if (this.locked) return { ok: false, reason: 'Le placement est terminé.' };
    if (this.currentSide !== side) return { ok: false, reason: 'Ce n’est pas à ce camp de placer.' };
    if (!this.fighters[side].includes(fighterId)) return { ok: false, reason: 'Ce combattant ne fait pas partie de la manche.' };
    if (this.placements[side].has(fighterId)) return { ok: false, reason: 'Ce combattant est déjà placé : il ne peut plus être déplacé.' };
    if (!tile || !this.arena.isInDeploymentArea(sideIndexOf(side), tile.x, tile.y)) return { ok: false, reason: 'Placez ce combattant dans la zone de son camp.' };
    if (this.isOccupied(tile)) return { ok: false, reason: 'Cette case est déjà occupée.' };
    return { ok: true, reason: null };
  }

  /** Pose (définitivement) un combattant, puis passe la main. { ok, reason, placement } */
  place(side, fighterId, tile) {
    const check = this.canPlace(side, fighterId, tile);
    if (!check.ok) return check;
    const placed = { x: tile.x, y: tile.y };
    this.placements[side].set(fighterId, placed);
    const placement = { side, fighterId, tile: placed, order: this.history.length + 1 };
    this.history.push(placement);
    this.nextSide = side === 'A' ? 'B' : 'A';
    return { ok: true, reason: null, placement };
  }

  /** Dernier combattant posé par un camp (ou par n'importe quel camp). */
  getLastPlacement(side = null) {
    return [...this.history].reverse().find((entry) => !side || entry.side === side) ?? null;
  }

  getPlacement(side, fighterId) {
    return this.placements[side].get(fighterId) ?? null;
  }

  /** Verrouillage définitif (au lancement de la manche). */
  lock() {
    if (!this.isComplete) throw new Error('Tous les combattants ne sont pas placés.');
    this.locked = true;
  }

  /** Placements au format des manches : [{ fighterId, x, y }] par camp. */
  toLineup() {
    const of = (side) => this.fighters[side].map((fighterId) => ({ fighterId, ...this.placements[side].get(fighterId) }));
    return { placementsA: of('A'), placementsB: of('B') };
  }
}
