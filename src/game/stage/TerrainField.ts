import { TerrainDetail, type TerrainMound } from './TerrainDetail';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { hashSeed, mulberry32 } from '../rng';
import type { Surface } from '../vehicle/surfaces';
import type { TerrainQuery } from '../vehicle/Terrain';
import {
  circuitSurface,
  circuitTrackside,
  gravelDepth,
  kerbLift,
  outermostBarrier,
  type CircuitTrackside,
} from './CircuitTrackside';
import { Coastline } from './Coastline';
import { type AxisPoint, CoastShape, type CoastSurface } from './CoastShape';
import type { Oasis } from './Oases';
import { STAGE_TYPES, reliefAmplitude } from './regions';
import { createRoadHit } from './RoadPath';
import { smoothRoadProfile } from './RoadProfile';
import { halfWidthAt } from './RoadWidth';
import { SpatialHash } from './SpatialHash';
import type { StageDef } from './StageGenerator';
import { UrbanField } from './UrbanField';
import {
  JUNCTION_REACH,
  KERB_LIFT,
  KERB_RAMP,
  PAVEMENT_WIDTH,
  PLATEAU_BLEND,
  plateauDistance,
  townFade,
  type TownDef,
} from './Town';
import { junctionKerbs, type JunctionSurface } from './TownKerbs';

const FLAT_MARGIN = 3;
/**
 * In a town the ground stays level a whole terrain cell (2 m) beyond the
 * pavement, so the mesh's slope toward the hills starts past the pavement's
 * edge instead of poking up through its last half metre as a jagged line.
 */
const TOWN_FLAT_MARGIN = PAVEMENT_WIDTH + 2;
/** A city's ground is paving-coloured this far behind its pavements, where the terraces' pads ramp up. */
const PAVED_MARGIN = 1.6;
const BLEND_WIDTH = 16;
/** On a Coast stage the verges give way to the ground over this much instead, so the cliff edge and the cut show. */
const COAST_BLEND = 9;
/**
 * On a Coast stage the ground beside every stretch of road within
 * `BANK_REACH` beyond its flat margin climbs no steeper than this above its
 * deck (rise per metre), so a hairpin cut deep into the hillside opens out
 * instead of standing as a wall at its edge; inland of the shore road it
 * falls no steeper below it either, and where a lower road's cut and an
 * upper road's fill cross, the ground ramps straight from one to the other.
 */
const BANK_SLOPE = 1.2;
const BANK_REACH = 30;
/** The fill floor fades in over this much inland of the shore road's line, leaving the sea cliffs alone. */
const FILL_FADE = 8;
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
/**
 * The road mesh lays a verge strip this wide beside each edge of the
 * carriageway, at deck level. Its colour can differ from the ground's (the
 * Autumnal verges fade out from the mud), so the terrain must never share
 * its plane: two coplanar surfaces fight for depth, and the coarse terrain
 * faces flicker through the strip as triangles while the camera moves. On
 * the open road the bed therefore stays `VERGE_BED_DROP` below the strip
 * from the trench ramp outwards and rises to meet the strip's outer edge
 * over its last `VERGE_BED_RAMP`.
 */
export const VERGE_WIDTH = 3;
export const VERGE_BED_DROP = 0.15;
const VERGE_BED_RAMP = 0.5;
const VERGE_BED_PAST = 0.3;
/**
 * The same for a circuit's gravel traps, drawn barely over the flat runoff:
 * the bed sinks this far under the band, ramping back to the runoff's level
 * over `GRAVEL_BED_RAMP` inside its edges.
 */
const GRAVEL_BED_DROP = 0.15;
const GRAVEL_BED_RAMP = 0.5;
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

/** Samples across a side street's deck at its junction zone's end, from the street's right edge to its left. */
const PROFILE_SAMPLES = 7;

/**
 * A blocked side street's deck: the route's own deck through the junction
 * zone, then a straight climb from the deck across the zone's end
 * (`profile`) toward the ground at the stub's end (`y1`).
 */
interface StubDeck {
  x0: number;
  z0: number;
  dx: number;
  dz: number;
  len: number;
  hw: number;
  /** The route's deck across the zone's end, `PROFILE_SAMPLES` from the street's right edge to its left. */
  profile: Float64Array;
  /** The middle of `profile`: the deck on the axis at the zone's end. */
  yZone: number;
  y1: number;
  /** An open city street: its far end takes the deck of the road it meets. */
  open: boolean;
  /** An open street ending in a T on the route: within this fraction of its length from its end the deck is the route's. */
  farZone: number;
  /** The last `stubHit` query that weighed this street (it is filed in every cell it crosses). */
  visit: number;
}

/** A side street's deck at a point: the route's deck through the junction zone, then its own ramp (see `stubHit`). */
function stubDeckAt(s: StubDeck, x: number, z: number, routeDeck: number | null): number {
  const len2 = s.len * s.len;
  let t = len2 > 0 ? ((x - s.x0) * s.dx + (z - s.z0) * s.dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const zone = (s.hw + JUNCTION_REACH) / s.len;
  if (t <= zone && routeDeck !== null) return routeDeck;
  if (s.farZone > 0 && t >= 1 - s.farZone && routeDeck !== null) return routeDeck;
  const lat = ((x - s.x0) * s.dz - (z - s.z0) * s.dx) / s.len;
  const start = profileAt(s, lat);
  const span = Math.max(1e-6, 1 - s.farZone - zone);
  const ramp = Math.min(1, Math.max(0, (t - zone) / span));
  return start + (s.y1 - start) * ramp;
}

/** `s.profile` interpolated at `lat` metres to the street's left, held at the edges. */
function profileAt(s: StubDeck, lat: number): number {
  const n = s.profile.length - 1;
  const u = Math.min(n, Math.max(0, ((lat + s.hw) / (2 * s.hw)) * n));
  const i = Math.min(n - 1, Math.floor(u));
  const f = u - i;
  return s.profile[i]! * (1 - f) + s.profile[i + 1]! * f;
}

interface StreetHit {
  deck: number;
  distance: number;
  hw: number;
  /** Path distance of the route hit; NaN for a side street. */
  along: number;
  stub: boolean;
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
/** Pad grid cell: a terrace pad with its blend spans a cell or two. */
const PAD_CELL = 16;
/** Side-street grid cell. */
const STUB_CELL = 32;

export interface TerrainSample {
  height: number;
  /** 0 = untouched terrain, 1 = on the road bed. */
  roadBlend: number;
  /** Unsigned distance to the road centreline (Infinity when far). */
  roadDistance: number;
  /** In a city: 2 under a carriageway or a junction's paving, 1 under a pavement and the strip behind it, else 0. */
  paved?: number;
  /** How rocky the ground is here, 0..1: the coast's cliff band and outcrops; 0 elsewhere. */
  rock?: number;
  /** Coast only, 0..1: gravel and scree, and sun-dried grass. */
  scree?: number;
  dry?: number;
  /** 0..1 how far into a crowd's berm: painted a lusher grass by the mesher. */
  earth?: number;
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
  /** The coast the stage runs along, on Coast stages. */
  readonly coast: Coastline | null;
  /** Dune sea instead of hills. */
  private readonly dunes: boolean;
  /** A ridge of snow heaped along both verges (the Arctic), as height and width; null elsewhere. */
  private readonly banks: { height: number; width: number } | null;
  /** Road distances of the crests `addCrests` raised on the straights, for the tests and the probes. */
  readonly crestsAt: number[] = [];
  /** The oases, on dune stages: set by `scatterScenery` with their pads, read by the renderer for the pools. */
  oases: Oasis[] = [];
  private readonly roadHeights: Float64Array;
  private readonly hit = createRoadHit();
  private readonly offroad: Surface;
  readonly corridor: number;
  private pads: TerrainPad[] = [];
  /** Bumps off the road and the berms in front of the crowds. */
  private readonly detail: TerrainDetail;
  /** The pads filed in every cell their reach touches, so a height query reads its own cell's few. */
  private padGrid = new SpatialHash<TerrainPad>(PAD_CELL);
  private readonly town: TownDef | null;
  /** Reference height of the town: the mean of the hills over its footprint, which its relief is tamed around. */
  readonly townY: number;
  /** Share of the hills' relief kept inside the town. */
  readonly townRelief: number;
  private readonly stubs: StubDeck[];
  /** The side streets filed in every cell they cross, searched outward in rings for the nearest. */
  private readonly stubGrid = new SpatialHash<StubDeck>(STUB_CELL);
  private readonly stubExtent = { x0: 0, x1: 0, z0: 0, z1: 0 };
  private stubQuery = 0;
  /** The widest side street: a street in an unvisited ring can beat the best found only within this. */
  private stubMaxHw = 0;
  /** Each junction's tarmac, trenched like a carriageway so the junction surface sits clear of the terrain. */
  private readonly junctions: JunctionSurface[];
  private readonly surfaceScratch: CoastSurface = { rock: 0, scree: 0, dry: 0 };
  /** The lowest cut cap and the highest fill floor over the coast road stretches `visitNear` finds. */
  private cutCap = Infinity;
  private fillFloor = -Infinity;
  /** How far beyond its flat margin the road setting each bound lies. */
  private cutX = 0;
  private fillX = 0;
  private readonly axis: AxisPoint = { u: 0, v: 0 };
  private readonly envelope = (along: number, distance: number): void => {
    const deck = this.roadHeightAt(along) + ROAD_LIFT;
    const beyond = Math.max(0, distance - this.stage.halfWidth - this.flatMargin);
    const cut = deck + BANK_SLOPE * beyond;
    if (cut < this.cutCap) {
      this.cutCap = cut;
      this.cutX = beyond;
    }
    const fill = deck - BANK_SLOPE * beyond;
    if (fill > this.fillFloor) {
      this.fillFloor = fill;
      this.fillX = beyond;
    }
  };
  private readonly street: StreetHit = {
    deck: 0,
    distance: Infinity,
    hw: 0,
    along: NaN,
    stub: false,
  };
  private readonly stubScratch: StreetHit = {
    deck: 0,
    distance: Infinity,
    hw: 0,
    along: NaN,
    stub: true,
  };
  /** Whether the last `deckAt` found a street in reach (its hit is then in `street`). */
  private nearStreet = false;
  /** Level ground either side of the deck before the blend: wide on a circuit, out past its barriers. */
  private readonly flatMargin: number;
  /** A circuit's kerbs, gravel traps and barriers; null on an open stage. */
  private readonly trackside: CircuitTrackside | null;
  /** A city's roundabout levelling and tram rails; null elsewhere. */
  private urban: UrbanField | null = null;

  constructor(readonly stage: StageDef) {
    const region = STAGE_TYPES[stage.stageType];
    this.noise = createNoise2D(mulberry32(hashSeed(stage.seed, 'terrain')));
    this.amplitude = reliefAmplitude(region, stage.loop) * (stage.circuit?.relief ?? 1);
    this.frequency = region.terrain.frequency;
    this.dunes = region.terrain.dunes === true;
    this.banks = region.terrain.banks ?? null;
    this.coast = region.coast
      ? new Coastline(
          stage,
          new CoastShape(
            stage.seed,
            region.coast.seaLevel,
            this.amplitude,
            this.frequency,
            stage.loop,
          ),
        )
      : null;
    this.offroad = region.offroad;
    this.trackside = circuitTrackside(stage);
    this.flatMargin = this.trackside
      ? outermostBarrier(this.trackside) - stage.halfWidth + 4
      : FLAT_MARGIN;
    this.corridor =
      stage.halfWidth + Math.max(this.flatMargin, stage.town ? TOWN_FLAT_MARGIN : 0) + BLEND_WIDTH;
    this.town = stage.town ?? null;
    this.townY = this.town ? this.plateauHeight(this.town) : 0;
    // A city says how much of the hills it keeps; a village keeps a fixed share.
    this.townRelief =
      this.town?.relief !== undefined
        ? Math.min(0.9, this.town.relief / this.amplitude)
        : Math.min(TOWN_RELIEF_MAX, TOWN_RELIEF_METRES / this.amplitude);
    if (this.town?.relief !== undefined)
      this.urban = new UrbanField(this.town, (x, z) => this.groundHeight(x, z));
    // Coast, dunes, circuits and cities keep their own shaped ground: no bumps there.
    const plain = !this.coast && !this.dunes && !this.trackside && this.town?.city !== true;
    this.detail = new TerrainDetail(
      plain ? createNoise2D(mulberry32(hashSeed(stage.seed, 'terrain-detail'))) : null,
    );
    this.roadHeights = this.buildRoadHeights();
    this.stubs = this.town ? this.buildStubs(this.town) : [];
    this.fileStubs();
    this.junctions = this.town
      ? this.town.junctions.map((j) => junctionKerbs(j, this.stage, this.stage.halfWidth).surface)
      : [];
  }

  /**
   * Replace the level pads (set after construction, once scenery is placed,
   * so the road bed built in the constructor is unaffected). Pads sit well
   * clear of the carriageway, so they only ever meet the road's outer blend.
   */
  setPads(pads: readonly TerrainPad[]): void {
    this.pads = [...pads];
    this.padGrid = new SpatialHash<TerrainPad>(PAD_CELL);
    for (const p of this.pads) this.padGrid.insert(p, p.x, p.z, p.radius + (p.blend ?? PAD_BLEND));
  }

  /** Replace the berms (set with the spectators, after construction, like the pads). */
  setMounds(mounds: readonly TerrainMound[]): void {
    this.detail.setMounds(mounds);
  }

  /** Whether (x, z) is on a berm, or within `margin` of one: wild scenery keeps off them. */
  onMound(x: number, z: number, margin = 0): boolean {
    return this.detail.onMound(x, z, margin);
  }

  /** The bumps (`share` of them) and any berm at (x, z). */
  private detailAt(x: number, z: number, share: number): number {
    return this.detail.bumps(x, z, share) + this.detail.mound(x, z);
  }

  /** File each side street in every cell its carriageway crosses, and note how far the grid runs. */
  private fileStubs(): void {
    const e = this.stubExtent;
    e.x0 = e.z0 = Infinity;
    e.x1 = e.z1 = -Infinity;
    for (const s of this.stubs) {
      this.stubMaxHw = Math.max(this.stubMaxHw, s.hw);
      const n = Math.max(1, Math.ceil(s.len / (STUB_CELL / 2)));
      for (let i = 0; i <= n; i++) {
        const x = s.x0 + (s.dx * i) / n;
        const z = s.z0 + (s.dz * i) / n;
        e.x0 = Math.min(e.x0, x);
        e.x1 = Math.max(e.x1, x);
        e.z0 = Math.min(e.z0, z);
        e.z1 = Math.max(e.z1, z);
        // Filed with the half width as reach so a point beside the street finds it in its own cell.
        this.stubGrid.insert(s, x, z, s.hw);
      }
    }
  }

  /** The hills alone (the coast, on a Coast stage): before the town plateau, the road bed and any pads. */
  baseHeight(x: number, z: number): number {
    if (this.coast) return this.coast.ground(x, z);
    if (this.dunes) return this.duneHeight(x, z);
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

  /** A dune sea: long ridges with sharp crests, stretched downwind, over a rolling sand floor. */
  private duneHeight(x: number, z: number): number {
    const f = this.frequency;
    const n = this.noise;
    const a = this.amplitude;
    // Across the ridges (u) the noise runs four times faster than along them (v), so they stretch downwind.
    const u = x * 0.83 + z * 0.56;
    const v = -x * 0.56 + z * 0.83;
    const ridge = 1 - Math.abs(n(u * f * 1.7 + 3.3, v * f * 0.4));
    const floor =
      0.55 * n(x * f * 0.5 + 9.1, z * f * 0.5) + 0.25 * n(x * f * 1.3, z * f * 1.3 + 5.5);
    return a * (0.85 * ridge * ridge - 0.3 + 0.6 * floor) + 0.25 * n(x * 0.06, z * 0.06);
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
    const h = tamed + (base - tamed) * smoothstep(0, PLATEAU_BLEND, d);
    return this.urban ? this.urban.tame(x, z, h) : h;
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
      // The route's deck across the zone's end: the street carries those levels on from there,
      // so where the route leaves its reach (or another stretch of it comes within reach) the
      // deck does not step.
      const ux = dx / len;
      const uz = dz / len;
      const ex = s.x0 + ux * zoneEnd;
      const ez = s.z0 + uz * zoneEnd;
      const routeAt = (x: number, z: number) =>
        this.stage.path.nearest(x, z, this.corridor, this.hit)
          ? this.roadHeightAt(this.hit.along)
          : this.groundHeight(x, z);
      const profile = new Float64Array(PROFILE_SAMPLES);
      for (let i = 0; i < PROFILE_SAMPLES; i++) {
        const lat = -s.halfWidth + (2 * s.halfWidth * i) / (PROFILE_SAMPLES - 1);
        profile[i] = routeAt(ex + uz * lat, ez - ux * lat);
      }
      const yZone = profile[(PROFILE_SAMPLES - 1) / 2]!;
      const end = this.groundHeight(s.x1, s.z1);
      const climb = Math.max(0, len - zoneEnd);
      const rise = Math.max(-climb * STUB_GRADE, Math.min(climb * STUB_GRADE, end - yZone));
      out.push({
        x0: s.x0,
        z0: s.z0,
        dx,
        dz,
        len,
        hw: s.halfWidth,
        profile,
        yZone,
        y1: yZone + rise,
        open: s.open === true,
        farZone: 0,
        visit: 0,
      });
    }
    // An open street ends on another road and takes that road's deck there, whatever the climb:
    // the route's where the route is in reach, else the side street it runs into; two that meet
    // head on share the mean of their own levels.
    const ends = out.map((s) => ({ x: s.x0 + s.dx, z: s.z0 + s.dz }));
    const joined = out.map((s, i) => {
      if (!s.open) return s.y1;
      const e = ends[i]!;
      if (this.stage.path.nearest(e.x, e.z, this.corridor, this.hit)) {
        if (this.hit.distance < 1) {
          // On the route's axis: a T junction. The route's deck holds through the junction zone
          // at this end as at the other, and the ramp between the zones ends at the route's deck
          // where the far zone begins.
          const hw = halfWidthAt(this.stage, this.hit.along);
          const zoneLen = Math.min(s.len / 2, hw + JUNCTION_REACH);
          s.farZone = zoneLen / s.len;
          const zx = e.x - (s.dx / s.len) * zoneLen;
          const zz = e.z - (s.dz / s.len) * zoneLen;
          return this.stage.path.nearest(zx, zz, this.corridor, this.hit)
            ? this.roadHeightAt(this.hit.along)
            : this.roadHeightAt(this.hit.along);
        }
        return this.roadHeightAt(this.hit.along);
      }
      let best: StubDeck | null = null;
      let bestD = Infinity;
      out.forEach((o, k) => {
        if (o === s) return;
        const len2 = o.len * o.len;
        let t = len2 > 0 ? ((e.x - o.x0) * o.dx + (e.z - o.z0) * o.dz) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(e.x - (o.x0 + o.dx * t), e.z - (o.z0 + o.dz * t));
        const facing = o.open && Math.hypot(ends[k]!.x - e.x, ends[k]!.z - e.z) < 1.5;
        if (facing) {
          best = null;
          bestD = -1;
          return;
        }
        if (bestD >= 0 && d < bestD && d < o.hw + PAVEMENT_WIDTH + 1) {
          best = o;
          bestD = d;
        }
      });
      if (bestD < 0) {
        const other = out.find(
          (o, k) => o !== s && Math.hypot(ends[k]!.x - e.x, ends[k]!.z - e.z) < 1.5,
        );
        return other ? (s.y1 + other.y1) / 2 : s.y1;
      }
      return best ? stubDeckAt(best, e.x, e.z, null) : s.y1;
    });
    out.forEach((s, i) => {
      s.y1 = joined[i]!;
    });
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
    const stamp = ++this.stubQuery;
    const weigh = (list: readonly StubDeck[]) => {
      for (let i = 0; i < list.length; i++) {
        const s = list[i]!;
        if (s.visit === stamp) continue;
        s.visit = stamp;
        const len2 = s.len * s.len;
        let t = len2 > 0 ? ((x - s.x0) * s.dx + (z - s.z0) * s.dz) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const distance = Math.hypot(x - (s.x0 + s.dx * t), z - (s.z0 + s.dz * t));
        if (distance - s.hw >= best) continue;
        best = distance - s.hw;
        found = true;
        // Through the junction zone the street is the route's own deck, so plates and the ribbon
        // meet without a step; beyond it the street carries on from the deck across the zone's end
        // and ramps to its end level: the route past the zone (which may bend away, or loop back
        // within reach near the street's end) has no say. Continuous at the zone's end.
        out.deck = stubDeckAt(s, x, z, routeDeck);
        out.distance = distance;
        out.hw = s.hw;
      }
    };
    // Rings of cells outward from the query's own cell, until every unvisited street is too far
    // to beat the best, or the rings have passed the last street.
    const g = this.stubGrid;
    const cx = g.index(x);
    const cz = g.index(z);
    const e = this.stubExtent;
    const last = Math.max(
      Math.abs(cx - g.index(e.x0)),
      Math.abs(cx - g.index(e.x1)),
      Math.abs(cz - g.index(e.z0)),
      Math.abs(cz - g.index(e.z1)),
    );
    for (let r = 0; r <= last; r++) {
      g.ring(cx, cz, r, weigh);
      if (found && best <= r * STUB_CELL - this.stubMaxHw) break;
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
      out.along = this.hit.along;
      out.stub = false;
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
        out.along = NaN;
        out.stub = true;
        found = true;
      }
    }
    // Inside a roundabout's hand-off disc every deck is the ring's level.
    if (found && this.urban) {
      const level = this.urban.ringLevel(x, z);
      if (level !== null) out.deck = level;
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
    const pads = this.padGrid.at(this.padGrid.index(x), this.padGrid.index(z));
    if (!pads) return h;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i]!;
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
    const f = Math.min(
      Math.max(this.stage.path.wrap(along) / s, 0),
      this.roadHeights.length - 1.000001,
    );
    const i = Math.floor(f);
    return this.roadHeights[i]! + (this.roadHeights[i + 1]! - this.roadHeights[i]!) * (f - i);
  }

  /** How far beyond the verge the deck gives way to the ground: shorter beside a coast road. */
  private blendWidth(st: StreetHit): number {
    return this.coast && !st.stub ? COAST_BLEND : BLEND_WIDTH;
  }

  /** Level ground beyond the carriageway before the blend: wider where the town's pavements run. */
  private flatMarginFor(st: StreetHit): number {
    if (this.town && (st.stub || townFade(this.town, st.along) > 0)) return TOWN_FLAT_MARGIN;
    return this.flatMargin;
  }

  /**
   * The ground the road blends into: the hills, and on a Coast stage held
   * within `BANK_SLOPE` of every stretch of road in reach, so stacked legs
   * never meet in a wall or a step.
   */
  private shapedGround(x: number, z: number): number {
    const base = this.groundHeight(x, z);
    if (!this.coast) return base;
    this.cutCap = Infinity;
    this.fillFloor = -Infinity;
    const reach = this.stage.halfWidth + this.flatMargin + BANK_REACH;
    this.stage.path.visitNear(x, z, reach, this.envelope);
    if (this.cutCap === Infinity) return base;
    const shape = this.coast.shape;
    const a = shape.toAxis(x, z, this.axis);
    const inland = a.v - shape.shore(a.u) - shape.roadInland(a.u);
    const floor = this.fillFloor - (1 - smoothstep(0, FILL_FADE, inland)) * 1000;
    if (floor <= this.cutCap) return Math.max(Math.min(base, this.cutCap), floor);
    // A lower road's cut meets an upper road's fill: ramp between their flat margins.
    const span = this.cutX + this.fillX;
    return span > 0 ? (this.cutCap * this.fillX + floor * this.cutX) / span : floor;
  }

  sample(x: number, z: number, out: TerrainSample): TerrainSample {
    const base = this.shapedGround(x, z);
    const st = this.street;
    if (this.coast) {
      const c = this.coast.surface(x, z, this.surfaceScratch);
      out.rock = c.rock;
      out.scree = c.scree;
      out.dry = c.dry;
    } else {
      out.rock = 0;
      out.scree = 0;
      out.dry = 0;
    }
    out.paved = 0;
    out.earth = this.detail.earth(x, z);
    if (!this.nearestStreet(x, z, st)) {
      out.height = this.applyPads(x, z, base + this.detailAt(x, z, 1));
      out.roadBlend = 0;
      out.roadDistance = Infinity;
      return out;
    }
    const deck = st.deck + ROAD_LIFT;
    const hw = st.hw;
    const flat = this.flatMarginFor(st);
    if (this.town?.city) {
      // The ground under a city street reads as its surface: tarmac under the carriageway and the
      // junctions' paving, paving under the pavements and the strip up to the facades, so neither
      // a seam between plates nor a terrace's ramp ever shows green.
      let beyond = st.distance - hw;
      for (const js of this.junctions)
        if (Math.hypot(x - js.x, z - js.z) <= js.zone) beyond = Math.min(beyond, js.distance(x, z));
      out.paved = beyond < 0.3 ? 2 : beyond < PAVEMENT_WIDTH + PAVED_MARGIN ? 1 : 0;
    }
    const t = smoothstep(hw + flat, hw + flat + this.blendWidth(st), st.distance);
    let trench = Math.max(
      (ROAD_LIFT + ROAD_BED_DROP) * (1 - smoothstep(hw - TRENCH_IN, hw + TRENCH_OUT, st.distance)),
      this.vergeBed(st),
    );
    for (const js of this.junctions) {
      if (Math.hypot(x - js.x, z - js.z) > js.zone) continue;
      const f = js.distance(x, z);
      trench = Math.max(
        trench,
        (ROAD_LIFT + ROAD_BED_DROP) * (1 - smoothstep(-TRENCH_IN, TRENCH_OUT, f)),
      );
    }
    if (this.trackside && !st.stub)
      trench +=
        GRAVEL_BED_DROP *
        smoothstep(
          0,
          GRAVEL_BED_RAMP,
          gravelDepth(this.trackside, this.stage.path, hw, st.along, this.hit.lateral),
        );
    const raw = deck + (base - deck) * t - trench + this.bankLift(st) + this.detailAt(x, z, t);
    // Under a city's pavements the terraces' pads do not reach: a pad vertex there would tilt the
    // coarse terrain face up through the pavement as a green wedge along the building.
    out.height = out.paved ? raw : this.applyPads(x, z, raw);
    out.roadBlend = 1 - t;
    out.roadDistance = st.distance;
    return out;
  }

  /**
   * How far the bed sinks under the road mesh's verge strip here (see
   * `VERGE_WIDTH`). Only on the open road: a town's pavements stand above
   * the ground already and stop at junction mouths, a circuit's runoff has
   * its own beds, and a snow bank rises out of the strip on purpose.
   */
  private vergeBed(st: StreetHit): number {
    if (this.banks || this.trackside || st.stub) return 0;
    if (this.town && townFade(this.town, st.along) > 0) return 0;
    const beyond = st.distance - st.hw;
    return (
      VERGE_BED_DROP *
      (1 - smoothstep(VERGE_WIDTH - VERGE_BED_RAMP, VERGE_WIDTH + VERGE_BED_PAST, beyond))
    );
  }

  /**
   * The snow bank beside the carriageway: a rounded ridge from the verge's
   * edge out over `banks.width`, `banks.height` high at its crest, that
   * wheels climb and the terrain mesh heaps. Nothing where a town's pavements
   * run, nor beside a side street.
   */
  private bankLift(st: StreetHit): number {
    const b = this.banks;
    if (!b || st.stub) return 0;
    if (this.town && townFade(this.town, st.along) > 0) return 0;
    const out = st.distance - st.hw - 0.6;
    if (out <= 0 || out >= b.width) return 0;
    const u = out / b.width;
    return b.height * Math.sin(Math.PI * u) ** 1.3;
  }

  /** The surface without the pavements' kerb lift: the deck tarmac, kerb faces and pavements are built on. */
  deckAt(x: number, z: number): number {
    const base = this.shapedGround(x, z);
    const st = this.street;
    this.nearStreet = this.nearestStreet(x, z, st);
    if (!this.nearStreet) return this.applyPads(x, z, base + this.detailAt(x, z, 1));
    const deck = st.deck + ROAD_LIFT;
    const flat = this.flatMarginFor(st);
    const t = smoothstep(st.hw + flat, st.hw + flat + this.blendWidth(st), st.distance);
    return (
      this.applyPads(x, z, deck + (base - deck) * t + this.detailAt(x, z, t)) + this.bankLift(st)
    );
  }

  /**
   * The surface wheels ride on: the deck, plus the kerb lift over a town
   * pavement (a strip `PAVEMENT_WIDTH` wide outside every carriageway and
   * junction surface), climbed over `KERB_RAMP` so a wheel mounts it as a bump.
   */
  heightAt(x: number, z: number): number {
    const h = this.deckAt(x, z);
    if (this.trackside) return h + this.kerbLift();
    const town = this.town;
    if (!town || !this.nearStreet) return h;
    const st = this.street;
    const fade = st.stub ? 1 : townFade(town, st.along);
    if (fade <= 0) return h;
    const rails = this.urban ? this.urban.lift(x, z) : 0;
    let out = st.distance - st.hw;
    for (const js of this.junctions) {
      if (Math.hypot(x - js.x, z - js.z) > js.zone) continue;
      out = Math.min(out, js.distance(x, z));
    }
    if (out <= 0 || out >= PAVEMENT_WIDTH + 0.4) return h + rails;
    const onto =
      smoothstep(0, KERB_RAMP, out) *
      (1 - smoothstep(PAVEMENT_WIDTH - 0.3, PAVEMENT_WIDTH + 0.4, out));
    return h + KERB_LIFT * fade * onto + rails;
  }

  /** A circuit kerb under the last `deckAt` point: a low ramped bump a wheel feels. */
  private kerbLift(): number {
    if (!this.nearStreet) return 0;
    const st = this.street;
    return kerbLift(
      this.trackside!,
      this.stage.path,
      st.along,
      this.hit.lateral,
      st.distance - st.hw,
    );
  }

  /**
   * Town streets are paved whatever the stage surface; the route through the
   * town counts as one of them, and so do the pavements (concrete, a kerb up:
   * tarmac grip, black tyre marks) along every street and round every
   * junction's surface.
   */
  surfaceAt(x: number, z: number): Surface {
    if (this.trackside) {
      const { path, halfWidth, surface } = this.stage;
      if (!path.nearest(x, z, this.corridor, this.hit)) return this.offroad;
      return circuitSurface(this.trackside, path, halfWidth, this.hit, surface, this.offroad);
    }
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
    if (town && this.onPavement(x, z)) return 'tarmac';
    return this.offroad;
  }

  /** True on a town pavement: the kerb-high band outside a street's carriageway or a junction's surface, where the town has faded in. */
  private onPavement(x: number, z: number): boolean {
    const st = this.street;
    if (!this.nearestStreet(x, z, st)) return false;
    const fade = st.stub ? 1 : townFade(this.town!, st.along);
    if (fade < 0.5) return false;
    let out = st.distance - st.hw;
    for (const js of this.junctions) {
      if (Math.hypot(x - js.x, z - js.z) > js.zone) continue;
      out = Math.min(out, js.distance(x, z));
    }
    return out < PAVEMENT_WIDTH + 0.2;
  }

  /** The road profile: the ground under each sample, smoothed and grade-limited (cyclically on a closed lap). */
  private buildRoadHeights(): Float64Array {
    const { xs, zs, count, spacing, closed } = this.stage.path;
    const raw = new Float64Array(count);
    for (let i = 0; i < (closed ? count - 1 : count); i++)
      raw[i] = this.groundHeight(xs[i]!, zs[i]!);
    const smooth = smoothRoadProfile(raw, spacing, closed);
    if (this.urban) return this.urban.levelProfile(smooth, spacing, this.stage.path);
    const crests = STAGE_TYPES[this.stage.stageType].terrain.crests;
    if (crests && !closed) this.addCrests(smooth, crests);
    return smooth;
  }

  /**
   * Humps on the straights for the car to jump: about every `every` metres,
   * where the road runs straight for the hump's length and no gate, town or
   * start stands, a raised cosine `height` high over `length` is added to
   * the profile (its steepest grade is π·height/length, under the limiter's
   * 12 % for the regions that ask). Seeded from the stage.
   */
  private addCrests(
    heights: Float64Array,
    crests: { every: number; height: number; length: number },
  ): void {
    const path = this.stage.path;
    const spacing = path.spacing;
    const rand = mulberry32(hashSeed(this.stage.seed, 'crests'));
    const keepOut = [this.stage.startDistance, ...this.stage.gates.map((g) => g.distance)];
    const town = this.town;
    const half = crests.length / 2;
    const straight = (d: number) => {
      const i0 = Math.max(1, Math.floor((d - half - 6) / spacing));
      const i1 = Math.min(path.count - 1, Math.ceil((d + half + 6) / spacing));
      let turn = 0;
      for (let i = i0; i <= i1; i++) {
        const a = path.headings[i]! - path.headings[i - 1]!;
        turn += Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      }
      // Straight enough, and level enough that the hump's grade adds to little: a hump on a slope
      // would pass the limiter's grade.
      const rise = Math.abs(heights[i1]! - heights[i0]!) / ((i1 - i0) * spacing);
      return turn < 0.4 && rise < 0.06;
    };
    for (
      let d = this.stage.startDistance + 160 + rand() * crests.every;
      d < path.length - 120;
      d += crests.every * (0.7 + 0.6 * rand())
    ) {
      // Slide along a little for a straight stretch; give up on this one if none is near.
      let at = NaN;
      for (let probe = 0; probe <= 120; probe += 6) {
        const c = d + probe;
        if (keepOut.some((k) => Math.abs(k - c) < half + 16)) continue;
        if (town && c > town.from - half - 60 && c < town.to + half + 60) continue;
        if (straight(c)) {
          at = c;
          break;
        }
      }
      if (Number.isNaN(at)) continue;
      this.crestsAt.push(at);
      const i0 = Math.max(0, Math.ceil((at - half) / spacing));
      const i1 = Math.min(heights.length - 1, Math.floor((at + half) / spacing));
      for (let i = i0; i <= i1; i++) {
        const t = (i * spacing - (at - half)) / crests.length;
        heights[i]! += (crests.height / 2) * (1 - Math.cos(2 * Math.PI * t));
      }
    }
  }
}
