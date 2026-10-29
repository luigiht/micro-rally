import type { VehicleState } from './VehicleSim';

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

const CELL = 8;

function key(cx: number, cz: number): number {
  return (cx + 0x8000) * 0x10000 + (cz + 0x8000);
}

/** Uniform grid over static circular obstacles (tree trunks, boulders). */
export class ObstacleGrid {
  private readonly cells = new Map<number, Int32Array>();

  constructor(readonly obstacles: readonly Obstacle[]) {
    const tmp = new Map<number, number[]>();
    obstacles.forEach((o, i) => {
      const k = key(Math.floor(o.x / CELL), Math.floor(o.z / CELL));
      const list = tmp.get(k);
      if (list) list.push(i);
      else tmp.set(k, [i]);
    });
    for (const [k, list] of tmp) this.cells.set(k, Int32Array.from(list));
  }

  /** Writes indices of obstacles in cells overlapping the circle into `out`; returns the count. */
  query(x: number, z: number, radius: number, out: Int32Array): number {
    let n = 0;
    const reach = radius + 2;
    for (let cx = Math.floor((x - reach) / CELL); cx <= Math.floor((x + reach) / CELL); cx++) {
      for (let cz = Math.floor((z - reach) / CELL); cz <= Math.floor((z + reach) / CELL); cz++) {
        const ids = this.cells.get(key(cx, cz));
        if (!ids) continue;
        for (let k = 0; k < ids.length && n < out.length; k++) out[n++] = ids[k]!;
      }
    }
    return n;
  }
}

const CAR_RADIUS = 0.9;
const CIRCLE_OFFSET = 1.0;
const RESTITUTION = 0.25;
const scratch = new Int32Array(64);

/**
 * Pushes the car (two circles along its axis) out of obstacles and removes
 * inbound velocity. Returns the largest impact speed this step (m/s).
 */
export function resolveObstacleCollisions(s: VehicleState, grid: ObstacleGrid): number {
  let impact = 0;
  const fx = Math.sin(s.yaw);
  const fz = Math.cos(s.yaw);
  for (let c = -1; c <= 1; c += 2) {
    const cx = s.x + fx * CIRCLE_OFFSET * c;
    const cz = s.z + fz * CIRCLE_OFFSET * c;
    const n = grid.query(cx, cz, CAR_RADIUS, scratch);
    for (let k = 0; k < n; k++) {
      const o = grid.obstacles[scratch[k]!]!;
      const dx = cx - o.x;
      const dz = cz - o.z;
      const min = CAR_RADIUS + o.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const nz = dz / d;
      s.x += nx * (min - d);
      s.z += nz * (min - d);
      const vn = s.vx * nx + s.vz * nz;
      if (vn < 0) {
        s.vx -= (1 + RESTITUTION) * vn * nx;
        s.vz -= (1 + RESTITUTION) * vn * nz;
        s.yawRate *= 0.5;
        impact = Math.max(impact, -vn);
      }
    }
  }
  return impact;
}
