import { hashSeed, mulberry32 } from '../rng';
import type { BoxObstacle } from '../vehicle/Collisions';
import { createRoadHit, type RoadSample } from './RoadPath';
import { SpatialHash } from './SpatialHash';
import type { StageDef } from './StageGenerator';
import { plateauDistance } from './Town';

/**
 * Frozen rivers (the Alpine's): where the road dips to its lowest it crosses
 * a river on a stone arch bridge, the ice running off through the hills on
 * either side until it fades into the snow. Laid after the road, so the
 * road never changes: each crossing is a low point of the road's profile;
 * from it the river is traced both ways, setting off square to the road and
 * then taking, step by step, whichever heading in a fan ahead finds the
 * lowest ground (with a little momentum and a slow seeded meander), so it
 * follows the valley floors and keeps away from every other stretch of road
 * and from the other rivers. Its ice lies a channel's depth under the
 * ground, smoothed along it, and is drawn down at the crossing to the
 * bridge's clearance under the deck, so the bridge spans a small gorge; for
 * its last stretch at either end the channel shallows into the ground. Pure TS.
 */

export interface RiverStyle {
  /** At least this many rivers a stage. */
  min: number;
  /** Half the ice's width, the channel's depth under the ground, the ice's depth under the deck at the bridge, how far each way it runs. */
  halfWidth: number;
  depth: number;
  clearance: number;
  reach: number;
}

export interface RiverPoint {
  x: number;
  z: number;
  /** The ice's height here. */
  level: number;
  /** 1 along the river, falling to 0 over its last stretch at either end, where it fades into the ground. */
  fade: number;
}

export interface River {
  points: RiverPoint[];
  halfWidth: number;
  /** Where the road crosses it: road distance, position, the road's heading, and the point index. */
  crossing: { along: number; x: number; z: number; heading: number; index: number };
  /** The road distances the bridge spans, bank to bank. */
  bridge: { from: number; to: number };
}

/** What the planner reads of the ground and the road. */
export interface RiverGround {
  stage: StageDef;
  groundHeight(x: number, z: number): number;
  roadHeightAt(along: number): number;
  /** How far past the carriageway's edge a road's corridor reaches. */
  corridor: number;
}

/** Steps a river is traced in, and the fan of headings it weighs at each. */
const STEP = 8;
const FAN = 4;
const FAN_STEP = 0.15;
/** Metres of ground a step's turn costs (per radian squared), and its pull toward the meander. */
const TURN_COST = 6;
const MEANDER_COST = 4;
const MEANDER_SWING = 0.35;
const MEANDER_LENGTH = 70;
/** A river keeps this far from any road beyond its own crossing, and from the other rivers. */
const ROAD_GAP = 14;
const RIVER_GAP = 34;
/** Near its own crossing (this much road either way) the road does not count, for this much river. */
const OWN_ROAD = 70;
const OWN_RUN = 60;
/** A river this short on either side is no river: the crossing is skipped. */
const MIN_SIDE = 100;
/** Its last this many metres at either end shallow into the ground. */
const FADE = 45;
/** The ice is drawn down to the bridge's clearance over this much river either side of the road. */
const GORGE = 55;
/** The ice never stands closer than this under the ground beside it. */
const UNDER = 0.6;
/** Crossings: a low point is the lowest road within this much either way, and stands this far from the start, gates, finish and town. */
const LOW_WINDOW = 30;
const PROMINENCE_WINDOW = 150;
const GATE_GAP = 60;
const ENDS = 90;
const TOWN_GAP = 150;
/** Crossings stand at least this far apart along the road (a fallback pick a little less). */
const APART = 350;
const FALLBACK_APART = 240;
/** Fallback crossings are tried every this many metres of road; no stage tries more than this many rivers. */
const REST_STEP = 20;
/** A fallback crossing's lowness: its height over the lowest road this far either way. */
const LIFT_WINDOW = 100;
const MAX_TRIES = 40;
/** The bridge spans the ice and this much of each bank. */
const BANK_SPAN = 6;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Every river of a stage, at least `style.min` of them where the road allows. */
export function planRivers(ground: RiverGround, style: RiverStyle): River[] {
  const rand = mulberry32(hashSeed(ground.stage.seed, 'rivers'));
  const rivers: River[] = [];
  const { dips, rest } = crossings(ground);
  let tries = 0;
  // The road's deepest dips first, one more than needed where there are good ones; then, while
  // still short, every other allowed stretch from the lowest up, a little closer together.
  for (const [list, apart, most] of [
    [dips, APART, style.min + 1],
    [rest, FALLBACK_APART, style.min],
  ] as const) {
    for (const along of list) {
      if (rivers.length >= most || tries >= MAX_TRIES) break;
      if (rivers.some((r) => Math.abs(r.crossing.along - along) < apart)) continue;
      tries++;
      const river = traceRiver(ground, style, along, rivers, rand);
      if (river) rivers.push(river);
    }
  }
  return rivers;
}

/** Candidate crossings: the road's dips by how deep they are, and every other allowed stretch from the lowest up. */
function crossings(ground: RiverGround): { dips: number[]; rest: number[] } {
  const stage = ground.stage;
  const sp = stage.path.spacing;
  const finish = stage.startDistance + stage.length;
  const keep = [stage.startDistance, ...stage.gates.map((g) => g.distance)];
  const town = stage.town;
  const allowed = (d: number) =>
    d > stage.startDistance + ENDS &&
    d < finish - ENDS &&
    keep.every((k) => Math.abs(k - d) > GATE_GAP) &&
    !(town && d > town.from - TOWN_GAP && d < town.to + TOWN_GAP);
  const n = Math.floor(stage.path.length / sp);
  const h = Array.from({ length: n }, (_, i) => ground.roadHeightAt(i * sp));
  const lows: { d: number; prominence: number }[] = [];
  const w = Math.round(LOW_WINDOW / sp);
  const pw = Math.round(PROMINENCE_WINDOW / sp);
  for (let i = w; i < n - w; i++) {
    const d = i * sp;
    if (!allowed(d)) continue;
    let low = true;
    for (let j = i - w; j <= i + w && low; j++) if (h[j]! < h[i]!) low = false;
    if (!low) continue;
    let left = h[i]!;
    let right = h[i]!;
    for (let j = Math.max(0, i - pw); j < i; j++) left = Math.max(left, h[j]!);
    for (let j = i + 1; j <= Math.min(n - 1, i + pw); j++) right = Math.max(right, h[j]!);
    lows.push({ d, prominence: Math.min(left, right) - h[i]! });
  }
  lows.sort((a, b) => b.prominence - a.prominence);
  // The rest by how far each stands above the lowest road near it: the nearest thing to a dip first.
  const lift = (d: number) => {
    let low = Infinity;
    for (let e = -LIFT_WINDOW; e <= LIFT_WINDOW; e += sp)
      low = Math.min(low, ground.roadHeightAt(d + e));
    return ground.roadHeightAt(d) - low;
  };
  const rest: { d: number; lift: number }[] = [];
  for (let d = stage.startDistance + ENDS; d < finish - ENDS; d += REST_STEP)
    if (allowed(d)) rest.push({ d, lift: lift(d) });
  rest.sort((a, b) => a.lift - b.lift);
  return { dips: lows.map((l) => l.d), rest: rest.map((r) => r.d) };
}

/** One side of a river from the crossing, outward: its points, without the crossing itself. */
function traceSide(
  ground: RiverGround,
  style: RiverStyle,
  start: RoadSample,
  along: number,
  side: 1 | -1,
  others: readonly River[],
  phase: number,
): { x: number; z: number }[] {
  const stage = ground.stage;
  const path = stage.path;
  const hit = createRoadHit();
  const reach = stage.halfWidth + ground.corridor + ROAD_GAP;
  let phi = start.heading + (side * Math.PI) / 2;
  let x = start.x;
  let z = start.z;
  const out: { x: number; z: number }[] = [];
  // Near another road, or another river: no good.
  const blocked = (px: number, pz: number, run: number) => {
    if (path.nearest(px, pz, reach, hit)) {
      const own = Math.abs(hit.along - along) < OWN_ROAD && run < OWN_RUN;
      if (!own) return true;
    }
    if (stage.town && plateauDistance(stage.town, px, pz) < reach) return true;
    return others.some((r) => r.points.some((p) => Math.hypot(p.x - px, p.z - pz) < RIVER_GAP));
  };
  for (let run = STEP; run <= style.reach; run += STEP) {
    const meander = MEANDER_SWING * Math.sin(run / MEANDER_LENGTH + phase);
    let best = NaN;
    let bestCost = Infinity;
    for (let k = -FAN; k <= FAN; k++) {
      const turn = k * FAN_STEP;
      const a = phi + turn;
      const nx = x + Math.sin(a) * STEP;
      const nz = z + Math.cos(a) * STEP;
      if (blocked(nx, nz, run)) continue;
      const cost =
        ground.groundHeight(nx, nz) +
        TURN_COST * turn * turn +
        MEANDER_COST * (wrap(a - (start.heading + (side * Math.PI) / 2)) - meander) ** 2;
      if (cost < bestCost) {
        bestCost = cost;
        best = a;
      }
    }
    if (Number.isNaN(best)) break;
    phi = best;
    x += Math.sin(phi) * STEP;
    z += Math.cos(phi) * STEP;
    out.push({ x, z });
  }
  return out;
}

/** The river through the road at `along`, or null where it cannot run far enough either side. */
function traceRiver(
  ground: RiverGround,
  style: RiverStyle,
  along: number,
  others: readonly River[],
  rand: () => number,
): River | null {
  const stage = ground.stage;
  const at: RoadSample = { x: 0, z: 0, heading: 0 };
  stage.path.sample(along, at);
  const left = traceSide(ground, style, at, along, 1, others, rand() * 10);
  const right = traceSide(ground, style, at, along, -1, others, rand() * 10);
  if (left.length * STEP < MIN_SIDE || right.length * STEP < MIN_SIDE) return null;
  const line = [...left.reverse(), { x: at.x, z: at.z }, ...right];
  const index = left.length;
  // The ice: a channel's depth under the ground smoothed along the river, drawn down at the crossing.
  const raw = line.map((p) => ground.groundHeight(p.x, p.z));
  const smooth = raw.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - 3); j <= Math.min(raw.length - 1, i + 3); j++) {
      s += raw[j]!;
      n++;
    }
    return s / n;
  });
  const deck = ground.roadHeightAt(along);
  const target = Math.min(smooth[index]! - style.depth, deck - style.clearance);
  const total = (line.length - 1) * STEP;
  const points = line.map((p, i): RiverPoint => {
    const s = Math.abs(i - index) * STEP;
    const w = 1 - smoothstep(0, GORGE, s);
    const base = smooth[i]! - style.depth;
    const level = Math.min(base + (target - base) * w, raw[i]! - UNDER);
    const fromEnd = Math.min(i * STEP, total - i * STEP);
    return { x: p.x, z: p.z, level, fade: smoothstep(0, FADE, fromEnd) };
  });
  const span = style.halfWidth + BANK_SPAN;
  return {
    points,
    halfWidth: style.halfWidth,
    crossing: { along, x: at.x, z: at.z, heading: at.heading, index },
    bridge: { from: along - span, to: along + span },
  };
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** The river nearest a point: how far from its line, the ice's height and fade there, its half width. */
export interface RiverHit {
  distance: number;
  level: number;
  fade: number;
  halfWidth: number;
}

interface Segment {
  a: RiverPoint;
  b: RiverPoint;
  halfWidth: number;
}

const CELL = 16;

/** The rivers' segments filed in a grid, for `riverAt` queries within `reach` of a river's line. */
export class RiverIndex {
  private readonly grid = new SpatialHash<Segment>(CELL);

  constructor(
    rivers: readonly River[],
    readonly reach: number,
  ) {
    for (const r of rivers)
      for (let i = 0; i + 1 < r.points.length; i++) {
        const a = r.points[i]!;
        const b = r.points[i + 1]!;
        const seg = { a, b, halfWidth: r.halfWidth };
        const n = Math.max(1, Math.ceil(STEP / (CELL / 2)));
        for (let k = 0; k <= n; k++)
          this.grid.insert(seg, a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n, reach);
      }
  }

  /** The nearest river within `reach` of (x, z) into `out`; false when none. */
  at(x: number, z: number, out: RiverHit): boolean {
    let best = Infinity;
    this.grid.near(x, z, 0, (s) => {
      const dx = s.b.x - s.a.x;
      const dz = s.b.z - s.a.z;
      const len2 = dx * dx + dz * dz;
      let t = len2 > 0 ? ((x - s.a.x) * dx + (z - s.a.z) * dz) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - (s.a.x + dx * t), z - (s.a.z + dz * t));
      if (d < best && d <= this.reach) {
        best = d;
        out.distance = d;
        out.level = s.a.level + (s.b.level - s.a.level) * t;
        out.fade = s.a.fade + (s.b.fade - s.a.fade) * t;
        out.halfWidth = s.halfWidth;
      }
    });
    return best !== Infinity;
  }

  /**
   * The lowest carved bed over every river segment within `reach` of (x, z):
   * each segment's floor (`floor` under its ice, raised by `rise` where it
   * fades) plus `bank` per metre past its half width. Taken over all of them,
   * not the nearest, so where two stretches of a winding river come close
   * the bed has no step between them. Infinity away from every river.
   */
  bedAt(x: number, z: number, floor: number, rise: number, bank: number): number {
    let bed = Infinity;
    this.grid.near(x, z, 0, (s) => {
      const dx = s.b.x - s.a.x;
      const dz = s.b.z - s.a.z;
      const len2 = dx * dx + dz * dz;
      let t = len2 > 0 ? ((x - s.a.x) * dx + (z - s.a.z) * dz) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - (s.a.x + dx * t), z - (s.a.z + dz * t));
      if (d > this.reach) return;
      const level = s.a.level + (s.b.level - s.a.level) * t;
      const fade = s.a.fade + (s.b.fade - s.a.fade) * t;
      bed = Math.min(bed, level - floor + (1 - fade) * rise + Math.max(0, d - s.halfWidth) * bank);
    });
    return bed;
  }
}

/** A bridge's parapets stand this far past the carriageway's edge (their middle), this thick, and run this far past the span at each end. */
export const PARAPET_OUT = 0.55;
export const PARAPET_HALF = 0.3;
export const PARAPET_RUN = 3;
/** Collider pieces along a parapet are this long. */
const PARAPET_PIECE = 3;

/** The road distances a bridge's parapets (and its deck) run between. */
export function bridgeSpan(r: River): { from: number; to: number } {
  return { from: r.bridge.from - PARAPET_RUN, to: r.bridge.to + PARAPET_RUN };
}

/** The bridges' parapets as colliders: short boxes along both edges of every span. */
export function bridgeObstacles(
  stage: Pick<StageDef, 'path' | 'halfWidth'>,
  rivers: readonly River[],
): BoxObstacle[] {
  return edgeObstacles(stage, rivers.map(bridgeSpan), stage.halfWidth + PARAPET_OUT, PARAPET_HALF);
}

/**
 * A rail or parapet along both edges of each span of road, `off` metres out
 * from the centre line (its middle) and `half` thick each way, as short boxes.
 */
export function edgeObstacles(
  stage: Pick<StageDef, 'path'>,
  spans: readonly { from: number; to: number }[],
  off: number,
  half: number,
): BoxObstacle[] {
  const out: BoxObstacle[] = [];
  const a: RoadSample = { x: 0, z: 0, heading: 0 };
  const b: RoadSample = { x: 0, z: 0, heading: 0 };
  for (const { from, to } of spans) {
    for (let d = from; d < to - 1e-6; d += PARAPET_PIECE) {
      const e = Math.min(to, d + PARAPET_PIECE);
      stage.path.sample(d, a);
      stage.path.sample(e, b);
      for (const side of [1, -1]) {
        const x0 = a.x + Math.cos(a.heading) * off * side;
        const z0 = a.z - Math.sin(a.heading) * off * side;
        const x1 = b.x + Math.cos(b.heading) * off * side;
        const z1 = b.z - Math.sin(b.heading) * off * side;
        out.push({
          x: (x0 + x1) / 2,
          z: (z0 + z1) / 2,
          hx: half,
          hz: Math.hypot(x1 - x0, z1 - z0) / 2 + 0.15,
          yaw: Math.atan2(x1 - x0, z1 - z0),
        });
      }
    }
  }
  return out;
}
