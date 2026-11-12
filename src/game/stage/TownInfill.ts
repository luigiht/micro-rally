import { CITY_EAVES } from './BuildingCatalog';
import { buildingIndex } from './BuildingIndex';
import type { Wall } from './Town';
import type { Pt, Site } from './TownTerraces';

/**
 * A city's infill: wherever no catalog building could stand behind a
 * pavement (a skewed corner, the narrow end of a wedge, a bend too tight),
 * a building is built to the plot instead, its footprint following the
 * pavement line and the shape of the corner rather than a rectangle. The
 * wall that marked the gap stays as its front's collider; nothing draws it.
 */

/**
 * One fitted building: its footprint is the street front (along the
 * pavement line, in order) followed by the rest of the outline back round
 * to the front's start, a height and a tint.
 */
export interface Infill {
  front: Pt[];
  back: Pt[];
  height: number;
  tint: number;
}

/** Façade tints the renderer chooses from. */
export const INFILL_TINTS = 4;
/** Depths tried behind each front, deepest first; the back must stay clear of every street. */
const DEPTHS = [9, 7, 5, 3.5, 2] as const;
/** A run's ends reach this much further along the pavement, to meet the buildings either side. */
const END_REACH = 0.6;
/** A slice's sides may run this far back to their apex; further, and it is cut off square. */
const MAX_SLICE = 14;
/** How far either side of a run's middle the street and the plot are looked for. */
const SIDE_PROBE = 2.5;
const JOIN = 0.05;

/** Chain walls into runs of consecutive pieces, end to start. */
function runs(walls: readonly Wall[]): Pt[][] {
  const out: Pt[][] = [];
  for (const w of walls) {
    const last = out[out.length - 1];
    const end = last?.[last.length - 1];
    if (last && end && Math.hypot(end.x - w.x0, end.z - w.z0) < JOIN)
      last.push({ x: w.x1, z: w.z1 });
    else
      out.push([
        { x: w.x0, z: w.z0 },
        { x: w.x1, z: w.z1 },
      ]);
  }
  return out;
}

/** A stable 0..1 from a point, so an infill's height and tint never change between visits. */
function hash(p: Pt, salt: number): number {
  let h = Math.imul(Math.round(p.x * 8) ^ 0x5bd1e995, 0x27d4eb2d) ^ Math.round(p.z * 8);
  h = Math.imul(h ^ salt ^ (h >>> 15), 0x165667b1);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/**
 * Fit a building to every run of the city's walls that backs a pavement
 * (a street on one side, the plot on the other); its wall stays as the
 * front's collider. Runs open or built up on both sides, or with no room
 * behind, lose their wall instead.
 */
export function fitInfills(site: Site): Infill[] {
  const infills: Infill[] = [];
  const kept: Wall[] = [];
  for (const run of runs(site.walls)) {
    const m = Math.floor((run.length - 1) / 2);
    const a = run[m]!;
    const b = run[m + 1]!;
    const d = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    // Left of travel, in this code's frame: (dz, −dx).
    const lx = (b.z - a.z) / d;
    const lz = -(b.x - a.x) / d;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const openLeft = site.clear(mx + lx * SIDE_PROBE, mz + lz * SIDE_PROBE, 0);
    const openRight = site.clear(mx - lx * SIDE_PROBE, mz - lz * SIDE_PROBE, 0);
    if (openLeft === openRight) continue;
    const inward = openLeft ? 1 : -1;
    // The pieces, the run's two ends reaching on to meet the neighbours.
    const pts = run.map((p) => ({ ...p }));
    const reach = (from: Pt, to: Pt) => {
      const len = Math.hypot(to.x - from.x, to.z - from.z) || 1;
      to.x += ((to.x - from.x) / len) * END_REACH;
      to.z += ((to.z - from.z) / len) * END_REACH;
    };
    reach(pts[1]!, pts[0]!);
    reach(pts[pts.length - 2]!, pts[pts.length - 1]!);
    const back = backOf(site, pts, inward);
    // No building, no wall: a gap nothing fills stays open rather than walled.
    if (!back) continue;
    for (let i = 1; i < run.length; i++)
      kept.push({ x0: run[i - 1]!.x, z0: run[i - 1]!.z, x1: run[i]!.x, z1: run[i]!.z });
    infills.push({
      front: pts,
      back,
      height: neighbourHeight(site, run[0]!, run[run.length - 1]!) ?? 10 + hash(run[0]!, 1) * 4,
      tint: Math.floor(hash(run[0]!, 2) * INFILL_TINTS),
    });
  }
  site.walls.length = 0;
  site.walls.push(...kept);
  return infills;
}

/** The inward normal of the piece from `p` to `q`. */
function normal(p: Pt, q: Pt, inward: 1 | -1): Pt {
  const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
  return { x: ((q.z - p.z) / len) * inward, z: (-(q.x - p.x) / len) * inward };
}

/**
 * The rest of a fitted building's outline behind its front `pts`, or null
 * when nothing fits. Where the fronts' two end normals meet behind it (a
 * curved corner, or an L round a block's corner) the building is a slice:
 * its sides run in from the front's ends to that apex, cut off square if
 * it lies too far back or reaches a street. Otherwise (a straight front,
 * or one bending away from the plot) it is the front offset straight back.
 */
function backOf(site: Site, pts: Pt[], inward: 1 | -1): Pt[] | null {
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const n0 = normal(first, pts[1]!, inward);
  const n1 = normal(pts[pts.length - 2]!, last, inward);
  const clearAll = (cs: Pt[]) => cs.every((c) => site.clear(c.x, c.z, 0.05));
  const along = (a: Pt, b: Pt, k: number): Pt => ({
    x: a.x + (b.x - a.x) * k,
    z: a.z + (b.z - a.z) * k,
  });
  // Where first + t·n0 meets last + u·n1.
  const det = n0.x * -n1.z - n0.z * -n1.x;
  if (Math.abs(det) > 1e-6) {
    const rx = last.x - first.x;
    const rz = last.z - first.z;
    const t = (rx * -n1.z - rz * -n1.x) / det;
    const u = (n0.x * rz - n0.z * rx) / det;
    if (t > 0.5 && u > 0.5) {
      const apex = { x: first.x + n0.x * t, z: first.z + n0.z * t };
      if (t <= MAX_SLICE && u <= MAX_SLICE) {
        const sides = [1 / 3, 2 / 3].flatMap((k) => [along(first, apex, k), along(last, apex, k)]);
        if (clearAll([apex, ...sides])) return [apex];
      }
      // Cut the slice off square, as deep as it stays clear and short of its apex.
      for (const depth of DEPTHS) {
        if (depth >= Math.min(t, u)) continue;
        const a = { x: last.x + n1.x * depth, z: last.z + n1.z * depth };
        const b = { x: first.x + n0.x * depth, z: first.z + n0.z * depth };
        if (clearAll([a, b, along(a, b, 0.5)])) return [a, b];
      }
      return null;
    }
  }
  // Straight or bending away: offset every point straight back (mitred at the bends).
  for (const depth of DEPTHS) {
    const offs = pts.map((p, i) => {
      const a = i > 0 ? normal(pts[i - 1]!, p, inward) : null;
      const b = i < pts.length - 1 ? normal(p, pts[i + 1]!, inward) : null;
      const n = a && b ? { x: a.x + b.x, z: a.z + b.z } : (a ?? b)!;
      const len = Math.hypot(n.x, n.z) || 1;
      const cos = a && b ? Math.max(0.5, (n.x * b.x + n.z * b.z) / len) : 1;
      return { x: p.x + (n.x / len) * (depth / cos), z: p.z + (n.z / len) * (depth / cos) };
    });
    if (clearAll(offs)) return offs.reverse();
  }
  return null;
}

/** How close to a run's end a neighbour must stand to set the fitted building's height. */
const NEIGHBOUR_REACH = 1.2;

/**
 * The eaves height of the lower of the buildings a run's two ends meet, so
 * a fitted building joins its neighbours at their height; null when neither
 * end meets one.
 */
function neighbourHeight(site: Site, a: Pt, b: Pt): number | null {
  const index = buildingIndex(site.buildings);
  let low: number | null = null;
  for (const p of [a, b])
    index.near(p.x, p.z, NEIGHBOUR_REACH, ({ b: n }) => {
      const dx = p.x - n.x;
      const dz = p.z - n.z;
      const u = dx * Math.cos(n.yaw) - dz * Math.sin(n.yaw);
      const v = dx * Math.sin(n.yaw) + dz * Math.cos(n.yaw);
      const eaves = CITY_EAVES[n.style];
      if (eaves && Math.abs(u) <= n.hx + NEIGHBOUR_REACH && Math.abs(v) <= n.hz + NEIGHBOUR_REACH)
        low = low === null ? eaves : Math.min(low, eaves);
    });
  return low;
}
