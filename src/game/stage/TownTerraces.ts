import {
  buildingCorners,
  FRONT_SETBACK,
  type Arrow,
  type Building,
  type BuildingStyle,
  type ConeRow,
  type Junction,
  type Planting,
  type Street,
  type Wall,
  type Footprint,
} from './Town';
import { BUILDING_SIZE, pickStyle, VILLAGE_VARIANTS } from './BuildingCatalog';

export { BUILDING_SIZE } from './BuildingCatalog';

/** Terraced houses stand a party wall apart; terrace pads blend over less, so neighbours never tilt each other. */
export const PARTY_GAP = 0.4;
/** On a bend a house front is a chord of the facade; its middle may stand over the pavement by at most this. */
const MAX_BULGE = 0.8;
/** Facade polylines drop vertices within this of the line between their neighbours. */
const SIMPLIFY = 0.05;
/** When a house will not fit, the row moves on by this much and tries again. */
const RETRY_STEP = 1;
/** Garden walls are checked against the streets this often, and trimmed where another street crosses. */
const WALL_CHECK = 2;
const WALL_SLACK = 0.1;
/** A facade is only crossed by lines near where they start. */
const CROSS_REACH = 40;

export interface Pt {
  x: number;
  z: number;
}

/** The village under construction. */
export interface Site {
  rand: () => number;
  /** True when (x, z) stands at least a pavement less `slack` from every carriageway, the route's by its actual width. */
  clear: (x: number, z: number, slack: number) => boolean;
  streets: Street[];
  cones: ConeRow[];
  buildings: Building[];
  walls: Wall[];
  arrows: Arrow[];
  junctions: Junction[];
  plantings: Planting[];
  /** Building style weights for the terraces; the village mix when unset. */
  styles?: readonly (readonly [BuildingStyle, number])[];
  /** How far the blocked side streets run from their junctions; `STUB_LENGTH` when unset. */
  stubLength?: number;
  /** How many render variants (tints) the terraces draw from; 2 when unset. */
  variants?: number;
}

/** True when a circle of radius `r` at (x, z) is clear of every carriageway's pavement and every building. */
export function openGround(site: Site, x: number, z: number, r: number): boolean {
  if (!site.clear(x, z, -r)) return false;
  for (const b of site.buildings) {
    const dx = x - b.x;
    const dz = z - b.z;
    const cy = Math.cos(b.yaw);
    const sy = Math.sin(b.yaw);
    const u = dx * cy - dz * sy;
    const v = dx * sy + dz * cy;
    if (Math.abs(u) <= b.hx + r && Math.abs(v) <= b.hz + r) return false;
  }
  return true;
}

export const forward = (h: number): Pt => ({ x: Math.sin(h), z: Math.cos(h) });
export const left = (h: number): Pt => ({ x: Math.cos(h), z: -Math.sin(h) });
/** Point `along` a frame at `o` on `heading`, `across` to its left. */
export const at = (o: Pt, heading: number, along: number, across: number): Pt => ({
  x: o.x + Math.sin(heading) * along + Math.cos(heading) * across,
  z: o.z + Math.cos(heading) * along - Math.sin(heading) * across,
});
export const street = (a: Pt, b: Pt, halfWidth: number, route: boolean): Street => ({
  x0: a.x,
  z0: a.z,
  x1: b.x,
  z1: b.z,
  halfWidth,
  route,
});
export const wall = (a: Pt, b: Pt): Wall => ({ x0: a.x, z0: a.z, x1: b.x, z1: b.z });

/** A house standing on a facade: centre, yaw with the door toward the street, and where it ends along the facade. */
export interface Placed {
  x: number;
  z: number;
  yaw: number;
  end: number;
}

/** A point on a facade with its distance along it. */
export interface FacadePoint extends Pt {
  s: number;
}

/**
 * The line houses front onto, measured by distance `s` along it in the
 * direction of travel: a polyline a pavement's width off a street, with the
 * houses on its left (`side` 1) or right (-1).
 */
export interface Facade {
  length: number;
  point(s: number): Pt;
  /** Where a front of half width `hx` and depth `hz` stands if it starts at `s`; null when the facade bends too much for it. */
  house(s: number, hx: number, hz: number): Placed | null;
  /** Vertices of the facade from `s0` to `s1`, both ends included. */
  trace(s0: number, s1: number): Pt[];
  /** Where a line from `o` on `heading`, `across` to its left, crosses the facade near `o`. */
  cross(o: Pt, heading: number, across: number): FacadePoint | null;
  nearest(x: number, z: number): FacadePoint;
}

/** Ramer–Douglas–Peucker: the fewest vertices that keep the polyline within `eps`. */
function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length <= 2) return pts.slice();
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = pts[a]!.x;
    const az = pts[a]!.z;
    const dx = pts[b]!.x - ax;
    const dz = pts[b]!.z - az;
    const len = Math.hypot(dx, dz) || 1;
    let worst = eps;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i]!.x - ax) * dz - (pts[i]!.z - az) * dx) / len;
      if (d > worst) {
        worst = d;
        idx = i;
      }
    }
    if (idx > 0) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export function polylineFacade(raw: Pt[], side: 1 | -1): Facade {
  const pts = simplify(raw, SIMPLIFY);
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z));
  const length = cum[cum.length - 1]!;
  /** Index of the segment holding `s`. */
  const segment = (s: number): number => {
    let lo = 0;
    let hi = Math.max(0, pts.length - 2);
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cum[mid]! <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const point = (s: number): Pt => {
    const i = segment(s);
    const p = pts[i]!;
    const q = pts[i + 1] ?? p;
    const len = cum[i + 1]! - cum[i]!;
    const t = len > 0 ? Math.min(1, Math.max(0, (s - cum[i]!) / len)) : 0;
    return { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t };
  };
  return {
    length,
    point,
    trace(s0, s1) {
      const out = [point(s0)];
      for (let i = segment(s0) + 1; i < pts.length && cum[i]! < s1 - 1e-9; i++)
        if (cum[i]! > s0 + 1e-9) out.push(pts[i]!);
      out.push(point(s1));
      return out;
    },
    house(s, hx, hz) {
      const a = point(s);
      const chord = 2 * hx;
      const i = segment(s);
      let k = i + 1;
      while (k < pts.length && Math.hypot(pts[k]!.x - a.x, pts[k]!.z - a.z) < chord) k++;
      if (k >= pts.length) return null;
      // The far corner lies on segment k-1 → k, a chord's length from the near one.
      const p = k === i + 1 ? a : pts[k - 1]!;
      const q = pts[k]!;
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const ex = p.x - a.x;
      const ez = p.z - a.z;
      const qa = dx * dx + dz * dz;
      const qb = 2 * (dx * ex + dz * ez);
      const qc = ex * ex + ez * ez - chord * chord;
      const disc = qb * qb - 4 * qa * qc;
      if (qa === 0 || disc < 0) return null;
      const t = (-qb + Math.sqrt(disc)) / (2 * qa);
      const b = { x: p.x + dx * t, z: p.z + dz * t };
      const end = (k === i + 1 ? s : cum[k - 1]!) + Math.sqrt(qa) * t;
      const heading = Math.atan2(b.x - a.x, b.z - a.z);
      // Depth grows away from the street: to the left of the chord on a left facade.
      const nx = Math.cos(heading) * side;
      const nz = -Math.sin(heading) * side;
      for (let m = i + 1; m < k; m++)
        if (-((pts[m]!.x - a.x) * nx + (pts[m]!.z - a.z) * nz) > MAX_BULGE) return null;
      return {
        x: (a.x + b.x) / 2 + nx * hz,
        z: (a.z + b.z) / 2 + nz * hz,
        yaw: heading + (side * Math.PI) / 2,
        end,
      };
    },
    cross(o, heading, across) {
      const p0 = at(o, heading, 0, across);
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      let best: FacadePoint | null = null;
      let bestT = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i]!;
        const q = pts[i + 1]!;
        if (
          Math.hypot(p.x - o.x, p.z - o.z) > CROSS_REACH &&
          Math.hypot(q.x - o.x, q.z - o.z) > CROSS_REACH
        )
          continue;
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        // p0 + f t = p + d u
        const det = dx * fz - dz * fx;
        if (Math.abs(det) < 1e-9) continue;
        const rx = p.x - p0.x;
        const rz = p.z - p0.z;
        const t = (dx * rz - dz * rx) / det;
        const u = (fx * rz - fz * rx) / det;
        if (u < -1e-9 || u > 1 + 1e-9 || Math.abs(t) >= Math.abs(bestT)) continue;
        bestT = t;
        const uu = Math.min(1, Math.max(0, u));
        best = {
          s: cum[i]! + Math.sqrt(dx * dx + dz * dz) * uu,
          x: p.x + dx * uu,
          z: p.z + dz * uu,
        };
      }
      return best;
    },
    nearest(x, z) {
      let best: FacadePoint = { s: 0, x: pts[0]!.x, z: pts[0]!.z };
      let bestD = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i]!;
        const q = pts[i + 1]!;
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const len2 = dx * dx + dz * dz;
        let u = len2 > 0 ? ((x - p.x) * dx + (z - p.z) * dz) / len2 : 0;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        const px = p.x + dx * u;
        const pz = p.z + dz * u;
        const d = Math.hypot(x - px, z - pz);
        if (d < bestD) {
          bestD = d;
          best = { s: cum[i]! + Math.sqrt(len2) * u, x: px, z: pz };
        }
      }
      return best;
    },
  };
}

/** Facade along a straight street from `o` on `heading` to `length`, a pavement off its left (`side` 1) or right (-1). */
export function straightFacade(
  o: Pt,
  heading: number,
  halfWidth: number,
  side: 1 | -1,
  length: number,
): Facade {
  const off = (halfWidth + FRONT_SETBACK) * side;
  return polylineFacade([at(o, heading, 0, off), at(o, heading, length, off)], side);
}

/** True when the two footprints are at least `gap` apart along some edge axis (so never overlapping). */
export function apart(a: Footprint, b: Footprint, gap: number): boolean {
  const ca = buildingCorners(a);
  const cb = buildingCorners(b);
  for (const r of [a, b]) {
    for (const [ax, az] of [
      [Math.cos(r.yaw), -Math.sin(r.yaw)],
      [Math.sin(r.yaw), Math.cos(r.yaw)],
    ]) {
      let aMin = Infinity;
      let aMax = -Infinity;
      let bMin = Infinity;
      let bMax = -Infinity;
      for (const [x, z] of ca) {
        const p = x * ax! + z * az!;
        aMin = Math.min(aMin, p);
        aMax = Math.max(aMax, p);
      }
      for (const [x, z] of cb) {
        const p = x * ax! + z * az!;
        bMin = Math.min(bMin, p);
        bMax = Math.max(bMax, p);
      }
      if (aMax + gap <= bMin + 1e-9 || bMax + gap <= aMin + 1e-9) return true;
    }
  }
  return false;
}

/** Stand a building if its footprint stays behind every pavement and a party gap from every other building. */
export function place(site: Site, b: Building): boolean {
  for (const [x, z] of buildingCorners(b)) if (!site.clear(x, z, 0.05)) return false;
  for (const k of site.buildings) if (!apart(k, b, PARTY_GAP)) return false;
  site.buildings.push(b);
  return true;
}

/**
 * Garden wall along the facade from `s0` to `s1`, following its bends and
 * trimmed wherever another street crosses it (a side street from a
 * neighbouring junction can run this close).
 */
export function wallAlong(site: Site, facade: Facade, s0: number, s1: number): void {
  if (s1 - s0 < 0.3) return;
  const pts = facade.trace(s0, s1);
  for (let i = 1; i < pts.length; i++) pushWall(site, pts[i - 1]!, pts[i]!);
}

/** A garden wall from `p` to `q`, less any stretch that crosses a street. */
export function pushWall(site: Site, p: Pt, q: Pt): void {
  const len = Math.hypot(q.x - p.x, q.z - p.z);
  if (len < 0.05) return;
  const n = Math.ceil(len / WALL_CHECK);
  const along = (k: number): Pt => ({
    x: p.x + ((q.x - p.x) * k) / n,
    z: p.z + ((q.z - p.z) * k) / n,
  });
  let run: Pt | null = null;
  for (let k = 0; k <= n; k++) {
    const c = along(k);
    const ok = site.clear(c.x, c.z, WALL_SLACK);
    if (ok && !run) run = c;
    if ((!ok || k === n) && run) {
      const end = ok ? c : along(k - 1);
      if (Math.hypot(end.x - run.x, end.z - run.z) >= 0.3) site.walls.push(wall(run, end));
      run = null;
    }
  }
}

/**
 * A terrace along the facade between `from` and `to`: houses a party wall
 * apart, each standing where it fits, and a garden wall across every gap,
 * so the pavement is backed from end to end.
 */
export function row(site: Site, facade: Facade, from: number, to: number): void {
  const smallest = 2 * BUILDING_SIZE.tower.hx;
  let lastEdge = from;
  let cursor = from;
  while (to - cursor >= smallest) {
    const style = pickStyle(site.rand, site.styles, to - cursor);
    if (!style) break;
    const { hx, hz } = BUILDING_SIZE[style];
    const h = facade.house(cursor, hx, hz);
    const variant = Math.floor(site.rand() * (site.variants ?? VILLAGE_VARIANTS));
    if (
      h &&
      h.end <= to + 1e-6 &&
      place(site, { style, x: h.x, z: h.z, yaw: h.yaw, hx, hz, variant })
    ) {
      wallAlong(site, facade, lastEdge, cursor);
      lastEdge = h.end;
      cursor = h.end + PARTY_GAP;
    } else {
      cursor += RETRY_STEP;
    }
  }
  wallAlong(site, facade, lastEdge, to);
}
