import { hashSeed, mulberry32 } from '../rng';
import type { RoadGround } from './RoadDips';
import { roadLowPoints } from './RoadDips';

/**
 * Watersplashes: shallow fords of standing water right across the road, in
 * its dips, the Moorland's signature (the Welsh forests' "watersplash"). The
 * stage's brief draws how many (`splashCount`, from the seed alone, so par
 * can allow for them); the terrain lays them on the finished road profile
 * (`planSplashes`), the deepest dips first, so water lies where it would.
 * A car in one wades: the `water` surface's drag and grip. Pure TS.
 */

export interface SplashStyle {
  /** Fewest and most splashes a stage, inclusive. */
  count: readonly [number, number];
  /** Shortest and longest splash along the road, metres. */
  length: readonly [number, number];
  /** The water's colour where it differs from the Moorland's grey (the Savanna's muddy red-brown). */
  water?: string;
}

export interface Watersplash {
  /** The dip's road distance, and the water's ends along the road. */
  along: number;
  from: number;
  to: number;
}

/** Splashes keep this far apart along the road, metres (a little closer for the fallback picks). */
const APART = 150;
const FALLBACK_APART = 110;
/** Nor within this far of the start or finish line, a checkpoint gate or a town. */
const ENDS = 120;
const GATE_GAP = 50;
/** Most the road may turn over a splash and this far either side, radians: each is seen on the approach. */
const TURN_LIMIT = 0.55;
const SIGHT = 25;
/** Seconds a decent run gives up wading each splash (par allowance). */
export const SPLASH_PAR_SECONDS = 0.6;

/** How many splashes a stage has: drawn on its own stream, from the seed alone. */
export function splashCount(seed: number, style: SplashStyle): number {
  const rand = mulberry32(hashSeed(seed, 'splash-count'));
  const [lo, hi] = style.count;
  return lo + Math.floor(rand() * (hi - lo + 1));
}

/** How far the road's heading turns between `a` and `b` metres along it. */
function turnBetween(ground: RoadGround, a: number, b: number): number {
  const sample = { x: 0, z: 0, heading: 0 };
  let total = 0;
  let prev: number | null = null;
  for (let d = a; d <= b; d += 5) {
    ground.stage.path.sample(d, sample);
    if (prev !== null)
      total += Math.abs(
        Math.atan2(Math.sin(sample.heading - prev), Math.cos(sample.heading - prev)),
      );
    prev = sample.heading;
  }
  return total;
}

/** The stage's splashes, `count` of them where the road allows, ordered along it. */
export function planSplashes(ground: RoadGround, style: SplashStyle, count: number): Watersplash[] {
  const rand = mulberry32(hashSeed(ground.stage.seed, 'splashes'));
  const { dips, rest } = roadLowPoints(ground, { ends: ENDS, gateGap: GATE_GAP, townGap: 150 });
  const splashes: Watersplash[] = [];
  // The dips first, then the lowest of the rest; on a road too twisty to see them coming, any
  // allowed spot, so a stage always has its count.
  for (const [list, apart, sighted] of [
    [dips, APART, true],
    [rest, FALLBACK_APART, true],
    [rest, FALLBACK_APART, false],
  ] as const) {
    for (const along of list) {
      if (splashes.length >= count) break;
      if (splashes.some((s) => Math.abs(s.along - along) < apart)) continue;
      const [lo, hi] = style.length;
      const length = lo + rand() * (hi - lo);
      if (
        sighted &&
        turnBetween(ground, along - length / 2 - SIGHT, along + length / 2 + SIGHT) > TURN_LIMIT
      )
        continue;
      splashes.push({ along, from: along - length / 2, to: along + length / 2 });
    }
  }
  return splashes.sort((a, b) => a.along - b.along);
}

/** The splash at road distance `along`, if any (a handful a stage: a plain scan). */
export function splashAt(splashes: readonly Watersplash[], along: number): Watersplash | null {
  for (const s of splashes) if (along >= s.from && along <= s.to) return s;
  return null;
}
