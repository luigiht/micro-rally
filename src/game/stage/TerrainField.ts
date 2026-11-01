import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { hashSeed, mulberry32 } from '../rng';
import type { Surface } from '../vehicle/surfaces';
import type { TerrainQuery } from '../vehicle/Terrain';
import { REGIONS } from './regions';
import { createRoadHit } from './RoadPath';
import { halfWidthAt } from './RoadWidth';
import type { StageDef } from './StageGenerator';
import { JUNCTION_REACH, PLATEAU_BLEND, plateauDistance, type TownDef } from './Town';

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
/**
 * Inside a town the hills keep a share of their relief, so streets climb and
 * dip and buildings step down the slope: enough that the tamed hills swing
 * about `TOWN_RELIEF_METRES` either side of the town's reference height,
 * capped at `TOWN_RELIEF_MAX` of the region's amplitude.
 */
export const TOWN_RELIEF_METRES = 8;
export const TOWN_RELIEF_MAX = 0.4;
/** Side streets climb no faster than this, beyond the junction zone where they follow the route's deck. */
const STUB_GRADE = 0.08;

/**
 * A blocked side street's deck: the route's own deck through the junction
 * zone, then a straight climb from the deck at the zone's end (`yZone`)
 * toward the ground at the stub's end (`y1`).
 */
interface StubDeck {
  x0: number;
  z0: number;
  dx: number;
  dz: number;
  len: number;
  hw: number;
  yZone: number;
  y1: number;
}

interface StreetHit {
  deck: number;
  distance: number;
  hw: number;
}

/**
 * A level pad flattened into the hills: height `y` within `radius` of (x, z)
 * (a house), or within an oriented rectangle of half extents `hx`/`hz` at
 * `yaw` (a town building's terrace); blending out over `blend` (`PAD_BLEND`
 * by default) beyond the edge.
 */
export interface TerrainPad {
  x: number;
  z: number;
  y: number;
  radius: number;
  hx?: number;
  hz?: number;
  yaw?: number;
  blend?: number;
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
  /** Reference height of the town: the mean of the hills over its footprint, which its relief is tamed around. */
  readonly townY: number;
  /** Share of the hills' relief kept inside the town. */
  readonly townRelief: number;
  private readonly stubs: StubDeck[];
  private readonly street: StreetHit = { deck: 0, distance: Infinity, hw: 0 };
  private readonly stubScratch: StreetHit = { deck: 0, distance: Infinity, hw: 0 };

  constructor(readonly stage: StageDef) {
    const region = REGIONS[stage.region];
    this.noise = createNoise2D(mulberry32(hashSeed(stage.seed, 'terrain')));
    this.amplitude = region.terrain.amplitude * (1 + 0.15 * Math.min(stage.loop, 4));
    this.frequency = region.terrain.frequency;
    this.offroad = region.offroad;
    this.corridor = stage.halfWidth + FLAT_MARGIN + BLEND_WIDTH;
    this.town = stage.town ?? null;
    this.townY = this.town ? this.plateauHeight(this.town) : 0;
    this.townRelief = Math.min(TOWN_RELIEF_MAX, TOWN_RELIEF_METRES / this.amplitude);
    this.roadHeights = this.buildRoadHeights();
    this.stubs = this.town ? this.buildStubs(this.town) : [];
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
   * The ground the road bed and corridor are cut into: the hills, with their
   * relief tamed to `TOWN_RELIEF` around the town's reference height inside
   * its footprint and blending back to full relief over `PLATEAU_BLEND`.
   */
  groundHeight(x: number, z: number): number {
    const base = this.baseHeight(x, z);
    if (!this.town) return base;
    const d = plateauDistance(this.town, x, z);
    if (d >= PLATEAU_BLEND) return base;
    const tamed = this.townY + (base - this.townY) * this.townRelief;
    return tamed + (base - tamed) * smoothstep(0, PLATEAU_BLEND, d);
  }

  /** Side streets start at the route's height and follow the ground outward, no steeper than the road. */
  private buildStubs(town: TownDef): StubDeck[] {
    const out: StubDeck[] = [];
    for (const s of town.streets) {
      if (s.route) continue;
      const dx = s.x1 - s.x0;
      const dz = s.z1 - s.z0;
      const len = Math.hypot(dx, dz);
      const zoneEnd = Math.min(len, s.halfWidth + JUNCTION_REACH);
      const zx = s.x0 + (dx / len) * zoneEnd;
      const zz = s.z0 + (dz / len) * zoneEnd;
      const yZone = this.stage.path.nearest(zx, zz, this.corridor, this.hit)
        ? this.roadHeightAt(this.hit.along)
        : this.groundHeight(zx, zz);
      const end = this.groundHeight(s.x1, s.z1);
      const climb = Math.max(0, len - zoneEnd);
      const rise = Math.max(-climb * STUB_GRADE, Math.min(climb * STUB_GRADE, end - yZone));
      out.push({ x0: s.x0, z0: s.z0, dx, dz, len, hw: s.halfWidth, yZone, y1: yZone + rise });
    }
    return out;
  }

  /**
   * Nearest side street to (x, z) by distance beyond its edge; false when the
   * town has none in reach. `routeDeck` is the route's deck at this point when
   * the route is in reach: within the junction zone the stub follows it, so
   * plates and the ribbon meet without a step; beyond, it climbs on its own.
   */
  private stubHit(x: number, z: number, routeDeck: number | null, out: StreetHit): boolean {
    let best = Infinity;
    let found = false;
    for (const s of this.stubs) {
      const len2 = s.len * s.len;
      let t = len2 > 0 ? ((x - s.x0) * s.dx + (z - s.z0) * s.dz) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const distance = Math.hypot(x - (s.x0 + s.dx * t), z - (s.z0 + s.dz * t));
      if (distance - s.hw >= best) continue;
      best = distance - s.hw;
      found = true;
      const zone = (s.hw + JUNCTION_REACH) / s.len;
      if (t <= zone && routeDeck !== null) out.deck = routeDeck;
      else {
        const ramp = zone >= 1 ? 0 : Math.max(0, (t - zone) / (1 - zone));
        out.deck = s.yZone + (s.y1 - s.yZone) * ramp;
      }
      out.distance = distance;
      out.hw = s.hw;
    }
    return found;
  }

  /**
   * The street nearest (x, z), route or side street, as deck height (road
   * profile, before the lift), distance to its centreline and half width.
   * False when no street is within the corridor.
   */
  private nearestStreet(x: number, z: number, out: StreetHit): boolean {
    let found = false;
    if (this.stage.path.nearest(x, z, this.corridor, this.hit)) {
      out.hw = halfWidthAt(this.stage, this.hit.along);
      out.deck = this.roadHeightAt(this.hit.along);
      out.distance = this.hit.distance;
      found = true;
    }
    if (this.stubs.length > 0 && plateauDistance(this.town!, x, z) < this.corridor) {
      const s = this.stubScratch;
      if (
        this.stubHit(x, z, found ? out.deck : null, s) &&
        (!found || s.distance - s.hw < out.distance - out.hw)
      ) {
        out.deck = s.deck;
        out.distance = s.distance;
        out.hw = s.hw;
        found = true;
      }
    }
    return found;
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
      const blend = p.blend ?? PAD_BLEND;
      const reach = p.radius + blend;
      if (dx * dx + dz * dz >= reach * reach) continue;
      let edge: number;
      if (p.hx !== undefined && p.hz !== undefined) {
        // Distance beyond the rectangle's edge in its own frame (left axis (cos, -sin), forward (sin, cos)).
        const yaw = p.yaw ?? 0;
        const u = dx * Math.cos(yaw) - dz * Math.sin(yaw);
        const v = dx * Math.sin(yaw) + dz * Math.cos(yaw);
        edge = Math.hypot(Math.max(0, Math.abs(u) - p.hx), Math.max(0, Math.abs(v) - p.hz));
      } else {
        edge = Math.max(0, Math.hypot(dx, dz) - p.radius);
      }
      const t = smoothstep(0, blend, edge);
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
    const st = this.street;
    if (!this.nearestStreet(x, z, st)) {
      out.height = this.applyPads(x, z, base);
      out.roadBlend = 0;
      out.roadDistance = Infinity;
      return out;
    }
    const deck = st.deck + ROAD_LIFT;
    const hw = st.hw;
    const t = smoothstep(hw + FLAT_MARGIN, hw + FLAT_MARGIN + BLEND_WIDTH, st.distance);
    const trench =
      (ROAD_LIFT + ROAD_BED_DROP) * (1 - smoothstep(hw - TRENCH_IN, hw + TRENCH_OUT, st.distance));
    out.height = this.applyPads(x, z, deck + (base - deck) * t - trench);
    out.roadBlend = 1 - t;
    out.roadDistance = st.distance;
    return out;
  }

  heightAt(x: number, z: number): number {
    const base = this.groundHeight(x, z);
    const st = this.street;
    if (!this.nearestStreet(x, z, st)) return this.applyPads(x, z, base);
    const deck = st.deck + ROAD_LIFT;
    const t = smoothstep(st.hw + FLAT_MARGIN, st.hw + FLAT_MARGIN + BLEND_WIDTH, st.distance);
    return this.applyPads(x, z, deck + (base - deck) * t);
  }

  /** Town streets are paved whatever the stage surface; the route through the town counts as one of them. */
  surfaceAt(x: number, z: number): Surface {
    const town = this.town;
    if (
      this.stage.path.nearest(x, z, this.stage.halfWidth, this.hit) &&
      this.hit.distance <= halfWidthAt(this.stage, this.hit.along)
    ) {
      return town && this.hit.along >= town.from && this.hit.along <= town.to
        ? 'tarmac'
        : this.stage.surface;
    }
    if (
      this.stubs.length > 0 &&
      this.stubHit(x, z, null, this.stubScratch) &&
      this.stubScratch.distance <= this.stubScratch.hw
    )
      return 'tarmac';
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
    const step = MAX_GRADE * spacing;
    for (let i = 1; i < count; i++)
      a[i] = Math.min(a[i - 1]! + step, Math.max(a[i - 1]! - step, a[i]!));
    for (let i = count - 2; i >= 0; i--)
      a[i] = Math.min(a[i + 1]! + step, Math.max(a[i + 1]! - step, a[i]!));
    return a;
  }
}
