import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { hashSeed, mulberry32 } from '../rng';

/**
 * The lie of a Coast stage before its road is drawn, as functions of axis
 * coordinates: `u` along the stage's general direction, `v` to its left.
 * The water line meanders at `shore(u)` with the sea to the right of it; the
 * land climbs from a beach through a terraced rock band (the cliff) onto a
 * scrub hillside with outcrops. The road builder and the terrain both derive
 * from this, seeded from the stage, so they agree without sharing state.
 */

const BEACH_TOP = 1.1;
const SEABED_SLOPE = 0.12;
const SEABED_FLOOR = -9;
/** Low-poly rock: flat treads and steep risers, in runs of `TREAD + RISER` metres across the slope. */
const CLIFF_TREAD = 2.8;
const CLIFF_RISER = 1.2;
const HILL_TREAD = 4.5;
const HILL_RISER = 1.5;
/** A tall cliff stands at 62°; a low one is a sandy bank the car can climb. */
const CLIFF_GRADE_HIGH = 1.9;
const CLIFF_GRADE_LOW = 0.5;
const HILL_MIN = 0.4;
const HILL_MAX = 0.5;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** A horizontal run reshaped into flat treads and steep risers with the same average slope. */
function terrace(run: number, tread: number, riser: number): number {
  const period = tread + riser;
  const k = Math.floor(run / period);
  return (k + smoothstep(tread, period, run - k * period)) * period;
}

export interface AxisPoint {
  u: number;
  v: number;
}

export class CoastShape {
  /** Heading of the stage axis. */
  readonly theta: number;
  private readonly fx: number;
  private readonly fz: number;
  private readonly lx: number;
  private readonly lz: number;
  private readonly noise: NoiseFunction2D;

  constructor(
    seed: number,
    readonly seaLevel: number,
    /** Amplitude and frequency of the hills' relief further inland. */
    private readonly relief: number,
    private readonly frequency: number,
  ) {
    const rand = mulberry32(hashSeed(seed, 'coast'));
    this.theta = rand() * Math.PI * 2;
    this.noise = createNoise2D(rand);
    this.fx = Math.sin(this.theta);
    this.fz = Math.cos(this.theta);
    this.lx = Math.cos(this.theta);
    this.lz = -Math.sin(this.theta);
  }

  toWorld(u: number, v: number): [number, number] {
    return [u * this.fx + v * this.lx, u * this.fz + v * this.lz];
  }

  toAxis(x: number, z: number, out: AxisPoint): AxisPoint {
    out.u = x * this.fx + z * this.fz;
    out.v = x * this.lx + z * this.lz;
    return out;
  }

  /** Left offset of the water line: long bays and headlands with gentler bends on them, nothing tighter than about 50 m. */
  shore(u: number): number {
    const n = this.noise;
    return 60 * n(u * 0.0035, 1.5) + 14 * n(u * 0.007 + 40, 2.5);
  }

  /**
   * Dry sand between the water and the foot of the cliff, down to a couple of
   * metres at a headland. The clamp is smooth: a hard one put a corner in the
   * shore road wherever the width crossed it.
   */
  beachWidth(u: number): number {
    const w = 12 + 18 * this.noise(u * 0.005 + 50.5, 8.8);
    return 0.5 * (w + Math.hypot(w, 4));
  }

  /** Height of the rock band above the beach. */
  cliffHeight(u: number): number {
    return 14 + 10 * this.noise(u * 0.0033 + 21.7, 2.2);
  }

  /** How much of a cliff the band is: 1 for tall rock, 0 for a sandy bank. */
  private cliffness(height: number): number {
    return smoothstep(5, 12, height);
  }

  private cliffGrade(height: number): number {
    return CLIFF_GRADE_LOW + (CLIFF_GRADE_HIGH - CLIFF_GRADE_LOW) * this.cliffness(height);
  }

  cliffWidth(u: number): number {
    const h = this.cliffHeight(u);
    return h / this.cliffGrade(h);
  }

  /** Slope of the hillside above the cliff. */
  hillSlope(u: number): number {
    return HILL_MIN + (HILL_MAX - HILL_MIN) * (0.5 + 0.5 * this.noise(u * 0.007 + 9.1, 6.6));
  }

  /** How far back from the cliff top the shore road runs. */
  shelf(u: number): number {
    return 6 + 5 * this.noise(u * 0.0045 + 13.3, 4.4);
  }

  /** Inland offset of the shore road from the water line. */
  roadInland(u: number): number {
    return this.beachWidth(u) + this.cliffWidth(u) + this.shelf(u);
  }

  /** How rocky the ground is at (u, v): the cliff band and the outcrops are rock, sand and scrub are not. */
  rockiness(u: number, v: number, x: number, z: number): number {
    const t = v - this.shore(u) - this.beachWidth(u);
    if (t < -1) return 0;
    const h = this.cliffHeight(u);
    const cw = h / this.cliffGrade(h);
    if (t <= cw + 1) return this.cliffness(h);
    return this.outcrops(x, z, t - cw);
  }

  /** Where the hillside shows rock instead of scrub, fading in off the cliff top. */
  private outcrops(x: number, z: number, m: number): number {
    return (
      smoothstep(0.15, 0.55, this.noise(x * 0.02 + 31.3, z * 0.02 - 7.7)) * smoothstep(2, 12, m)
    );
  }

  /** Ground height at axis (u, v); the world (x, z) seeds the textures. */
  ground(u: number, v: number, x: number, z: number): number {
    const sea = this.seaLevel;
    const s = v - this.shore(u);
    if (s <= 0) return sea + Math.max(SEABED_FLOOR, SEABED_SLOPE * s);
    const n = this.noise;
    const bw = this.beachWidth(u);
    if (s <= bw) return sea + BEACH_TOP * (s / bw) + 0.12 * n(x * 0.07, z * 0.07);
    const t = s - bw;
    const h = this.cliffHeight(u);
    const grade = this.cliffGrade(h);
    const cw = h / grade;
    // The cliff band: terraced rock, its ledges broken up by noise, or a smooth bank where it is low.
    const run = Math.min(cw, Math.max(0, t + 1.2 * n(x * 0.05 + 7.3, z * 0.05)));
    const smoothBand = grade * Math.min(cw, t);
    const rockBand = Math.min(h, grade * terrace(run, CLIFF_TREAD, CLIFF_RISER));
    const cliffness = this.cliffness(h);
    const band = smoothBand + (rockBand - smoothBand) * cliffness;
    // The hillside: scrub slope, terraced into steps where the outcrops are.
    const m = Math.max(0, t - cw);
    const slope = this.hillSlope(u);
    const hill = slope * m;
    const steps = slope * terrace(m, HILL_TREAD, HILL_RISER);
    const rock = this.outcrops(x, z, m);
    const f = this.frequency;
    const relief =
      this.relief *
      (0.6 * n(x * f, z * f) +
        0.3 * n(x * f * 0.37 + 17.1, z * f * 0.37 - 4.3) +
        0.1 * n(x * f * 2.3, z * f * 2.3));
    const rubble = 0.3 * n(x * 0.13, z * 0.13) * smoothstep(1, 4, t);
    return (
      sea + BEACH_TOP + band + hill + (steps - hill) * rock + relief * smoothstep(6, 60, m) + rubble
    );
  }
}
