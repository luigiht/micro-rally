import { createRoadHit, type RoadPath } from './RoadPath';
import type { TownDef } from './Town';
import { tangentLength } from './TownPlan';

/** Narrow streets widen back to the stage road over this distance beyond their ends. */
const WIDTH_TAPER = 24;

/** The fields of a stage that decide how wide the carriageway is at a point along it. */
export interface RoadWidthSource {
  halfWidth: number;
  /** Half width per path sample where it varies (narrow town streets); absent when constant. */
  widths?: Float64Array;
  path: RoadPath;
}

/** Half width of the carriageway at a distance along the road. */
export function halfWidthAt(stage: RoadWidthSource, along: number): number {
  const w = stage.widths;
  if (!w) return stage.halfWidth;
  const f = Math.min(Math.max(along / stage.path.spacing, 0), w.length - 1.000001);
  const i = Math.floor(f);
  return w[i]! + (w[i + 1]! - w[i]!) * (f - i);
}

/** A junction holds the carriageway at its own width this far beyond its arcs' tangents, past where the ribbon hands over. */
const JUNCTION_HOLD = 4;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Per-sample half widths when any route street is narrower than the stage
 * road; undefined when none is. Each narrow street holds its width along its
 * length and widens back to the stage road over `WIDTH_TAPER` beyond each
 * end. A junction between a wide and a narrow leg holds the narrow width
 * right through, from one arc tangent to the other and a little beyond, so
 * its side streets and kerbs meet a ribbon of one width.
 */
export function buildWidths(
  path: RoadPath,
  town: Pick<TownDef, 'streets' | 'junctions'>,
  base: number,
): Float64Array | undefined {
  const hit = createRoadHit();
  const ranges: { lo: number; hi: number; hw: number }[] = [];
  for (const s of town.streets) {
    if (!s.route || s.halfWidth >= base - 1e-6) continue;
    path.nearest(s.x0, s.z0, 30, hit);
    const a0 = hit.along;
    path.nearest(s.x1, s.z1, 30, hit);
    const a1 = hit.along;
    ranges.push({ lo: Math.min(a0, a1), hi: Math.max(a0, a1), hw: s.halfWidth });
  }
  for (const j of town.junctions) {
    const blocked = j.arms.filter((a) => a.role === 'blocked');
    const inArm = j.arms.find((a) => a.role === 'in');
    const outArm = j.arms.find((a) => a.role === 'out');
    if (blocked.length === 0 || !inArm || !outArm) continue;
    const hw = Math.min(...blocked.map((a) => a.halfWidth));
    if (hw >= base - 1e-6) continue;
    path.nearest(j.x, j.z, 60, hit);
    const hold = tangentLength(wrap(outArm.heading - (inArm.heading + Math.PI))) + JUNCTION_HOLD;
    ranges.push({ lo: hit.along - hold, hi: hit.along + hold, hw });
  }
  if (ranges.length === 0) return undefined;
  const w = new Float64Array(path.count).fill(base);
  for (const r of ranges) {
    for (let i = 0; i < path.count; i++) {
      const d = i * path.spacing;
      const out = d < r.lo ? r.lo - d : d > r.hi ? d - r.hi : 0;
      const t = Math.min(1, out / WIDTH_TAPER);
      w[i] = Math.min(w[i]!, r.hw + (base - r.hw) * t);
    }
  }
  return w;
}
