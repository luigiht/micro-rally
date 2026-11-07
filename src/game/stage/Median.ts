import { KERB_LIFT, KERB_RAMP } from './Town';

/**
 * A kerbed green divider down the middle of a city boulevard (see
 * `UrbanGenerator.cityMedians`): a straight strip of grass between two
 * narrow sidewalks, a kerb high, rounded at both ends (a capsule of
 * `MEDIAN_HALF` radius about the segment), broken for every junction. Drawn
 * by `MedianBuilder`, felt by the wheels through `medianLift`.
 */
export interface Median {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Half width of the whole divider, kerb to kerb. */
export const MEDIAN_HALF = 0.9;
/** The sidewalk strip along each edge of the divider's top; grass between. */
export const MEDIAN_WALK = 0.35;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** How far (x, z) stands above the deck because of a median: a kerb's lift on it (a capsule about its axis, so the ends are round), climbed over `KERB_RAMP` at its edges. */
export function medianLift(medians: readonly Median[], x: number, z: number): number {
  for (const m of medians) {
    const pad = MEDIAN_HALF + KERB_RAMP;
    if (
      x < Math.min(m.x0, m.x1) - pad ||
      x > Math.max(m.x0, m.x1) + pad ||
      z < Math.min(m.z0, m.z1) - pad ||
      z > Math.max(m.z0, m.z1) + pad
    )
      continue;
    const dx = m.x1 - m.x0;
    const dz = m.z1 - m.z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    let u = ((x - m.x0) * dx + (z - m.z0) * dz) / len;
    u = u < 0 ? 0 : u > len ? len : u;
    const px = m.x0 + (dx / len) * u;
    const pz = m.z0 + (dz / len) * u;
    const d = Math.hypot(x - px, z - pz);
    if (d >= MEDIAN_HALF + KERB_RAMP) continue;
    return KERB_LIFT * (1 - smoothstep(MEDIAN_HALF, MEDIAN_HALF + KERB_RAMP, d));
  }
  return 0;
}

/** Whether a point on the route at path distance `along` (the centreline) lies on a median: for the lane markings to skip their centre line. */
export function onMedian(medians: readonly Median[], x: number, z: number): boolean {
  return medianLift(medians, x, z) > KERB_LIFT * 0.5;
}
