import { hashSeed, mulberry32 } from '../rng';
import type { BoxObstacle } from '../vehicle/Collisions';
import type { TramLine } from './Tram';

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

/** The lines and their timetable, as the session carries them. */
export interface TramTraffic {
  lines: readonly TramLine[];
  runs: readonly TramRun[];
}
