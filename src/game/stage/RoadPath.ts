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

/**
 * Arc-length-parameterised road centreline with a spatial grid for nearest
 * queries. A `closed` path is a loop (a circuit lap): its last sample sits on
 * its first, `sample` wraps distances round the lap, and the headings at the
 * seam look across it, so anything that walks 0..length draws one lap whole.
 */
export class RoadPath {
  readonly count: number;
  readonly length: number;
  readonly headings: Float64Array;
  private readonly grid = new Map<number, Int32Array>();

  constructor(
    readonly xs: Float64Array,
    readonly zs: Float64Array,
    readonly spacing: number,
    readonly closed = false,
  ) {
    this.count = xs.length;
    this.length = (this.count - 1) * spacing;
    this.headings = new Float64Array(this.count);
    const last = this.count - 1;
    for (let i = 0; i < this.count; i++) {
      // On a loop sample `last` is sample 0, so the neighbours wrap past it.
      const a = closed ? (i === 0 ? last - 1 : i - 1) : Math.max(0, i - 1);
      const b = closed ? (i === last ? 1 : i + 1) : Math.min(last, i + 1);
      this.headings[i] = Math.atan2(xs[b]! - xs[a]!, zs[b]! - zs[a]!);
    }
    this.buildGrid();
  }

  /** `distance` wrapped into [0, length) on a closed path; unchanged on an open one. */
  wrap(distance: number): number {
    if (!this.closed) return distance;
    const d = distance % this.length;
    return d < 0 ? d + this.length : d;
  }

  /**
   * Resample a closed loop (interleaved x,z, not repeating the first point) to
   * even arc-length spacing: the spacing is stretched a hair so a whole number
   * of steps goes round, and the last sample lands exactly on the first.
   */
  static fromClosedPolyline(points: readonly number[], spacing: number): RoadPath {
    const n = points.length / 2;
    const cum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      cum[i + 1] =
        cum[i]! +
        Math.hypot(points[j * 2]! - points[i * 2]!, points[j * 2 + 1]! - points[i * 2 + 1]!);
    }
    const total = cum[n]!;
    const steps = Math.max(3, Math.round(total / spacing));
    const step = total / steps;
    const xs = new Float64Array(steps + 1);
    const zs = new Float64Array(steps + 1);
    let seg = 0;
    for (let k = 0; k < steps; k++) {
      const d = k * step;
      while (cum[seg + 1]! < d) seg++;
      const j = (seg + 1) % n;
      const t = (d - cum[seg]!) / Math.max(1e-9, cum[seg + 1]! - cum[seg]!);
      xs[k] = points[seg * 2]! + (points[j * 2]! - points[seg * 2]!) * t;
      zs[k] = points[seg * 2 + 1]! + (points[j * 2 + 1]! - points[seg * 2 + 1]!) * t;
    }
    xs[steps] = xs[0]!;
    zs[steps] = zs[0]!;
    return new RoadPath(xs, zs, step, true);
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
    const f = Math.min(Math.max(this.wrap(distance) / this.spacing, 0), this.count - 1.000001);
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

  /** Calls `visit(along, distance)` for the closest point of every segment within `maxDist`; a segment may come twice. */
  visitNear(
    x: number,
    z: number,
    maxDist: number,
    visit: (along: number, distance: number) => void,
  ): void {
    const c0x = Math.floor((x - maxDist) / CELL);
    const c1x = Math.floor((x + maxDist) / CELL);
    const c0z = Math.floor((z - maxDist) / CELL);
    const c1z = Math.floor((z + maxDist) / CELL);
    const max2 = maxDist * maxDist;
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
          if (d2 <= max2) visit((i + t) * this.spacing, Math.sqrt(d2));
        }
      }
    }
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
