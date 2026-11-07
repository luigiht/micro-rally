/**
 * A uniform grid over the ground plane for looking up nearby items by their
 * (x, z) footprint, instead of scanning every item: a city stage carries
 * thousands of buildings, walls and pads, and each placement or height query
 * only cares about the few within reach. Pure TS, no allocation per query.
 */
export class SpatialHash<T> {
  private readonly cells = new Map<number, T[]>();

  constructor(readonly cell: number) {}

  /** The grid column or row holding coordinate `v`. */
  index(v: number): number {
    return Math.floor(v / this.cell);
  }

  /** Items filed in cell (cx, cz), in insertion order; undefined when none. */
  at(cx: number, cz: number): readonly T[] | undefined {
    return this.cells.get(key(cx, cz));
  }

  /** File `item` in every cell the square of half size `reach` about (x, z) touches (0 = its own cell only). */
  insert(item: T, x: number, z: number, reach = 0): void {
    const x0 = this.index(x - reach);
    const x1 = this.index(x + reach);
    const z0 = this.index(z - reach);
    const z1 = this.index(z + reach);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const k = key(cx, cz);
        const list = this.cells.get(k);
        if (list) list.push(item);
        else this.cells.set(k, [item]);
      }
  }

  /**
   * Visit every item filed in a cell the square of half size `reach` about
   * (x, z) touches; stops early when `fn` returns true, and returns whether
   * it did. An item filed in several cells may be visited once per cell.
   */
  near(x: number, z: number, reach: number, fn: (item: T) => boolean | void): boolean {
    const x0 = this.index(x - reach);
    const x1 = this.index(x + reach);
    const z0 = this.index(z - reach);
    const z1 = this.index(z + reach);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const list = this.cells.get(key(cx, cz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) if (fn(list[i]!) === true) return true;
      }
    return false;
  }

  /**
   * Visit the cells at Chebyshev distance `r` from cell (cx, cz): the ring of
   * cells round it (r = 0 is the cell itself). Items there lie at least
   * `(r - 1) * cell` from any point inside (cx, cz).
   */
  ring(cx: number, cz: number, r: number, fn: (items: readonly T[]) => void): void {
    if (r === 0) {
      const list = this.cells.get(key(cx, cz));
      if (list) fn(list);
      return;
    }
    for (let i = -r; i <= r; i++) {
      const top = this.cells.get(key(cx + i, cz - r));
      if (top) fn(top);
      const bottom = this.cells.get(key(cx + i, cz + r));
      if (bottom) fn(bottom);
    }
    for (let j = -r + 1; j <= r - 1; j++) {
      const l = this.cells.get(key(cx - r, cz + j));
      if (l) fn(l);
      const rr = this.cells.get(key(cx + r, cz + j));
      if (rr) fn(rr);
    }
  }
}

/** One integer per cell; columns and rows are offset to stay positive within ±2^15 cells. */
function key(cx: number, cz: number): number {
  return (cx + 32768) * 65536 + (cz + 32768);
}
