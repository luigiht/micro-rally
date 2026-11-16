export function chunkKey(cx: number, cz: number): number {
  return (cx + 0x8000) * 0x10000 + (cz + 0x8000);
}

/** The chunk coordinates a `chunkKey` encodes. */
export function chunkCoords(key: number): [number, number] {
  return [Math.floor(key / 0x10000) - 0x8000, (key % 0x10000) - 0x8000];
}

interface Candidate {
  cx: number;
  cz: number;
  key: number;
  d2: number;
}

/** The point is looked at again whenever it has moved this share of a chunk since the last look. */
const RECHECK = 0.25;
/** A loaded chunk is dropped once its nearest edge lies this share of a chunk past the radius. */
const DROP = 0.5;

/**
 * Decides which square chunks should exist around a moving point: every
 * chunk whose nearest edge lies within `radius` of it, so nothing loads
 * closer than `radius` less the little the point moves between looks
 * (`RECHECK` of a chunk); dropped with hysteresis once well out of reach.
 * Looks again only when the point has moved that far.
 */
export class ChunkStreamer {
  readonly loaded = new Set<number>();
  private lastX = Number.NaN;
  private lastZ = Number.NaN;

  constructor(
    readonly size: number,
    readonly radius: number,
    private readonly load: (cx: number, cz: number, key: number) => void,
    private readonly unload: (key: number) => void,
  ) {}

  /** Distance from (x, z) to the nearest point of chunk (cx, cz)'s square (0 inside it). */
  private edge(cx: number, cz: number, x: number, z: number): number {
    const dx = Math.max(cx * this.size - x, 0, x - (cx + 1) * this.size);
    const dz = Math.max(cz * this.size - z, 0, z - (cz + 1) * this.size);
    return Math.hypot(dx, dz);
  }

  update(x: number, z: number): void {
    const step = this.size * RECHECK;
    if (Math.abs(x - this.lastX) < step && Math.abs(z - this.lastZ) < step) return;
    this.lastX = x;
    this.lastZ = z;
    const cx = Math.floor(x / this.size);
    const cz = Math.floor(z / this.size);
    const r = Math.ceil(this.radius / this.size) + 1;
    const wanted: Candidate[] = [];
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = this.edge(cx + dx, cz + dz, x, z);
        if (d <= this.radius)
          wanted.push({ cx: cx + dx, cz: cz + dz, key: chunkKey(cx + dx, cz + dz), d2: d * d });
      }
    }
    // Nearest first, so what is close arrives first.
    wanted.sort((a, b) => a.d2 - b.d2);
    for (const w of wanted) {
      if (!this.loaded.has(w.key)) {
        this.loaded.add(w.key);
        this.load(w.cx, w.cz, w.key);
      }
    }
    const drop = this.radius + this.size * DROP;
    for (const key of this.loaded) {
      const [kcx, kcz] = chunkCoords(key);
      if (this.edge(kcx, kcz, x, z) > drop) {
        this.loaded.delete(key);
        this.unload(key);
      }
    }
  }

  clear(): void {
    for (const key of this.loaded) this.unload(key);
    this.loaded.clear();
    this.lastX = Number.NaN;
    this.lastZ = Number.NaN;
  }
}
