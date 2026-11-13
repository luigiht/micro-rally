import { laneCount } from './LaneMarkings';

/**
 * A city's road and pavement detail, all in vertex colour so the surfaces
 * stay flat-shaded and low-poly: each lane's two wheel paths worn a shade
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
