import { hashSeed, mulberry32 } from '../rng';
import { createRoadHit, type RoadPath } from './RoadPath';
import type { Arrow, Barrier, Building, BuildingStyle, Street, TownDef } from './Town';

/** Share of stages (after the first) whose route threads a town. */
export const TOWN_CHANCE = 0.35;
/** Control-point spacing of the centreline builder; blocks are whole multiples of it. */
const STEP = 20;
/** Blocked side streets reach this far from the intersection; the barrier row stands part-way down. */
export const STUB_LENGTH = 32;
export const BARRIER_DISTANCE = 14;
/** Building fronts stand this far beyond the street edge: a pavement plus a strip. */
const FRONT_SETBACK = 3;
/** No building starts closer than this to an intersection, so facades on crossing streets never meet. */
const CORNER_SETBACK = 18;
/** Buildings may start this close to the town's entry and exit points. */
const EDGE_SETBACK = 4;
/** Blocks at least this long get a crossroads halfway along the entry and exit legs. */
export const CROSSROADS_BLOCK = 80;
/** Plateau margin beyond the street grid: along the route (room for the approach ramps) and across. */
const MARGIN_U = 70;
const MARGIN_V = 40;

/** Turn sequences; every one sums to zero so the route leaves the town on the heading it arrived with. */
const PATTERNS: readonly (readonly (1 | -1)[])[] = [
  [1, -1],
  [-1, 1],
  [1, -1, 1, -1],
  [-1, 1, -1, 1],
  [1, -1, -1, 1],
  [-1, 1, 1, -1],
];

/** Footprint half extents per style: `hx` across the front, `hz` deep. */
export const BUILDING_SIZE: Readonly<Record<BuildingStyle, { hx: number; hz: number }>> = {
  townhouse: { hx: 4, hz: 3.5 },
  shop: { hx: 5, hz: 4 },
  tower: { hx: 3, hz: 3 },
  hall: { hx: 6, hz: 4.5 },
};
const STYLE_WEIGHTS: readonly (readonly [BuildingStyle, number])[] = [
  ['townhouse', 4],
  ['shop', 3],
  ['tower', 1],
  ['hall', 1],
];

/** What the centreline builder needs: where the town's entry leg starts, how long a block is, which way each corner turns. */
export interface TownPlan {
  /** Control distance at which the entry leg (one block before the first corner) begins. */
  entryAt: number;
  block: number;
  turns: readonly (1 | -1)[];
}

/** Where the builder actually laid the town: entry point and heading, each corner, the exit point. */
export interface TownTrace {
  entry: { x: number; z: number; heading: number };
  corners: { x: number; z: number }[];
  exit: { x: number; z: number };
}

interface Pt {
  x: number;
  z: number;
}

/** Deterministic per stage seed; never on a game's first stage (the splash demo and the smoke tests drive it). */
export function hasTown(seed: number, index: number): boolean {
  return index > 0 && (hashSeed(seed, 'town') % 1000) / 1000 < TOWN_CHANCE;
}

/** The town's shape and where it sits: first corner between 30% and 55% of the stage, snapped to the control grid. */
export function planTown(seed: number, startDistance: number, length: number): TownPlan {
  const rand = mulberry32(hashSeed(seed, 'town'));
  const block = rand() < 0.5 ? 60 : 80;
  const patterns = length < 1500 ? PATTERNS.slice(0, 2) : PATTERNS;
  const turns = patterns[Math.floor(rand() * patterns.length)]!;
  const corner = startDistance + length * (0.3 + 0.25 * rand());
  return { entryAt: Math.max(STEP * 3, Math.round((corner - block) / STEP) * STEP), block, turns };
}

/** Control distance the town occupies: entry leg, one leg per corner, exit leg. */
export function townSpan(plan: TownPlan): number {
  return plan.block * (plan.turns.length + 2);
}

function forward(heading: number): Pt {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

function street(a: Pt, b: Pt, halfWidth: number, route: boolean): Street {
  return { x0: a.x, z0: a.z, x1: b.x, z1: b.z, halfWidth, route };
}

function pickStyle(rand: () => number): BuildingStyle {
  let total = 0;
  for (const [, w] of STYLE_WEIGHTS) total += w;
  let r = rand() * total;
  for (const [style, w] of STYLE_WEIGHTS) {
    r -= w;
    if (r <= 0) return style;
  }
  return 'townhouse';
}

/**
 * Buildings along one straight street between `from` and `to` along it, on
 * both sides, fronts `FRONT_SETBACK` beyond the edge, doors (local -z) facing
 * the street. `heading` is the street's direction from its start point.
 */
function lineStreet(
  rand: () => number,
  start: Pt,
  heading: number,
  from: number,
  to: number,
  halfWidth: number,
  out: Building[],
): void {
  const f = forward(heading);
  const left = { x: Math.cos(heading), z: -Math.sin(heading) };
  for (const side of [1, -1] as const) {
    let cursor = from + 1.5 + rand() * 2.5;
    while (cursor < to) {
      const style = pickStyle(rand);
      const { hx, hz } = BUILDING_SIZE[style];
      if (cursor + 2 * hx > to) break;
      const along = cursor + hx;
      const off = (halfWidth + FRONT_SETBACK + hz) * side;
      out.push({
        style,
        x: start.x + f.x * along + left.x * off,
        z: start.z + f.z * along + left.z * off,
        // The door side faces the street: local +z points away from it.
        yaw: heading + (side * Math.PI) / 2,
        hx,
        hz,
        variant: rand() < 0.5 ? 0 : 1,
      });
      cursor += 2 * hx + 1.5 + rand() * 2.5;
    }
  }
}

/** Blocked side street from an intersection: the stub, its barrier row and the buildings lining it. */
function sideStreet(
  rand: () => number,
  at: Pt,
  heading: number,
  halfWidth: number,
  streets: Street[],
  barriers: Barrier[],
  buildings: Building[],
): void {
  const f = forward(heading);
  const end = { x: at.x + f.x * STUB_LENGTH, z: at.z + f.z * STUB_LENGTH };
  streets.push(street(at, end, halfWidth, false));
  barriers.push({
    x: at.x + f.x * BARRIER_DISTANCE,
    z: at.z + f.z * BARRIER_DISTANCE,
    yaw: heading,
    halfLength: halfWidth + 0.6,
  });
  lineStreet(rand, at, heading, CORNER_SETBACK, STUB_LENGTH, halfWidth, buildings);
}

/** Lay the town's streets, barriers, direction boards, buildings and plateau around the route the builder traced. */
export function layoutTown(
  plan: TownPlan,
  trace: TownTrace,
  path: RoadPath,
  halfWidth: number,
  seed: number,
): TownDef {
  const rand = mulberry32(hashSeed(seed, 'town-layout'));
  const streets: Street[] = [];
  const barriers: Barrier[] = [];
  const buildings: Building[] = [];
  const arrows: Arrow[] = [];
  const h0 = trace.entry.heading;
  // Headings of each leg: entry, after each corner, exit (back on h0).
  const headings = [h0];
  for (const t of plan.turns) headings.push(headings[headings.length - 1]! + (t * Math.PI) / 2);
  const points: Pt[] = [trace.entry, ...trace.corners, trace.exit];

  for (let leg = 0; leg < points.length - 1; leg++) {
    const a = points[leg]!;
    const b = points[leg + 1]!;
    const h = headings[leg]!;
    streets.push(street(a, b, halfWidth, true));
    const first = leg === 0;
    const last = leg === points.length - 2;
    const from = first ? EDGE_SETBACK : CORNER_SETBACK;
    const to = plan.block - (last ? EDGE_SETBACK : CORNER_SETBACK);
    if ((first || last) && plan.block >= CROSSROADS_BLOCK) {
      // A crossroads halfway along the entry and exit legs where the route goes straight on;
      // only on long blocks, where its building rows clear the corner stubs' rows.
      const f = forward(h);
      const mid = { x: a.x + (f.x * plan.block) / 2, z: a.z + (f.z * plan.block) / 2 };
      for (const side of [1, -1] as const)
        sideStreet(rand, mid, h + (side * Math.PI) / 2, halfWidth, streets, barriers, buildings);
      lineStreet(rand, a, h, from, plan.block / 2 - CORNER_SETBACK, halfWidth, buildings);
      lineStreet(rand, a, h, plan.block / 2 + CORNER_SETBACK, to, halfWidth, buildings);
    } else {
      lineStreet(rand, a, h, from, to, halfWidth, buildings);
    }
  }
  trace.corners.forEach((c, k) => {
    const hin = headings[k]!;
    const hout = headings[k + 1]!;
    // Straight on and the far side are blocked; a board across the junction shows the turn.
    sideStreet(rand, c, hin, halfWidth, streets, barriers, buildings);
    sideStreet(rand, c, hout + Math.PI, halfWidth, streets, barriers, buildings);
    const f = forward(hin);
    arrows.push({
      x: c.x + f.x * (halfWidth + 2.2),
      z: c.z + f.z * (halfWidth + 2.2),
      yaw: hin,
      turn: plan.turns[k]!,
    });
  });

  // Plateau: the bounding box of everything in the town frame, with ramp room along the route.
  const sy = Math.sin(h0);
  const cy = Math.cos(h0);
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  const extend = (p: Pt) => {
    const dx = p.x - trace.entry.x;
    const dz = p.z - trace.entry.z;
    const u = dx * sy + dz * cy;
    const v = dx * cy - dz * sy;
    uMin = Math.min(uMin, u);
    uMax = Math.max(uMax, u);
    vMin = Math.min(vMin, v);
    vMax = Math.max(vMax, v);
  };
  for (const s of streets) {
    extend({ x: s.x0, z: s.z0 });
    extend({ x: s.x1, z: s.z1 });
  }
  for (const b of buildings) extend(b);
  const cu = (uMin + uMax) / 2;
  const cv = (vMin + vMax) / 2;
  const hit = createRoadHit();
  path.nearest(trace.entry.x, trace.entry.z, 20, hit);
  const from = hit.along;
  path.nearest(trace.exit.x, trace.exit.z, 20, hit);
  const to = hit.along;
  return {
    x: trace.entry.x + cu * sy + cv * cy,
    z: trace.entry.z + cu * cy - cv * sy,
    heading: h0,
    halfU: (uMax - uMin) / 2 + MARGIN_U,
    halfV: (vMax - vMin) / 2 + MARGIN_V,
    from,
    to,
    streets,
    buildings,
    barriers,
    arrows,
  };
}
