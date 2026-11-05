import type { Gate } from './Checkpoints';
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
): Gate[] {
  const lap = path.length;
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
      push('checkpoint', startDistance + k * lap + (lap * s) / (SECTORS + 1));
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
