import type { RoadPath } from './RoadPath';

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
