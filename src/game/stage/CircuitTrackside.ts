import type { BoxObstacle } from '../vehicle/Collisions';
import type { Surface } from '../vehicle/surfaces';
import type { RoadHit, RoadPath } from './RoadPath';
import type { StageDef } from './StageGenerator';

/**
 * What stands beside a circuit, per sample of its closed lap: the kerbs on
 * the corners, the gravel traps on the outside of the fast ones, and the
 * barrier line each side (Armco, with catch fencing where the runoff is
 * widest and along the main straight). Derived from the path's curvature
 * alone, so the terrain worker and the renderer build the same thing.
 * Sides follow the road's lateral sign: +1 left, −1 right. Pure TS.
 */

/** Corners tighter than this radius (metres) get kerbs. */
export const KERB_RADIUS = 150;
/** Fast corners (radius between these) get a gravel trap on the outside. */
const GRAVEL_RADIUS: readonly [number, number] = [40, 150];
/** Kerbs run from this far inside the carriageway edge to this far outside it. */
export const KERB_IN = 0.2;
export const KERB_OUT = 0.9;
/** The kerb stands this high, climbed over `KERB_RAMP_WIDTH` from either edge. */
export const KERB_HEIGHT = 0.03;
export const KERB_RAMP_WIDTH = 0.25;
/** Barrier offset beyond the carriageway edge on straights, and the most extra runoff a corner's outside gets. */
const BARRIER_GAP = 6;
const RUNOFF_EXTRA = 10;
/** Barriers keep at least this far beyond the carriageway edge, even on a hairpin's inside. */
const MIN_INSIDE_GAP = 2.5;
/** Gravel stops this short of the barrier, and starts this far beyond the kerb. */
export const GRAVEL_TO_BARRIER = 1.5;
export const GRAVEL_FROM_KERB = 1.2;
/** Barrier collider thickness (half), metres. */
const BARRIER_HALF = 0.2;

export interface CircuitTrackside {
  /** Signed curvature per sample (1/m), positive turning left. */
  curvature: Float64Array;
  /** Per side (index 0 left, 1 right) and sample: kerb present. */
  kerb: [Uint8Array, Uint8Array];
  /** Per side and sample: gravel trap present. */
  gravel: [Uint8Array, Uint8Array];
  /** Per side and sample: metres along the lap to the nearer end of its gravel run (0 off gravel). */
  gravelRun: [Float64Array, Float64Array];
  /** Per side and sample: barrier offset from the centreline, metres. */
  barrier: [Float64Array, Float64Array];
  /** Per side and sample: catch fence stands on the barrier. */
  fence: [Uint8Array, Uint8Array];
}

const sideIndex = (side: 1 | -1) => (side === 1 ? 0 : 1);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Cyclic box filter over ±`r` samples (the last sample repeats the first, so it is left out and copied). */
function smoothCyclic(a: Float64Array, r: number): Float64Array {
  const n = a.length - 1;
  const out = new Float64Array(a.length);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += a[(i + k + n) % n]!;
    out[i] = sum / (2 * r + 1);
  }
  out[n] = out[0]!;
  return out;
}

function maxCyclic(a: Float64Array, r: number): Float64Array {
  const n = a.length - 1;
  const out = new Float64Array(a.length);
  for (let i = 0; i < n; i++) {
    let m = -Infinity;
    for (let k = -r; k <= r; k++) m = Math.max(m, a[(i + k + n) % n]!);
    out[i] = m;
  }
  out[n] = out[0]!;
  return out;
}

/** Grow every run of set samples by `r` either way, round the lap. */
function dilate(mask: Uint8Array, r: number): Uint8Array {
  const n = mask.length - 1;
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    for (let k = -r; k <= r; k++) out[(i + k + n) % n] = 1;
  }
  out[n] = out[0]!;
  return out;
}

function buildTrackside(path: RoadPath, halfWidth: number, mainStraight: number): CircuitTrackside {
  const n = path.count - 1;
  const span = 3;
  const raw = new Float64Array(path.count);
  for (let i = 0; i < n; i++) {
    const a = path.headings[(i - span + n) % n]!;
    const b = path.headings[(i + span) % n]!;
    raw[i] = wrapAngle(b - a) / (2 * span * path.spacing);
  }
  raw[n] = raw[0]!;
  const curvature = smoothCyclic(raw, 2);

  const kerb: [Uint8Array, Uint8Array] = [new Uint8Array(path.count), new Uint8Array(path.count)];
  const gravelSeed: [Uint8Array, Uint8Array] = [
    new Uint8Array(path.count),
    new Uint8Array(path.count),
  ];
  const extra: [Float64Array, Float64Array] = [
    new Float64Array(path.count),
    new Float64Array(path.count),
  ];
  for (let i = 0; i < n; i++) {
    const k = curvature[i]!;
    const r = Math.abs(k) > 1e-6 ? 1 / Math.abs(k) : Infinity;
    const inside = k > 0 ? 0 : 1;
    const outside = 1 - inside;
    if (r < KERB_RADIUS) kerb[inside]![i] = 1;
    if (r >= GRAVEL_RADIUS[0] && r < GRAVEL_RADIUS[1]) gravelSeed[outside]![i] = 1;
    extra[outside]![i] = RUNOFF_EXTRA * Math.min(1, Math.max(0, (KERB_RADIUS - r) / 110));
  }
  // The outside kerb runs from the apex (the tightest sample) over the exit.
  for (let i = 0; i < n; i++) {
    const k = curvature[i]!;
    if (1 / Math.max(1e-6, Math.abs(k)) >= KERB_RADIUS) continue;
    const prev = Math.abs(curvature[(i - 1 + n) % n]!);
    const exiting = Math.abs(k) <= prev && Math.sign(curvature[(i - 1 + n) % n]!) === Math.sign(k);
    if (exiting) kerb[k > 0 ? 1 : 0]![i] = 1;
  }
  const kerbs: [Uint8Array, Uint8Array] = [dilate(kerb[0], 3), dilate(kerb[1], 3)];

  const barrier: [Float64Array, Float64Array] = [
    new Float64Array(path.count),
    new Float64Array(path.count),
  ];
  const fence: [Uint8Array, Uint8Array] = [new Uint8Array(path.count), new Uint8Array(path.count)];
  const gravel: [Uint8Array, Uint8Array] = [new Uint8Array(path.count), new Uint8Array(path.count)];
  const mainEnd = Math.ceil(mainStraight / path.spacing);
  for (const s of [0, 1] as const) {
    // Runoff opens out before the corner and closes after it: widened, then eased.
    const runoff = smoothCyclic(maxCyclic(extra[s]!, 10), 8);
    const grown = dilate(gravelSeed[s]!, 10);
    for (let i = 0; i <= n; i++) {
      const j = i % n;
      let offset = halfWidth + BARRIER_GAP + runoff[j]!;
      // On a corner's inside the line keeps well inside the radius, so the offset curve never folds.
      const k = curvature[j]!;
      const insideHere = (k > 0 ? 0 : 1) === s;
      if (insideHere && Math.abs(k) > 1e-6) {
        let rMin = Infinity;
        for (let m = -10; m <= 10; m++) {
          const km = Math.abs(curvature[(j + m + n) % n]!);
          if (km > 1e-6) rMin = Math.min(rMin, 1 / km);
        }
        offset = Math.min(offset, Math.max(halfWidth + MIN_INSIDE_GAP, 0.7 * rMin));
      }
      barrier[s]![i] = offset;
      fence[s]![i] = runoff[j]! > 4 || j <= mainEnd ? 1 : 0;
      const room = offset - GRAVEL_TO_BARRIER - (halfWidth + KERB_OUT + GRAVEL_FROM_KERB);
      gravel[s]![i] = grown[j]! && room > 3 ? 1 : 0;
    }
  }
  const gravelRun: [Float64Array, Float64Array] = [
    new Float64Array(path.count),
    new Float64Array(path.count),
  ];
  for (const s of [0, 1] as const) {
    const g = gravel[s];
    for (let i = 0; i < n; i++) {
      if (!g[i]) continue;
      let back = 0;
      while (back < n && g[(i - back - 1 + n) % n]) back++;
      let fwd = 0;
      while (fwd < n && g[(i + fwd + 1) % n]) fwd++;
      gravelRun[s][i] = Math.min(back, fwd) * path.spacing;
    }
    gravelRun[s][n] = gravelRun[s][0]!;
  }
  return { curvature, kerb: kerbs, gravel, gravelRun, barrier, fence };
}

const cache = new WeakMap<StageDef, CircuitTrackside>();

/** The trackside of a circuit stage (built once per stage object); null on an open stage. */
export function circuitTrackside(stage: StageDef): CircuitTrackside | null {
  if (!stage.circuit) return null;
  let t = cache.get(stage);
  if (!t) {
    t = buildTrackside(stage.path, stage.halfWidth, stage.circuit.mainStraight);
    cache.set(stage, t);
  }
  return t;
}

/** Sample index nearest a lap distance. */
function sampleAt(path: RoadPath, along: number): number {
  return Math.min(path.count - 1, Math.max(0, Math.round(path.wrap(along) / path.spacing)));
}

/** Whether a kerb runs at this lap distance on this side. */
export function kerbAt(t: CircuitTrackside, path: RoadPath, along: number, side: 1 | -1): boolean {
  return t.kerb[sideIndex(side)][sampleAt(path, along)] === 1;
}

/** Barrier offset from the centreline at this lap distance on this side. */
export function barrierAt(
  t: CircuitTrackside,
  path: RoadPath,
  along: number,
  side: 1 | -1,
): number {
  const f = path.wrap(along) / path.spacing;
  const i = Math.min(path.count - 2, Math.floor(f));
  const a = t.barrier[sideIndex(side)];
  return a[i]! + (a[i + 1]! - a[i]!) * (f - i);
}

/** Whether a point `lateral` metres off the centreline (signed, + left) at `along` is in a gravel trap. */
export function inGravel(
  t: CircuitTrackside,
  path: RoadPath,
  halfWidth: number,
  along: number,
  lateral: number,
): boolean {
  const side = lateral >= 0 ? 1 : -1;
  if (t.gravel[sideIndex(side)][sampleAt(path, along)] !== 1) return false;
  const d = Math.abs(lateral);
  return (
    d > halfWidth + KERB_OUT + GRAVEL_FROM_KERB &&
    d < barrierAt(t, path, along, side) - GRAVEL_TO_BARRIER
  );
}

/**
 * How far a point lies inside the gravel band as drawn (metres to its nearest
 * edge, across or along the lap); 0 outside it.
 */
export function gravelDepth(
  t: CircuitTrackside,
  path: RoadPath,
  halfWidth: number,
  along: number,
  lateral: number,
): number {
  const k = sideIndex(lateral >= 0 ? 1 : -1);
  const f = path.wrap(along) / path.spacing;
  const i = Math.min(path.count - 2, Math.max(0, Math.floor(f)));
  const g = t.gravel[k];
  if (!g[i] || !g[i + 1]) return 0;
  const run = t.gravelRun[k];
  const alongDepth = run[i]! + (run[i + 1]! - run[i]!) * (f - i);
  const d = Math.abs(lateral);
  const inner = halfWidth + KERB_OUT + GRAVEL_FROM_KERB;
  const outer = barrierAt(t, path, along, lateral >= 0 ? 1 : -1) - GRAVEL_TO_BARRIER;
  return Math.max(0, Math.min(d - inner, outer - d, alongDepth));
}

/** Where the barrier line stands: one point per sample on this side. */
export function barrierLine(stage: StageDef, t: CircuitTrackside, side: 1 | -1): Float64Array {
  const { path } = stage;
  const a = t.barrier[sideIndex(side)];
  const out = new Float64Array(path.count * 2);
  for (let i = 0; i < path.count; i++) {
    const h = path.headings[i]!;
    // Left of travel is (cos h, −sin h).
    out[i * 2] = path.xs[i]! + Math.cos(h) * a[i]! * side;
    out[i * 2 + 1] = path.zs[i]! - Math.sin(h) * a[i]! * side;
  }
  return out;
}

/** The barriers as colliders: 4 m boxes along each line. */
export function barrierObstacles(stage: StageDef): BoxObstacle[] {
  const t = circuitTrackside(stage);
  if (!t) return [];
  const out: BoxObstacle[] = [];
  const step = Math.max(1, Math.round(4 / stage.path.spacing));
  for (const side of [1, -1] as const) {
    const line = barrierLine(stage, t, side);
    for (let i = 0; i + step < stage.path.count; i += step) {
      const x0 = line[i * 2]!;
      const z0 = line[i * 2 + 1]!;
      const x1 = line[(i + step) * 2]!;
      const z1 = line[(i + step) * 2 + 1]!;
      const dx = x1 - x0;
      const dz = z1 - z0;
      out.push({
        x: (x0 + x1) / 2,
        z: (z0 + z1) / 2,
        hx: BARRIER_HALF,
        hz: Math.hypot(dx, dz) / 2 + 0.2,
        yaw: Math.atan2(dx, dz),
      });
    }
  }
  return out;
}

/** Furthest any barrier stands from the centreline: the flat corridor and scenery clearance reach past it. */
export function outermostBarrier(t: CircuitTrackside): number {
  let m = 0;
  for (const a of t.barrier) for (let i = 0; i < a.length; i++) m = Math.max(m, a[i]!);
  return m;
}

/** The grandstand beside the start/finish line: 64 m long, about 7 m deep, this far behind the barrier. */
export const STAND = { length: 64, depth: 6.6, gap: 4 } as const;
/** Smaller open grandstands at the outside of the circuit's tighter corners. */
export const CORNER_STAND = {
  length: 26,
  depth: 5.2,
  rows: 4,
  rowRise: 0.4,
  gap: 3,
  spacing: 110,
  max: 6,
} as const;

export interface StandSpot {
  /** Side of the track it stands on (+1 left). */
  side: 1 | -1;
  /** Its front edge's distance from the centreline, and the heading of the straight there. */
  back: number;
  heading: number;
  /** Centre of its footprint, and a radius that covers it, for keeping trees out. */
  x: number;
  z: number;
  radius: number;
}

/** Where a circuit's grandstand stands: on the outside of the lap (opposite the way it turns overall), facing the line. */
export function grandstandSpot(stage: StageDef, t: CircuitTrackside): StandSpot {
  let turn = 0;
  for (let i = 0; i < t.curvature.length - 1; i++) turn += t.curvature[i]!;
  const side: 1 | -1 = turn > 0 ? -1 : 1;
  const sample = { x: 0, z: 0, heading: 0 };
  stage.path.sample(stage.startDistance, sample);
  const back = barrierAt(t, stage.path, stage.startDistance, side) + STAND.gap;
  const mid = back + STAND.depth / 2;
  return {
    side,
    back,
    heading: sample.heading,
    x: sample.x + Math.cos(sample.heading) * mid * side,
    z: sample.z - Math.sin(sample.heading) * mid * side,
    radius: Math.hypot(STAND.length / 2, STAND.depth / 2) + 6,
  };
}

export interface CornerStandSpot extends StandSpot {
  /** Lap distance of the corner apex. */
  distance: number;
}

/** Spaced outside-of-corner stands, at up to six of the circuit's tightest turns. */
export function cornerStandSpots(stage: StageDef, t: CircuitTrackside): CornerStandSpot[] {
  const path = stage.path;
  const n = path.count - 1;
  const candidates: { index: number; strength: number; distance: number }[] = [];
  for (let i = 0; i < n; i++) {
    const strength = Math.abs(t.curvature[i]!);
    if (strength < 1 / 120) continue;
    let peak = true;
    for (let offset = -8; offset <= 8 && peak; offset++)
      if (Math.abs(t.curvature[(i + offset + n) % n]!) > strength + 1e-8) peak = false;
    if (!peak) continue;
    const distance = i * path.spacing;
    const fromStart = path.wrap(distance - stage.startDistance);
    const startGap = Math.min(fromStart, path.length - fromStart);
    if (startGap < (STAND.length + CORNER_STAND.length) / 2 + 16) continue;
    candidates.push({ index: i, strength, distance });
  }
  candidates.sort((a, b) => b.strength - a.strength);

  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    if (
      selected.some((s) => {
        const delta = path.wrap(candidate.distance - s.distance);
        return Math.min(delta, path.length - delta) < CORNER_STAND.spacing;
      })
    )
      continue;
    selected.push(candidate);
    if (selected.length === CORNER_STAND.max) break;
  }

  const sample = { x: 0, z: 0, heading: 0 };
  return selected
    .sort((a, b) => a.distance - b.distance)
    .map(({ index, distance }) => {
      const side: 1 | -1 = t.curvature[index]! > 0 ? -1 : 1;
      const back = barrierAt(t, path, distance, side) + CORNER_STAND.gap;
      path.sample(distance, sample);
      const mid = back + CORNER_STAND.depth / 2;
      return {
        distance,
        side,
        back,
        heading: sample.heading,
        x: sample.x + Math.cos(sample.heading) * mid * side,
        z: sample.z - Math.sin(sample.heading) * mid * side,
        radius: Math.hypot(CORNER_STAND.length / 2, CORNER_STAND.depth / 2) + 4,
      };
    });
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * The kerb's lift under a point `out` metres beyond the carriageway edge
 * (negative inside it) at lap distance `along`, on the side `lateral` gives:
 * `KERB_HEIGHT` across its top, ramped at both edges; 0 off a kerb.
 */
export function kerbLift(
  t: CircuitTrackside,
  path: RoadPath,
  along: number,
  lateral: number,
  out: number,
): number {
  if (out <= -KERB_IN || out >= KERB_OUT) return 0;
  if (!kerbAt(t, path, along, lateral >= 0 ? 1 : -1)) return 0;
  const onto =
    smoothstep(-KERB_IN, -KERB_IN + KERB_RAMP_WIDTH, out) *
    (1 - smoothstep(KERB_OUT - KERB_RAMP_WIDTH, KERB_OUT, out));
  return KERB_HEIGHT * onto;
}

/** What a wheel rolls on at a road hit: the track's surface, tarmac over a kerb, gravel in a trap, else `offroad`. */
export function circuitSurface(
  t: CircuitTrackside,
  path: RoadPath,
  halfWidth: number,
  hit: RoadHit,
  surface: Surface,
  offroad: Surface,
): Surface {
  if (hit.distance <= halfWidth) return surface;
  if (hit.distance <= halfWidth + KERB_OUT && kerbAt(t, path, hit.along, hit.lateral >= 0 ? 1 : -1))
    return 'tarmac';
  if (inGravel(t, path, halfWidth, hit.along, hit.lateral)) return 'gravel';
  return offroad;
}
