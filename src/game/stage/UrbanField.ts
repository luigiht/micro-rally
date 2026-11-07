import { medianLift } from './Median';
import type { RoadPath } from './RoadPath';
import { handoffRadius, ringOuterRadius, type Roundabout } from './Roundabout';
import type { TownDef } from './Town';
import { tramLift } from './Tram';

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
  private readonly trams: TownDef['trams'];
  private readonly medians: TownDef['medians'];

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
    this.trams = town.trams;
    this.medians = town.medians;
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
   * otherwise carry a little of the approaches' slope onto the ring.
   */
  levelProfile(heights: Float64Array, spacing: number, path: RoadPath): Float64Array {
    const s = { x: 0, z: 0, heading: 0 };
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
    return heights;
  }

  /** What stands up out of the deck under a wheel at (x, z): a boulevard's median kerb, and the tram rails' ridge; 0 on plain tarmac. */
  lift(x: number, z: number): number {
    return (
      (this.medians ? medianLift(this.medians, x, z) : 0) +
      (this.trams ? tramLift(this.trams, x, z) : 0)
    );
  }
}
