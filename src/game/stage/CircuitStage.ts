import type { Gate } from './Checkpoints';
import { CROSS_ZONE, lapGap, type CircuitCrossing } from './CircuitCrossing';
import type { CircuitStyle } from './CircuitGenerator';
import type { RoadPath, RoadSample } from './RoadPath';

/** Laps in every circuit race, from a standing start. */
export const CIRCUIT_LAPS = 3;
/** Sector checkpoints per lap, evenly spaced between start/finish crossings. */
const SECTORS = 3;
/** Pulling away from the grid costs about this much against par. */
export const STANDING_START_SECONDS = 4;
/** A circuit is a lane wider than a rally tarmac road. */
export const CIRCUIT_HALF_WIDTH = 6;
/**
 * The grid behind the start/finish line: slots this far apart, staggered
 * this far either side of the centre, the first slot's front this far behind
 * the line. The player starts from pole, the first slot.
 */
export const GRID = { slots: 8, pitch: 8, stagger: 2.2, first: 6, carBack: 2.4 } as const;

/** What a circuit stage carries beyond an ordinary stage. */
export interface CircuitInfo {
  laps: number;
  /** One lap, metres (the closed path's length). */
  lapLength: number;
  style: CircuitStyle;
  /** Length of the main straight the start/finish line is on. */
  mainStraight: number;
  /** Multiplier on the region's hill relief. */
  relief: number;
  /** Where the lap crosses itself, on a bridge over a tunnel. */
  crossing: CircuitCrossing;
}

const ITALIAN = ['Valtorre', 'Montebello', 'Castelvento', 'Roccalta', 'Pievedoro', 'Lagomare'];
const FRENCH = ['Sarthenay', 'Beaulac', 'Montfleury', 'Vauclair', 'Rochebrune', 'Chantevent'];
const GERMAN = ['Rosshain', 'Eichwald', 'Tannberg', 'Hohenfels', 'Grünau', 'Falkenau'];

/**
 * A circuit's name from the brief's two name draws: the first picks the
 * flavour (an Italian autodromo, a French circuit, a German ring), the
 * second the place. Original names, not translated.
 */
export function circuitName(a: number, b: number): string {
  const kind = Math.floor(a * 3);
  if (kind === 0) return `Autodromo di ${ITALIAN[Math.floor(b * ITALIAN.length)]!}`;
  if (kind === 1) return `Circuit de ${FRENCH[Math.floor(b * FRENCH.length)]!}`;
  return `${GERMAN[Math.floor(b * GERMAN.length)]!}ring`;
}

/**
 * The race's gates, unrolled over every lap: per lap, sector checkpoints at
 * even fractions of the lap and a `lap` gate on the start/finish line; the
 * last crossing of the line is the `finish`. Distances keep counting past
 * the lap (`startDistance + k·lapLength + …`), so they strictly increase like
 * an open stage's; positions come from the closed path's wrapping `sample`.
 */
export function circuitGates(
  path: RoadPath,
  startDistance: number,
  laps: number,
  halfWidth: number,
  crossing?: CircuitCrossing,
): Gate[] {
  const lap = path.length;
  // A sector checkpoint keeps off the crossing (its gate line would reach the other stretch): it
  // moves away from it, back or on, whichever side it stood.
  const clear = (d: number) => {
    if (!crossing) return d;
    for (const c of [crossing.over, crossing.under]) {
      if (lapGap(d, c, lap) >= CROSS_ZONE) continue;
      const after = (((d - c) % lap) + lap) % lap;
      d += after < lap / 2 ? CROSS_ZONE - after + 10 : -(CROSS_ZONE - (lap - after) + 10);
    }
    return d;
  };
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const gates: Gate[] = [];
  const push = (kind: Gate['kind'], distance: number) => {
    path.sample(distance, sample);
    gates.push({
      kind,
      distance,
      x: sample.x,
      z: sample.z,
      heading: sample.heading,
      halfWidth: halfWidth + 4,
    });
  };
  for (let k = 0; k < laps; k++) {
    for (let s = 1; s <= SECTORS; s++) {
      push(
        'checkpoint',
        startDistance + k * lap + clear((lap * s) / (SECTORS + 1) + startDistance) - startDistance,
      );
    }
    push(k === laps - 1 ? 'finish' : 'lap', startDistance + (k + 1) * lap);
  }
  return gates;
}

/** Lap times from a run's splits: the time at each `lap`/`finish` gate, less the one before. */
export function lapTimes(gates: readonly Gate[], splits: readonly number[]): number[] {
  const out: number[] = [];
  let prev = 0;
  gates.forEach((g, i) => {
    if (g.kind === 'checkpoint') return;
    const t = splits[i];
    if (t === undefined) return;
    out.push(t - prev);
    prev = t;
  });
  return out;
}

/** The start is level from behind the last grid slot to this far past the line, easing back into the lap's hills over `START_EASE`. */
const START_BEHIND = GRID.first + GRID.slots * GRID.pitch + 6;
const START_AHEAD = 40;
const START_EASE = 80;

/**
 * Level the road profile of a closed lap (`heights`, one per sample, the
 * last repeating the first) over its start: the grid and the line stand on
 * flat road at the mean height there, the profile easing back to its own
 * over `START_EASE` either side. In place.
 */
export function levelCircuitStart(
  heights: Float64Array,
  spacing: number,
  startDistance: number,
): void {
  const n = heights.length - 1;
  const at = (d: number) => ((Math.round(d / spacing) % n) + n) % n;
  let sum = 0;
  let count = 0;
  for (let d = -START_BEHIND; d <= START_AHEAD; d += spacing) {
    sum += heights[at(startDistance + d)]!;
    count++;
  }
  const level = sum / count;
  for (let d = -START_BEHIND - START_EASE; d <= START_AHEAD + START_EASE; d += spacing) {
    const out = d < -START_BEHIND ? -START_BEHIND - d : d > START_AHEAD ? d - START_AHEAD : 0;
    const t = Math.min(1, out / START_EASE);
    const keep = t * t * (3 - 2 * t);
    const i = at(startDistance + d);
    heights[i] = level + (heights[i]! - level) * keep;
  }
  heights[n] = heights[0]!;
}
