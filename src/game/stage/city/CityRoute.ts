import { hashSeed, mulberry32 } from '../../rng';
import type { UrbanDef } from '../regions';
import { FILLET } from '../Town';
import { samplePoints, selfSeparated, tangentLength, type TownLeg } from '../TownPlan';
import { across, cityGrid, edgeBetween, HALF_COLS, type CityGraph } from './CityGrid';
import { planTramLoop } from './TramLoop';

/**
 * The stage's route through the city map: a walk along the grid's streets
 * from the start crossroads, never back the way it came and never through a
 * crossroads twice, turning left and right at the junctions (a block or
 * three straight, a block or two across), passing two or three roundabouts
 * at crossroads it drives straight through or turns left at, crossing the
 * tram loop's rails at four crossroads or more, and finishing
 * along an avenue at least `FINAL_RUN` metres from its last turn. Laid as
 * the same legs `buildCentreline` takes, in the plan frame (the start node at
 * the origin, the first street along +z), so every corner of the route lands
 * on its crossroads.
 */

/** Deflection onto and off a roundabout's ring: the angle and arc radius (as `UrbanPlan` lays them). */
export const DEFLECTION = (28 * Math.PI) / 180;
export const DEFLECTION_RADIUS = 20;
/** The warp's slight bends at crossroads round this (corners: see `cornerRadius`). */
const KINK_RADIUS = 30;
/** A turn under this at a crossroads is the warp's bend, not a corner. */
const KINK = (20 * Math.PI) / 180;
/** A straight keeps at least this much after its corner tangents. */
const MIN_TAIL = 8;
/** The finish: no turn in the last this-many metres (finish line 100 m in, run-out beyond). */
export const FINAL_RUN = 520;
/** The route keeps a column from the lattice's edge, so streets run beyond it on both sides. */
const SIDE_MARGIN = 2;
const MAX_ATTEMPTS = 200;
/** Roundabouts on the route: two, and a third from the second difficulty loop. */
const MIN_ROUNDABOUTS = 2;
const MAX_ROUNDABOUTS = 3;

export interface CityRoundabout {
  /** The crossroads it stands on, and its island's centre and radius in the plan frame. */
  node: number;
  x: number;
  z: number;
  islandRadius: number;
}

/** The city as planned: its map (in the plan frame), the route's crossroads in order, its roundabouts. */
export interface CityPlan {
  graph: CityGraph;
  route: number[];
  roundabouts: CityRoundabout[];
  /** The tram loop's crossroads in order round its rectangle (see `planTramLoop`); empty when it has none. */
  tram: number[];
}

const straight = (length: number, turn: number, radius: number, halfWidth: number): TownLeg => ({
  kind: 'straight',
  length,
  radius,
  sweep: 0,
  turn,
  halfWidth,
});

const curve = (radius: number, sweep: number, halfWidth: number): TownLeg => ({
  kind: 'curve',
  length: radius * Math.abs(sweep),
  radius,
  sweep,
  turn: 0,
  halfWidth,
});

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Rotate and shift the graph so node `start` is the origin and its street to `next` runs along +z. */
function toPlanFrame(g: CityGraph, start: number, next: number): void {
  const o = g.nodes[start]!;
  const n = g.nodes[next]!;
  const h = Math.atan2(n.x - o.x, n.z - o.z);
  const c = Math.cos(-h);
  const s = Math.sin(-h);
  const ox = o.x;
  const oz = o.z;
  for (const p of g.nodes) {
    const dx = p.x - ox;
    const dz = p.z - oz;
    // Turning a heading by φ maps (x, z) to (x cos φ + z sin φ, −x sin φ + z cos φ); here φ = −h.
    p.x = dx * c + dz * s;
    p.z = -dx * s + dz * c;
  }
}

/**
 * One roundabout passage, turning `turn` (left +) in all: a right deflection,
 * a left circulation and a right deflection, laid from heading 0 at the
 * origin. Returns how far before and after its virtual corner (where the in
 * and out lines meet) it starts and ends, and the island centre from that
 * corner, in the in-heading frame.
 */
export function ringPassage(
  ringRadius: number,
  turn: number,
): { before: number; after: number; centre: { x: number; z: number }; length: number } {
  let x = 0;
  let z = 0;
  let h = 0;
  let centre = { x: 0, z: 0 };
  const arc = (r: number, sweep: number, ring = false) => {
    const side = Math.sign(sweep);
    // Left of heading h is (cos h, −sin h); the arc's centre lies `side` that way.
    const cx = x + side * r * Math.cos(h);
    const cz = z - side * r * Math.sin(h);
    if (ring) centre = { x: cx, z: cz };
    h += sweep;
    x = cx - side * r * Math.cos(h);
    z = cz + side * r * Math.sin(h);
  };
  arc(DEFLECTION_RADIUS, -DEFLECTION);
  arc(ringRadius, 2 * DEFLECTION + turn, true);
  arc(DEFLECTION_RADIUS, -DEFLECTION);
  const length = 2 * DEFLECTION_RADIUS * DEFLECTION + ringRadius * (2 * DEFLECTION + turn);
  // Solve (x, z) = before·(0, 1) + after·(sin turn, cos turn).
  let before: number;
  let after: number;
  if (Math.abs(Math.sin(turn)) < 1e-6) {
    before = after = z / 2;
  } else {
    after = x / Math.sin(turn);
    before = z - after * Math.cos(turn);
  }
  return { before, after, centre: { x: centre.x, z: centre.z - before }, length };
}

/** A randomised walk from the start crossroads; null when it runs into a dead end. */
function walk(g: CityGraph, rand: () => number, span: number): number[] | null {
  const start = g.at(0, 0);
  const route = [start, g.at(0, 1)];
  const visited = new Set(route);
  let laid = length(g, start, route[1]!);
  // Direction across (0 = along the stage, ±1 = across), and blocks since the last turn.
  let di = 0;
  let run = 1;
  const isAvenueCol = (i: number) => i % 3 === 0;
  while (laid < span + 200) {
    const here = g.nodes[route[route.length - 1]!]!;
    const finishing = span - laid < FINAL_RUN + 120;
    const options: [number, number, number][] = [];
    const add = (ni: number, nj: number, w: number) => {
      if (Math.abs(ni) > HALF_COLS - SIDE_MARGIN) return;
      const id = g.at(ni, nj);
      if (id < 0 || visited.has(id) || !edgeBetween(g, here.id, id)) return;
      options.push([id, ni - here.i, w]);
    };
    if (finishing) {
      // Step across to the nearest avenue column (on the way the route was going, if it ties),
      // then straight on to the end.
      if (isAvenueCol(here.i)) add(here.i, here.j + 1, 1);
      else {
        const up = here.i + ((3 - (((here.i % 3) + 3) % 3)) % 3);
        const down = up - 3;
        const toward =
          di !== 0 && (up - here.i) * di > 0
            ? 1
            : di !== 0
              ? -1
              : up - here.i <= here.i - down
                ? 1
                : -1;
        if (di === 0 || toward === di) add(here.i + toward, here.j, 1);
        else add(here.i, here.j + 1, 1);
      }
    } else if (di === 0) {
      add(here.i, here.j + 1, run < 2 ? 3 : 1.2);
      if (run >= 1) {
        add(here.i + 1, here.j, 0.8);
        add(here.i - 1, here.j, 0.8);
      }
    } else {
      add(here.i, here.j + 1, run >= 1 ? 2 : 0);
      add(here.i + di, here.j, run < 2 ? 0.9 : 0.3);
    }
    if (options.length === 0) return null;
    let total = 0;
    for (const [, , w] of options) total += w;
    let r = rand() * total;
    let pick = options[options.length - 1]!;
    for (const o of options) {
      r -= o[2];
      if (r <= 0) {
        pick = o;
        break;
      }
    }
    const [id, step] = pick;
    const ndi = step;
    run = ndi === di ? run + 1 : 1;
    di = ndi;
    laid += length(g, here.id, id);
    route.push(id);
    visited.add(id);
  }
  return route;
}

function length(g: CityGraph, a: number, b: number): number {
  const p = g.nodes[a]!;
  const q = g.nodes[b]!;
  return Math.hypot(q.x - p.x, q.z - p.z);
}

function headingOf(g: CityGraph, a: number, b: number): number {
  const p = g.nodes[a]!;
  const q = g.nodes[b]!;
  return Math.atan2(q.x - p.x, q.z - p.z);
}

/** The corner at route index k (0 at the ends): the turn there, left +. */
function turnAt(g: CityGraph, route: readonly number[], k: number): number {
  if (k <= 0 || k >= route.length - 1) return 0;
  return wrap(headingOf(g, route[k]!, route[k + 1]!) - headingOf(g, route[k - 1]!, route[k]!));
}

/**
 * A corner rounds at the narrower street's half width plus the kerb return's
 * radius, so its inner edge is the junction's kerb return exactly and the
 * junction is square round it (`JunctionBox`); the warp's slight bends round
 * `KINK_RADIUS`.
 */
function cornerRadius(turn: number, hwIn: number, hwOut: number): number {
  return Math.abs(turn) < KINK ? KINK_RADIUS : Math.min(hwIn, hwOut) + FILLET;
}

/** The half widths either side of the route's crossroads `k`. */
function widthsAt(g: CityGraph, route: readonly number[], k: number): [number, number] {
  const hw = (a: number, b: number) => edgeBetween(g, route[a]!, route[b]!)?.halfWidth;
  const hwIn = hw(k - 1, k) ?? hw(k, k + 1)!;
  return [hwIn, hw(k, k + 1) ?? hwIn];
}

/** Pick the roundabouts: crossroads driven straight through or turned left at, with room either side. */
function pickRoundabouts(
  g: CityGraph,
  route: readonly number[],
  rand: () => number,
  count: number,
  span: number,
  def: UrbanDef,
): CityRoundabout[] {
  const out: CityRoundabout[] = [];
  let along = 0;
  const at: number[] = [0];
  for (let k = 1; k < route.length; k++) at.push((along += length(g, route[k - 1]!, route[k]!)));
  for (let n = 0; n < count; n++) {
    const target = span * (count === 1 ? 0.5 : 0.25 + (0.5 * n) / (count - 1));
    let best = -1;
    let bestGap = Infinity;
    for (let k = 2; k < route.length - 2; k++) {
      const turn = turnAt(g, route, k);
      if (turn < -0.17 || turn > 1.75) continue;
      if (Math.abs(turn) > 0.35 && Math.abs(turn - Math.PI / 2) > 0.35) continue;
      if (at[k]! < 250 || at[k]! > span - FINAL_RUN - 150) continue;
      if (out.some((r) => Math.abs(route.indexOf(r.node) - k) < 3)) continue;
      const ringHw = def.lanes.two;
      const islandRadius = def.island.min + rand() * (def.island.max - def.island.min);
      const p = ringPassage(islandRadius + ringHw, turn);
      const prevTurn = turnAt(g, route, k - 1);
      const nextTurn = turnAt(g, route, k + 1);
      const roomIn =
        length(g, route[k - 1]!, route[k]!) -
        tangentLength(prevTurn, cornerRadius(prevTurn, ...widthsAt(g, route, k - 1)));
      const roomOut =
        length(g, route[k]!, route[k + 1]!) -
        tangentLength(nextTurn, cornerRadius(nextTurn, ...widthsAt(g, route, k + 1)));
      if (p.before > roomIn - MIN_TAIL || p.after > roomOut - MIN_TAIL) continue;
      const gap = Math.abs(at[k]! - target);
      if (gap < bestGap) {
        bestGap = gap;
        best = k;
        // Island centre in the plan frame: from the corner node, in the in-heading frame.
        const h = headingOf(g, route[k - 1]!, route[k]!);
        const node = g.nodes[route[k]!]!;
        const c = p.centre;
        // In-heading frame: +z forward (sin h, cos h), +x left (cos h, −sin h).
        const cand: CityRoundabout = {
          node: route[k]!,
          x: node.x + c.x * Math.cos(h) + c.z * Math.sin(h),
          z: node.z - c.x * Math.sin(h) + c.z * Math.cos(h),
          islandRadius,
        };
        if (out.length === n) out.push(cand);
        else out[n] = cand;
      }
    }
    if (best < 0) break;
  }
  return out;
}

/** Lay the route as legs: a straight per street, its corner at the crossroads, a passage at each roundabout. */
function routeLegs(
  g: CityGraph,
  route: readonly number[],
  roundabouts: readonly CityRoundabout[],
  span: number,
  def: UrbanDef,
): TownLeg[] {
  const legs: TownLeg[] = [];
  const ringAt = new Map(roundabouts.map((r) => [r.node, r]));
  let carryIn = 0;
  let laid = 0;
  for (let k = 1; k < route.length && laid < span; k++) {
    const a = route[k - 1]!;
    const b = route[k]!;
    const hw = edgeBetween(g, a, b)!.halfWidth;
    let len = length(g, a, b) - carryIn;
    carryIn = 0;
    const ring = ringAt.get(b);
    const turn = turnAt(g, route, k);
    if (ring) {
      const ringHw = def.lanes.two;
      const p = ringPassage(ring.islandRadius + ringHw, turn);
      len -= p.before;
      legs.push(straight(len, 0, 0, hw));
      const ringLeg = curve(ring.islandRadius + ringHw, 2 * DEFLECTION + turn, ringHw);
      ringLeg.roundabout = { islandRadius: ring.islandRadius };
      legs.push(
        curve(DEFLECTION_RADIUS, -DEFLECTION, hw),
        ringLeg,
        curve(DEFLECTION_RADIUS, -DEFLECTION, hw),
      );
      laid += len + p.length;
      carryIn = p.after;
      continue;
    }
    if (laid + len >= span) {
      legs.push(straight(span - laid, 0, 0, hw));
      laid = span;
      break;
    }
    const corner = Math.abs(turn) < 1e-4 ? 0 : turn;
    const radius = corner === 0 ? 0 : cornerRadius(corner, ...widthsAt(g, route, k));
    legs.push(straight(len, corner, radius, hw));
    laid += len;
  }
  return legs;
}

/** Tails after every corner, nothing sharper than ~130°, and the route never approaching itself. */
function valid(legs: readonly TownLeg[]): boolean {
  let carry = 0;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    if (leg.kind === 'curve') {
      carry = 0;
      continue;
    }
    const t = Math.abs(leg.turn);
    if (t > (5 * Math.PI) / 7) return false;
    const out = t > 0 ? tangentLength(leg.turn, leg.radius) : 0;
    if (leg.length - carry - out < MIN_TAIL) return false;
    carry = out;
  }
  return selfSeparated(samplePoints(legs, 0));
}

/** The city for a stage: its map, the route through it as legs, and its roundabouts. */
export function planCity(
  seed: number,
  span: number,
  loop: number,
  def: UrbanDef,
): { legs: TownLeg[]; city: CityPlan } {
  const rand = mulberry32(hashSeed(seed, 'city-route'));
  const count = Math.min(MAX_ROUNDABOUTS, MIN_ROUNDABOUTS + Math.floor(loop / 2));
  // The first valid plan with every roundabout and a tram loop the route crosses often enough;
  // failing that, the valid plan that came closest.
  let fallback: { legs: TownLeg[]; city: CityPlan; score: number } | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const g = cityGrid(seed, span, def);
    const route = walk(g, rand, span);
    if (!route) continue;
    toPlanFrame(g, route[0]!, route[1]!);
    const roundabouts = pickRoundabouts(g, route, rand, count, span, def);
    const legs = routeLegs(g, route, roundabouts, span, def);
    if (legs.reduce((s, l) => s + l.length, 0) < span - 1 || !valid(legs)) continue;
    const trimmed = trimRoute(g, route, legs);
    const tram = planTramLoop(g, trimmed, new Set(roundabouts.map((r) => r.node)), rand) ?? [];
    const city: CityPlan = { graph: g, route: trimmed, roundabouts, tram };
    const score = (tram.length > 0 ? 10 : 0) + Math.min(roundabouts.length, count);
    if (score === 10 + count) return { legs, city };
    if (!fallback || score > fallback.score) fallback = { legs, city, score };
  }
  if (fallback) return { legs: fallback.legs, city: fallback.city };
  // Straight up the start column: always valid.
  const g = cityGrid(seed, span, def);
  const route: number[] = [];
  for (let j = 0; g.at(0, j) >= 0; j++) route.push(g.at(0, j));
  toPlanFrame(g, route[0]!, route[1]!);
  const legs = routeLegs(g, route, [], span, def);
  return { legs, city: { graph: g, route: trimRoute(g, route, legs), roundabouts: [], tram: [] } };
}

/** The route's crossroads up to where its legs end, and the one it is heading for there. */
function trimRoute(g: CityGraph, route: readonly number[], legs: readonly TownLeg[]): number[] {
  const total = legs.reduce((s, l) => s + l.length, 0);
  let laid = 0;
  const out = [route[0]!];
  for (let k = 1; k < route.length; k++) {
    out.push(route[k]!);
    laid += length(g, route[k - 1]!, route[k]!);
    if (laid > total + 1) break;
  }
  return out;
}

export { across };
