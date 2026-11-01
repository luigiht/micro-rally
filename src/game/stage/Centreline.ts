import { RoadPath } from './RoadPath';
import type { TownTrace } from './TownGenerator';
import { cornerRadius, tangentLength, type TownPlan } from './TownPlan';

export const ROAD_SPACING = 2;
export const CONTROL_STEP = 20;
export const START_DISTANCE = 30;
export const RUNOUT = 140;
export const MAX_DEVIATION = 1.25;
/** Before a town the walk steers back onto the stage axis over `STEER_IN`, then runs dead straight for `TOWN_APPROACH`. */
const TOWN_APPROACH = 60;
const STEER_IN = 100;
const STEER_RATE = 0.3;
/** Corner arcs are laid as chords no longer than this. */
const CHORD = 5;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Centripetal Catmull-Rom (Barry–Goldman form) through p1..p2 for control
 * points at uneven spacing: the knot steps follow the square roots of the
 * chord lengths, so the curve neither kinks nor loops where short arc chords
 * meet long straight steps. With even spacing it is the uniform spline.
 */
function centripetal(
  xs: readonly [number, number, number, number],
  zs: readonly [number, number, number, number],
  s: number,
  out: [number, number],
): void {
  const knot = (i: number) =>
    Math.max(1e-6, Math.sqrt(Math.hypot(xs[i + 1]! - xs[i]!, zs[i + 1]! - zs[i]!)));
  const t1 = knot(0);
  const t2 = t1 + knot(1);
  const t3 = t2 + knot(2);
  const t = t1 + (t2 - t1) * s;
  const mix = (a: number, b: number, ta: number, tb: number) =>
    ((tb - t) * a + (t - ta) * b) / (tb - ta);
  for (const [k, p] of [xs, zs].entries()) {
    const a1 = mix(p[0], p[1], 0, t1);
    const a2 = mix(p[1], p[2], t1, t2);
    const a3 = mix(p[2], p[3], t2, t3);
    const b1 = mix(a1, a2, 0, t2);
    const b2 = mix(a2, a3, t1, t3);
    out[k as 0 | 1] = mix(b1, b2, t1, t2);
  }
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export interface Centreline {
  path: RoadPath;
  trace: TownTrace | null;
}

/**
 * Heading random walk on a 20 m control polygon, smoothed with Catmull-Rom.
 * With a town plan the walk steers back onto the stage axis, runs straight
 * into the town, lays its legs (straights on the polygon, every corner as an
 * explicit arc so the spline never kinks, curves as short chords) and resumes
 * on the heading the town hands back; `trace` records what was laid. `mirror`
 * flips every turn, for a second attempt when the first fouls the open road.
 */
export function buildCentreline(
  rand: () => number,
  total: number,
  twist: number,
  plan: TownPlan | null,
  mirror = false,
): Centreline {
  const theta0 = rand() * Math.PI * 2;
  let heading = theta0;
  let curv = 0;
  let bendCurv = 0;
  let bendLeft = 0;
  let bendSign = rand() < 0.5 ? -1 : 1;
  let x = 0;
  let z = 0;
  let trace: TownTrace | null = null;
  const ctrl: number[] = [
    x - Math.sin(heading) * CONTROL_STEP,
    z - Math.cos(heading) * CONTROL_STEP,
    x,
    z,
  ];
  const sign = mirror ? -1 : 1;
  for (let d = 0; d < total + CONTROL_STEP * 3; d += CONTROL_STEP) {
    if (plan && d === plan.entryAt) {
      trace = { entry: { x, z, heading }, legs: [], exit: { x, z } };
      let h = heading;
      let emitted = 0;
      let carry = 0; // exit tangent of the previous corner, already laid
      const push = (nx: number, nz: number) => {
        x = nx;
        z = nz;
        ctrl.push(x, z);
      };
      const arc = (radius: number, sweep: number, points: { x: number; z: number }[]) => {
        const steps = Math.max(5, Math.ceil((radius * Math.abs(sweep)) / CHORD));
        const dA = sweep / steps;
        const chord = 2 * radius * Math.sin(Math.abs(dA) / 2);
        for (let k = 0; k < steps; k++) {
          push(x + Math.sin(h + dA / 2) * chord, z + Math.cos(h + dA / 2) * chord);
          h += dA;
          points.push({ x, z });
        }
        emitted += radius * Math.abs(sweep);
      };
      for (const leg of plan.legs) {
        const headingIn = h;
        if (leg.kind === 'curve') {
          const points = [{ x, z }];
          arc(leg.radius, leg.sweep * sign, points);
          trace.legs.push({
            kind: 'curve',
            points,
            headingIn,
            headingOut: h,
            turn: 0,
            halfWidth: leg.halfWidth,
            radius: leg.radius,
            sweep: leg.sweep * sign,
            length: leg.length,
          });
          carry = 0;
          continue;
        }
        const turn = leg.turn * sign;
        const out = turn !== 0 ? tangentLength(turn) : 0;
        const portion = leg.length - carry - out;
        const steps = Math.max(1, Math.round(portion / CONTROL_STEP));
        const points = [{ x, z }];
        for (let k = 0; k < steps; k++)
          push(x + (Math.sin(h) * portion) / steps, z + (Math.cos(h) * portion) / steps);
        points.push({ x, z });
        emitted += portion;
        trace.legs.push({
          kind: 'straight',
          points,
          headingIn,
          headingOut: h,
          turn,
          halfWidth: leg.halfWidth,
          radius: 0,
          sweep: 0,
          length: portion,
        });
        carry = 0;
        if (turn !== 0) {
          // The polygon corner lies `out` beyond the straight; the arc cuts it and lands `out` past it on the new heading.
          const corner = { x: x + Math.sin(h) * out, z: z + Math.cos(h) * out };
          const radius = cornerRadius(turn);
          const cpoints = [{ x, z }];
          arc(radius, turn, cpoints);
          trace.legs.push({
            kind: 'corner',
            points: cpoints,
            headingIn,
            headingOut: h,
            turn,
            halfWidth: leg.halfWidth,
            radius,
            sweep: turn,
            length: radius * Math.abs(turn),
            corner,
          });
          carry = out;
        }
      }
      trace.exit = { x, z };
      heading = h;
      d += Math.round(emitted / CONTROL_STEP) * CONTROL_STEP - CONTROL_STEP;
      curv = 0;
      bendCurv = 0;
      bendLeft = 1;
      continue;
    }
    const steering =
      plan !== null &&
      d >= plan.entryAt - TOWN_APPROACH - STEER_IN &&
      d < plan.entryAt - TOWN_APPROACH;
    const approaching = plan !== null && d >= plan.entryAt - TOWN_APPROACH && d < plan.entryAt;
    if (steering) {
      // Back onto the stage axis so the town's legs never run toward earlier road.
      const back = wrap(theta0 - heading);
      heading += Math.max(-STEER_RATE, Math.min(STEER_RATE, back));
      curv = 0;
      bendCurv = 0;
      bendLeft = 1;
    } else if (approaching) {
      bendCurv = 0;
      curv = 0;
      bendLeft = 1;
    } else if (d > START_DISTANCE + CONTROL_STEP) {
      if (bendLeft <= 0) {
        if (rand() < 0.2) {
          bendCurv = 0;
          bendLeft = 1 + Math.floor(rand() * 2);
        } else {
          // Mostly alternate direction so bends chain into S-curves.
          if (rand() < 0.7) bendSign = -bendSign;
          bendCurv = bendSign * (0.18 + Math.pow(rand(), 0.7) * 0.55) * (0.5 + twist * 0.6);
          bendLeft = 1 + Math.floor(rand() * 3);
        }
      }
      bendLeft--;
      curv += (bendCurv - curv) * 0.85;
      heading += curv;
      const dev = heading - theta0;
      if (Math.abs(dev) > MAX_DEVIATION) {
        heading = theta0 + Math.sign(dev) * MAX_DEVIATION;
        curv = 0;
        bendSign = -Math.sign(dev);
        bendLeft = 0;
      }
    }
    x += Math.sin(heading) * CONTROL_STEP;
    z += Math.cos(heading) * CONTROL_STEP;
    ctrl.push(x, z);
  }

  const dense: number[] = [];
  const n = ctrl.length / 2;
  const pt: [number, number] = [0, 0];
  for (let i = 1; i < n - 2; i++) {
    const xs = [ctrl[(i - 1) * 2]!, ctrl[i * 2]!, ctrl[(i + 1) * 2]!, ctrl[(i + 2) * 2]!] as const;
    const zs = [
      ctrl[(i - 1) * 2 + 1]!,
      ctrl[i * 2 + 1]!,
      ctrl[(i + 1) * 2 + 1]!,
      ctrl[(i + 2) * 2 + 1]!,
    ] as const;
    // The open-road walk steps evenly, where the uniform spline is exact and cheap; town
    // legs mix short arc chords with long steps and take the centripetal form.
    const even = [0, 1, 2].every(
      (k) => Math.abs(Math.hypot(xs[k + 1]! - xs[k]!, zs[k + 1]! - zs[k]!) - CONTROL_STEP) < 1e-6,
    );
    for (let s = 0; s < 12; s++) {
      const t = s / 12;
      if (even) {
        dense.push(
          catmullRom(xs[0], xs[1], xs[2], xs[3], t),
          catmullRom(zs[0], zs[1], zs[2], zs[3], t),
        );
      } else {
        centripetal(xs, zs, t, pt);
        dense.push(pt[0], pt[1]);
      }
    }
  }
  return { path: RoadPath.fromPolyline(dense, ROAD_SPACING), trace };
}

/** True when no two samples 200 m apart along the road come within 52 m of each other in the window [a, b] along it. */
export function selfApproachOk(path: RoadPath, a: number, b: number): boolean {
  const i0 = Math.max(0, Math.floor(a / path.spacing));
  const i1 = Math.min(path.count - 1, Math.ceil(b / path.spacing));
  for (let i = i0; i <= i1; i += 2)
    for (let j = i + 100; j <= i1; j += 2)
      if (Math.hypot(path.xs[i]! - path.xs[j]!, path.zs[i]! - path.zs[j]!) <= 52) return false;
  return true;
}
