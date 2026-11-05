import { ROAD_SPACING } from './Centreline';
import type { CoastShape } from './CoastShape';
import { RoadPath } from './RoadPath';

/**
 * The coast road, drawn on the `CoastShape`'s ground: it follows the shore
 * a shelf back from the cliff top, and once or twice a stage turns inland and
 * climbs the hillside in a stack of two hairpins (toward the land, then away,
 * so the road keeps its direction: left then right with the sea on the right,
 * the mirror image with it on the left) before a long diagonal back down.
 * The legs are contour lines of the hillside (the shore road shifted inland
 * across the stage axis), so they never cusp however the shore bends; each
 * hairpin is a circular arc that leaves tangent to the leg below and lands
 * tangent to the contour above, its sweep and radius fitted to where that
 * contour runs, so the road turns without a kink at either end. Every leg stays
 * under the road bed's 12 % grade limit: the climb between stacked legs is
 * their spacing times the hill's slope, spread over a hairpin and a leg.
 */

const STEP = 4;
/** Road distance before the first stack, and between stacks. */
const FIRST_AT_MIN = 320;
const FIRST_AT_SPAN = 300;
const BETWEEN = 450;
/** A second stack only on a road long enough to carry it. */
const TWO_STACKS_FROM = 2200;
const LEG_MIN = 140;
const LEG_SPAN = 40;
/** Contour spacing of the stacked legs; the hairpins' radii follow from where the contours lie. */
const RADIUS_MIN = 22;
const RADIUS_SPAN = 4;
/** On the hardest difficulty loop the stacks' hairpins tighten by up to this much. */
const RADIUS_HARD = 4;
/** A hairpin never turns tighter than this, whatever the contours do. */
const MIN_TURN = 12;
/** Along the top before the way down. */
const TOP_LEG = 50;
/** The way down holds this grade, under the limiter's 12 %. */
const DESCENT_GRADE = 0.1;
/** Light smoothing of the finished polyline: rounds the small corners left where a hairpin meets its leg. */
const SMOOTH_PASSES = 2;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export interface Switchback {
  /** Road distances where the stack begins (the foot of the first leg) and where the descent rejoins the shelf. */
  from: number;
  to: number;
}

export interface CoastRoad {
  path: RoadPath;
  switchbacks: Switchback[];
}

interface Frame {
  /** Unit tangent of travel. */
  tx: number;
  tz: number;
  /** Unit normal pointing inland. */
  nx: number;
  nz: number;
}

export function buildCoastRoad(rand: () => number, total: number, shape: CoastShape): CoastRoad {
  const pts: number[] = [];
  let length = 0;
  let lastX = NaN;
  let lastZ = NaN;
  const push = (x: number, z: number) => {
    if (!Number.isNaN(lastX)) length += Math.hypot(x - lastX, z - lastZ);
    lastX = x;
    lastZ = z;
    pts.push(x, z);
  };
  /** The shore road and its inland contours, `lift` metres across the axis from it, in world space. */
  const contour = (u: number, lift: number): [number, number] =>
    shape.toWorld(u, shape.shore(u) + shape.roadInland(u) + lift);
  /** Travel frame along a contour at `u`, heading +u (`dir` 1) or back (−1); the normal always points inland, on whichever hand the land lies. */
  const frame = (u: number, lift: number, dir: 1 | -1): Frame => {
    const [ax, az] = contour(u - 2, lift);
    const [bx, bz] = contour(u + 2, lift);
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const tx = (dir * (bx - ax)) / len;
    const tz = (dir * (bz - az)) / len;
    // Left of travel is (tz, −tx); inland is the left of the +u direction, or its right on a mirrored stage.
    const k = dir * shape.side;
    return { tx, tz, nx: k * tz, nz: -k * tx };
  };
  /**
   * The turn from (x, z), heading along `f`, onto the contour `lift` inland, to be travelled in
   * direction `dir` from the landing: a circular arc that leaves tangent to `f` and arrives
   * tangent to the contour, so neither end kinks. For a landing at `u` the arc's sweep is the
   * heading change to the contour's heading there and its radius follows from the distance out;
   * the landing is the `u` at which the arc's run along the tangent also matches, found as the
   * root of that mismatch with the radius eliminated.
   */
  const fitTurn = (x: number, z: number, f: Frame, lift: number, dir: 1 | -1, guess: number) => {
    const at = (u: number) => {
      const fc = frame(u, lift, dir);
      let alpha = Math.atan2(fc.tx * f.nx + fc.tz * f.nz, fc.tx * f.tx + fc.tz * f.tz);
      if (alpha <= 0) alpha += 2 * Math.PI;
      const [cx, cz] = contour(u, lift);
      const dn = (cx - x) * f.nx + (cz - z) * f.nz;
      const dt = (cx - x) * f.tx + (cz - z) * f.tz;
      return { alpha, dn, dt, g: dn * Math.sin(alpha) - dt * (1 - Math.cos(alpha)) };
    };
    // Bracket a sign change of the mismatch around the guess, then bisect it.
    let lo = guess - 60;
    let hi = guess + 60;
    let bestU = guess;
    let bestAbs = Infinity;
    let prevU = lo;
    let prevG = at(lo).g;
    let bracketed = false;
    for (let u = lo + 1; u <= hi; u += 1) {
      const g = at(u).g;
      if (Math.abs(g) < bestAbs) {
        bestAbs = Math.abs(g);
        bestU = u;
      }
      if (!bracketed && Math.sign(g) !== Math.sign(prevG) && Math.abs(u - guess) < 50) {
        lo = prevU;
        hi = u;
        bracketed = true;
      }
      prevU = u;
      prevG = g;
    }
    let uE = bestU;
    if (bracketed) {
      let gLo = at(lo).g;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const gMid = at(mid).g;
        if (Math.sign(gMid) === Math.sign(gLo)) {
          lo = mid;
          gLo = gMid;
        } else hi = mid;
      }
      uE = (lo + hi) / 2;
    }
    const fin = at(uE);
    return { uE, rho: Math.max(MIN_TURN, fin.dn / (1 - Math.cos(fin.alpha))), alpha: fin.alpha };
  };
  /** An arc from (x, z) heading along `f`, turning inland by `alpha` on radius `rho`. */
  const turn = (x: number, z: number, f: Frame, rho: number, alpha: number): void => {
    const steps = Math.max(2, Math.ceil((rho * alpha) / STEP));
    for (let k = 1; k <= steps; k++) {
      const th = (alpha * k) / steps;
      const sn = Math.sin(th);
      const c = 1 - Math.cos(th);
      push(x + f.tx * rho * sn + f.nx * rho * c, z + f.tz * rho * sn + f.nz * rho * c);
    }
  };

  const switchbacks: Switchback[] = [];
  let u = 0;
  push(...contour(u, 0));
  let nextAt = FIRST_AT_MIN + rand() * FIRST_AT_SPAN;
  const stacks = total >= TWO_STACKS_FROM ? 2 : 1;

  /** Sine of the angle between the contour's run at `u` and the stage axis. */
  const skew = (u: number, lift: number) => {
    const f = frame(u, lift, 1);
    return Math.abs(f.tx * Math.cos(shape.theta) - f.tz * Math.sin(shape.theta));
  };

  const stack = () => {
    const from = length;
    const leg = LEG_MIN + rand() * LEG_SPAN;
    const r = RADIUS_MIN - RADIUS_HARD * shape.difficulty + rand() * RADIUS_SPAN;
    // Leg 1 along the shelf.
    const uA = u;
    for (let d = STEP; d <= leg; d += STEP) push(...contour(uA + d, 0));
    const uT = uA + leg;
    // Hairpin 1 off the shelf onto the contour two radii inland, then leg 2 back along it.
    const lift2 = 2 * r;
    const f1 = frame(uT, 0, 1);
    const t1 = fitTurn(lastX, lastZ, f1, lift2, -1, uT);
    turn(lastX, lastZ, f1, t1.rho, t1.alpha);
    // Leg 2's length is chosen so that hairpin 2 starts where the contour runs nearest the axis.
    let leg2 = leg - 20;
    for (let cand = leg - 40; cand <= leg; cand += 5)
      if (skew(t1.uE - cand, lift2) < skew(t1.uE - leg2, lift2)) leg2 = cand;
    for (let d = STEP; d <= leg2; d += STEP) push(...contour(t1.uE - d, lift2));
    const uE = t1.uE - leg2;
    // Hairpin 2 onto the contour two radii further inland, travelled forward again.
    const lift4 = 4 * r;
    const f2 = frame(uE, lift2, -1);
    const t2 = fitTurn(lastX, lastZ, f2, lift4, 1, uE);
    turn(lastX, lastZ, f2, t2.rho, t2.alpha);
    const land2 = { u: t2.uE };
    // Along the top, then the long way down to the shelf.
    const descent = (lift4 * shape.hillSlope(land2.u)) / DESCENT_GRADE;
    for (let d = STEP; d <= TOP_LEG + descent; d += STEP) {
      const f = d <= TOP_LEG ? 0 : smoothstep(0, 1, (d - TOP_LEG) / descent);
      push(...contour(land2.u + d, lift4 * (1 - f)));
    }
    u = land2.u + TOP_LEG + descent;
    switchbacks.push({ from, to: length });
  };

  while (length < total + 2 * STEP) {
    // A stack starts where the shelf runs within 25° of the axis, so the contours above lie a full two
    // radii out; if no such stretch turns up within 400 m, 40° will do.
    const limit = length > nextAt + 400 ? Math.sin(Math.PI / 4.5) : Math.sin(Math.PI / 7.2);
    if (switchbacks.length < stacks && length >= nextAt && skew(u, 0) < limit) {
      stack();
      nextAt = length + BETWEEN;
      continue;
    }
    u += STEP;
    push(...contour(u, 0));
  }
  // Round off the corners a hairpin's landing can leave: a quarter-half-quarter blend of neighbours, twice.
  for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
    const prev = pts.slice();
    for (let i = 2; i + 2 < pts.length; i += 2) {
      pts[i] = 0.25 * prev[i - 2]! + 0.5 * prev[i]! + 0.25 * prev[i + 2]!;
      pts[i + 1] = 0.25 * prev[i - 1]! + 0.5 * prev[i + 1]! + 0.25 * prev[i + 3]!;
    }
  }
  return { path: RoadPath.fromPolyline(pts, ROAD_SPACING), switchbacks };
}
