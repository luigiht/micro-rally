import { hashSeed, mulberry32 } from '../rng';
import type { BoxObstacle } from '../vehicle/Collisions';
import type { TramLine } from './Tram';
import { loopAt, type TramLoopDef } from './city/TramLoop';

/**
 * The trams that run the city's lines now and then: pure timetable, one
 * run per line every `headway` seconds, alternating direction, the tram
 * sliding in from one end of the line and out at the other. The renderer
 * (`TramFleet`) asks for each line's pose at the run's clock, and the
 * session asks for the trams' hitboxes (`tramBoxes`) at the same clock, so
 * what the driver sees is what the car hits.
 */
export interface TramRun {
  /** Seconds between one tram's start and the next on this line. */
  headway: number;
  /** Seconds added to the clock, so the lines are out of step. */
  offset: number;
  /** How long one crossing takes, nose entering to tail leaving, fades included. */
  duration: number;
  /** The line's length. */
  length: number;
}

export interface TramPose {
  x: number;
  z: number;
  /** Heading the tram travels, the nose toward it. */
  heading: number;
  /** 0 just as it appears or vanishes at a line's end, 1 in between. */
  opacity: number;
}

/** Metres per second (about 29 km/h), the tram's length and width, and the stretch over which it fades in and out at the ends. */
export const TRAM_SPEED = 8;
export const TRAM_LENGTH = 24;
export const TRAM_WIDTH = 2.65;
export const TRAM_FADE = 10;
/** A tram is solid once it has faded in this far. */
const SOLID_FROM = 0.5;
/** Headway bounds, seconds. */
const HEADWAY_MIN = 55;
const HEADWAY_MAX = 95;

/** A timetable for every line, from the stage seed, so a stage's trams run the same for everyone. */
export function tramSchedule(trams: readonly TramLine[], seed: number): TramRun[] {
  const rand = mulberry32(hashSeed(seed, 'trams'));
  return trams.map((t) => {
    const length = Math.hypot(t.x1 - t.x0, t.z1 - t.z0);
    const headway = HEADWAY_MIN + rand() * (HEADWAY_MAX - HEADWAY_MIN);
    return {
      headway,
      offset: rand() * headway,
      duration: (length + TRAM_LENGTH + 2 * TRAM_FADE) / TRAM_SPEED,
      length,
    };
  });
}

/** Where the line's tram is at clock time `t` seconds, or null while none is on the line. */
export function tramPose(line: TramLine, run: TramRun, t: number): TramPose | null {
  const since = t + run.offset;
  const n = Math.floor(since / run.headway);
  const phase = since - n * run.headway;
  if (phase >= run.duration) return null;
  // The centre travels from a tram's length (and the fade) before the start to as far past the end.
  const travel = phase * TRAM_SPEED - TRAM_LENGTH / 2 - TRAM_FADE;
  const forward = n % 2 === 0;
  const s = forward ? travel : run.length - travel;
  const dx = line.x1 - line.x0;
  const dz = line.z1 - line.z0;
  const len = run.length || 1;
  const ux = dx / len;
  const uz = dz / len;
  const heading = Math.atan2(forward ? dx : -dx, forward ? dz : -dz);
  // Fading by how far the centre still is outside the line at either end.
  const outside = Math.max(0, -s, s - run.length);
  const opacity = Math.min(1, Math.max(0, 1 - outside / (TRAM_LENGTH / 2 + TRAM_FADE)));
  return { x: line.x0 + ux * s, z: line.z0 + uz * s, heading, opacity };
}

/** The trams on the lines at clock time `t` as oriented boxes, the faint ends left out, appended to `out`. */
export function tramBoxes(
  trams: readonly TramLine[],
  runs: readonly TramRun[],
  t: number,
  out: BoxObstacle[] = [],
): BoxObstacle[] {
  out.length = 0;
  trams.forEach((line, i) => {
    const run = runs[i];
    if (!run) return;
    const pose = tramPose(line, run, t);
    if (!pose || pose.opacity < SOLID_FROM) return;
    out.push({ x: pose.x, z: pose.z, hx: TRAM_WIDTH / 2, hz: TRAM_LENGTH / 2, yaw: pose.heading });
  });
  return out;
}

/** The lines and their timetable, as the session carries them; a mapped city's loop and its trams instead. */
export interface TramTraffic {
  lines: readonly TramLine[];
  runs: readonly TramRun[];
  loop?: LoopFleet;
}

/** The trams circling a loop: each a distance round it at clock 0. */
export interface LoopFleet {
  loop: TramLoopDef;
  offsets: number[];
}

/** One tram for every this-many metres of loop, at least two. */
const LOOP_SPACING = 420;
/** A loop tram rides two bogies this far either side of its centre, which set its heading round the curves. */
export const LOOP_BOGIE = 8;

/** A loop's trams, evenly spaced round it from a phase drawn from the stage seed. */
export function loopFleet(loop: TramLoopDef, seed: number): LoopFleet {
  const rand = mulberry32(hashSeed(seed, 'trams'));
  const count = Math.max(2, Math.round(loop.length / LOOP_SPACING));
  const phase = rand() * loop.length;
  return {
    loop,
    offsets: Array.from({ length: count }, (_, k) => phase + (k * loop.length) / count),
  };
}

const front = { x: 0, z: 0, heading: 0 };
const back = { x: 0, z: 0, heading: 0 };

/** A tram is three cars joined by bellows (`TramGeometry`): each this long, the bellows this long between. */
export const TRAM_SECTIONS = 3;
export const TRAM_BELLOWS = 0.6;
export const SECTION_LENGTH = (TRAM_LENGTH - TRAM_BELLOWS * (TRAM_SECTIONS - 1)) / TRAM_SECTIONS;
/** Each car's centre along the tram from its middle, rear car first (the nose is toward +). */
export const SECTION_OFFSETS = Array.from(
  { length: TRAM_SECTIONS },
  (_, i) => -TRAM_LENGTH / 2 + SECTION_LENGTH / 2 + i * (SECTION_LENGTH + TRAM_BELLOWS),
);
/** A car rides two bogies this far either side of its own centre. */
const SECTION_BOGIE = SECTION_LENGTH * 0.4;

/** Tram `k` of a loop fleet at clock `t`, as a whole: between bogies `LOOP_BOGIE` either side of its centre. */
export function loopPose(fleet: LoopFleet, k: number, t: number, out: TramPose): TramPose {
  return between(fleet.loop, fleet.offsets[k]! + t * TRAM_SPEED, LOOP_BOGIE, out);
}

/**
 * Car `section` of tram `k` at clock `t`: each car rides its own two bogies
 * on the rails, so round a curve the cars bend at the bellows like a train
 * rather than the tram cutting across as one stiff body.
 */
export function loopSectionPose(
  fleet: LoopFleet,
  k: number,
  section: number,
  t: number,
  out: TramPose,
): TramPose {
  const s = fleet.offsets[k]! + t * TRAM_SPEED + SECTION_OFFSETS[section]!;
  return between(fleet.loop, s, SECTION_BOGIE, out);
}

function between(loop: TramLoopDef, s: number, half: number, out: TramPose): TramPose {
  loopAt(loop, s + half, front);
  loopAt(loop, s - half, back);
  out.x = (front.x + back.x) / 2;
  out.z = (front.z + back.z) / 2;
  out.heading = Math.atan2(front.x - back.x, front.z - back.z);
  out.opacity = 1;
  return out;
}

const pose: TramPose = { x: 0, z: 0, heading: 0, opacity: 1 };

/** Every tram's hitbox at clock `t`, lines or loop, into `out`. */
export function trafficBoxes(traffic: TramTraffic, t: number, out: BoxObstacle[]): BoxObstacle[] {
  if (!traffic.loop) return tramBoxes(traffic.lines, traffic.runs, t, out);
  out.length = 0;
  for (let k = 0; k < traffic.loop.offsets.length; k++)
    for (let c = 0; c < TRAM_SECTIONS; c++) {
      loopSectionPose(traffic.loop, k, c, t, pose);
      out.push({
        x: pose.x,
        z: pose.z,
        hx: TRAM_WIDTH / 2,
        hz: SECTION_LENGTH / 2 + TRAM_BELLOWS / 2,
        yaw: pose.heading,
      });
    }
  return out;
}
