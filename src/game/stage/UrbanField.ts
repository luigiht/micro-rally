import { medianLift } from './Median';
import { createRoadHit, type RoadPath } from './RoadPath';
import { handoffRadius, ringOuterRadius, type Roundabout } from './Roundabout';
import type { Junction, TownDef } from './Town';
import { junctionReach } from './TownJunctions';
import { SpatialHash } from './SpatialHash';
import { railLift, TRAM_GAUGE, type TramLine } from './Tram';

/**
 * What a city does to the ground beyond what a village does (see
 * `TerrainField`, which delegates here when the stage's town has urban
 * fields): the hills round each roundabout and each junction are levelled
 * to the height at its centre, so rings lie flat and intersections sit on
 * small plateaus between the climbs, as a hilly city's do; and the medians'
 * kerbs and the tram rails stand up out of the deck under the wheels.
 */

/**
 * The ground is level this far beyond a ring's outer edge and blends back to
 * the hills over `RING_BLEND`: far enough that the road profile's smoothing
 * window (30 m either way) sees only level ground from anywhere on the
 * ring, so the route's deck, the undriven ring's and the island all sit at
 * one height and the approaches ease down onto the plaza.
 */
const RING_FLAT = 18;
const RING_BLEND = 40;
/** The ground is level this far round each junction and blends back to the hills over `JUNCTION_BLEND`: hilly cities flatten their intersections. */
const JUNCTION_FLAT = 14;
const JUNCTION_BLEND = 22;
/** The road profile eases onto a ring's level over this much either side of the route's arc round it, and never steeper than `MAX_GRADE`. */
const RING_RAMP = 40;
const MAX_GRADE = 0.12;
/**
 * The route's deck lies level through each junction it drives, this far past
 * the junction's reach either side, and eases back onto the profile over
 * `JUNCTION_RAMP`, no steeper than `JUNCTION_GRADE` (a little over the open
 * street's limit, since a short ramp between two level crossings may need it).
 */
const JUNCTION_PIN_MARGIN = 2;
const JUNCTION_RAMP = 30;
const JUNCTION_GRADE = 0.15;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

interface Flat {
  x: number;
  z: number;
  /** Where the level ground ends and the blend begins, and how far the blend runs. */
  radius: number;
  blend: number;
  y: number;
  /** A ring's: path distances of the route's arc round it, which `levelProfile` pins, and its hand-off disc. */
  from?: number;
  to?: number;
  disc?: number;
}

export class UrbanField {
  private readonly flats: Flat[];
  /** The rails gridded, so a height query weighs the few pieces round it (a tram loop has hundreds). */
  private readonly rails = new SpatialHash<TramLine>(16);
  private readonly medians: TownDef['medians'];
  /** The junctions the route drives through (corners and crossroads), whose deck `levelProfile` levels. */
  private readonly routeJunctions: Junction[];

  /** `ground` is the tamed hill height before any roundabout levelling, sampled once at each centre. */
  constructor(town: TownDef, ground: (x: number, z: number) => number) {
    this.flats = [
      ...(town.roundabouts ?? []).map((r: Roundabout): Flat => ({
        x: r.x,
        z: r.z,
        radius: ringOuterRadius(r) + RING_FLAT,
        blend: RING_BLEND,
        y: ground(r.x, r.z),
        from: r.from,
        to: r.to,
        disc: handoffRadius(r),
      })),
      ...town.junctions.map((j): Flat => ({
        x: j.x,
        z: j.z,
        radius: JUNCTION_FLAT,
        blend: JUNCTION_BLEND,
        y: ground(j.x, j.z),
      })),
    ];
    for (const t of town.trams ?? []) {
      const len = Math.hypot(t.x1 - t.x0, t.z1 - t.z0);
      this.rails.insert(t, (t.x0 + t.x1) / 2, (t.z0 + t.z1) / 2, len / 2 + TRAM_GAUGE);
    }
    this.medians = town.medians;
    this.routeJunctions = town.junctions.filter((j) => j.arms.some((a) => a.role !== 'blocked'));
  }

  /** `h`, the tamed hills at (x, z), levelled to each roundabout's height within reach of it. */
  tame(x: number, z: number, h: number): number {
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d >= f.radius + f.blend) continue;
      h = f.y + (h - f.y) * smoothstep(f.radius, f.radius + f.blend, d);
    }
    return h;
  }

  /**
   * The level every deck inside a ring's hand-off disc takes: the ring's
   * own, so the ribbon, the ring's surface, the side streets' plates and the
   * terrain mesh all agree there; null elsewhere.
   */
  ringLevel(x: number, z: number): number | null {
    for (const f of this.flats)
      if (f.disc !== undefined && Math.hypot(x - f.x, z - f.z) < f.disc) return f.y;
    return null;
  }

  /**
   * The smoothed road profile pinned to each ring's level for the whole
   * stretch the route spends inside its hand-off disc and eased onto that
   * level over `RING_RAMP` either side, so the deck, the undriven ring
   * (which follows the route's deck), the island and everything the ring's
   * surface paints share one height. The smoothing's wide window would
   * otherwise carry a little of the approaches' slope onto the ring. Then
   * every junction on the route is levelled the same way (`levelJunctions`).
   */
  levelProfile(heights: Float64Array, spacing: number, path: RoadPath): Float64Array {
    const s = { x: 0, z: 0, heading: 0 };
    const pinned = new Uint8Array(heights.length);
    for (const f of this.flats) {
      if (f.from === undefined || f.to === undefined || f.disc === undefined) continue;
      const inside = (d: number) => {
        path.sample(d, s);
        return Math.hypot(s.x - f.x, s.z - f.z) < f.disc!;
      };
      let from = f.from;
      while (from > f.from - 80 && inside(from - spacing)) from -= spacing;
      let to = f.to;
      while (to < f.to + 80 && inside(to + spacing)) to += spacing;
      const i0 = Math.max(0, Math.floor((from - RING_RAMP) / spacing));
      const i1 = Math.min(heights.length - 1, Math.ceil((to + RING_RAMP) / spacing));
      for (let i = i0; i <= i1; i++) {
        const d = i * spacing;
        const out = d < from ? from - d : d > to ? d - to : 0;
        const w = Math.min(1, out / RING_RAMP);
        heights[i] = f.y + (heights[i]! - f.y) * w * w * (3 - 2 * w);
      }
      // Grade-limit outward from the level arc, both ways, through the ramps and on as far as the
      // clamping changes anything: the arc itself stays level, the approaches give.
      const step = MAX_GRADE * spacing;
      const a0 = Math.max(0, Math.round(from / spacing));
      const a1 = Math.min(heights.length - 1, Math.round(to / spacing));
      pinned.fill(1, a0, a1 + 1);
      for (let i = a0 - 1; i >= 0; i--) {
        const prev = heights[i + 1]!;
        const clamped = Math.min(prev + step, Math.max(prev - step, heights[i]!));
        if (clamped === heights[i] && i < i0) break;
        heights[i] = clamped;
      }
      for (let i = a1 + 1; i < heights.length; i++) {
        const prev = heights[i - 1]!;
        const clamped = Math.min(prev + step, Math.max(prev - step, heights[i]!));
        if (clamped === heights[i] && i > i1) break;
        heights[i] = clamped;
      }
    }
    this.levelJunctions(heights, spacing, path, pinned);
    return heights;
  }

  /**
   * The route's deck level through each junction it drives (at the profile's
   * own height there), so every junction is a flat plateau: the side streets
   * meeting it hold that level across their whole width (see
   * `TerrainField.buildStubs`), and nothing on it tilts. Rings keep their own
   * levels; ramps ease back onto the profile and are grade-limited.
   */
  private levelJunctions(
    heights: Float64Array,
    spacing: number,
    path: RoadPath,
    pinned: Uint8Array,
  ): void {
    const last = heights.length - 1;
    const hit = createRoadHit();
    // Level stretches in order along the road: the rings' (fixed) and each junction's, merged
    // where they meet, each at the profile's height at its first junction.
    interface Stretch {
      a0: number;
      a1: number;
      y: number;
      fixed: boolean;
    }
    const stretches: Stretch[] = [];
    for (let i = 0; i <= last; i++) {
      if (!pinned[i]) continue;
      const a0 = i;
      while (i < last && pinned[i + 1]) i++;
      stretches.push({ a0, a1: i, y: heights[a0]!, fixed: true });
    }
    const spans = this.routeJunctions
      .filter((j) => path.nearest(j.x, j.z, 60, hit))
      .map((j) => {
        path.nearest(j.x, j.z, 60, hit);
        const reach = junctionReach(j) + JUNCTION_PIN_MARGIN;
        return {
          a0: Math.max(0, Math.floor((hit.along - reach) / spacing)),
          a1: Math.min(last, Math.ceil((hit.along + reach) / spacing)),
          y: heights[Math.min(last, Math.round(hit.along / spacing))]!,
        };
      })
      .sort((p, q) => p.a0 - q.a0);
    for (const sp of spans) {
      const clash = stretches.find((t) => sp.a0 <= t.a1 + 1 && sp.a1 >= t.a0 - 1);
      if (clash?.fixed) continue;
      if (clash) {
        clash.a0 = Math.min(clash.a0, sp.a0);
        clash.a1 = Math.max(clash.a1, sp.a1);
      } else stretches.push({ ...sp, fixed: false });
    }
    stretches.sort((p, q) => p.a0 - q.a0);
    // Each level within reach of its neighbours' at the ramp's grade, both ways: rings stay put.
    const step = JUNCTION_GRADE * spacing * 0.9;
    for (let pass = 0; pass < 2; pass++)
      for (let k = 0; k < stretches.length; k++) {
        const t = stretches[pass === 0 ? k : stretches.length - 1 - k]!;
        if (t.fixed) continue;
        for (const n of [
          stretches[stretches.indexOf(t) - 1],
          stretches[stretches.indexOf(t) + 1],
        ]) {
          if (!n) continue;
          const gap = Math.max(0, n.a0 > t.a1 ? n.a0 - t.a1 : t.a0 - n.a1) * step;
          t.y = Math.min(n.y + gap, Math.max(n.y - gap, t.y));
        }
      }
    // Level each stretch and ease the profile onto it either side.
    const ramp = Math.ceil(JUNCTION_RAMP / spacing);
    for (const t of stretches) {
      if (t.fixed) continue;
      for (let i = Math.max(0, t.a0 - ramp); i <= Math.min(last, t.a1 + ramp); i++) {
        if (pinned[i]) continue;
        const out = i < t.a0 ? (t.a0 - i) * spacing : i > t.a1 ? (i - t.a1) * spacing : 0;
        const w = Math.min(1, out / JUNCTION_RAMP);
        heights[i] = t.y + (heights[i]! - t.y) * w * w * (3 - 2 * w);
      }
      pinned.fill(1, t.a0, t.a1 + 1);
    }
    // Every free sample within the ramps' grade of its neighbours, both ways, until it settles.
    const limit = JUNCTION_GRADE * spacing;
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 1; i <= last; i++) {
        if (pinned[i]) continue;
        const prev = heights[i - 1]!;
        heights[i] = Math.min(prev + limit, Math.max(prev - limit, heights[i]!));
      }
      for (let i = last - 1; i >= 0; i--) {
        if (pinned[i]) continue;
        const next = heights[i + 1]!;
        heights[i] = Math.min(next + limit, Math.max(next - limit, heights[i]!));
      }
    }
  }

  /** What stands up out of the deck under a wheel at (x, z): a boulevard's median kerb, and the tram rails' ridge; 0 on plain tarmac. */
  lift(x: number, z: number): number {
    this.railQueryX = x;
    this.railQueryZ = z;
    this.railMax = 0;
    this.rails.near(x, z, 0, this.weighRail);
    return (this.medians ? medianLift(this.medians, x, z) : 0) + this.railMax;
  }

  private railQueryX = 0;
  private railQueryZ = 0;
  private railMax = 0;
  /** One rail piece's ridge at the current query point, kept if it is the highest (no closure per query). */
  private readonly weighRail = (t: TramLine): void => {
    this.railMax = Math.max(this.railMax, railLift(t, this.railQueryX, this.railQueryZ));
  };
}
