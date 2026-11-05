import { mulberry32, pickWeighted } from '../rng';
import { RoadPath } from './RoadPath';

/**
 * Procedural closed race circuits. Three traits are drawn from and mixed:
 * the Ring (a long, twisty loop of medium corners over hills), the Sarthe (a
 * very long straight broken by chicanes, fast kinks and a slow hairpin at its
 * end) and the Park (long straights joined by tight chicanes, with one long
 * sweeping curve). A layout starts as a star-shaped polygon round a centre
 * (which can never cross itself), stretches some edges into straights, rounds
 * every vertex into an arc of a chosen radius, drops chicanes onto long
 * straights and is resampled as a closed `RoadPath` that starts at the
 * beginning of its longest straight. Pure TS.
 */

export type CircuitStyle = 'ring' | 'sarthe' | 'park';

export interface CircuitLayout {
  path: RoadPath;
  style: CircuitStyle;
  /** The start/finish line, metres from the path's start (the beginning of the main straight). */
  startDistance: number;
  /** Length of the main straight the lap starts on. */
  mainStraight: number;
  /** Multiplier on the region's hill relief: the Ring climbs, the Park is nearly flat. */
  relief: number;
}

export const LAP_MIN = 1500;
export const LAP_MAX = 2800;
/** No corner on a circuit is tighter than this (radius, metres). */
export const MIN_RADIUS = 12;
/**
 * Two stretches more than `APART_ALONG` apart round the lap keep this far
 * apart in space: room for runoff and barriers both sides, and for each
 * stretch's flattened corridor to blend back to the hills before the other's
 * begins (see `TerrainField`), so the ground never steps between them.
 */
export const MIN_APART = 90;
const APART_ALONG = 200;
const MIN_MAIN_STRAIGHT = 180;
const STRAIGHT_STEP = 2;
const ARC_STEP = 1.5;
const ATTEMPTS = 14;

interface StyleDef {
  corners: readonly [number, number];
  /** Stretch of the polygon along its long axis. */
  stretch: number;
  jitter: number;
  /** Chance per vertex of a dent pulled toward the centre: the inward bends that give a lap its character. */
  dents: number;
  /** Arc radius for a 180° turn and for a slight kink. */
  tight: number;
  open: number;
  relief: number;
  /** Chance of a chicane on each of the longest straights, longest first. */
  chicanes: readonly number[];
}

const STYLES: Readonly<Record<CircuitStyle, StyleDef>> = {
  ring: {
    corners: [12, 15],
    stretch: 1.25,
    jitter: 0.3,
    dents: 0.35,
    tight: 16,
    open: 55,
    relief: 1.6,
    chicanes: [0.35],
  },
  sarthe: {
    corners: [7, 9],
    stretch: 2.3,
    jitter: 0.22,
    dents: 0.15,
    tight: 15,
    open: 130,
    relief: 0.8,
    chicanes: [1, 0.7],
  },
  park: {
    corners: [6, 8],
    stretch: 1.7,
    jitter: 0.2,
    dents: 0.18,
    tight: 16,
    open: 75,
    relief: 0.5,
    chicanes: [1, 0.85],
  },
};

const STYLE_WEIGHTS: readonly (readonly [CircuitStyle, number])[] = [
  ['ring', 1],
  ['sarthe', 1],
  ['park', 1],
];

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Left of travel at heading h: (cos h, -sin h); forward is (sin h, cos h). */
function left(h: number): [number, number] {
  return [Math.cos(h), -Math.sin(h)];
}

interface Polygon {
  xs: number[];
  zs: number[];
}

function starPolygon(rand: () => number, def: StyleDef, scale: number): Polygon {
  const k = def.corners[0] + Math.floor(rand() * (def.corners[1] - def.corners[0] + 1));
  const spin = rand() * Math.PI * 2;
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i < k; i++) {
    const a = ((i + (rand() - 0.5) * 0.55) / k) * Math.PI * 2;
    const dent = rand() < def.dents ? 0.58 : 1;
    const r = (1 + (rand() - 0.5) * 2 * def.jitter) * dent;
    const u = Math.cos(a) * r * def.stretch;
    const v = Math.sin(a) * r;
    xs.push((u * Math.cos(spin) - v * Math.sin(spin)) * scale);
    zs.push((u * Math.sin(spin) + v * Math.cos(spin)) * scale);
  }
  return { xs, zs };
}

interface Corner {
  /** Signed turn (heading change); positive turns left. */
  turn: number;
  radius: number;
}

/** Signed heading change at each vertex of a closed polygon. */
function polygonTurns(poly: Polygon): number[] {
  const n = poly.xs.length;
  const heading = (i: number) => {
    const j = (i + 1) % n;
    return Math.atan2(poly.xs[j]! - poly.xs[i]!, poly.zs[j]! - poly.zs[i]!);
  };
  return Array.from({ length: n }, (_, i) => wrapAngle(heading(i) - heading((i + n - 1) % n)));
}

/** Arc radius per vertex from the style: tight for hairpins, open for kinks, then the style's set pieces. */
function chooseCorners(rand: () => number, poly: Polygon, style: CircuitStyle): Corner[] {
  const def = STYLES[style];
  const n = poly.xs.length;
  const edge = (i: number) => {
    const j = (i + 1) % n;
    return Math.hypot(poly.xs[j]! - poly.xs[i]!, poly.zs[j]! - poly.zs[i]!);
  };
  const corners: Corner[] = [];
  const turns = polygonTurns(poly);
  for (let i = 0; i < n; i++) {
    const turn = turns[i]!;
    const sharp = Math.min(1, Math.abs(turn) / Math.PI);
    const radius = (def.open + (def.tight - def.open) * sharp) * (0.85 + rand() * 0.3);
    corners.push({ turn, radius });
  }
  const longest = [...Array(n).keys()].sort((a, b) => edge(b) - edge(a));
  if (style === 'sarthe') {
    // The slow hairpin at the end of the long straight.
    corners[(longest[0]! + 1) % n]!.radius = def.tight;
  } else if (style === 'park') {
    // The long sweeper onto the main straight.
    corners[longest[0]!]!.radius = 110 + rand() * 40;
  }
  return corners;
}

interface Built {
  points: number[];
  /** Index (in points/2) where each straight starts, with its length. */
  straights: { start: number; length: number }[];
}

/** Round each vertex into an arc and lay the straights between, with chicanes where the style puts them. */
function fillet(
  rand: () => number,
  poly: Polygon,
  corners: Corner[],
  style: CircuitStyle,
): Built | null {
  const n = poly.xs.length;
  const hIn: number[] = [];
  const tan: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = (i + n - 1) % n;
    hIn.push(Math.atan2(poly.xs[i]! - poly.xs[p]!, poly.zs[i]! - poly.zs[p]!));
  }
  const edgeLen = (i: number) => {
    const j = (i + 1) % n;
    return Math.hypot(poly.xs[j]! - poly.xs[i]!, poly.zs[j]! - poly.zs[i]!);
  };
  for (let i = 0; i < n; i++) {
    const c = corners[i]!;
    const half = Math.abs(c.turn) / 2;
    if (half > 1.45) return null;
    let t = c.radius * Math.tan(half);
    const room = 0.45 * Math.min(edgeLen((i + n - 1) % n), edgeLen(i));
    if (t > room) {
      t = room;
      c.radius = half > 1e-6 ? t / Math.tan(half) : c.radius;
    }
    if (c.radius < MIN_RADIUS + 2 && half > 0.05) return null;
    tan.push(t);
  }
  // Straight i runs from the arc out of vertex i to the arc into vertex i+1.
  const straightLen = (i: number) => edgeLen(i) - tan[i]! - tan[(i + 1) % n]!;
  const order = [...Array(n).keys()].sort((a, b) => straightLen(b) - straightLen(a));
  const chicaneOn = new Map<number, number>();
  STYLES[style].chicanes.forEach((chance, rank) => {
    const i = order[rank];
    if (i === undefined || straightLen(i) < 240 || rand() >= chance) return;
    chicaneOn.set(i, style === 'sarthe' && rank === 0 ? 2 : 1);
  });
  // The lap starts on the longest straight; its chicanes stay in its far half, clear of the grid.
  const main = order[0]!;

  const points: number[] = [];
  const straights: Built['straights'] = [];
  for (let i = 0; i < n; i++) {
    const c = corners[i]!;
    const h0 = hIn[i]!;
    const [lx, lz] = left(h0);
    const ax = poly.xs[i]! - Math.sin(h0) * tan[i]!;
    const az = poly.zs[i]! - Math.cos(h0) * tan[i]!;
    const s = Math.sign(c.turn) || 1;
    const cx = ax + s * c.radius * lx;
    const cz = az + s * c.radius * lz;
    const steps = Math.max(1, Math.ceil((Math.abs(c.turn) * c.radius) / ARC_STEP));
    for (let k = 0; k < steps; k++) {
      const h = h0 + (c.turn * k) / steps;
      const [hx, hz] = left(h);
      points.push(cx - s * c.radius * hx, cz - s * c.radius * hz);
    }
    // The straight out of this corner, toward the next vertex.
    const h1 = h0 + c.turn;
    const [bx, bz] = [cx - s * c.radius * left(h1)[0], cz - s * c.radius * left(h1)[1]];
    const len = straightLen(i);
    if (len < 0) return null;
    straights.push({ start: points.length / 2, length: len });
    const fx = Math.sin(h1);
    const fz = Math.cos(h1);
    const [nx, nz] = left(h1);
    const chicanes = chicaneOn.get(i) ?? 0;
    const span = 50 + rand() * 10;
    const at = Array.from({ length: chicanes }, (_, k) =>
      i === main
        ? len * (0.55 + (0.33 * (k + 1)) / (chicanes + 1))
        : (len * (k + 1)) / (chicanes + 1.4),
    );
    const side = rand() < 0.5 ? 1 : -1;
    const depth = 6 + rand() * 3;
    const steps2 = Math.max(1, Math.floor(len / STRAIGHT_STEP));
    for (let k = 0; k < steps2; k++) {
      const u = (len * k) / steps2;
      let off = 0;
      at.forEach((c0, m) => {
        const w = (u - (c0 - span / 2)) / span;
        if (w > 0 && w < 1)
          off += (m % 2 === 0 ? side : -side) * depth * Math.sin(Math.PI * w) ** 2;
      });
      points.push(bx + fx * u + nx * off, bz + fz * u + nz * off);
    }
  }
  return { points, straights };
}

function rotateTo(built: Built, start: number): number[] {
  const n = built.points.length / 2;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    out.push(built.points[i * 2]!, built.points[i * 2 + 1]!);
  }
  return out;
}

/** Tightest radius on the lap, from the heading change over ±3 samples. */
export function minRadius(path: RoadPath): number {
  let min = Infinity;
  const n = path.count - 1;
  for (let i = 0; i < n; i++) {
    const a = path.headings[(i - 3 + n) % n]!;
    const b = path.headings[(i + 3) % n]!;
    const turn = Math.abs(wrapAngle(b - a));
    if (turn > 1e-6) min = Math.min(min, (6 * path.spacing) / turn);
  }
  return min;
}

/** True when stretches more than 200 m apart round the lap never come within `MIN_APART` of each other. */
export function lapClearOfItself(path: RoadPath): boolean {
  const n = path.count - 1;
  const gap = Math.ceil(APART_ALONG / path.spacing);
  for (let i = 0; i < n; i += 2)
    for (let j = i + gap; j < n; j += 2) {
      if (n - (j - i) < gap) continue;
      if (Math.hypot(path.xs[i]! - path.xs[j]!, path.zs[i]! - path.zs[j]!) < MIN_APART)
        return false;
    }
  return true;
}

function attempt(rand: () => number, style: CircuitStyle, target: number): CircuitLayout | null {
  const def = STYLES[style];
  let scale = target / (2 * Math.PI * (1 + def.stretch) * 0.5);
  const polyRand = rand();
  const cornerRand = rand();
  const filletRand = rand();
  let layout: CircuitLayout | null = null;
  for (let pass = 0; pass < 3; pass++) {
    // The same polygon and draws each pass: only the scale changes, toward the target lap.
    const seeded = (s: number) => mulberry32(Math.floor(s * 0xffffffff) >>> 0);
    const poly = starPolygon(seeded(polyRand), def, scale);
    const corners = chooseCorners(seeded(cornerRand), poly, style);
    const built = fillet(seeded(filletRand), poly, corners, style);
    if (!built) return null;
    const main = built.straights.reduce((a, b) => (b.length > a.length ? b : a));
    const path = RoadPath.fromClosedPolyline(rotateTo(built, main.start), 2);
    if (Math.abs(path.length - target) > 60 && pass < 2) {
      scale *= target / path.length;
      continue;
    }
    if (main.length < MIN_MAIN_STRAIGHT) return null;
    layout = {
      path,
      style,
      startDistance: Math.round(Math.min(160, Math.max(70, main.length * 0.3))),
      mainStraight: main.length,
      relief: def.relief,
    };
  }
  if (!layout) return null;
  const { path } = layout;
  if (path.length < LAP_MIN || path.length > LAP_MAX) return null;
  if (minRadius(path) < MIN_RADIUS) return null;
  if (!lapClearOfItself(path)) return null;
  return layout;
}

/** A plain rounded rectangle with a chicane on its back straight: always valid, used if every attempt fails. */
export function fallbackCircuit(): CircuitLayout {
  const poly: Polygon = { xs: [-360, 360, 360, -360], zs: [-170, -170, 170, 170] };
  const corners: Corner[] = polygonTurns(poly).map((turn) => ({ turn, radius: 45 }));
  const constant = () => 0.99;
  const built = fillet(constant, poly, corners, 'park')!;
  const main = built.straights.reduce((a, b) => (b.length > a.length ? b : a));
  const path = RoadPath.fromClosedPolyline(rotateTo(built, main.start), 2);
  return {
    path,
    style: 'park',
    startDistance: Math.round(Math.min(160, Math.max(70, main.length * 0.3))),
    mainStraight: main.length,
    relief: STYLES.park.relief,
  };
}

/** A circuit from the stage's RNG stream: the style first, then attempts until one passes every check. */
export function generateCircuit(rand: () => number): CircuitLayout {
  const style = pickWeighted(rand, STYLE_WEIGHTS);
  const target = 1700 + rand() * 700;
  for (let i = 0; i < ATTEMPTS; i++) {
    const layout = attempt(rand, style, target);
    if (layout) return layout;
  }
  return fallbackCircuit();
}
