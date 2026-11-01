import { createRoadHit, type RoadPath } from './RoadPath';
import type { TownDef } from './Town';

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

/** Per-sample half widths when any route street is narrower than the stage road; undefined when none is. */
export function buildWidths(path: RoadPath, town: TownDef, base: number): Float64Array | undefined {
  const narrow = town.streets.filter((s) => s.route && s.halfWidth < base - 1e-6);
  if (narrow.length === 0) return undefined;
  const w = new Float64Array(path.count).fill(base);
  const hit = createRoadHit();
  for (const s of narrow) {
    path.nearest(s.x0, s.z0, 30, hit);
    const a0 = hit.along;
    path.nearest(s.x1, s.z1, 30, hit);
    const a1 = hit.along;
    const lo = Math.min(a0, a1);
    const hi = Math.max(a0, a1);
    for (let i = 0; i < path.count; i++) {
      const d = i * path.spacing;
      const out = d < lo ? lo - d : d > hi ? d - hi : 0;
      const t = Math.min(1, out / WIDTH_TAPER);
      w[i] = Math.min(w[i]!, s.halfWidth + (base - s.halfWidth) * t);
    }
  }
  return w;
}
