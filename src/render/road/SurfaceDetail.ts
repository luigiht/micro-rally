import { laneCount } from './LaneMarkings';

/**
 * Road and pavement detail for a city, the Alpine passes and the Greenvale's worn tarmac, all in
 * vertex colour so the surfaces stay flat-shaded and low-poly. In a city: each lane's two wheel paths worn a shade
 * darker than the asphalt between them, the asphalt itself mottled piece by
 * piece, and the pavements laid as rows of slabs, each a touch lighter or
 * darker than the next. The ribbon (`RoadBuilder`), the side streets
 * (`TownStreetBuilder`) and the junctions' corners (`TownJunctionBuilder`)
 * share it, so the city's surfaces read as one.
 */

/** The wheel paths: this far either side of a lane's middle, this wide, this much darker. */
const WHEEL_OFFSET = 0.85;
const WHEEL_WIDTH = 0.55;
export const WHEEL_TONE = 0.89;
/** How far a piece of asphalt and a pavement slab may stray from the base colour, either way. */
export const ASPHALT_JITTER = 0.035;
export const SLAB_JITTER = 0.1;
/** Rows of slabs across a pavement's width, and a slab's length along a side street. */
export const SLAB_ROWS = 2;
export const SLAB_LENGTH = 2;

/** A stable 0..1 from integers, for tones that never change between visits. */
export function cellHash(a: number, b: number, c = 0): number {
  let h =
    Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x5bd1e995);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** A tone a little either side of 1 for cell (a, b) of surface `salt`, up to `jitter` away. */
export function cellTone(a: number, b: number, salt: number, jitter: number): number {
  return 1 + (cellHash(a, b, salt) - 0.5) * 2 * jitter;
}

export interface Band {
  a: number;
  b: number;
  wheel: boolean;
}

/** The most bands any carriageway is cut into (four lanes of five). */
export const MAX_BANDS = 20;

/**
 * A carriageway of half width `hw` cut across into bands from its right edge
 * (−hw) to its left (hw): in each lane, asphalt, a wheel path, asphalt, a
 * wheel path, asphalt. A lane too narrow for its wheel paths is one band.
 */
export function laneBands(hw: number): Band[] {
  const lanes = Math.max(1, laneCount(hw, false));
  const w = (2 * hw) / lanes;
  const out: Band[] = [];
  for (let i = 0; i < lanes; i++) {
    const lo = -hw + w * i;
    const mid = lo + w / 2;
    const hi = lo + w;
    const cuts = [
      mid - WHEEL_OFFSET - WHEEL_WIDTH / 2,
      mid - WHEEL_OFFSET + WHEEL_WIDTH / 2,
      mid + WHEEL_OFFSET - WHEEL_WIDTH / 2,
      mid + WHEEL_OFFSET + WHEEL_WIDTH / 2,
    ];
    if (cuts[0]! <= lo || cuts[3]! >= hi) {
      out.push({ a: lo, b: hi, wheel: false });
      continue;
    }
    out.push(
      { a: lo, b: cuts[0]!, wheel: false },
      { a: cuts[0]!, b: cuts[1]!, wheel: true },
      { a: cuts[1]!, b: cuts[2]!, wheel: false },
      { a: cuts[2]!, b: cuts[3]!, wheel: true },
      { a: cuts[3]!, b: hi, wheel: false },
    );
  }
  return out;
}

/**
 * A snow-dusted mountain road (the Alpine passes' `snow` surface, where no
 * banks are heaped) in the same lane bands, softly: the wheel tracks swept
 * almost clear and a shade darker, wet; a little dust between them, a touch
 * more over the crown between the lanes and along the edges, where the
 * traffic pushes it. A snow patch thickens every band, the tracks least.
 * Nothing runs ruled: each lane's tracks wander together across the lane
 * over tens of metres, every band edge strays a little on its own every few
 * metres, and each band's dust comes and goes along the road.
 */
type DustKind = 'track' | 'between' | 'crown' | 'edge';
const DUST_BASE: Readonly<Record<DustKind, number>> = {
  track: 0,
  between: 0.05,
  crown: 0.08,
  edge: 0.12,
};
/** How much of a snow patch's cover each kind of band takes. */
const DUST_PATCH: Readonly<Record<DustKind, number>> = {
  track: 0.8,
  between: 1,
  crown: 1.05,
  edge: 1.1,
};
/** A band's dust strays this far either way along the road, smoothly over this many samples. */
const DUST_RAG = 0.06;
const DUST_PERIOD = 2.5;
/** Dust never covers more than this share of the tarmac. */
const DUST_MAX = 0.65;
/** The swept wheel tracks: wet tarmac, a shade darker. */
export const TRACK_TONE = 0.95;
/** A lane's tracks wander this far either way, over this many samples; each band edge strays this far on its own, over that many. */
const TRACK_WANDER = 0.25;
const TRACK_WANDER_PERIOD = 12;
const EDGE_STRAY = 0.16;
const EDGE_STRAY_PERIOD = 1.6;

/** Smooth 0..1 noise along the road (sample index `k`), one stream per `salt`. */
export function alongNoise(k: number, period: number, salt: number): number {
  const c = k / period;
  const n = Math.floor(c);
  const f = c - n;
  const a = cellHash(n, salt);
  return a + (cellHash(n + 1, salt) - a) * (f * f * (3 - 2 * f));
}

/** Smooth noise along the road, −1..1. */
const wobble = (k: number, period: number, salt: number) => (alongNoise(k, period, salt) - 0.5) * 2;

/**
 * Where the edge between band `j` and band `j + 1` of a dusted carriageway
 * lies at sample `k`: its ruled place moved with its lane's wandering tracks
 * and by its own stray, never so far that two edges cross.
 */
function bandEdge(bands: readonly Band[], j: number, hw: number, k: number): number {
  const x = bands[j]!.b;
  const lanes = Math.max(1, laneCount(hw, false));
  const lane = Math.min(lanes - 1, Math.floor(((x + hw) * lanes) / (2 * hw) + 1e-6));
  return (
    x +
    TRACK_WANDER * wobble(k, TRACK_WANDER_PERIOD, 601 + lane) +
    EDGE_STRAY * wobble(k, EDGE_STRAY_PERIOD, 701 + j)
  );
}

/** Band `i` of a dusted carriageway of half width `hw` at sample `k`, its edges wandering; null past the last band. */
export function dustBand(hw: number, i: number, k: number): { a: number; b: number } | null {
  const bands = laneBands(hw);
  if (!bands[i]) return null;
  return {
    a: i === 0 ? -hw : bandEdge(bands, i - 1, hw, k),
    b: i === bands.length - 1 ? hw : bandEdge(bands, i, hw, k),
  };
}

function dustKind(bands: readonly Band[], i: number, hw: number): DustKind {
  const band = bands[i]!;
  if (band.wheel) return 'track';
  if (band.a <= -hw + 1e-6 || band.b >= hw - 1e-6) return 'edge';
  // A band reaching a lane's boundary (the crown between two lanes) rather than a wheel path either side.
  const prev = bands[i - 1];
  const next = bands[i + 1];
  return prev?.wheel && next?.wheel ? 'between' : 'crown';
}

/**
 * The share of snow over band `i` of a dusted carriageway of half width
 * `hw` at sample `k`, where the stage's snow patches lay `patch` (0..0.45).
 */
export function dustAt(hw: number, i: number, k: number, patch: number): number {
  const bands = laneBands(hw);
  if (!bands[i]) return 0;
  const kind = dustKind(bands, i, hw);
  const rag = wobble(k, DUST_PERIOD, 503 + i) * DUST_RAG * (kind === 'track' ? 0.4 : 1);
  return Math.min(DUST_MAX, Math.max(0, DUST_BASE[kind] + patch * DUST_PATCH[kind] + rag));
}

/**
 * Worn mountain tarmac (stage types with `wornTarmac`, the Greenvale), in the
 * dusted road's wandering lane bands: each piece mottled a little lighter or
 * darker; the wheel tracks polished a shade darker and the aggregate between
 * and along the edges a touch paler; black rubber laid down along the tracks
 * through the bends, the more the tighter, coming and going with the line
 * the cars took; and now and then a lane patched for ten metres or so, in
 * fresher dark asphalt or an old faded repair, its ends square.
 */
const WORN_JITTER = 0.05;
const WORN_TRACK = 0.92;
const WORN_EDGE = 1.05;
const WORN_BETWEEN = 1.02;
/** Rubber shows from this curvature (1/m) and is heaviest by this one, this much darker on a track. */
const RUBBER_FROM = 0.02;
const RUBBER_TO = 0.06;
const RUBBER_TRACK = 0.3;
const RUBBER_BETWEEN = 0.08;
/** Patches: in road samples per stretch, the share of a lane's stretches patched, and their two tones. */
const PATCH_SAMPLES = 6;
const PATCH_SHARE = 0.06;
const PATCH_DARK = 0.84;
const PATCH_FADED = 1.1;

/**
 * The worn carriageway's surface is uneven too, a few centimetres at most
 * and only ever below the deck, so the painted edge lines never sink into
 * it: each lane heaves slowly along the road, its wheel tracks sit in shallow
 * ruts, and every band edge strays a little station by station. The
 * carriageway's own edges stay at the deck, where the raised edge meets them.
 */
const HEAVE = 0.035;
const HEAVE_PERIOD = 9;
const RUT_DEPTH = 0.03;
const ROUGH = 0.012;

/** How far below the deck the edge between band `j - 1` and band `j` lies at sample `k`. */
function wornEdgeDepth(bands: readonly Band[], j: number, hw: number, k: number): number {
  if (j <= 0 || j >= bands.length) return 0;
  const x = bands[j]!.a;
  const lanes = Math.max(1, laneCount(hw, false));
  const lane = Math.min(lanes - 1, Math.floor(((x + hw) * lanes) / (2 * hw) + 1e-6));
  const rut =
    bands[j - 1]!.wheel || bands[j]!.wheel ? RUT_DEPTH * (0.5 + alongNoise(k, 5, 977 + j)) : 0;
  return HEAVE * alongNoise(k, HEAVE_PERIOD, 971 + lane) + rut + ROUGH * cellHash(k, j, 983);
}

/** Depths below the deck of band `i`'s two edges on a worn carriageway at sample `k`. */
export function wornDip(hw: number, i: number, k: number): readonly [number, number] {
  const bands = laneBands(hw);
  if (!bands[i]) return [0, 0];
  return [wornEdgeDepth(bands, i, hw, k), wornEdgeDepth(bands, i + 1, hw, k)];
}

/** The shade of band `i` of a worn carriageway of half width `hw` at sample `k`, where the road bends `bend` (1/m). */
export function wornTone(hw: number, i: number, k: number, bend: number): number {
  const bands = laneBands(hw);
  const band = bands[i];
  if (!band) return 1;
  const kind = dustKind(bands, i, hw);
  let tone = cellTone(k, i, 401, WORN_JITTER);
  tone *= kind === 'track' ? WORN_TRACK : kind === 'edge' ? WORN_EDGE : WORN_BETWEEN;
  const rubber =
    smoothstep(RUBBER_FROM, RUBBER_TO, Math.abs(bend)) * (0.35 + 0.65 * alongNoise(k, 7, 951 + i));
  tone *= 1 - rubber * (kind === 'track' ? RUBBER_TRACK : RUBBER_BETWEEN);
  const lanes = Math.max(1, laneCount(hw, false));
  const lane = Math.min(lanes - 1, Math.floor(((band.a + band.b) / 2 + hw) / ((2 * hw) / lanes)));
  const stretch = Math.floor(k / PATCH_SAMPLES);
  if (cellHash(stretch, lane, 907) < PATCH_SHARE)
    tone *= cellHash(stretch, lane, 911) < 0.6 ? PATCH_DARK : PATCH_FADED;
  return tone;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
