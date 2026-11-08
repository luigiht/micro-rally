import type { NoiseFunction2D } from 'simplex-noise';
import { SpatialHash } from './SpatialHash';

/**
 * Small-scale detail laid over the terrain's broad relief: gentle bumps and
 * hollows everywhere off the road, and earth berms where a crowd stands.
 *
 * Bumps: two octaves of noise, about 10 m and 5 m across, a few tens of
 * centimetres high, faded in with the road blend so the carriageway, its
 * verge strip and the flat margin beside it stay level.
 *
 * Berms: low capsule-shaped mounds of earth, each a straight segment with a
 * round profile across it, so a run of short ones follows a bend. Set from
 * the spectator placement (on mud stages), between the road and the people.
 */
export interface TerrainMound {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Half the berm's depth across: the ground rises from this far out to the crest on its spine. */
  radius: number;
  height: number;
}

const BUMP_AMPLITUDE = 0.26;
const BUMP_FREQUENCY = 1 / 10;
const RIPPLE_AMPLITUDE = 0.1;
const RIPPLE_FREQUENCY = 1 / 4.5;
const MOUND_CELL = 16;

export class TerrainDetail {
  private mounds: TerrainMound[] = [];
  private grid = new SpatialHash<TerrainMound>(MOUND_CELL);

  /** `noise` null: no bumps here (coast, dunes, circuits and cities keep their own ground). */
  constructor(private readonly noise: NoiseFunction2D | null) {}

  setMounds(mounds: readonly TerrainMound[]): void {
    this.mounds = [...mounds];
    this.grid = new SpatialHash<TerrainMound>(MOUND_CELL);
    for (const m of this.mounds) {
      const cx = (m.x0 + m.x1) / 2;
      const cz = (m.z0 + m.z1) / 2;
      const reach = Math.hypot(m.x1 - m.x0, m.z1 - m.z0) / 2 + m.radius;
      this.grid.insert(m, cx, cz, reach);
    }
  }

  get moundCount(): number {
    return this.mounds.length;
  }

  /** The bumps at (x, z), `share` of them (0 by the road, 1 out in the open). */
  bumps(x: number, z: number, share: number): number {
    if (!this.noise || share <= 0) return 0;
    const n = this.noise;
    return (
      share *
      (BUMP_AMPLITUDE * n(x * BUMP_FREQUENCY + 311.7, z * BUMP_FREQUENCY - 97.3) +
        RIPPLE_AMPLITUDE * n(x * RIPPLE_FREQUENCY - 51.1, z * RIPPLE_FREQUENCY + 223.9))
    );
  }

  /** The highest berm over (x, z); 0 off every berm. */
  mound(x: number, z: number): number {
    const list = this.grid.at(this.grid.index(x), this.grid.index(z));
    if (!list) return 0;
    let h = 0;
    for (let i = 0; i < list.length; i++) {
      const m = list[i]!;
      const u = distanceToSegment(x, z, m) / m.radius;
      if (u >= 1) continue;
      // A rounded crest easing out to the ground with no step at the foot.
      const w = 1 - u * u;
      h = Math.max(h, m.height * w * Math.sqrt(w));
    }
    return h;
  }

  /** How far into a berm (x, z) is, 0 off it to 1 on its spine. */
  earth(x: number, z: number): number {
    const list = this.grid.at(this.grid.index(x), this.grid.index(z));
    if (!list) return 0;
    let e = 0;
    for (let i = 0; i < list.length; i++) {
      const m = list[i]!;
      e = Math.max(e, 1 - distanceToSegment(x, z, m) / m.radius);
    }
    return e;
  }

  /** Whether (x, z) lies on a berm, or within `margin` of its foot. */
  onMound(x: number, z: number, margin = 0): boolean {
    for (const m of this.mounds) if (distanceToSegment(x, z, m) < m.radius + margin) return true;
    return false;
  }
}

function distanceToSegment(x: number, z: number, m: TerrainMound): number {
  const dx = m.x1 - m.x0;
  const dz = m.z1 - m.z0;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - m.x0) * dx + (z - m.z0) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (m.x0 + dx * t), z - (m.z0 + dz * t));
}
