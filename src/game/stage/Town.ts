import type { BoxObstacle } from '../vehicle/Collisions';

/**
 * A town section on a stage: a level plateau carrying a street grid the route
 * threads through with right-angle turns. Everything here is plain data
 * derived deterministically from the stage, so the terrain worker rebuilds it
 * from the seed exactly as the main thread does.
 *
 * Frame: `heading` is the yaw of the entry street (forward = (sin, 0, cos));
 * `u` runs along it from the town centre, `v` to its left.
 */
export interface TownDef {
  /** Plateau centre. */
  x: number;
  z: number;
  heading: number;
  /** Plateau half extents along `u` and `v`; the hills blend down to it over `PLATEAU_BLEND` beyond them. */
  halfU: number;
  halfV: number;
  /** Route distance interval [from, to] inside the town. */
  from: number;
  to: number;
  /** Every street centreline, route and side streets alike. */
  streets: Street[];
  buildings: Building[];
  barriers: Barrier[];
  /** Direction boards at the route's turns. */
  arrows: Arrow[];
}

/** Straight street centreline segment between two world points. */
export interface Street {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  halfWidth: number;
  /** True for the streets the route drives; false for the blocked side streets. */
  route: boolean;
}

export type BuildingStyle = 'townhouse' | 'shop' | 'tower' | 'hall';

/** Footprint-aligned building: `yaw` faces the door (local -z) at the street, half extents in its own frame. */
export interface Building {
  style: BuildingStyle;
  x: number;
  z: number;
  yaw: number;
  hx: number;
  hz: number;
  variant: number;
}

/** Row of rally barriers across a side street, centred on (x, z), spanning `halfLength` either side along its left axis. */
export interface Barrier {
  x: number;
  z: number;
  yaw: number;
  halfLength: number;
}

export interface Arrow {
  x: number;
  z: number;
  yaw: number;
  /** +1 left turn, -1 right turn. */
  turn: 1 | -1;
}

/** Width of the band beyond the plateau over which the hills blend down to it. */
export const PLATEAU_BLEND = 40;

/** Signed-ish distance from (x, z) to the plateau rectangle: 0 inside, Euclidean distance to its edge outside. */
export function plateauDistance(town: TownDef, x: number, z: number): number {
  const dx = x - town.x;
  const dz = z - town.z;
  const sy = Math.sin(town.heading);
  const cy = Math.cos(town.heading);
  const u = dx * sy + dz * cy;
  const v = dx * cy - dz * sy;
  const eu = Math.max(0, Math.abs(u) - town.halfU);
  const ev = Math.max(0, Math.abs(v) - town.halfV);
  return Math.hypot(eu, ev);
}

/** Unsigned distance from (x, z) to a street's centreline segment. */
export function streetDistance(s: Street, x: number, z: number): number {
  const dx = s.x1 - s.x0;
  const dz = s.z1 - s.z0;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - s.x0) * dx + (z - s.z0) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (s.x0 + dx * t), z - (s.z0 + dz * t));
}

/** True when (x, z) lies on a town street (within its half width). */
export function onTownStreet(town: TownDef, x: number, z: number): boolean {
  for (const s of town.streets) if (streetDistance(s, x, z) <= s.halfWidth) return true;
  return false;
}

/** Depth of a barrier row (half), along its facing axis. */
export const BARRIER_HALF_DEPTH = 0.4;

/** Oriented-box colliders for every building and barrier row in the town. */
export function townObstacles(town: TownDef): BoxObstacle[] {
  const out: BoxObstacle[] = [];
  for (const b of town.buildings) out.push({ x: b.x, z: b.z, hx: b.hx, hz: b.hz, yaw: b.yaw });
  for (const r of town.barriers)
    out.push({ x: r.x, z: r.z, hx: r.halfLength, hz: BARRIER_HALF_DEPTH, yaw: r.yaw });
  return out;
}
