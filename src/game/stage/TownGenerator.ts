import { hashSeed, mulberry32 } from '../rng';
import { createRoadHit, type RoadPath } from './RoadPath';
import {
  streetDistance,
  type Arrow,
  type Barrier,
  type Building,
  type BuildingStyle,
  type Street,
  type TownDef,
} from './Town';

/** Share of stages (after the first) whose route threads a town. */
export const TOWN_CHANCE = 0.35;
/** Blocked side streets reach this far from the intersection; the barrier row stands part-way down. */
export const STUB_LENGTH = 32;
export const BARRIER_DISTANCE = 14;
/** Direction boards stand this far in front of the barrier row they belong to. */
const ARROW_AHEAD_OF_BARRIER = 1.6;
/** Entry and exit legs at least this long get a crossroads halfway along. */
export const CROSSROADS_BLOCK = 80;
/** Building fronts stand this far beyond the street edge: a pavement plus a strip. */
const FRONT_SETBACK = 3;
/** No building starts closer than this to an intersection (more on sharp corners), so facades on crossing streets never meet. */
const CORNER_SETBACK = 18;
const SHARP_SETBACK = 24;
/** Buildings may start this close to the town's entry and exit points. */
const EDGE_SETBACK = 4;
/** Footprint corners stay this far outside every street's carriageway: the pavement and a strip, like their own front. */
export const STREET_CLEARANCE = 2.5;
/** Plateau margin beyond the street grid: along the route (room for the approach ramps) and across. */
const MARGIN_U = 70;
const MARGIN_V = 40;
/** Narrow streets widen back to the stage road over this distance beyond their ends. */
const WIDTH_TAPER = 24;

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

interface Pt {
  x: number;
  z: number;
}

/** One leg of the route as the centreline builder laid it in the world. */
export interface TracedLeg {
  kind: 'straight' | 'curve';
  /** Two points for a straight; the arc's chord points for a curve. */
  points: Pt[];
  headingIn: number;
  /** Heading at the leg's end, before its corner. */
  headingOut: number;
  turn: number;
  halfWidth: number;
  radius: number;
  sweep: number;
  /** Straight length, or arc length. */
  length: number;
}

/** Where the builder laid the town: entry point and heading, every leg, the exit point. */
export interface TownTrace {
  entry: Pt & { heading: number };
  legs: TracedLeg[];
  exit: Pt;
}

/** Deterministic per stage seed; never on a game's first stage (the splash demo and the smoke tests drive it). */
export function hasTown(seed: number, index: number): boolean {
  return index > 0 && (hashSeed(seed, 'town') % 1000) / 1000 < TOWN_CHANCE;
}

/** Per-sample half widths when any route street is narrower than the stage road; undefined when none is. */
export function buildWidths(path: RoadPath, town: TownDef, base: number): Float64Array | undefined {
  const narrow = town.streets.filter((s) => s.route && s.halfWidth < base - 1e-6);
  if (narrow.length === 0) return undefined;
  const w = new Float64Array(path.count).fill(base);
  const hit = createRoadHit();
  for (const s of narrow) {
    path.nearest(s.x0, s.z0, 30, hit);
    const a0 = hit.along;
    path.nearest(s.x1, s.z1, 30, hit);
    const a1 = hit.along;
    const lo = Math.min(a0, a1);
    const hi = Math.max(a0, a1);
    for (let i = 0; i < path.count; i++) {
      const d = i * path.spacing;
      const out = d < lo ? lo - d : d > hi ? d - hi : 0;
      const t = Math.min(1, out / WIDTH_TAPER);
      w[i] = Math.min(w[i]!, s.halfWidth + (base - s.halfWidth) * t);
    }
  }
  return w;
}

function forward(heading: number): Pt {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

function left(heading: number): Pt {
  return { x: Math.cos(heading), z: -Math.sin(heading) };
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

/** Buildings along one straight street between `from` and `to` along it, both sides, doors (local -z) facing the street. */
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
  const l = left(heading);
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
        x: start.x + f.x * along + l.x * off,
        z: start.z + f.z * along + l.z * off,
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

/** Buildings around a curved leg on both sides of the arc, fronts following the bend. */
function lineCurve(rand: () => number, leg: TracedLeg, out: Building[]): void {
  const start = leg.points[0]!;
  const bend = Math.sign(leg.sweep) || 1;
  const l = left(leg.headingIn);
  const centre = { x: start.x + l.x * bend * leg.radius, z: start.z + l.z * bend * leg.radius };
  // Angle of the start point about the centre; the arc sweeps `leg.sweep` from there.
  const a0 = Math.atan2(start.x - centre.x, start.z - centre.z);
  for (const side of [1, -1] as const) {
    const style0 = pickStyle(rand);
    const r =
      leg.radius + side * bend * -1 * (leg.halfWidth + FRONT_SETBACK + BUILDING_SIZE[style0].hz);
    if (r < 5) continue;
    const total = r * Math.abs(leg.sweep);
    let cursor = 3 + rand() * 2;
    while (cursor < total - 3) {
      const style = pickStyle(rand);
      const { hx, hz } = BUILDING_SIZE[style];
      if (cursor + 2 * hx > total - 3) break;
      const rr = leg.radius + side * bend * -1 * (leg.halfWidth + FRONT_SETBACK + hz);
      const theta = a0 + (bend * (cursor + hx)) / rr;
      const x = centre.x + Math.sin(theta) * rr;
      const z = centre.z + Math.cos(theta) * rr;
      // Tangent heading at this angle, then the door faces the street.
      const tangent = theta + (bend * Math.PI) / 2;
      out.push({
        style,
        x,
        z,
        yaw: tangent + (side * Math.PI) / 2,
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

/** World corners of a footprint. */
function corners(b: Building): Pt[] {
  const sy = Math.sin(b.yaw);
  const cy = Math.cos(b.yaw);
  return (
    [
      [b.hx, b.hz],
      [-b.hx, b.hz],
      [b.hx, -b.hz],
      [-b.hx, -b.hz],
    ] as const
  ).map(([u, v]) => ({ x: b.x + u * cy + v * sy, z: b.z - u * sy + v * cy }));
}

/** Drop any building whose footprint reaches a street or an earlier building. */
function settle(candidates: readonly Building[], streets: readonly Street[]): Building[] {
  const kept: Building[] = [];
  for (const b of candidates) {
    const clear = corners(b).every((c) =>
      streets.every((s) => streetDistance(s, c.x, c.z) >= s.halfWidth + STREET_CLEARANCE),
    );
    if (!clear) continue;
    const rb = Math.hypot(b.hx, b.hz);
    // Room for both terraces: neighbours stay apart by most of their diagonals.
    if (kept.some((k) => Math.hypot(k.x - b.x, k.z - b.z) < 0.95 * (rb + Math.hypot(k.hx, k.hz))))
      continue;
    kept.push(b);
  }
  return kept;
}

const setbackFor = (turn: number) =>
  Math.abs(turn) > (19 * Math.PI) / 36 ? SHARP_SETBACK : CORNER_SETBACK;

/** Lay the town's streets, barriers, direction boards, buildings and footprint around the route the builder traced. */
export function layoutTown(trace: TownTrace, path: RoadPath, seed: number): TownDef {
  const rand = mulberry32(hashSeed(seed, 'town-layout'));
  const streets: Street[] = [];
  const barriers: Barrier[] = [];
  const candidates: Building[] = [];
  const arrows: Arrow[] = [];
  const legs = trace.legs;
  legs.forEach((leg, i) => {
    const first = i === 0;
    const last = i === legs.length - 1;
    const prev = legs[i - 1];
    if (leg.kind === 'curve') {
      for (let k = 0; k < leg.points.length - 1; k++)
        streets.push(street(leg.points[k]!, leg.points[k + 1]!, leg.halfWidth, true));
      lineCurve(rand, leg, candidates);
      return;
    }
    const a = leg.points[0]!;
    const b = leg.points[1]!;
    const h = leg.headingIn;
    streets.push(street(a, b, leg.halfWidth, true));
    const from = first
      ? EDGE_SETBACK
      : prev && prev.kind === 'straight'
        ? setbackFor(prev.turn)
        : EDGE_SETBACK;
    const to =
      leg.length - (last ? EDGE_SETBACK : leg.turn !== 0 ? setbackFor(leg.turn) : EDGE_SETBACK);
    if ((first || last) && leg.length >= CROSSROADS_BLOCK) {
      // A crossroads halfway along the entry and exit legs where the route goes straight on.
      const f = forward(h);
      const mid = { x: a.x + (f.x * leg.length) / 2, z: a.z + (f.z * leg.length) / 2 };
      for (const side of [1, -1] as const)
        sideStreet(
          rand,
          mid,
          h + (side * Math.PI) / 2,
          leg.halfWidth,
          streets,
          barriers,
          candidates,
        );
      lineStreet(rand, a, h, from, leg.length / 2 - CORNER_SETBACK, leg.halfWidth, candidates);
      lineStreet(rand, a, h, leg.length / 2 + CORNER_SETBACK, to, leg.halfWidth, candidates);
    } else {
      lineStreet(rand, a, h, from, to, leg.halfWidth, candidates);
    }
    if (leg.turn !== 0) {
      // Straight on and the far side are blocked; a board just in front of the straight-on barrier shows the turn.
      const hout = leg.headingOut;
      sideStreet(rand, b, hout, leg.halfWidth, streets, barriers, candidates);
      sideStreet(rand, b, hout + leg.turn + Math.PI, leg.halfWidth, streets, barriers, candidates);
      const f = forward(hout);
      arrows.push({
        x: b.x + f.x * (BARRIER_DISTANCE - ARROW_AHEAD_OF_BARRIER),
        z: b.z + f.z * (BARRIER_DISTANCE - ARROW_AHEAD_OF_BARRIER),
        yaw: hout,
        turn: leg.turn > 0 ? 1 : -1,
      });
    }
  });
  const buildings = settle(candidates, streets);

  // Footprint: the bounding box of everything in the town frame, with ramp room along the route.
  const h0 = trace.entry.heading;
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
