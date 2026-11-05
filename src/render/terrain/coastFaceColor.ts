import type { Rgb } from './meshTerrainChunk';

/**
 * The coast's terrain colouring, one flat-shaded face at a time: a scrub
 * hillside of green and sun-dried grass dotted with dark maquis, gravel and
 * scree where the ground is loose or steep, and pale grey limestone where it
 * is bare, banded into strata (pale, body, faintly warm and blue-grey beds
 * that wander a little across the face) with grass on the flatter ledges. Sand and the road
 * verge are laid over this by the chunk mesher. Pure: runs in the worker.
 */

export interface CoastTones {
  rock: Rgb;
  rockLight: Rgb;
  rockDark: Rgb;
  rockWarm: Rgb;
  scree: Rgb;
  /** The bright grass that takes hold on the cliff's ledges. */
  ledge: Rgb;
  grassDry: Rgb;
  scrub: Rgb;
}

export interface CoastFace {
  /** Face centroid. */
  x: number;
  z: number;
  h: number;
  /** Up component of the face normal. */
  ny: number;
  /** Surface masks averaged over the face's corners, 0..1. */
  rock: number;
  scree: number;
  dry: number;
  /** Two independent per-face hashes in [0, 1). */
  hashA: number;
  hashB: number;
}

/**
 * Earthy ground goes to scree from about 46° of tilt and to bare rock from about 60°: the 22°–27°
 * hillside and its rolls and gullies stay grass, the road cuttings and the scarps do not.
 */
const SCREE_TILT_FROM = 0.3;
const SCREE_TILT_TO = 0.4;
const ROCK_TILT_TO = 0.5;
/** Strata beds are about this thick. */
const STRATA = 1.7;
/** Plants take hold on rock flatter than this (ny); maquis dots this share of the grass. */
const LEDGE_NY = 0.88;
const SCRUB_SHARE = 0.14;

/** Scratch for the rock body's colour: the mesher runs this per face, so nothing is allocated. */
const BODY: [number, number, number] = [0, 0, 0];

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function mix(out: number[], c: Rgb, k: number, scale = 1): void {
  out[0]! += (c[0] * scale - out[0]!) * k;
  out[1]! += (c[1] * scale - out[1]!) * k;
  out[2]! += (c[2] * scale - out[2]!) * k;
}

/** The face's colour, written into `out` (linear RGB), starting from the height-graded grass already there. */
export function coastFaceColor(tones: CoastTones, f: CoastFace, out: number[]): void {
  // Grass: patches of dry yellow-olive, dotted with dark maquis clumps (one face each).
  mix(out, tones.grassDry, f.dry * 0.6);
  if (f.hashB < SCRUB_SHARE * (1 - 0.5 * f.dry)) mix(out, tones.scrub, 0.75);

  const tilt = 1 - f.ny;
  const scree = Math.max(f.scree, smoothstep(SCREE_TILT_FROM, SCREE_TILT_TO, tilt));
  const rock = Math.max(f.rock, smoothstep(SCREE_TILT_TO, ROCK_TILT_TO, tilt));

  if (scree > 0) {
    // Gravel with the odd darker stone, its edge dithered face by face so patches fray out.
    mix(out, tones.scree, Math.min(1, scree * (0.8 + 0.4 * f.hashA)), 0.95 + 0.1 * f.hashA);
    if (f.hashB < 0.1) mix(out, tones.rockDark, 0.45 * scree);
  }

  if (rock > 0) {
    // Strata: beds by height, tilted and wandering a little across the face.
    const q =
      (f.h +
        0.9 * Math.sin(f.x * 0.071 + f.z * 0.023) +
        0.7 * Math.sin(f.z * 0.057 - f.x * 0.019)) /
      STRATA;
    const bed = q - Math.floor(q);
    const tone =
      bed < 0.14
        ? tones.rockDark
        : bed < 0.26
          ? tones.rockWarm
          : bed < 0.74
            ? tones.rock
            : tones.rockLight;
    const body = BODY;
    body[0] = out[0]!;
    body[1] = out[1]!;
    body[2] = out[2]!;
    mix(body, tone, 1, 0.94 + 0.12 * f.hashA);
    // Ledges catch the light and, here and there, a tuft of grass.
    const ledge = smoothstep(LEDGE_NY, 0.97, f.ny);
    mix(body, tones.rockLight, 0.35 * ledge);
    if (f.hashB < 0.35 * ledge) mix(body, tones.ledge, 0.85);
    mix(out, body, rock);
  }
}
