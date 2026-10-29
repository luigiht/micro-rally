export interface RoadHit {
  /** Index of the segment start sample. */
  index: number;
  /** Distance along the road, metres. */
  along: number;
  /** Signed lateral offset, positive = left of travel direction. */
  lateral: number;
  /** Unsigned distance to the centreline. */
  distance: number;
}

export interface RoadSample {
  x: number;
  z: number;
  /** Yaw of the travel direction: forward = (sin, 0, cos). */
  heading: number;
}

export function createRoadHit(): RoadHit {
  return { index: 0, along: 0, lateral: 0, distance: Infinity };
}

const CELL = 16;

function cellKey(cx: number, cz: number): number {
  return (cx + 0x8000) * 0x10000 + (cz + 0x8000);
}

/** Arc-length-parameterised road centreline with a spatial grid for nearest queries. */
export class RoadPath {
  readonly count: number;
  readonly length: number;
  readonly headings: Float64Array;
  private readonly grid = new Map<number, Int32Array>();

  constructor(
    readonly xs: Float64Array,
    readonly zs: Float64Array,
    readonly spacing: number,
  ) {
    this.count = xs.length;
    this.length = (this.count - 1) * spacing;
    this.headings = new Float64Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(this.count - 1, i + 1);
      this.headings[i] = Math.atan2(xs[b]! - xs[a]!, zs[b]! - zs[a]!);
    }
    this.buildGrid();
  }

  /** Resample a dense polyline (interleaved x,z) to even arc-length spacing. */
  static fromPolyline(points: readonly number[], spacing: number): RoadPath {
    const xs: number[] = [points[0]!];
    const zs: number[] = [points[1]!];
    let carry = 0;
    for (let i = 2; i < points.length; i += 2) {
      let ax = points[i - 2]!;
      let az = points[i - 1]!;
      const bx = points[i]!;
      const bz = points[i + 1]!;
      let seg = Math.hypot(bx - ax, bz - az);
      while (carry + seg >= spacing) {
        const t = (spacing - carry) / seg;
        ax += (bx - ax) * t;
        az += (bz - az) * t;
        xs.push(ax);
        zs.push(az);
        seg = Math.hypot(bx - ax, bz - az);
        carry = 0;
      }
      carry += seg;
    }
    return new RoadPath(Float64Array.from(xs), Float64Array.from(zs), spacing);
  }

  sample(distance: number, out: RoadSample): RoadSample {
    const f = Math.min(Math.max(distance / this.spacing, 0), this.count - 1.000001);
    const i = Math.floor(f);
    const t = f - i;
    out.x = this.xs[i]! + (this.xs[i + 1]! - this.xs[i]!) * t;
    out.z = this.zs[i]! + (this.zs[i + 1]! - this.zs[i]!) * t;
    out.heading = Math.atan2(this.xs[i + 1]! - this.xs[i]!, this.zs[i + 1]! - this.zs[i]!);
    return out;
  }

  /** Closest point on the centreline within `maxDist`. Returns false if none. */
  nearest(x: number, z: number, maxDist: number, out: RoadHit): boolean {
    out.distance = Infinity;
    const c0x = Math.floor((x - maxDist) / CELL);
    const c1x = Math.floor((x + maxDist) / CELL);
    const c0z = Math.floor((z - maxDist) / CELL);
    const c1z = Math.floor((z + maxDist) / CELL);
    let best = maxDist * maxDist;
    let found = false;
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const segs = this.grid.get(cellKey(cx, cz));
        if (!segs) continue;
        for (let k = 0; k < segs.length; k++) {
          const i = segs[k]!;
          const ax = this.xs[i]!;
          const az = this.zs[i]!;
          const dx = this.xs[i + 1]! - ax;
          const dz = this.zs[i + 1]! - az;
          const len2 = dx * dx + dz * dz;
          let t = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const px = x - (ax + dx * t);
          const pz = z - (az + dz * t);
          const d2 = px * px + pz * pz;
          if (d2 <= best) {
            best = d2;
            found = true;
            out.index = i;
            out.along = (i + t) * this.spacing;
            const inv = 1 / Math.sqrt(len2 || 1);
            // Left of travel direction (dx, dz) is (dz, -dx).
            out.lateral = (px * dz - pz * dx) * inv;
          }
        }
      }
    }
    if (found) out.distance = Math.sqrt(best);
    return found;
  }

  private buildGrid(): void {
    const tmp = new Map<number, number[]>();
    for (let i = 0; i < this.count - 1; i++) {
      const x0 = Math.floor(Math.min(this.xs[i]!, this.xs[i + 1]!) / CELL);
      const x1 = Math.floor(Math.max(this.xs[i]!, this.xs[i + 1]!) / CELL);
      const z0 = Math.floor(Math.min(this.zs[i]!, this.zs[i + 1]!) / CELL);
      const z1 = Math.floor(Math.max(this.zs[i]!, this.zs[i + 1]!) / CELL);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const key = cellKey(cx, cz);
          const list = tmp.get(key);
          if (list) list.push(i);
          else tmp.set(key, [i]);
        }
      }
    }
    for (const [key, list] of tmp) this.grid.set(key, Int32Array.from(list));
  }
}
