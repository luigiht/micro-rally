import type { Rgb } from './meshTerrainChunk';

/**
 * The Greenvale's ground, one flat-shaded face at a time: meadow greens
 * that deepen into lush green down the hollows and valley floors and warm
 * to a sunlit yellow-green over the crests, broken into broad patches of
 * olive and deeper green; grey rock on the steep faces and in outcrops on
 * the slopes, in faint beds of lighter and darker grey; and brown earth and
 * worn grass easing in toward the road. Every face strays a little lighter
 * or darker, so the hillsides read textured. The road's shoulder is laid
 * over this by the chunk mesher. Pure: runs in the worker.
 */

export interface ValleyTones {
  lush: Rgb;
  meadow: Rgb;
  sunlit: Rgb;
  olive: Rgb;
  rock: Rgb;
  rockDark: Rgb;
  rockLight: Rgb;
  earth: Rgb;
}

export interface ValleyFace {
  /** Face centroid and height. */
  x: number;
  z: number;
  h: number;
  /** Up component of the face normal. */
  ny: number;
  /** How far the ground lies below its surroundings, metres (negative on a crest). */
  hollow: number;
  /** How close the road is: 1 on its deck, falling to 0 where the ground has blended back into the hills. */
  road: number;
  /** Two independent per-face hashes in [0, 1). */
  hashA: number;
  hashB: number;
}

/** Ground goes to rock from about 33° of tilt and is bare by about 47°; outcrops break through from about 20°. */
const ROCK_FROM = 0.16;
const ROCK_TO = 0.32;
const OUTCROP_FROM = 0.06;
/** Rock beds are about this thick. */
const BED = 1.4;
/** Hollows this deep are fully lush; crests this high fully sunlit. */
const HOLLOW_FULL = 3.5;
const CREST_FULL = 4;
/** Patch sizes, metres: broad meadow patches and small tufts within them. */
const PATCH = 42;
const TUFT = 9;
/** Each face strays this much lighter or darker. */
const FACET = 0.14;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function hash(i: number, j: number, salt: number): number {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(salt, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise 0..1 on a lattice `cell` metres across. */
function valueNoise(x: number, z: number, cell: number, salt: number): number {
  const u = x / cell;
  const v = z / cell;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const su = fu * fu * (3 - 2 * fu);
  const sv = fv * fv * (3 - 2 * fv);
  const a = hash(i, j, salt);
  const b = hash(i + 1, j, salt);
  const c = hash(i, j + 1, salt);
  const d = hash(i + 1, j + 1, salt);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}

/** Scratch for the rock's colour: the mesher runs this per face, so nothing is allocated. */
const GREY: [number, number, number] = [0, 0, 0];

function mix(out: number[], c: Rgb, t: number): void {
  out[0]! += (c[0] - out[0]!) * t;
  out[1]! += (c[1] - out[1]!) * t;
  out[2]! += (c[2] - out[2]!) * t;
}

/** Writes the face's colour into `out` (linear RGB). */
export function valleyFaceColor(tones: ValleyTones, f: ValleyFace, out: number[]): void {
  const patch = valueNoise(f.x, f.z, PATCH, 11);
  const tuft = valueNoise(f.x, f.z, TUFT, 23);
  out[0] = tones.meadow[0];
  out[1] = tones.meadow[1];
  out[2] = tones.meadow[2];
  // Lush down the hollows, sunlit over the crests, patched with olive and deeper green between.
  mix(out, tones.lush, 0.85 * smoothstep(-0.5, HOLLOW_FULL, f.hollow + (tuft - 0.5) * 1.5));
  mix(out, tones.sunlit, 0.75 * smoothstep(0.5, CREST_FULL, -f.hollow + (tuft - 0.5) * 1.5));
  mix(out, tones.olive, 0.6 * smoothstep(0.58, 0.82, patch));
  mix(out, tones.lush, 0.45 * smoothstep(0.42, 0.18, patch));
  // Brown earth and worn grass toward the road, its edge broken up.
  mix(out, tones.earth, 0.62 * smoothstep(0.2, 0.85, f.road + (tuft - 0.5) * 0.45));
  // Grey rock on the steep faces, and outcrops breaking through the steeper slopes where the patches say.
  const tilt = 1 - f.ny;
  const face = smoothstep(ROCK_FROM, ROCK_TO, tilt + (tuft - 0.5) * 0.08);
  const outcrop = smoothstep(OUTCROP_FROM, ROCK_FROM, tilt) * smoothstep(0.7, 0.86, patch);
  const rocky = Math.max(face, outcrop) * (1 - 0.6 * f.road);
  if (rocky > 0) {
    const bed = f.h / BED + tuft * 0.8;
    const light = (bed - Math.floor(bed)) * 0.7 + f.hashB * 0.3;
    GREY[0] = tones.rockDark[0];
    GREY[1] = tones.rockDark[1];
    GREY[2] = tones.rockDark[2];
    mix(GREY, tones.rock, smoothstep(0, 0.45, light));
    mix(GREY, tones.rockLight, smoothstep(0.55, 1, light));
    mix(out, GREY, rocky);
  }
  const k = 1 + (f.hashA - 0.5) * 2 * FACET;
  out[0]! *= k;
  out[1]! *= k;
  out[2]! *= k;
}
