import type { CircuitTrackside } from '@/game/stage/CircuitTrackside';
import type { RoadPath } from '@/game/stage/RoadPath';
import { cellTone } from './SurfaceDetail';
import type { Strip } from './RoadBuilder';

/**
 * A circuit's race asphalt, textured: the carriageway cut into narrow bands
 * across, each two-metre block of each band a shade of its own, and dark
 * rubber laid down where the cars brake and turn: heavy over the braking
 * zone before each corner, along the racing line (the outside going in,
 * the inside at the apex), in streaks that come and go, lighter through
 * the corner itself. Read from the lap's curvature alone (`CircuitTrackside`),
 * so every view of the same circuit agrees.
 */

/** Bands across the carriageway. */
const BANDS = 10;
/** Every block strays this much lighter or darker. */
const JITTER = 0.045;
/** A corner is anything tighter than this radius (metres); braking runs this far before it. */
const CORNER_RADIUS = 110;
const BRAKE_REACH = 70;
/** Rubber darkens the asphalt by up to this share on the racing line in a braking zone, this through a corner. */
const BRAKE_DARK = 0.5;
const CORNER_DARK = 0.24;
/** The racing line's rubber spreads this far across (shares of the half width). */
const LINE_SPREAD = 0.42;

interface Rubber {
  /** 0..1 how hard the cars brake here, and how much they are turning. */
  brake: Float64Array;
  turn: Float64Array;
  /** Where the racing line runs, −1 (right edge) to 1 (left edge). */
  line: Float64Array;
}

const cache = new WeakMap<CircuitTrackside, Rubber>();

function smooth(a: Float64Array, r: number): Float64Array {
  const n = a.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += a[(i + k + n) % n]!;
    out[i] = s / (2 * r + 1);
  }
  return out;
}

function rubberOf(t: CircuitTrackside, path: RoadPath): Rubber {
  const hit = cache.get(t);
  if (hit) return hit;
  const n = path.count - 1;
  const reach = Math.round(BRAKE_REACH / path.spacing);
  const brake = new Float64Array(n);
  const turn = new Float64Array(n);
  const rawLine = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const k = t.curvature[i]!;
    const sharp = Math.min(1, Math.abs(k) * CORNER_RADIUS);
    turn[i] = Math.abs(k) * CORNER_RADIUS > 1 ? sharp : 0;
    // The braking zone: the nearest corner within reach ahead, harder the closer it is.
    let ahead = 0;
    let sign = 0;
    for (let j = 1; j <= reach; j++) {
      const kj = t.curvature[(i + j) % n]!;
      if (Math.abs(kj) * CORNER_RADIUS > 1) {
        ahead = 1 - (j - 1) / reach;
        sign = Math.sign(kj);
        break;
      }
    }
    brake[i] = turn[i]! > 0 ? 0 : ahead * ahead;
    // Left of travel is +1 and a left turn has positive curvature: in a corner the line hugs its
    // inside, braking for one it holds the outside.
    rawLine[i] = turn[i]! > 0 ? 0.6 * Math.sign(k) : ahead > 0 ? -0.55 * sign : 0;
  }
  const out = { brake: smooth(brake, 2), turn: smooth(turn, 3), line: smooth(rawLine, 8) };
  cache.set(t, out);
  return out;
}

/** The carriageway strip split into textured bands, with the rubber of the braking zones and corners. */
export function circuitTarmacStrips(base: Strip, t: CircuitTrackside, path: RoadPath): Strip[] {
  const rubber = rubberOf(t, path);
  const n = path.count - 1;
  return Array.from({ length: BANDS }, (_, band): Strip => {
    // Band edges from the right edge (−hw) to the left (+hw), and its middle as a share of the half width.
    const from = (hw: number) => -hw + (2 * hw * band) / BANDS;
    const to = (hw: number) => -hw + (2 * hw * (band + 1)) / BANDS;
    const mid = -1 + (2 * band + 1) / BANDS;
    return {
      ...base,
      a: from,
      b: to,
      detail: (_hw, k) => {
        const i = ((k % n) + n) % n;
        const block = cellTone(k, band, 503, JITTER);
        const near = Math.max(0, 1 - Math.abs(mid - rubber.line[i]!) / LINE_SPREAD);
        if (near <= 0) return block;
        // Tyre streaks: each band's rubber comes and goes in runs of a few metres.
        const streak = 0.45 + 0.55 * cellTone(Math.floor(k / 3), band, 509, 1) * 0.5;
        const dark =
          (BRAKE_DARK * rubber.brake[i]! + CORNER_DARK * rubber.turn[i]!) * near * streak;
        return block * (1 - Math.min(0.5, dark));
      },
    };
  });
}
