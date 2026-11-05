import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { hashSeed, mulberry32 } from '../rng';

/**
 * The lie of a Coast stage before its road is drawn, as functions of axis
 * coordinates: `u` along the stage's general direction, `v` across it toward
 * the land. The water line meanders at `shore(u)` with the sea on its low-`v`
 * side; the land climbs from a beach through a terraced rock band (the cliff)
 * onto a scrub hillside with outcrops. The road builder and the terrain both
 * derive from this, seeded from the stage, so they agree without sharing state.
 *
 * Each stage draws its own character: which hand the sea lies on (`side`),
 * how long and deep its bays are, and how many sharper headlands break them
 * up, the headlands growing sharper with the difficulty loop. One stage is a
 * lazy corniche round two wide bays, the next a jagged run of points.
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
/** Knobbly crags standing out of the cliff face and the hillside's rock scarps, metres. */
const CLIFF_CRAG = 1.5;
const HILL_CRAG = 1.3;
/** Buttresses steepen the face by this much and the gullies between them slacken it, as a share of the grade. */
const CLIFF_RIB = 0.35;
/** The boulder apron at the cliff foot: over the beach's landward part, up to about 1.7 m. */
const APRON_FROM = 0.55;
const APRON_HEIGHT = 1.1;
/** Rolling ground on the hillside, and the gullies that run down it. */
const HUMMOCK = 1.3;
const GULLY_DEPTH = 2.2;
/** The shore's two meanders at their reference size: bays (60 m across the axis, ~0.0035 /m) and the bends on them (14 m, ~0.007 /m). */
const BAY_AMP = 60;
const BAY_FREQ = 0.0035;
const BEND_AMP = 14;
const BEND_FREQ = 0.007;
/** Bay wavelength against the reference: short bays to a long lazy corniche. */
const BAY_WAVE_MIN = 0.75;
const BAY_WAVE_SPAN = 0.95;
const BAY_AMP_MAX = 120;
/** The difficulty loop stops sharpening the headlands here, as `reliefAmplitude` stops at loop 4. */
const HARDEST_LOOP = 4;

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

/** Terraces whose ledge line is shifted by `phase` metres, starting from 0 at a run of 0. */
function strata(run: number, phase: number, tread: number, riser: number): number {
  return terrace(run + phase, tread, riser) - terrace(phase, tread, riser);
}

export interface AxisPoint {
  u: number;
  v: number;
}

/** What the ground is made of at a point, 0..1 each: the terrain's colouring reads these. */
export interface CoastSurface {
  /** Bare rock: the cliff band and the hillside's outcrops. */
  rock: number;
  /** Gravel and scree: the boulder apron, fans below the outcrops, gully beds and loose patches. */
  scree: number;
  /** Sun-dried grass rather than green. */
  dry: number;
}

export class CoastShape {
  /** Heading of the stage axis. */
  readonly theta: number;
  /** Which hand of travel the land lies on: +1 left (the sea on the right), −1 right. */
  readonly side: 1 | -1;
  /** 0 on the first difficulty loop to 1 from `HARDEST_LOOP` on. */
  readonly difficulty: number;
  private readonly bayAmp: number;
  private readonly bayFreq: number;
  private readonly bendAmp: number;
  private readonly bendFreq: number;
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
    /** Difficulty loop of the stage (`StageBrief.loop`). */
    loop = 0,
  ) {
    const rand = mulberry32(hashSeed(seed, 'coast'));
    this.theta = rand() * Math.PI * 2;
    this.noise = createNoise2D(rand);
    // The stage's character, drawn after the axis and the noise so those stay as they were.
    this.side = rand() < 0.5 ? 1 : -1;
    this.difficulty = Math.min(Math.max(loop, 0), HARDEST_LOOP) / HARDEST_LOOP;
    // Bays: a longer wave is a deeper bay, but its bends are gentler (curvature goes as wave^-0.5).
    const wave = BAY_WAVE_MIN + rand() * BAY_WAVE_SPAN;
    this.bayFreq = BAY_FREQ / wave;
    this.bayAmp = Math.min(BAY_AMP_MAX, BAY_AMP * wave ** 1.5 * (0.85 + 0.3 * rand()));
    // Headlands: from barely there to a jagged run, leaning jagged on later loops. Their curvature,
    // amplitude × frequency², runs from half the reference to 1.5× it, and up to 2.25× on the hardest loop.
    const chop = Math.min(1, rand() * (0.75 + 0.5 * this.difficulty));
    this.bendFreq = BEND_FREQ * (0.8 + 0.9 * chop);
    this.bendAmp =
      BEND_AMP * (0.5 + chop) * (1 + 0.5 * this.difficulty) * (BEND_FREQ / this.bendFreq) ** 2;
    this.fx = Math.sin(this.theta);
    this.fz = Math.cos(this.theta);
    // `v` runs toward the land: to the left of the axis, or to its right on a mirrored stage.
    this.lx = this.side * Math.cos(this.theta);
    this.lz = -this.side * Math.sin(this.theta);
  }

  toWorld(u: number, v: number): [number, number] {
    return [u * this.fx + v * this.lx, u * this.fz + v * this.lz];
  }

  toAxis(x: number, z: number, out: AxisPoint): AxisPoint {
    out.u = x * this.fx + z * this.fz;
    out.v = x * this.lx + z * this.lz;
    return out;
  }

  /** Offset of the water line across the axis: the stage's bays, with its headlands on them. */
  shore(u: number): number {
    const n = this.noise;
    return this.bayAmp * n(u * this.bayFreq, 1.5) + this.bendAmp * n(u * this.bendFreq + 40, 2.5);
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

  /** Rock, scree and dry grass at (u, v), in one pass for the terrain's colouring. */
  surface(u: number, v: number, x: number, z: number, out: CoastSurface): CoastSurface {
    const n = this.noise;
    const s = v - this.shore(u);
    const bw = this.beachWidth(u);
    const t = s - bw;
    const h = this.cliffHeight(u);
    const cw = h / this.cliffGrade(h);
    out.dry = smoothstep(0.3, 0.8, 0.5 + 0.5 * n(x * 0.011 + 60.1, z * 0.011 - 20.7));
    if (t <= cw + 1) {
      out.rock = t < -1 ? 0 : this.cliffness(h);
      // The boulder apron at the foot of a rock cliff, landward of mid-beach.
      out.scree = s > 0 && t < 0 ? this.cliffness(h) * smoothstep(APRON_FROM, 1, s / bw) : 0;
      return out;
    }
    const m = t - cw;
    out.rock = this.outcrops(x, z, m);
    // Scree fans below the outcrops (uphill is toward the land), gravel in the gully beds, loose patches.
    const ux = x + this.lx * 7;
    const uz = z + this.lz * 7;
    const fan = smoothstep(0.15, 0.5, this.outcrops(ux, uz, m + 7)) * (1 - out.rock);
    const bed = 0.8 * this.gully(u, m, x, z) ** 2;
    const patch =
      0.75 *
      smoothstep(0.6, 0.85, n(x * 0.035 + 71.3, z * 0.035 + 4.1)) *
      smoothstep(10, 25, m) *
      (1 - out.rock);
    out.scree = Math.max(fan, bed, patch);
    return out;
  }

  /** Where the hillside shows rock instead of scrub, fading in off the cliff top: irregular, warped blobs. */
  private outcrops(x: number, z: number, m: number): number {
    const n = this.noise;
    const wx = x + 14 * n(x * 0.013 - 3.3, z * 0.013 + 8.1);
    const wz = z + 14 * n(x * 0.013 + 12.9, z * 0.013 - 6.6);
    const mask = n(wx * 0.02 + 31.3, wz * 0.02 - 7.7) + 0.3 * n(x * 0.07 - 2.2, z * 0.07 + 5.5);
    return smoothstep(0.42, 0.72, mask) * smoothstep(2, 12, m);
  }

  /** Buttresses (+1) and the gullies between them (−1) along the cliff face, 7–16 m apart and wandering. */
  private rib(u: number, x: number, z: number): number {
    const w = this.noise(u * 0.085 + 0.6 * this.noise(x * 0.03, z * 0.03), 17.7);
    return 1 - 2 * Math.abs(w);
  }

  /** 1 on the bed of a gully running down the hillside, 0 between them; deepening inland. */
  private gully(u: number, m: number, x: number, z: number): number {
    const n = this.noise;
    const g = 1 - Math.abs(n(u * 0.028 + 0.5 * n(x * 0.01, z * 0.01), m * 0.004 + 30.3));
    return g ** 4 * smoothstep(8, 40, m);
  }

  /** Ground height at axis (u, v); the world (x, z) seeds the textures. */
  ground(u: number, v: number, x: number, z: number): number {
    const sea = this.seaLevel;
    const s = v - this.shore(u);
    if (s <= 0) return sea + Math.max(SEABED_FLOOR, SEABED_SLOPE * s);
    const n = this.noise;
    const bw = this.beachWidth(u);
    const h = this.cliffHeight(u);
    const cliffness = this.cliffness(h);
    // Fallen boulders heaped against a rock cliff's foot, carried a few metres onto its lowest ledge.
    const apronTop = cliffness * (APRON_HEIGHT + 0.6 * n(x * 0.09 + 2.7, z * 0.09 - 1.4));
    if (s <= bw) {
      const apron = apronTop * smoothstep(APRON_FROM, 1, s / bw) ** 2;
      return sea + BEACH_TOP * (s / bw) + 0.12 * n(x * 0.07, z * 0.07) + apron;
    }
    const t = s - bw;
    const grade = this.cliffGrade(h);
    const cw = h / grade;
    // The cliff band: terraced rock steepening on buttresses and slackening in gullies, its ledges of
    // uneven depth wandering along the shore and broken up by noise; a smooth bank where it is low.
    const rib = this.rib(u, x, z);
    const run = Math.min(
      cw,
      Math.max(
        0,
        t * (1 + CLIFF_RIB * rib) + 1.4 * n(x * 0.05 + 7.3, z * 0.05) * smoothstep(0, 3, t),
      ),
    );
    const period = (CLIFF_TREAD + CLIFF_RISER) * (0.75 + 0.25 * (1 + n(u * 0.013 + 3.1, 9.4)));
    const tread = period * (CLIFF_TREAD / (CLIFF_TREAD + CLIFF_RISER));
    const phase = period * (0.5 + 0.5 * n(u * 0.021 + 5.5, 1.9));
    const smoothBand = grade * Math.min(cw, t);
    const rockBand = Math.min(h, grade * strata(run, phase, tread, period - tread));
    const crag = 1 - Math.abs(n(x * 0.11 + 3.3, z * 0.11 - 8.8));
    const crags =
      CLIFF_CRAG * (crag * crag - 0.45) * smoothstep(0, 2.5, t) * smoothstep(0, 2.5, cw - t);
    const band =
      smoothBand +
      (rockBand - smoothBand) * cliffness +
      crags * cliffness +
      apronTop * (1 - smoothstep(0, 3, t));
    // The hillside: rolling scrub cut by gullies, terraced into uneven scarps where the outcrops are.
    const m = Math.max(0, t - cw);
    const slope = this.hillSlope(u);
    const hill = slope * m;
    const hillPhase = (HILL_TREAD + HILL_RISER) * (0.5 + 0.5 * n(u * 0.05 + 2.2, 7.1));
    const steps = slope * strata(m, hillPhase, HILL_TREAD, HILL_RISER);
    const rock = this.outcrops(x, z, m);
    const scarp = 1 - Math.abs(n(x * 0.09 - 6.1, z * 0.09 + 2.4));
    const hummocks =
      (HUMMOCK * n(x * 0.045 + 11.1, z * 0.045 - 3.3) + 0.25 * n(x * 0.12 - 5.5, z * 0.12 + 8.8)) *
      smoothstep(4, 18, m);
    const gully = -GULLY_DEPTH * this.gully(u, m, x, z);
    const f = this.frequency;
    const relief =
      this.relief *
      (0.6 * n(x * f, z * f) +
        0.3 * n(x * f * 0.37 + 17.1, z * f * 0.37 - 4.3) +
        0.1 * n(x * f * 2.3, z * f * 2.3));
    const rubble = 0.3 * n(x * 0.13, z * 0.13) * smoothstep(1, 4, t);
    return (
      sea +
      BEACH_TOP +
      band +
      hill +
      (steps - hill + HILL_CRAG * (scarp * scarp - 0.3)) * rock +
      hummocks +
      gully +
      relief * smoothstep(6, 60, m) +
      rubble
    );
  }
}
