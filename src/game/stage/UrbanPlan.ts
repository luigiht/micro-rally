import { hashSeed, mulberry32 } from '../rng';
import { CONTROL_STEP } from './Centreline';
import type { UrbanDef } from './regions';
import {
  samplePoints,
  selfSeparated,
  tangentLength,
  type TownLeg,
  type TownPlan,
} from './TownPlan';

/**
 * The route through a city, as a town plan that covers the whole stage (see
 * `UrbanGenerator` for what is built along it). Blocks of 60–160 m end in
 * corners, mostly right angles with the odd skewed one and gentle kinks;
 * some blocks are sweeping avenues; the streets are one to four lanes wide,
 * never two narrow ones in a row, a boulevard at the start and the finish;
 * one to three roundabouts, each a right deflection onto the ring, a left
 * circulation of a quarter or three quarters of a turn, and a right
 * deflection off it. Every plan is checked against the self-approach rule
 * before it is kept.
 */

/** The legs begin at the first control step; everything before it is the run-in before the start line. */
export const URBAN_ENTRY = CONTROL_STEP;
/** Deflection onto and off a roundabout's ring: the angle and the arc radius. */
export const DEFLECTION = (28 * Math.PI) / 180;
export const DEFLECTION_RADIUS = 20;
/** Approach straight before a roundabout. */
const APPROACH = 60;
/** Gentle kinks (irregular streets) bend round this radius; right-angle and skewed corners round `8 + half width`. */
const KINK_RADIUS = 30;
const CORNER_RADIUS_BASE = 8;
/** The route keeps within this much of the stage axis, so it always progresses. */
const MAX_HEADING = (100 * Math.PI) / 180;
/** A straight keeps at least this much after its corner tangents. */
const MIN_TAIL = 8;
/**
 * The finish boulevard: the last block runs at least this far, the finish
 * line 100 m into it, the run-out beyond. The plan closes (a right-angle
 * block, then that boulevard) once less than `CLOSING` is left, before any
 * one leg (at most about 260 m) could overshoot that.
 */
const FINAL_BLOCK = 320;
const CLOSING = FINAL_BLOCK + 100 + 260;
const MAX_ATTEMPTS = 40;
/** Corners at or above this are junctions with side streets; below it the route just kinks. */
export const MIN_JUNCTION_TURN = Math.PI / 4;

const BLOCKS: readonly (readonly [number, number])[] = [
  [60, 2],
  [80, 3],
  [100, 3],
  [120, 3],
  [140, 2],
  [160, 1],
];
const CORNERS: readonly (readonly [number, number])[] = [
  [Math.PI / 2, 5],
  [Math.PI / 3, 1],
  [(5 * Math.PI) / 12, 1],
  [(7 * Math.PI) / 12, 1],
  [(2 * Math.PI) / 3, 1],
  // A kink: 15°–35°, drawn below.
  [0, 2],
];

function pickWeighted<T>(rand: () => number, table: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rand() * total;
  for (const [v, w] of table) {
    r -= w;
    if (r <= 0) return v;
  }
  return table[table.length - 1]![0];
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

/** A street class for the next block: a narrow lane at most once, boulevards the rest of the time with two-lane streets most common. */
function pickWidth(rand: () => number, lanes: UrbanDef['lanes'], narrowUsed: boolean): number {
  const r = rand();
  if (r < 0.08 && !narrowUsed) return lanes.narrow;
  if (r < 0.5) return lanes.two;
  if (r < 0.75) return lanes.three;
  return lanes.four;
}

/** Where along the plan each roundabout goes: spread over the middle three fifths of the stage, jittered. */
function roundaboutTargets(rand: () => number, span: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0.5 : 0.2 + (0.6 * i) / (n - 1);
    out.push(span * (f + (rand() - 0.5) * 0.08));
  }
  return out;
}

/**
 * One candidate plan. A street's width is drawn afresh only after a junction
 * corner: kinks, avenue curves and roundabouts carry the width through, so no
 * road changes its lane count along what reads as one straight. The finish
 * boulevard always follows a junction corner too.
 */
function drawCity(rand: () => number, span: number, roundabouts: number, def: UrbanDef): TownLeg[] {
  const { lanes, island } = def;
  const legs: TownLeg[] = [];
  const targets = roundaboutTargets(rand, span, roundabouts);
  let heading = 0;
  let laid = 0;
  let sign = rand() < 0.5 ? -1 : 1;
  let narrowUsed = false;
  let minNext = 0;
  let hw = lanes.four;
  /** Whether the last leg ended in a junction corner, so the next street may be another width. */
  let junction = false;
  const corner = (turn: number, kink: boolean) => {
    if (Math.abs(heading + turn) > MAX_HEADING) turn = -turn;
    if (Math.abs(heading + turn) > MAX_HEADING) turn = -Math.sign(heading) * (Math.PI / 2);
    return { turn, radius: kink ? KINK_RADIUS : CORNER_RADIUS_BASE + hw };
  };
  while (span - laid > 0) {
    const remaining = span - laid;
    // The last block is a boulevard straight through the finish and beyond, off a junction
    // corner: unless the road has just turned one, a block with a right angle comes first.
    if (remaining <= CLOSING) {
      if (!junction) {
        const length = Math.min(160, remaining - FINAL_BLOCK);
        const c = corner(sign * (Math.PI / 2), false);
        legs.push(straight(length, c.turn, c.radius, hw));
        laid += length;
        heading += c.turn;
      }
      legs.push(straight(span - laid, 0, 0, lanes.four));
      break;
    }
    if (junction) {
      hw = pickWidth(rand, lanes, narrowUsed);
      if (hw === lanes.narrow) narrowUsed = true;
      junction = false;
    }
    if (targets.length > 0 && laid >= targets[0]!) {
      targets.shift();
      // Through (a short circulation) or left (a quarter turn more), whichever keeps the heading in bounds.
      const leftOk = Math.abs(heading + Math.PI / 2) <= MAX_HEADING;
      const left = leftOk && rand() < 0.45;
      const sweep = 2 * DEFLECTION + (left ? Math.PI / 2 : 0);
      const ringHw = Math.min(hw, lanes.three);
      const islandRadius = island.min + rand() * (island.max - island.min);
      const ring = curve(islandRadius + ringHw, sweep, ringHw);
      ring.roundabout = { islandRadius };
      legs.push(
        straight(Math.max(APPROACH, minNext), 0, 0, hw),
        curve(DEFLECTION_RADIUS, -DEFLECTION, hw),
        ring,
        curve(DEFLECTION_RADIUS, -DEFLECTION, hw),
      );
      laid += Math.max(APPROACH, minNext) + 2 * DEFLECTION_RADIUS * DEFLECTION + ring.length;
      heading += sweep - 2 * DEFLECTION;
      minNext = APPROACH;
      continue;
    }
    let length = Math.max(minNext, pickWeighted(rand, BLOCKS));
    minNext = 0;
    if (rand() < 0.7) sign = -sign;
    if (rand() < 0.18) {
      // A sweeping avenue: the straight ends without a corner and an arc follows, the same width.
      const radius = 40 + rand() * 50;
      let sweep = sign * (Math.PI / 9 + rand() * (Math.PI / 4.5));
      if (Math.abs(heading + sweep) > MAX_HEADING) sweep = -sweep;
      legs.push(straight(length, 0, 0, hw), curve(radius, sweep, hw));
      laid += length + radius * Math.abs(sweep);
      heading += sweep;
      continue;
    }
    let angle = pickWeighted(rand, CORNERS);
    const kink = angle === 0;
    if (kink) angle = Math.PI / 12 + rand() * (Math.PI / 9);
    // A narrow lane keeps its corners square and its blocks short, like an old quarter.
    if (hw === lanes.narrow) {
      angle = Math.PI / 2;
      length = Math.min(length, 100);
    }
    const c = corner(sign * angle, kink && hw !== lanes.narrow);
    // A skewed corner over 100° eats a long tangent each side: give both blocks room.
    if (Math.abs(c.turn) > (7 * Math.PI) / 12) {
      length = Math.max(length, 100);
      minNext = 100;
    }
    legs.push(straight(length, c.turn, c.radius, hw));
    laid += length;
    heading += c.turn;
    junction = Math.abs(c.turn) >= MIN_JUNCTION_TURN;
  }
  return legs;
}

/** Corners leave a tail on their straights, a straight follows every corner, and the route never doubles back on itself. */
function validCity(legs: readonly TownLeg[]): boolean {
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
    if (t > 0 && legs[i + 1]?.kind !== 'straight') return false;
    carry = out;
  }
  return selfSeparated(samplePoints(legs, 0));
}

/** A staircase of 100 m blocks with alternating right angles: always valid, never pretty. */
function fallbackCity(span: number, def: UrbanDef): TownLeg[] {
  const legs: TownLeg[] = [];
  let laid = 0;
  let sign = 1;
  while (span - laid > 220) {
    const hw = legs.length % 2 === 0 ? def.lanes.four : def.lanes.two;
    legs.push(straight(100, sign * (Math.PI / 2), CORNER_RADIUS_BASE + hw, hw));
    laid += 100;
    sign = -sign;
  }
  legs.push(straight(span - laid, 0, 0, def.lanes.four));
  return legs;
}

/** The city's route: legs from the first control step to past the run-out, so the open-road walk never resumes. */
export function planUrban(seed: number, total: number, loop: number, def: UrbanDef): TownPlan {
  const rand = mulberry32(hashSeed(seed, 'urban'));
  const span = total + 4 * CONTROL_STEP - URBAN_ENTRY;
  const roundabouts = Math.min(3, 1 + Math.floor(loop / 2));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const legs = drawCity(rand, span, roundabouts, def);
    if (validCity(legs)) return { entryAt: URBAN_ENTRY, legs };
  }
  return { entryAt: URBAN_ENTRY, legs: fallbackCity(span, def) };
}
