import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { hashSeed, mulberry32 } from '../rng';
import type { Surface } from '../vehicle/surfaces';
import type { TerrainQuery } from '../vehicle/Terrain';
import { REGIONS } from './regions';
import { createRoadHit } from './RoadPath';
import type { StageDef } from './StageGenerator';
import { onTownStreet, PLATEAU_BLEND, plateauDistance, type TownDef } from './Town';

const FLAT_MARGIN = 3;
const BLEND_WIDTH = 16;
/**
 * The road ribbon is drawn this far above the smoothed road profile; the
 * verge (flat margin) sits at the same level, so ribbon and terrain meet
 * flush at the road edge and wheels roll off without a step.
 */
export const ROAD_LIFT = 0.08;
/**
 * Under the carriageway the terrain bed is sunk this far below the road
 * profile (so `ROAD_LIFT + ROAD_BED_DROP` below the deck), ramping back up to
 * deck level across the road edge (`TRENCH_IN` inside it to `TRENCH_OUT`
 * beyond it, under the road mesh's verge strip). The terrain grid and the
 * ribbon are both straight-line approximations of the same curved profile
 * sampled at different points, so over crests and dips the terrain's chords
 * can bow up through a thin lift; the trench keeps them hidden under the
 * road, while the verge strip (terrain-coloured) hides any seam beyond.
 */
export const ROAD_BED_DROP = 0.25;
const TRENCH_IN = 0.6;
export const TRENCH_OUT = 0.4;
const SMOOTH_WINDOW = 15;
const MAX_GRADE = 0.12;

/** A level pad flattened into the hills (under a house): height `y` within `radius`, blending out over `PAD_BLEND`. */
export interface TerrainPad {
  x: number;
  z: number;
  y: number;
  radius: number;
}
const PAD_BLEND = 3;

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
 * road bed. `sample` is the terrain bed the ground mesh is built from (sunk
 * under the ribbon); `heightAt` is the surface wheels touch: the ribbon deck
 * across the road and verge, blending to the hills beyond.
 */
export class TerrainField implements TerrainQuery {
  private readonly noise: NoiseFunction2D;
  private readonly amplitude: number;
  private readonly frequency: number;
  private readonly roadHeights: Float64Array;
  private readonly hit = createRoadHit();
  private readonly offroad: Surface;
  readonly corridor: number;
  private pads: TerrainPad[] = [];
  private readonly town: TownDef | null;
  /** Plateau height of the town, the mean of the hills over its footprint. */
  readonly townY: number;

  constructor(readonly stage: StageDef) {
    const region = REGIONS[stage.region];
    this.noise = createNoise2D(mulberry32(hashSeed(stage.seed, 'terrain')));
    this.amplitude = region.terrain.amplitude * (1 + 0.15 * Math.min(stage.loop, 4));
    this.frequency = region.terrain.frequency;
    this.offroad = region.offroad;
    this.corridor = stage.halfWidth + FLAT_MARGIN + BLEND_WIDTH;
    this.town = stage.town ?? null;
    this.townY = this.town ? this.plateauHeight(this.town) : 0;
    this.roadHeights = this.buildRoadHeights();
  }

  /**
   * Replace the level pads (set after construction, once scenery is placed,
   * so the road bed built in the constructor is unaffected). Pads sit well
   * clear of the carriageway, so they only ever meet the road's outer blend.
   */
  setPads(pads: readonly TerrainPad[]): void {
    this.pads = [...pads];
  }

  /** The hills alone: noise, before the town plateau, the road bed and any pads. */
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

  /**
   * The ground the road bed and corridor are cut into: the hills, levelled
   * onto the town plateau inside its footprint and blending back to the
   * hills over `PLATEAU_BLEND` beyond it.
   */
  groundHeight(x: number, z: number): number {
    const base = this.baseHeight(x, z);
    if (!this.town) return base;
    const d = plateauDistance(this.town, x, z);
    if (d >= PLATEAU_BLEND) return base;
    return this.townY + (base - this.townY) * smoothstep(0, PLATEAU_BLEND, d);
  }

  /** Mean hill height over the plateau footprint, sampled on a coarse grid. */
  private plateauHeight(town: TownDef): number {
    const sy = Math.sin(town.heading);
    const cy = Math.cos(town.heading);
    let sum = 0;
    let n = 0;
    for (let u = -town.halfU; u <= town.halfU; u += 10) {
      for (let v = -town.halfV; v <= town.halfV; v += 10) {
        sum += this.baseHeight(town.x + u * sy + v * cy, town.z + u * cy - v * sy);
        n++;
      }
    }
    return sum / n;
  }

  /** Flatten the finished height onto any pad covering (x, z); applied last so the road blend cannot tilt a pad. */
  private applyPads(x: number, z: number, h: number): number {
    for (const p of this.pads) {
      const dx = x - p.x;
      const dz = z - p.z;
      const reach = p.radius + PAD_BLEND;
      if (dx * dx + dz * dz >= reach * reach) continue;
      const t = smoothstep(p.radius, reach, Math.hypot(dx, dz));
      h = p.y + (h - p.y) * t;
    }
    return h;
  }

  roadHeightAt(along: number): number {
    const s = this.stage.path.spacing;
    const f = Math.min(Math.max(along / s, 0), this.roadHeights.length - 1.000001);
    const i = Math.floor(f);
    return this.roadHeights[i]! + (this.roadHeights[i + 1]! - this.roadHeights[i]!) * (f - i);
  }

  sample(x: number, z: number, out: TerrainSample): TerrainSample {
    const base = this.groundHeight(x, z);
    if (!this.stage.path.nearest(x, z, this.corridor, this.hit)) {
      out.height = this.applyPads(x, z, base);
      out.roadBlend = 0;
      out.roadDistance = Infinity;
      return out;
    }
    const deck = this.roadHeightAt(this.hit.along) + ROAD_LIFT;
    const hw = this.stage.halfWidth;
    const t = smoothstep(hw + FLAT_MARGIN, this.corridor, this.hit.distance);
    const trench =
      (ROAD_LIFT + ROAD_BED_DROP) *
      (1 - smoothstep(hw - TRENCH_IN, hw + TRENCH_OUT, this.hit.distance));
    out.height = this.applyPads(x, z, deck + (base - deck) * t - trench);
    out.roadBlend = 1 - t;
    out.roadDistance = this.hit.distance;
    return out;
  }

  heightAt(x: number, z: number): number {
    const base = this.groundHeight(x, z);
    const onRoute = this.stage.path.nearest(x, z, this.corridor, this.hit);
    // Side streets are flat plates on the plateau at deck level, like the route beside them.
    if (
      this.town &&
      (!onRoute || this.hit.distance > this.stage.halfWidth) &&
      onTownStreet(this.town, x, z)
    )
      return this.townY + ROAD_LIFT;
    if (!onRoute) return this.applyPads(x, z, base);
    const deck = this.roadHeightAt(this.hit.along) + ROAD_LIFT;
    const hw = this.stage.halfWidth;
    const t = smoothstep(hw + FLAT_MARGIN, this.corridor, this.hit.distance);
    return this.applyPads(x, z, deck + (base - deck) * t);
  }

  /** Town streets are paved whatever the stage surface; the route through the town counts as one of them. */
  surfaceAt(x: number, z: number): Surface {
    const hw = this.stage.halfWidth;
    const town = this.town;
    if (this.stage.path.nearest(x, z, hw, this.hit)) {
      return town && this.hit.along >= town.from && this.hit.along <= town.to
        ? 'tarmac'
        : this.stage.surface;
    }
    if (town && onTownStreet(town, x, z)) return 'tarmac';
    return this.offroad;
  }

  private buildRoadHeights(): Float64Array {
    const { xs, zs, count, spacing } = this.stage.path;
    const raw = new Float64Array(count);
    for (let i = 0; i < count; i++) raw[i] = this.groundHeight(xs[i]!, zs[i]!);
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
    // Inside the town the route is dead level on the plateau; the grade clamps below ramp the approaches.
    if (this.town) {
      const i0 = Math.max(0, Math.ceil(this.town.from / spacing));
      const i1 = Math.min(count - 1, Math.floor(this.town.to / spacing));
      for (let i = i0; i <= i1; i++) a[i] = this.townY;
    }
    const step = MAX_GRADE * spacing;
    for (let i = 1; i < count; i++)
      a[i] = Math.min(a[i - 1]! + step, Math.max(a[i - 1]! - step, a[i]!));
    for (let i = count - 2; i >= 0; i--)
      a[i] = Math.min(a[i + 1]! + step, Math.max(a[i + 1]! - step, a[i]!));
    return a;
  }
}
