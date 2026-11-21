import { hashSeed } from '../rng';

/**
 * Groves: stretches where the road runs into dense forest (the Greenvale's
 * oaks, chestnuts and lindens; the Moorland's spruce plantations), so that now and then a stage
 * plunges through thick woods between its open hillsides. A slow noise along
 * the road, its own per stage, picks them: about `share` of the road, in
 * runs of roughly `length` metres, easing in and out over a few dozen.
 * Pure TS.
 */

export interface GroveDef {
  /** About this share of the road runs through groves. */
  share: number;
  /** Roughly how long a grove (and the open ground between) runs along the road, metres. */
  length: number;
  /** Broadleaves grow this many times as thick by the road in a grove, and this much bigger. */
  boost: number;
  grow: number;
  /** In a grove trees stand this share of their canopies' spacing apart (`SceneryDensity.crowding` elsewhere). */
  crowding: number;
  /** More broadleaves per 100 m of road spread evenly out to `reach` metres from its edge, in a grove only. */
  deep: number;
  reach: number;
  /**
   * What the grove is a wood of: broadleaves (the Greenvale's, when unset) or pines (`tree`
   * props: the Moorland's conifer plantations).
   */
  kind?: 'broadleaf' | 'tree';
}

/** A grove fades in and out over this share of the noise's range. */
const EDGE = 0.08;

function hash01(k: number, salt: number): number {
  let h = Math.imul(k ^ salt, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** A stage's groves: how deep in one the road is at distance `d` (0 open ground, 1 thick forest). */
export function groves(seed: number, def: GroveDef): (d: number) => number {
  const salt = hashSeed(seed, 'groves');
  const cut = 1 - def.share;
  return (d) => {
    // Value noise on knots `length` apart, smoothed: runs of grove and open ground of about that length.
    const t = d / def.length;
    const k = Math.floor(t);
    const f = t - k;
    const a = hash01(k, salt);
    const n = a + (hash01(k + 1, salt) - a) * (f * f * (3 - 2 * f));
    return smoothstep(cut - EDGE, cut + EDGE, n);
  };
}
