import type { VehicleState } from './VehicleSim';

/** Round obstacle: tree trunks, boulders. */
export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

/**
 * Oriented box obstacle: buildings, garden walls. `yaw` follows the
 * car convention (forward = (sin, 0, cos)); `hx` is the half extent across
 * (local x, the left axis), `hz` along (local z, forward).
 */
export interface BoxObstacle {
  x: number;
  z: number;
  hx: number;
  hz: number;
  yaw: number;
}

const CELL = 8;
const CAR_RADIUS = 0.9;
const CIRCLE_OFFSET = 1.0;
const RESTITUTION = 0.25;
/** Boxes are filed in every cell their bounding circle reaches, padded by the car radius, so a query only looks at the car circle's own cell. */
const BOX_PAD = CAR_RADIUS + 0.5;
const MAX_HITS = 128;

function key(cx: number, cz: number): number {
  return (cx + 0x8000) * 0x10000 + (cz + 0x8000);
}

function fileInto(tmp: Map<number, number[]>, k: number, i: number): void {
  const list = tmp.get(k);
  if (list) list.push(i);
  else tmp.set(k, [i]);
}

function freeze(tmp: Map<number, number[]>, into: Map<number, Int32Array>): void {
  for (const [k, list] of tmp) into.set(k, Int32Array.from(list));
}

/** Uniform grid over static obstacles: circles filed by centre cell, boxes by every cell they reach. */
export class ObstacleGrid {
  private readonly cells = new Map<number, Int32Array>();
  private readonly boxCells = new Map<number, Int32Array>();

  constructor(
    readonly obstacles: readonly Obstacle[],
    readonly boxes: readonly BoxObstacle[] = [],
  ) {
    const tmp = new Map<number, number[]>();
    obstacles.forEach((o, i) =>
      fileInto(tmp, key(Math.floor(o.x / CELL), Math.floor(o.z / CELL)), i),
    );
    freeze(tmp, this.cells);
    const tmpBoxes = new Map<number, number[]>();
    boxes.forEach((b, i) => {
      const reach = Math.hypot(b.hx, b.hz) + BOX_PAD;
      for (let cx = Math.floor((b.x - reach) / CELL); cx <= Math.floor((b.x + reach) / CELL); cx++)
        for (
          let cz = Math.floor((b.z - reach) / CELL);
          cz <= Math.floor((b.z + reach) / CELL);
          cz++
        )
          fileInto(tmpBoxes, key(cx, cz), i);
    });
    freeze(tmpBoxes, this.boxCells);
  }

  /** Writes indices of circles in cells overlapping the query circle into `out`; returns the count. */
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

  /** Writes indices of boxes whose padded bounds reach the cell of (x, z) into `out`; returns the count. */
  queryBoxes(x: number, z: number, out: Int32Array): number {
    const ids = this.boxCells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!ids) return 0;
    const n = Math.min(ids.length, out.length);
    for (let k = 0; k < n; k++) out[k] = ids[k]!;
    return n;
  }
}

const scratch = new Int32Array(MAX_HITS);
const scratchBoxes = new Int32Array(MAX_HITS);

/** Moves the car out along the unit normal by `depth` and kills inbound velocity; returns the inbound speed removed. */
function push(s: VehicleState, nx: number, nz: number, depth: number): number {
  s.x += nx * depth;
  s.z += nz * depth;
  const vn = s.vx * nx + s.vz * nz;
  if (vn >= 0) return 0;
  s.vx -= (1 + RESTITUTION) * vn * nx;
  s.vz -= (1 + RESTITUTION) * vn * nz;
  s.yawRate *= 0.5;
  return -vn;
}

/** Car circle at (cx, cz) against one oriented box; returns the inbound speed removed, 0 when clear. */
function hitBox(s: VehicleState, b: BoxObstacle, cx: number, cz: number): number {
  const dx = cx - b.x;
  const dz = cz - b.z;
  const sy = Math.sin(b.yaw);
  const cy = Math.cos(b.yaw);
  // Circle centre in the box frame: left axis (cos, -sin), forward axis (sin, cos).
  const lx = dx * cy - dz * sy;
  const lz = dx * sy + dz * cy;
  const qx = lx < -b.hx ? -b.hx : lx > b.hx ? b.hx : lx;
  const qz = lz < -b.hz ? -b.hz : lz > b.hz ? b.hz : lz;
  const ex = lx - qx;
  const ez = lz - qz;
  const d2 = ex * ex + ez * ez;
  let nlx: number;
  let nlz: number;
  let depth: number;
  if (d2 === 0) {
    // Centre inside the box: leave through the nearest face.
    const px = b.hx - Math.abs(lx);
    const pz = b.hz - Math.abs(lz);
    if (px < pz) {
      nlx = lx < 0 ? -1 : 1;
      nlz = 0;
      depth = px + CAR_RADIUS;
    } else {
      nlx = 0;
      nlz = lz < 0 ? -1 : 1;
      depth = pz + CAR_RADIUS;
    }
  } else {
    if (d2 >= CAR_RADIUS * CAR_RADIUS) return 0;
    const d = Math.sqrt(d2);
    nlx = ex / d;
    nlz = ez / d;
    depth = CAR_RADIUS - d;
  }
  // Back to world axes.
  return push(s, nlx * cy + nlz * sy, -nlx * sy + nlz * cy, depth);
}

/**
 * Pushes the car (two circles along its axis) out of circles and boxes and
 * removes inbound velocity. Returns the largest impact speed this step (m/s).
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
      impact = Math.max(impact, push(s, dx / d, dz / d, min - d));
    }
    const nb = grid.queryBoxes(cx, cz, scratchBoxes);
    for (let k = 0; k < nb; k++) {
      impact = Math.max(impact, hitBox(s, grid.boxes[scratchBoxes[k]!]!, cx, cz));
    }
  }
  return impact;
}
