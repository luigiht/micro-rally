import { rallyIndex } from './regions';
import { hashSeed, mulberry32 } from '../rng';

/** Corner arcs: 12 m, or 10 m on the sharpest (over 95°) corners; a leg may set its own (`radius`, wide city streets). */
export function cornerRadius(turn: number, radius?: number): number {
  if (radius !== undefined && radius > 0) return radius;
  return Math.abs(turn) > (19 * Math.PI) / 36 ? 10 : 12;
}

/** How far before and after the polygon corner the arc starts and ends. */
export function tangentLength(turn: number, radius?: number): number {
  return cornerRadius(turn, radius) * Math.tan(Math.abs(turn) / 2);
}

/**
 * Every third rally stage carries a town (counted along the rally mix,
 * `rallyIndex`, so the cities and circuits never shift them: rally stages
 * 2, 5, 8, …), the same in every game and in whichever region the mix puts
 * there; against the mix's seven slots that comes round every Forest
 * surface, Alpine and Arctic. Never the first stage (the splash demo and
 * the smoke tests drive it), never two in a row. Regions that build no
 * villages (the coast, the desert) skip theirs: see `stageHasTown`.
 */
const TOWN_EVERY = 3;
export function hasTown(index: number): boolean {
  const rally = rallyIndex(index);
  return rally !== null && rally % TOWN_EVERY === TOWN_EVERY - 1;
}

/** Half width of the narrow old-town streets some towns have through their middle. */
export const NARROW_HALF_WIDTH = 3.2;
/** Control-point spacing of the centreline builder; straight legs are whole multiples of it. */
export const PLAN_STEP = 20;
/** Route points at least `APPROACH_ALONG` apart along the road stay this far apart in space (the stage rule is 50 m). */
const MIN_SEPARATION = 54;
const APPROACH_ALONG = 196;
/** Straight run the builder adds before and after the town, included in the check. */
const RUN_IN = 80;
/** The route leaves the town within this much of the heading it arrived on. */
const MAX_NET_TURN = 0.45;
const MAX_ATTEMPTS = 24;

/**
 * One leg of the route through town. Straight legs end in a corner of
 * `turn` radians (0 on the exit leg); curves are circular arcs of `radius`
 * swept through `sweep` radians (signed, + = left) and end tangentially.
 */
export interface TownLeg {
  kind: 'straight' | 'curve';
  /** Straight length, or arc length for a curve. */
  length: number;
  /** A curve's radius; on a straight, the radius of the corner that ends it (0 for the default, see `cornerRadius`). */
  radius: number;
  sweep: number;
  turn: number;
  halfWidth: number;
  /** A city roundabout: set on the curve leg that circles its island (see `UrbanPlan`). */
  roundabout?: { islandRadius: number };
}

export interface TownPlan {
  /** Control distance at which the entry leg begins. */
  entryAt: number;
  legs: TownLeg[];
}

interface Pt {
  x: number;
  z: number;
}

const CORNERS: readonly (readonly [number, number])[] = [
  [Math.PI / 3, 1],
  [Math.PI / 2, 3],
  [(7 * Math.PI) / 12, 1],
];

function pickCorner(rand: () => number): number {
  let total = 0;
  for (const [, w] of CORNERS) total += w;
  let r = rand() * total;
  for (const [angle, w] of CORNERS) {
    r -= w;
    if (r <= 0) return angle;
  }
  return Math.PI / 2;
}

const straight = (length: number, turn: number, halfWidth: number): TownLeg => ({
  kind: 'straight',
  length,
  radius: 0,
  sweep: 0,
  turn,
  halfWidth,
});

/** Draw one candidate route: entry straight, a few middle legs (straights with corners, tight curves), exit straight. */
function drawLegs(
  rand: () => number,
  long: boolean,
  halfWidth: number,
  narrow: boolean,
): TownLeg[] {
  const inner = narrow ? NARROW_HALF_WIDTH : halfWidth;
  const block = () => (rand() < 0.5 ? 60 : 80);
  let sign = rand() < 0.5 ? -1 : 1;
  const next = () => {
    if (rand() < 0.7) sign = -sign;
    return sign;
  };
  const legs: TownLeg[] = [straight(block(), sign * pickCorner(rand), halfWidth)];
  const middle = long ? 2 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2);
  for (let i = 0; i < middle; i++) {
    if (rand() < 0.4) {
      const radius = 14 + rand() * 5;
      const sweep = next() * (Math.PI / 3 + rand() * (Math.PI / 4.5));
      legs.push({
        kind: 'curve',
        length: radius * Math.abs(sweep),
        radius,
        sweep,
        turn: 0,
        halfWidth: inner,
      });
    } else {
      const len = [40, 60, 80][Math.floor(rand() * 3)]!;
      legs.push(straight(len, next() * pickCorner(rand), inner));
    }
  }
  legs.push(straight(block(), 0, halfWidth));
  // Balance the heading so the town hands the route back roughly the way it came.
  const net = legs.reduce((a, l) => a + l.turn + l.sweep, 0);
  for (let i = legs.length - 2; i >= 0; i--) {
    const leg = legs[i]!;
    if (leg.kind !== 'straight') continue;
    leg.turn -= net;
    if (Math.abs(leg.turn) < 1e-9) leg.turn = 0;
    break;
  }
  return legs;
}

/** Points every 2 m along the route in the town frame (entry at the origin, heading +z), with straight run-in and run-out of `runIn`. */
export function samplePoints(legs: readonly TownLeg[], runIn = RUN_IN): Pt[] {
  const pts: Pt[] = [];
  let x = 0;
  let z = -runIn;
  let h = 0;
  const walk = (dist: number, heading: number) => {
    for (let d = 0; d < dist; d += 2) {
      pts.push({ x: x + Math.sin(heading) * d, z: z + Math.cos(heading) * d });
    }
    x += Math.sin(heading) * dist;
    z += Math.cos(heading) * dist;
  };
  const arc = (radius: number, sweep: number) => {
    const steps = Math.ceil((radius * Math.abs(sweep)) / 2);
    const dA = sweep / steps;
    const chord = 2 * radius * Math.sin(Math.abs(dA) / 2);
    for (let k = 0; k < steps; k++) {
      pts.push({ x, z });
      x += Math.sin(h + dA / 2) * chord;
      z += Math.cos(h + dA / 2) * chord;
      h += dA;
    }
  };
  walk(runIn, 0);
  let carry = 0;
  for (const leg of legs) {
    if (leg.kind === 'curve') {
      arc(leg.radius, leg.sweep);
      carry = 0;
      continue;
    }
    const out = leg.turn !== 0 ? tangentLength(leg.turn, leg.radius) : 0;
    walk(leg.length - carry - out, h);
    if (leg.turn !== 0) arc(cornerRadius(leg.turn, leg.radius), leg.turn);
    carry = out;
  }
  walk(runIn, h);
  pts.push({ x, z });
  return pts;
}

/**
 * The self-approach rule on sampled points: no two points `gapAlong` metres
 * or more apart along the route come within `minSep` of each other. Points
 * are hashed into cells of `minSep` so a whole city is checked in linear
 * time.
 */
export function selfSeparated(
  pts: readonly Pt[],
  gapAlong = APPROACH_ALONG,
  minSep = MIN_SEPARATION,
): boolean {
  const cell = minSep;
  const gap = Math.ceil(gapAlong / 2);
  const cells = new Map<number, number[]>();
  const key = (cx: number, cz: number) => (cx + 0x8000) * 0x10000 + (cz + 0x8000);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const cx = Math.floor(p.x / cell);
    const cz = Math.floor(p.z / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const list = cells.get(key(cx + dx, cz + dz));
        if (!list) continue;
        for (const j of list) {
          if (i - j < gap) continue;
          const q = pts[j]!;
          if (Math.hypot(p.x - q.x, p.z - q.z) < minSep) return false;
        }
      }
    const k = key(cx, cz);
    const list = cells.get(k);
    if (list) list.push(i);
    else cells.set(k, [i]);
  }
  return true;
}

/**
 * Every corner is a real corner followed by a straight with room left after
 * the corner arcs, the route comes out ahead on roughly its heading, and it
 * never doubles back on itself.
 */
function validLegs(legs: readonly TownLeg[]): boolean {
  let carry = 0;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    const t = Math.abs(leg.turn);
    if (t > 0 && (t < Math.PI / 4 || t > (5 * Math.PI) / 8)) return false;
    if (leg.kind === 'curve') {
      carry = 0;
      continue;
    }
    const out = t > 0 ? tangentLength(leg.turn, leg.radius) : 0;
    if (leg.length - carry - out < 8) return false;
    if (t > 0 && legs[i + 1]?.kind !== 'straight') return false;
    carry = out;
  }
  const net = legs.reduce((a, l) => a + l.turn + l.sweep, 0);
  if (Math.abs(net) > MAX_NET_TURN) return false;
  const pts = samplePoints(legs);
  if (!selfSeparated(pts)) return false;
  const exit = pts[pts.length - 1]!;
  return exit.z > RUN_IN + 80;
}

/** The town's shape and where it sits: entry between 30% and 55% of the stage, snapped to the control grid. */
export function planTown(
  seed: number,
  startDistance: number,
  length: number,
  halfWidth: number,
): TownPlan {
  const rand = mulberry32(hashSeed(seed, 'town'));
  const at = startDistance + length * (0.3 + 0.25 * rand());
  const narrow = rand() < 0.5;
  const long = length >= 1500;
  const entryAt = (legs: TownLeg[]) =>
    Math.max(PLAN_STEP * 3, Math.round((at - legs[0]!.length) / PLAN_STEP) * PLAN_STEP);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const legs = drawLegs(rand, long, halfWidth, narrow);
    if (validLegs(legs)) return { entryAt: entryAt(legs), legs };
  }
  const fallback = [
    straight(60, Math.PI / 2, halfWidth),
    straight(60, -Math.PI / 2, halfWidth),
    straight(60, 0, halfWidth),
  ];
  return { entryAt: entryAt(fallback), legs: fallback };
}

/** Control distance the town occupies. */
export function townSpan(plan: TownPlan): number {
  return plan.legs.reduce((a, l) => a + l.length, 0);
}
