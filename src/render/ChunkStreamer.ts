export function chunkKey(cx: number, cz: number): number {
  return (cx + 0x8000) * 0x10000 + (cz + 0x8000);
}

interface Candidate {
  cx: number;
  cz: number;
  key: number;
  d2: number;
}

/**
 * Decides which square chunks should exist around a moving point. Only does
 * work when the point crosses into a new chunk; unloads with hysteresis.
 */
export class ChunkStreamer {
  readonly loaded = new Set<number>();
  private lastCx = Number.NaN;
  private lastCz = Number.NaN;

  constructor(
    readonly size: number,
    readonly radius: number,
    private readonly load: (cx: number, cz: number, key: number) => void,
    private readonly unload: (key: number) => void,
  ) {}

  update(x: number, z: number): void {
    const cx = Math.floor(x / this.size);
    const cz = Math.floor(z / this.size);
    if (cx === this.lastCx && cz === this.lastCz) return;
    this.lastCx = cx;
    this.lastCz = cz;

    const r = Math.ceil(this.radius / this.size) + 1;
    const keep = this.radius + this.size * 0.75;
    const drop = this.radius + this.size * 1.75;
    const wanted: Candidate[] = [];
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const ccx = (cx + dx + 0.5) * this.size - x;
        const ccz = (cz + dz + 0.5) * this.size - z;
        const d2 = ccx * ccx + ccz * ccz;
        if (d2 <= keep * keep)
          wanted.push({ cx: cx + dx, cz: cz + dz, key: chunkKey(cx + dx, cz + dz), d2 });
      }
    }
    wanted.sort((a, b) => a.d2 - b.d2);
    for (const w of wanted) {
      if (!this.loaded.has(w.key)) {
        this.loaded.add(w.key);
        this.load(w.cx, w.cz, w.key);
      }
    }
    for (const key of this.loaded) {
      const kcx = Math.floor(key / 0x10000) - 0x8000;
      const kcz = (key % 0x10000) - 0x8000;
      const ddx = (kcx + 0.5) * this.size - x;
      const ddz = (kcz + 0.5) * this.size - z;
      if (ddx * ddx + ddz * ddz > drop * drop) {
        this.loaded.delete(key);
        this.unload(key);
      }
    }
  }

  clear(): void {
    for (const key of this.loaded) this.unload(key);
    this.loaded.clear();
    this.lastCx = Number.NaN;
    this.lastCz = Number.NaN;
  }
}
