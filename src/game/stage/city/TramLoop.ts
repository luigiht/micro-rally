import { hashSeed, mulberry32 } from '../../rng';
import type { TramLine } from '../Tram';
import type { CityMap } from './CityMap';

/**
 * A city's tram circuit: a closed loop round a rectangle of blocks of its
 * map (one to three blocks across, two to four along), running on its
 * streets with its corners eased round `TRAM_RADIUS` arcs. It is chosen to
 * share at least one street with the route and to be crossed by it at a
 * crossroads the route drives straight through,
 * so the driver races alongside the trams and across their rails; never
 * through a roundabout or near the start.
 */

/** A closed loop as sampled points (the last joins back to the first), and its length. */
export interface TramLoopDef {
  xs: number[];
  zs: number[];
  length: number;
  /** The contact wire's span wires, out to the facades either side (set once the buildings stand). */
  spans?: TramSpan[];
}

/** A span wire across the street at (x, z) on the loop, `left` and `right` metres out from the axis to the facades. */
export interface TramSpan {
  x: number;
  z: number;
  heading: number;
  left: number;
  right: number;
}

/** Span wires every this far round the loop. */
const SPAN_EVERY = 25;

/**
 * The span wires that hold the contact wire up: every `SPAN_EVERY` metres
 * round the loop, wherever `reach` finds a facade on both sides (null on a
 * side with none, or at a junction).
 */
export function planSpans(
  loop: TramLoopDef,
  reach: (x: number, z: number, heading: number) => { left: number | null; right: number | null },
): TramSpan[] {
  const out: TramSpan[] = [];
  const p = { x: 0, z: 0, heading: 0 };
  for (let s = SPAN_EVERY / 2; s < loop.length; s += SPAN_EVERY) {
    loopAt(loop, s, p);
    const r = reach(p.x, p.z, p.heading);
    if (r.left !== null && r.right !== null)
      out.push({ x: p.x, z: p.z, heading: p.heading, left: r.left, right: r.right });
  }
  return out;
}

/** The loop's corners turn round this radius. */
export const TRAM_RADIUS = 18;
/** Samples: this far apart on the straights, this many degrees apart round the corners. */
const STRAIGHT_STEP = 4;
const ARC_STEP = (3 * Math.PI) / 180;
/** Loop length bounds, metres, and the length the choice leans toward. */
const MIN_LOOP = 800;
const MAX_LOOP = 2600;
const IDEAL_LOOP = 1500;

interface Pt {
  x: number;
  z: number;
}

/** The map's route crossroads and every crossroads one street from them (the streets the city lays). */
function corridor(map: CityMap): Set<number> {
  const out = new Set<number>();
  const across = (e: number, n: number) =>
    map.edges[e]!.a === n ? map.edges[e]!.b : map.edges[e]!.a;
  for (const n of map.route.slice(1)) {
    out.add(n);
    for (const e of map.adjacency[n]!) out.add(across(e, n));
  }
  out.delete(map.route[0]!);
  return out;
}

/** The perimeter of lattice rectangle [i0, i1] × [j0, j1], as node ids in order round it, or null if any street is missing. */
function perimeter(
  map: CityMap,
  at: (i: number, j: number) => number,
  i0: number,
  i1: number,
  j0: number,
  j1: number,
): number[] | null {
  const ring: [number, number][] = [];
  for (let i = i0; i < i1; i++) ring.push([i, j0]);
  for (let j = j0; j < j1; j++) ring.push([i1, j]);
  for (let i = i1; i > i0; i--) ring.push([i, j1]);
  for (let j = j1; j > j0; j--) ring.push([i0, j]);
  const ids = ring.map(([i, j]) => at(i, j));
  if (ids.some((id) => id < 0)) return null;
  for (let k = 0; k < ids.length; k++) {
    const a = ids[k]!;
    const b = ids[(k + 1) % ids.length]!;
    if (!map.adjacency[a]!.some((e) => map.edges[e]!.a === b || map.edges[e]!.b === b)) return null;
  }
  return ids;
}

/** Pick the city's tram loop (in the world frame), or null when no rectangle of its streets suits. */
export function chooseTramLoop(map: CityMap, seed: number): TramLoopDef | null {
  const rand = mulberry32(hashSeed(seed, 'tram-loop'));
  const index = new Map<string, number>();
  map.nodes.forEach((n, id) => index.set(`${n.i},${n.j}`, id));
  const at = (i: number, j: number) => index.get(`${i},${j}`) ?? -1;
  const laid = corridor(map);
  const rings = new Set(map.roundabouts.map((r) => r.node));
  const routeAt = new Map(map.route.map((n, k) => [n, k]));
  const routeEdge = (a: number, b: number) => {
    const ka = routeAt.get(a);
    const kb = routeAt.get(b);
    return ka !== undefined && kb !== undefined && Math.abs(ka - kb) === 1;
  };
  const lastSafe = map.route.length - 3;
  let best: { ids: number[]; score: number } | null = null;
  const is = map.nodes.map((n) => n.i);
  const js = map.nodes.map((n) => n.j);
  for (let i0 = Math.min(...is); i0 <= Math.max(...is); i0++)
    for (let j0 = 2; j0 <= Math.max(...js); j0++)
      for (let w = 1; w <= 3; w++)
        for (let h = 2; h <= 4; h++) {
          const ids = perimeter(map, at, i0, i0 + w, j0, j0 + h);
          if (!ids) continue;
          if (ids.some((id) => !laid.has(id) || rings.has(id))) continue;
          if (ids.some((id) => (routeAt.get(id) ?? 0) > lastSafe)) continue;
          let length = 0;
          let shared = 0;
          for (let k = 0; k < ids.length; k++) {
            const a = ids[k]!;
            const b = ids[(k + 1) % ids.length]!;
            length += Math.hypot(
              map.nodes[b]!.x - map.nodes[a]!.x,
              map.nodes[b]!.z - map.nodes[a]!.z,
            );
            if (routeEdge(a, b)) shared++;
          }
          if (length < MIN_LOOP || length > MAX_LOOP) continue;
          // Crossings: route crossroads on the loop the route drives straight through, neither
          // arriving nor leaving along the loop's streets; joins: where it turns onto or off them.
          const onLoop = new Set(ids);
          let crossings = 0;
          let joins = 0;
          for (const id of ids) {
            const k = routeAt.get(id);
            if (k === undefined) continue;
            const along = (n: number | undefined) => {
              if (n === undefined || !onLoop.has(n)) return false;
              const p = ids.indexOf(id);
              const q = ids.indexOf(n);
              return Math.abs(p - q) === 1 || Math.abs(p - q) === ids.length - 1;
            };
            const a = along(map.route[k - 1]);
            const b = along(map.route[k + 1]);
            if (!a && !b) crossings++;
            else if (a !== b) joins++;
          }
          // Best a loop the route both shares and crosses; then one it shares and joins; then one it crosses twice.
          const tier =
            shared >= 1 && crossings >= 1
              ? 0
              : shared >= 1 && joins >= 2
                ? 1
                : crossings >= 2
                  ? 2
                  : -1;
          if (tier < 0) continue;
          const score =
            tier * 10000 + Math.abs(length - IDEAL_LOOP) - 150 * Math.min(shared, 3) + rand() * 100;
          if (!best || score < best.score) best = { ids, score };
        }
  if (!best) return null;
  return loopShape(best.ids.map((id) => ({ x: map.nodes[id]!.x, z: map.nodes[id]!.z })));
}

/** The loop through `corners` (in order, closed), each corner eased round `TRAM_RADIUS`, sampled. */
export function loopShape(corners: readonly Pt[]): TramLoopDef {
  const n = corners.length;
  const xs: number[] = [];
  const zs: number[] = [];
  for (let k = 0; k < n; k++) {
    const p = corners[(k - 1 + n) % n]!;
    const c = corners[k]!;
    const q = corners[(k + 1) % n]!;
    const hin = Math.atan2(c.x - p.x, c.z - p.z);
    const hout = Math.atan2(q.x - c.x, q.z - c.z);
    const turn = Math.atan2(Math.sin(hout - hin), Math.cos(hout - hin));
    const lenIn = Math.hypot(c.x - p.x, c.z - p.z);
    const lenOut = Math.hypot(q.x - c.x, q.z - c.z);
    const r = Math.min(
      TRAM_RADIUS,
      (0.45 * Math.min(lenIn, lenOut)) / Math.max(1e-6, Math.tan(Math.abs(turn) / 2)),
    );
    const t = r * Math.tan(Math.abs(turn) / 2);
    // The arc from t before the corner to t after it.
    const a = { x: c.x - Math.sin(hin) * t, z: c.z - Math.cos(hin) * t };
    const side = Math.sign(turn) || 1;
    // Left of heading h is (cos h, −sin h).
    const cx = a.x + side * r * Math.cos(hin);
    const cz = a.z - side * r * Math.sin(hin);
    const steps = Math.max(1, Math.ceil(Math.abs(turn) / ARC_STEP));
    for (let s = 0; s <= steps; s++) {
      const h = hin + (turn * s) / steps;
      xs.push(cx - side * r * Math.cos(h));
      zs.push(cz + side * r * Math.sin(h));
    }
    // On along the straight to the next corner's arc.
    const nextTurn = (() => {
      const q2 = corners[(k + 2) % n]!;
      const h2 = Math.atan2(q2.x - q.x, q2.z - q.z);
      return Math.atan2(Math.sin(h2 - hout), Math.cos(h2 - hout));
    })();
    const lenNext = Math.hypot(corners[(k + 2) % n]!.x - q.x, corners[(k + 2) % n]!.z - q.z);
    const rNext = Math.min(
      TRAM_RADIUS,
      (0.45 * Math.min(lenOut, lenNext)) / Math.max(1e-6, Math.tan(Math.abs(nextTurn) / 2)),
    );
    const tNext = rNext * Math.tan(Math.abs(nextTurn) / 2);
    const sx = xs[xs.length - 1]!;
    const sz = zs[zs.length - 1]!;
    const ex = q.x - Math.sin(hout) * tNext;
    const ez = q.z - Math.cos(hout) * tNext;
    const run = Math.hypot(ex - sx, ez - sz);
    const m = Math.max(1, Math.floor(run / STRAIGHT_STEP));
    for (let s = 1; s < m; s++) {
      xs.push(sx + ((ex - sx) * s) / m);
      zs.push(sz + ((ez - sz) * s) / m);
    }
  }
  let length = 0;
  for (let k = 0; k < xs.length; k++) {
    const j = (k + 1) % xs.length;
    length += Math.hypot(xs[j]! - xs[k]!, zs[j]! - zs[k]!);
  }
  return { xs, zs, length };
}

/** The loop as straight rail segments, sample to sample, for the wheels and everything that keeps clear of rails. */
export function loopLines(loop: TramLoopDef): TramLine[] {
  const out: TramLine[] = [];
  for (let k = 0; k < loop.xs.length; k++) {
    const j = (k + 1) % loop.xs.length;
    out.push({ x0: loop.xs[k]!, z0: loop.zs[k]!, x1: loop.xs[j]!, z1: loop.zs[j]!, loop: true });
  }
  return out;
}

/** The point and heading `s` metres round the loop (any s; it wraps). */
export function loopAt(
  loop: TramLoopDef,
  s: number,
  out: { x: number; z: number; heading: number },
): void {
  let d = ((s % loop.length) + loop.length) % loop.length;
  const n = loop.xs.length;
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    const dx = loop.xs[j]! - loop.xs[k]!;
    const dz = loop.zs[j]! - loop.zs[k]!;
    const len = Math.hypot(dx, dz);
    if (d <= len || k === n - 1) {
      const t = len > 0 ? Math.min(1, d / len) : 0;
      out.x = loop.xs[k]! + dx * t;
      out.z = loop.zs[k]! + dz * t;
      out.heading = Math.atan2(dx, dz);
      return;
    }
    d -= len;
  }
}
