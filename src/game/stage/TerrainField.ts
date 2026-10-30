import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { hashSeed, mulberry32 } from '../rng';
import type { Surface } from '../vehicle/surfaces';
import type { TerrainQuery } from '../vehicle/Terrain';
import { REGIONS } from './regions';
import { createRoadHit } from './RoadPath';
import type { StageDef } from './StageGenerator';

const FLAT_MARGIN = 2.5;
const BLEND_WIDTH = 16;
/** The road ribbon is drawn this far above the terrain bed; wheels rest on the ribbon, not the bed. */
export const ROAD_LIFT = 0.08;
/** Half-width of the blend from ribbon height down to the bed, centred on the road edge. */
const ROAD_EDGE = 0.3;
const SMOOTH_WINDOW = 15;
const MAX_GRADE = 0.12;

export interface TerrainSample {
  height: number;
  /** 0 = untouched terrain, 1 = on the road bed. */
  roadBlend: number;
  /** Unsigned distance to the road centreline (Infinity when far). */
  roadDistance: number;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Simplex hills with the road corridor flattened onto a smoothed, grade-limited
 * road bed. `sample` is the terrain bed the ground mesh is built from;
 * `heightAt` is the surface wheels touch, which adds the road ribbon's lift
 * across the carriageway.
 */
export class TerrainField implements TerrainQuery {
  private readonly noise: NoiseFunction2D;
  private readonly amplitude: number;
  private readonly frequency: number;
  private readonly roadHeights: Float64Array;
  private readonly hit = createRoadHit();
  private readonly offroad: Surface;
  readonly corridor: number;

  constructor(readonly stage: StageDef) {
    const region = REGIONS[stage.region];
    this.noise = createNoise2D(mulberry32(hashSeed(stage.seed, 'terrain')));
    this.amplitude = region.terrain.amplitude * (1 + 0.15 * Math.min(stage.loop, 4));
    this.frequency = region.terrain.frequency;
    this.offroad = region.offroad;
    this.corridor = stage.halfWidth + FLAT_MARGIN + BLEND_WIDTH;
    this.roadHeights = this.buildRoadHeights();
  }

  baseHeight(x: number, z: number): number {
    const f = this.frequency;
    const n = this.noise;
    return (
      this.amplitude *
      (0.55 * n(x * f, z * f) +
        0.3 * n(x * f * 0.37 + 17.1, z * f * 0.37 - 4.3) +
        0.11 * n(x * f * 2.3, z * f * 2.3) +
        0.04 * n(x * f * 5.1, z * f * 5.1))
    );
  }

  roadHeightAt(along: number): number {
    const s = this.stage.path.spacing;
    const f = Math.min(Math.max(along / s, 0), this.roadHeights.length - 1.000001);
    const i = Math.floor(f);
    return this.roadHeights[i]! + (this.roadHeights[i + 1]! - this.roadHeights[i]!) * (f - i);
  }

  sample(x: number, z: number, out: TerrainSample): TerrainSample {
    const base = this.baseHeight(x, z);
    if (!this.stage.path.nearest(x, z, this.corridor, this.hit)) {
      out.height = base;
      out.roadBlend = 0;
      out.roadDistance = Infinity;
      return out;
    }
    const road = this.roadHeightAt(this.hit.along);
    const hw = this.stage.halfWidth;
    const t = smoothstep(hw + FLAT_MARGIN, this.corridor, this.hit.distance);
    out.height = road + (base - road) * t;
    out.roadBlend = 1 - t;
    out.roadDistance = this.hit.distance;
    return out;
  }

  heightAt(x: number, z: number): number {
    const base = this.baseHeight(x, z);
    if (!this.stage.path.nearest(x, z, this.corridor, this.hit)) return base;
    const road = this.roadHeightAt(this.hit.along);
    const hw = this.stage.halfWidth;
    const t = smoothstep(hw + FLAT_MARGIN, this.corridor, this.hit.distance);
    const ribbon = 1 - smoothstep(hw - ROAD_EDGE, hw + ROAD_EDGE, this.hit.distance);
    return road + (base - road) * t + ROAD_LIFT * ribbon;
  }

  surfaceAt(x: number, z: number): Surface {
    const hw = this.stage.halfWidth;
    return this.stage.path.nearest(x, z, hw, this.hit) ? this.stage.surface : this.offroad;
  }

  private buildRoadHeights(): Float64Array {
    const { xs, zs, count, spacing } = this.stage.path;
    const raw = new Float64Array(count);
    for (let i = 0; i < count; i++) raw[i] = this.baseHeight(xs[i]!, zs[i]!);
    // Two box-filter passes ≈ gaussian smoothing along the road.
    let a = raw;
    for (let pass = 0; pass < 2; pass++) {
      const b = new Float64Array(count);
      for (let i = 0; i < count; i++) {
        let sum = 0;
        let n = 0;
        for (let k = i - SMOOTH_WINDOW; k <= i + SMOOTH_WINDOW; k++) {
          if (k >= 0 && k < count) {
            sum += a[k]!;
            n++;
          }
        }
        b[i] = sum / n;
      }
      a = b;
    }
    const step = MAX_GRADE * spacing;
    for (let i = 1; i < count; i++)
      a[i] = Math.min(a[i - 1]! + step, Math.max(a[i - 1]! - step, a[i]!));
    for (let i = count - 2; i >= 0; i--)
      a[i] = Math.min(a[i + 1]! + step, Math.max(a[i + 1]! - step, a[i]!));
    return a;
  }
}
