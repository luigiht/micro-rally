import { hashSeed, mulberry32 } from '../rng';
import { createRoadHit, type RoadSample } from './RoadPath';
import type { StageDef } from './StageGenerator';

/**
 * Volcanic cones on the horizon (the Savanna's): two or three broad, steep
 * hills standing far off the road, so they rise out of the haze as the stage
 * winds across the plain. Each is a rounded cone with a shallow crater, laid
 * over the ground's own relief; none comes within its foot of any stretch of
 * road, so the road's profile never feels them. Pure TS.
 */

export interface ConeStyle {
  count: readonly [number, number];
  distance: readonly [number, number];
  height: readonly [number, number];
  radius: readonly [number, number];
}

export interface Cone {
  x: number;
  z: number;
  height: number;
  radius: number;
}

/** Tries per cone before the stage settles for fewer. */
const TRIES = 40;
/** The crater: its rim this share of the radius out, this share of the height deep. */
const CRATER = 0.12;
const CRATER_DEPTH = 0.08;

const lerp = (r: readonly [number, number], t: number) => r[0] + (r[1] - r[0]) * t;

export function planCones(stage: StageDef, style: ConeStyle): Cone[] {
  const rand = mulberry32(hashSeed(stage.seed, 'cones'));
  const n = Math.round(lerp(style.count, rand()));
  const hit = createRoadHit();
  const s: RoadSample = { x: 0, z: 0, heading: 0 };
  const cones: Cone[] = [];
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < TRIES; t++) {
      // From a point along the road, out to one side.
      stage.path.sample(rand() * stage.path.length, s);
      const side = rand() < 0.5 ? -1 : 1;
      const out = lerp(style.distance, rand());
      const radius = lerp(style.radius, rand());
      const height = lerp(style.height, rand());
      const x = s.x + Math.cos(s.heading) * out * side;
      const z = s.z - Math.sin(s.heading) * out * side;
      // The whole foot clear of every stretch of road, and of the cones already laid.
      if (stage.path.nearest(x, z, radius + 40, hit)) continue;
      if (cones.some((c) => Math.hypot(c.x - x, c.z - z) < c.radius + radius)) continue;
      cones.push({ x, z, height, radius });
      break;
    }
  }
  return cones;
}

/** The cones' lift at (x, z): a rounded cone with a small crater at its top. */
export function coneHeight(cones: readonly Cone[], x: number, z: number): number {
  let h = 0;
  for (const c of cones) {
    const r = Math.hypot(x - c.x, z - c.z) / c.radius;
    if (r >= 1) continue;
    // Steep flanks easing out into the plain at the foot.
    const body = (1 - r) ** 1.6 * (1 - 0.25 * (1 - r) ** 4);
    const crater = r < CRATER ? CRATER_DEPTH * (1 - (r / CRATER) ** 2) : 0;
    h = Math.max(h, c.height * (body - crater));
  }
  return h;
}
