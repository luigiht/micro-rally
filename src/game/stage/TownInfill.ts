import { CITY_EAVES } from './BuildingCatalog';
import { buildingIndex } from './BuildingIndex';
import type { Wall } from './Town';
import { isSimple, overlaps } from './Footprints';
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
  /** Street doors on its front: where each stands and the way it faces (unit, toward the street). */
  doors?: { x: number; z: number; nx: number; nz: number }[];
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
    const offs = offsetBack(pts, inward, depth);
    if (clearAll(offs)) return offs.reverse();
  }
  return null;
}

/** The front `pts` offset `depth` toward the plot, mitred at the bends, in the front's order. */
function offsetBack(pts: Pt[], inward: 1 | -1, depth: number): Pt[] {
  return pts.map((p, i) => {
    const a = i > 0 ? normal(pts[i - 1]!, p, inward) : null;
    const b = i < pts.length - 1 ? normal(p, pts[i + 1]!, inward) : null;
    const n = a && b ? { x: a.x + b.x, z: a.z + b.z } : (a ?? b)!;
    const len = Math.hypot(n.x, n.z) || 1;
    const cos = a && b ? Math.max(0.5, (n.x * b.x + n.z * b.z) / len) : 1;
    return { x: p.x + (n.x / len) * (depth / cos), z: p.z + (n.z / len) * (depth / cos) };
  });
}

/** A lot's building is this deep where it stays clear, else the next of `DEPTHS`, else `SHELL_DEPTH`. */
const SHELL_DEPTH = 1;
/** A street face this long gets its own door; a shorter front gets one in its middle. */
const DOOR_FACE = 5;
/** A front turning more than this at a vertex starts a new street face. */
const FACE_TURN = (25 * Math.PI) / 180;

/**
 * The building of one city lot (`CityFrontageFill`): its front is the lot's
 * stretch of frontage (in order, the plot on its left), its back the front
 * offset straight back (mitred round a corner) as deep as `maxDepth` allows
 * while every back point stays behind every pavement, a shell `SHELL_DEPTH`
 * deep where nothing deeper does. Its sides are the lot's own cuts, square to
 * the front, so it meets its neighbours without crossing them. A door stands
 * in the middle of each street face (each run of the front between turns),
 * and its front is laid as walls, its collider.
 */
export function fitLot(
  site: Site,
  front: readonly Pt[],
  maxDepth: number,
  placed: readonly Infill[],
): Infill {
  const pts = front.map((p) => ({ x: p.x, z: p.z }));
  const index = buildingIndex(site.buildings);
  // Clear of every pavement, unfolded (a front turning hard folds a deep offset over itself),
  // and clear of every building standing, catalog or fitted.
  const stands = (back: Pt[]) => {
    if (!back.every((c) => site.clear(c.x, c.z, 0.05))) return false;
    const outline = [...pts, ...back];
    if (!isSimple(outline)) return false;
    const cx = outline.reduce((s, p) => s + p.x, 0) / outline.length;
    const cz = outline.reduce((s, p) => s + p.z, 0) / outline.length;
    const reach = Math.max(...outline.map((p) => Math.hypot(p.x - cx, p.z - cz)));
    const hitsBuilding = index.near(cx, cz, reach, ({ corners }) =>
      overlaps(
        outline,
        [0, 1, 3, 2].map((i) => ({ x: corners[i]![0], z: corners[i]![1] })),
      ),
    );
    return !hitsBuilding && !placed.some((o) => overlaps(outline, [...o.front, ...o.back]));
  };
  let back: Pt[] | null = null;
  for (const depth of [...DEPTHS, SHELL_DEPTH]) {
    if (depth > maxDepth) continue;
    const offs = offsetBack(pts, 1, depth).reverse();
    if (stands(offs)) {
      back = offs;
      break;
    }
  }
  back ??= offsetBack(pts, 1, SHELL_DEPTH).reverse();
  for (let i = 1; i < pts.length; i++)
    site.walls.push({ x0: pts[i - 1]!.x, z0: pts[i - 1]!.z, x1: pts[i]!.x, z1: pts[i]!.z });
  const first = pts[0]!;
  return {
    front: pts,
    back,
    height: neighbourHeight(site, first, pts[pts.length - 1]!) ?? 10 + hash(first, 1) * 4,
    tint: Math.floor(hash(first, 2) * INFILL_TINTS),
    doors: doorsOf(pts),
  };
}

/** A door in the middle of each street face of a front with its plot on the left; one in the middle when no face is long enough. */
function doorsOf(pts: readonly Pt[]): NonNullable<Infill['doors']> {
  const faces: Pt[][] = [[pts[0]!]];
  for (let i = 1; i < pts.length; i++) {
    faces[faces.length - 1]!.push(pts[i]!);
    if (i < pts.length - 1) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const c = pts[i + 1]!;
      const d = Math.atan2(c.x - b.x, c.z - b.z) - Math.atan2(b.x - a.x, b.z - a.z);
      if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) > FACE_TURN) faces.push([b]);
    }
  }
  const middle = (face: readonly Pt[], length: number) => {
    let run = 0;
    for (let i = 1; i < face.length; i++) {
      const p = face[i - 1]!;
      const q = face[i]!;
      const len = Math.hypot(q.x - p.x, q.z - p.z);
      if (run + len >= length / 2 && len > 0) {
        const t = (length / 2 - run) / len;
        // The plot lies left of the front; the street, right: (−dz, dx) per unit length.
        return {
          x: p.x + (q.x - p.x) * t,
          z: p.z + (q.z - p.z) * t,
          nx: -(q.z - p.z) / len,
          nz: (q.x - p.x) / len,
        };
      }
      run += len;
    }
    return null;
  };
  const lengthOf = (face: readonly Pt[]) => {
    let len = 0;
    for (let i = 1; i < face.length; i++)
      len += Math.hypot(face[i]!.x - face[i - 1]!.x, face[i]!.z - face[i - 1]!.z);
    return len;
  };
  const doors = faces
    .filter((f) => lengthOf(f) >= DOOR_FACE)
    .map((f) => middle(f, lengthOf(f)))
    .filter((d): d is NonNullable<typeof d> => d !== null);
  if (doors.length > 0) return doors;
  const whole = middle(pts, lengthOf(pts));
  return whole ? [whole] : [];
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
