/**
 * A straight tram line through a city (see `UrbanGenerator`): two rails a
 * standard gauge apart set flush in the tarmac, across the route at a
 * crossroads or down the middle of a boulevard. The rails are drawn by
 * `TramTrackBuilder` and felt by the wheels through `tramLift`: a two
 * centimetre ridge on each rail, grip unchanged.
 */
export interface TramLine {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Standard gauge, rail to rail. */
export const TRAM_GAUGE = 1.435;
/** Height of the rail's head over the tarmac, what a wheel feels crossing it. */
export const RAIL_LIFT = 0.02;
/** Half width of the felt ridge: wider than the rail (0.08 m) so a wheel sampled at 120 Hz cannot step over it unnoticed. */
export const RAIL_FELT = 0.15;
/** The paved strip between and beside the rails. */
export const TRAM_BED_HALF = 1.3;
/** The overhead contact wire's height over the rail heads: the pantograph's strips ride its underside there. */
export const TRAM_WIRE_HEIGHT = 5.15;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * How far (x, z) stands above the deck because of tram rails: `RAIL_LIFT` on a
 * rail head, easing to nothing `RAIL_FELT` from its centre. A bounding box per
 * line rejects almost every query before the projection.
 */
export function tramLift(trams: readonly TramLine[], x: number, z: number): number {
  let lift = 0;
  for (const t of trams) {
    const pad = TRAM_GAUGE / 2 + RAIL_FELT;
    if (
      x < Math.min(t.x0, t.x1) - pad ||
      x > Math.max(t.x0, t.x1) + pad ||
      z < Math.min(t.z0, t.z1) - pad ||
      z > Math.max(t.z0, t.z1) + pad
    )
      continue;
    const dx = t.x1 - t.x0;
    const dz = t.z1 - t.z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const u = ((x - t.x0) * dx + (z - t.z0) * dz) / len;
    if (u < 0 || u > len) continue;
    const lateral = Math.abs(((x - t.x0) * dz - (z - t.z0) * dx) / len);
    const d = Math.abs(lateral - TRAM_GAUGE / 2);
    lift = Math.max(lift, RAIL_LIFT * (1 - smoothstep(0.05, RAIL_FELT, d)));
  }
  return lift;
}
