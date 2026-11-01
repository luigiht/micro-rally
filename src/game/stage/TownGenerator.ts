import { hashSeed, mulberry32 } from '../rng';
import { createRoadHit, type RoadPath } from './RoadPath';
import { tangentLength } from './TownPlan';
import {
  streetDistance,
  type Arrow,
  type Barrier,
  type Building,
  type BuildingStyle,
  type Street,
  type TownDef,
} from './Town';

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

/** One leg of the route as the centreline builder laid it in the world; corners are the arcs between straights. */
export interface TracedLeg {
  kind: 'straight' | 'curve' | 'corner';
  /** Two points for a straight; the arc's chord points for a curve or corner. */
  points: Pt[];
  headingIn: number;
  /** Heading at the leg's end, before its corner. */
  headingOut: number;
  turn: number;
  halfWidth: number;
  radius: number;
  sweep: number;
  /** Straight length (after its corner tangents), or arc length. */
  length: number;
  /** Corners: the polygon corner the arc cuts, where the side streets meet. */
  corner?: Pt;
}

/** Where the builder laid the town: entry point and heading, every leg, the exit point. */
export interface TownTrace {
  entry: Pt & { heading: number };
  legs: TracedLeg[];
  exit: Pt;
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
  endStyle: BuildingStyle = rand() < 0.5 ? 'townhouse' : 'shop',
): void {
  const f = forward(heading);
  const end = { x: at.x + f.x * STUB_LENGTH, z: at.z + f.z * STUB_LENGTH };
  streets.push(street(at, end, halfWidth, false));
  // The row reaches the building line so the pavement cannot be used to squeeze past.
  barriers.push({
    x: at.x + f.x * BARRIER_DISTANCE,
    z: at.z + f.z * BARRIER_DISTANCE,
    yaw: heading,
    halfLength: halfWidth + FRONT_SETBACK - 0.6,
  });
  lineStreet(rand, at, heading, CORNER_SETBACK, STUB_LENGTH, halfWidth, buildings);
  // A building closes the dead end, facing back down the street.
  const { hx, hz } = BUILDING_SIZE[endStyle];
  const back = STUB_LENGTH + FRONT_SETBACK - 0.5 + hz;
  buildings.push({
    style: endStyle,
    x: at.x + f.x * back,
    z: at.z + f.z * back,
    yaw: heading + Math.PI,
    hx,
    hz,
    variant: rand() < 0.5 ? 0 : 1,
  });
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
  let cornersSeen = 0;
  legs.forEach((leg, i) => {
    const first = i === 0;
    const last = i === legs.length - 1;
    if (leg.kind === 'curve' || leg.kind === 'corner') {
      for (let k = 0; k < leg.points.length - 1; k++)
        streets.push(street(leg.points[k]!, leg.points[k + 1]!, leg.halfWidth, true));
      if (leg.kind === 'curve') {
        lineCurve(rand, leg, candidates);
        return;
      }
      // Straight on and the far side are blocked at the polygon corner; a board ahead of the
      // straight-on barrier shows the turn. The first corner's blocked straight is closed by the
      // town hall, the landmark the driver brakes toward.
      const c = leg.corner!;
      const hin = leg.headingIn;
      const hout = leg.headingOut;
      sideStreet(
        rand,
        c,
        hin,
        leg.halfWidth,
        streets,
        barriers,
        candidates,
        cornersSeen === 0 ? 'hall' : undefined,
      );
      sideStreet(rand, c, hout + Math.PI, leg.halfWidth, streets, barriers, candidates);
      const f = forward(hin);
      arrows.push({
        x: c.x + f.x * (BARRIER_DISTANCE - ARROW_AHEAD_OF_BARRIER),
        z: c.z + f.z * (BARRIER_DISTANCE - ARROW_AHEAD_OF_BARRIER),
        yaw: hin,
        turn: leg.turn > 0 ? 1 : -1,
      });
      cornersSeen++;
      return;
    }
    const a = leg.points[0]!;
    const b = leg.points[1]!;
    const h = leg.headingIn;
    streets.push(street(a, b, leg.halfWidth, true));
    // Setbacks are measured from the polygon corners, a tangent length beyond the straight's ends.
    const prev = legs[i - 1];
    const next = legs[i + 1];
    const inTangent = prev?.kind === 'corner' ? tangentLength(prev.turn) : 0;
    const outTangent = next?.kind === 'corner' ? tangentLength(next.turn) : 0;
    const from = first
      ? EDGE_SETBACK
      : prev?.kind === 'corner'
        ? Math.max(0, setbackFor(prev.turn) - inTangent)
        : EDGE_SETBACK;
    const to =
      leg.length -
      (last
        ? EDGE_SETBACK
        : next?.kind === 'corner'
          ? Math.max(0, setbackFor(next.turn) - outTangent)
          : EDGE_SETBACK);
    const planned = leg.length + inTangent + outTangent;
    if ((first || last) && planned >= CROSSROADS_BLOCK) {
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
  });
  // The hall and the end buildings were pushed by the side streets; settle them before the rows so they survive.
  const ordered = [
    ...candidates.filter((b) => b.style === 'hall'),
    ...candidates.filter((b) => b.style !== 'hall'),
  ];
  const buildings = settle(ordered, streets);

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
