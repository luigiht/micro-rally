import type { RoadPath } from './RoadPath';

/**
 * Where a circuit's lap crosses itself (every circuit is a figure of eight,
 * `CircuitGenerator`): one stretch climbs onto a bridge, the other dips into
 * a walled cutting and runs under it through a short tunnel, the bridge's
 * slab its roof. This module holds the crossing's measurements and the
 * shaping every other part reads (the road profile, the ground, the
 * barriers, the car's height): pure TS.
 */

export interface CircuitCrossing {
  /** The crossing point. */
  x: number;
  z: number;
  /** Lap distances where the bridge stretch (`over`) and the tunnel stretch (`under`) pass it. */
  over: number;
  under: number;
}

/** The bridge's deck stands this far over the tunnel's road at the crossing. */
export const CROSS_CLEARANCE = 7.5;
/** Either stretch holds its full rise or dip this far either side of the crossing, then eases back over `CROSS_EASE`. */
export const CROSS_PLATEAU = 25;
export const CROSS_EASE = 110;
/** Within this radius of the crossing the ground follows the cutting and the bridge's embankment. */
export const CROSS_ZONE = 75;
/**
 * The cutting's walls stand this far past the tunnel road's carriageway
 * edge. The ground stays down at the cutting's floor `WALL_HOLD` past their
 * face (two terrain cells, so no coarse triangle straddling the wall slopes
 * up in front of it), then climbs out over `WALL_RAMP`; each wall is a
 * solid block `WALL_BODY` deep, hiding that climb.
 */
export const WALL_GAP = 2.5;
export const WALL_HOLD = 4.5;
export const WALL_RAMP = 1.5;
export const WALL_BODY = WALL_HOLD + WALL_RAMP + 0.5;
/** The tunnel road's walls run this far either side of the crossing (road distance). */
export const WALL_REACH = 55;
/** The bridge's parapets stand this far past its carriageway edge. */
export const PARAPET_GAP = 1;
/** The bridge slab (the tunnel's roof) reaches this far either side of the bridge road's centreline, this deep. */
export const ROOF_HALF = 16;
export const SLAB_DEPTH = 1.3;
/** The bridge (deck, parapets) runs this far either side of the crossing along the bridge road. */
export const BRIDGE_REACH = 16;

/** Cyclic distance between two lap distances. */
export function lapGap(a: number, b: number, lap: number): number {
  const d = Math.abs(a - b) % lap;
  return Math.min(d, lap - d);
}

/**
 * The lap's one self-crossing: the first pair of segments more than
 * `minApart` metres apart round the lap that intersect. Null when the lap
 * never crosses itself.
 */
export function findCrossing(
  path: RoadPath,
  minApart: number,
): { x: number; z: number; a: number; b: number } | null {
  const n = path.count - 1;
  const { xs, zs, spacing } = path;
  const gap = Math.ceil(minApart / spacing);
  for (let i = 0; i < n; i++) {
    const ax = xs[i]!;
    const az = zs[i]!;
    const bx = xs[i + 1]!;
    const bz = zs[i + 1]!;
    for (let j = i + gap; j < n; j++) {
      if (n - (j - i) < gap) break;
      const cx = xs[j]!;
      const cz = zs[j]!;
      const dx = xs[j + 1]!;
      const dz = zs[j + 1]!;
      // Quick reject on the bounding boxes.
      if (Math.max(cx, dx) < Math.min(ax, bx) || Math.min(cx, dx) > Math.max(ax, bx)) continue;
      if (Math.max(cz, dz) < Math.min(az, bz) || Math.min(cz, dz) > Math.max(az, bz)) continue;
      const rx = bx - ax;
      const rz = bz - az;
      const sx = dx - cx;
      const sz = dz - cz;
      const den = rx * sz - rz * sx;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((cx - ax) * sz - (cz - az) * sx) / den;
      const u = ((cx - ax) * rz - (cz - az) * rx) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      return { x: ax + rx * t, z: az + rz * t, a: (i + t) * spacing, b: (j + u) * spacing };
    }
  }
  return null;
}

/** 0..1 how fully a stretch takes its rise or dip `d` metres (road distance) from the crossing. */
function crossingShare(d: number): number {
  if (d <= CROSS_PLATEAU) return 1;
  const t = Math.min(1, (d - CROSS_PLATEAU) / CROSS_EASE);
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Lift the bridge stretch and sink the tunnel stretch of a closed lap's
 * road profile (`heights`, one per sample, the last repeating the first)
 * about their mean at the crossing, `CROSS_CLEARANCE` apart, easing back to
 * the profile over `CROSS_EASE`. In place.
 */
export function shapeCrossing(heights: Float64Array, spacing: number, c: CircuitCrossing): void {
  const n = heights.length - 1;
  const lap = n * spacing;
  const at = (d: number) => {
    const f = (((d / spacing) % n) + n) % n;
    const i = Math.floor(f);
    return heights[i]! + (heights[(i + 1) % n]! - heights[i]!) * (f - i);
  };
  const mid = (at(c.over) + at(c.under)) / 2;
  const targets = [
    { along: c.over, level: mid + CROSS_CLEARANCE / 2 },
    { along: c.under, level: mid - CROSS_CLEARANCE / 2 },
  ];
  for (let i = 0; i < n; i++) {
    for (const t of targets) {
      const w = crossingShare(lapGap(i * spacing, t.along, lap));
      if (w > 0) heights[i] = heights[i]! + (t.level - heights[i]!) * w;
    }
  }
  heights[n] = heights[0]!;
}

/** Whether a stretch of the lap at `along` lies on the crossing's shaped road (its rise or dip, either stretch). */
export function nearCrossing(
  c: CircuitCrossing,
  along: number,
  lap: number,
  reach: number,
): boolean {
  return lapGap(along, c.over, lap) < reach || lapGap(along, c.under, lap) < reach;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Whether (x, z) lies where the crossing shapes the ground (the cutting's walls and the bridge's embankment). */
export function inCrossingZone(c: CircuitCrossing, x: number, z: number): boolean {
  return Math.hypot(x - c.x, z - c.z) < WALL_REACH;
}

/**
 * The ground near the crossing: the tunnel road's cutting (`under`, the
 * ground shaped by that stretch alone) out to its walls, `WALL_GAP` past
 * the carriageway's edge (`underDistance` from its centreline), then the
 * ground shaped by the bridge stretch alone (`over`: its embankment, else
 * the hills), easing back to the ground as every stretch shapes it
 * (`normal`) toward the zone's edge.
 */
export function crossingGround(
  c: CircuitCrossing,
  x: number,
  z: number,
  under: number,
  over: number,
  underDistance: number,
  halfWidth: number,
  normal: number,
): number {
  const w = 1 - smoothstep(WALL_REACH - 15, WALL_REACH, Math.hypot(x - c.x, z - c.z));
  if (w <= 0) return normal;
  const hold = halfWidth + WALL_GAP + WALL_HOLD;
  const t = smoothstep(hold, hold + WALL_RAMP, underDistance);
  return normal + (under + (over - under) * t - normal) * w;
}

/** A circuit's road climbs no steeper than this anywhere its profile was reshaped. */
export const CIRCUIT_MAX_GRADE = 0.1;

/**
 * Hold a closed lap's profile to `CIRCUIT_MAX_GRADE` outward from each of
 * `fixed` (lap distances, kept exactly as they are: the crossing's two
 * plateaus, the level start), over `reach` metres either way round the
 * lap: the ramps the reshaping laid are eased where they came out steeper.
 * In place.
 */
export function limitLapGrade(
  heights: Float64Array,
  spacing: number,
  fixed: readonly number[],
  reach: number,
): void {
  const n = heights.length - 1;
  const step = CIRCUIT_MAX_GRADE * spacing;
  const steps = Math.ceil(reach / spacing);
  const at = (i: number) => ((i % n) + n) % n;
  for (const d of fixed) {
    const i0 = Math.round(d / spacing);
    for (const dir of [1, -1]) {
      for (let k = 1; k <= steps; k++) {
        const i = at(i0 + dir * k);
        const p = heights[at(i0 + dir * (k - 1))]!;
        heights[i] = Math.min(p + step, Math.max(p - step, heights[i]!));
      }
    }
  }
  heights[n] = heights[0]!;
}
