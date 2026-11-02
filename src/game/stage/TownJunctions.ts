import { FILLET, FRONT_SETBACK, JUNCTION_REACH, type Arm, type Junction } from './Town';
import { cornerRadius, tangentLength } from './TownPlan';

const TAU = Math.PI * 2;
/** Heading folded into [0, 2π). */
export const normHeading = (h: number): number => ((h % TAU) + TAU) % TAU;

/**
 * The open ground between two neighbouring arms of a junction: `a` on its
 * left side, `b` on its right, `angle` from one to the other. `p` is where
 * the two carriageway edges would meet, `k` where the facade lines do.
 */
export interface Wedge {
  a: Arm;
  b: Arm;
  angle: number;
  px: number;
  pz: number;
  kx: number;
  kz: number;
}

/** Arms in heading order, so each one and the next bound a wedge (the last wraps to the first). */
export function sortedArms(j: Junction): Arm[] {
  return [...j.arms].sort((p, q) => normHeading(p.heading) - normHeading(q.heading));
}

/** Where a's left offset line meets b's right offset line, each `off` beyond the arm's axis. */
export function offsetCorner(
  j: Junction,
  a: Arm,
  b: Arm,
  offA: number,
  offB: number,
): { x: number; z: number } {
  const fax = Math.sin(a.heading);
  const faz = Math.cos(a.heading);
  const fbx = Math.sin(b.heading);
  const fbz = Math.cos(b.heading);
  // Left of a heading h is (cos h, -sin h).
  const ox = Math.cos(a.heading) * offA;
  const oz = -Math.sin(a.heading) * offA;
  const qx = -Math.cos(b.heading) * offB;
  const qz = Math.sin(b.heading) * offB;
  // o + fa*t = q + fb*u
  const det = fax * -fbz - faz * -fbx;
  if (Math.abs(det) < 1e-9) return { x: j.x + ox, z: j.z + oz };
  const rx = qx - ox;
  const rz = qz - oz;
  const t = (rx * -fbz - rz * -fbx) / det;
  return { x: j.x + ox + fax * t, z: j.z + oz + faz * t };
}

export function wedges(j: Junction): Wedge[] {
  const arms = sortedArms(j);
  return arms.map((a, k) => {
    const b = arms[(k + 1) % arms.length]!;
    const angle = normHeading(normHeading(b.heading) - normHeading(a.heading)) || TAU;
    const p = offsetCorner(j, a, b, a.halfWidth, b.halfWidth);
    const f = offsetCorner(j, a, b, a.halfWidth + FRONT_SETBACK, b.halfWidth + FRONT_SETBACK);
    return { a, b, angle, px: p.x, pz: p.z, kx: f.x, kz: f.z };
  });
}

/** Distance of a point along an arm's axis from the junction. */
export function alongArm(j: Junction, arm: Arm, x: number, z: number): number {
  return (x - j.x) * Math.sin(arm.heading) + (z - j.z) * Math.cos(arm.heading);
}

/**
 * How far along a blocked arm the junction's own surface reaches: past the
 * farther of its two kerb returns, or the end of the deck zone, whichever
 * is longer. The arm's straight plates, pavements and lines start there.
 */
export function stubCut(j: Junction, arm: Arm, routeHalfWidth: number): number {
  let reach = routeHalfWidth + JUNCTION_REACH;
  for (const w of wedges(j)) {
    if ((w.a !== arm && w.b !== arm) || w.angle >= Math.PI) continue;
    const tangent = alongArm(j, arm, w.px, w.pz) + FILLET / Math.tan(w.angle / 2);
    reach = Math.max(reach, tangent + 1);
  }
  return reach;
}

/** At a corner the ribbon hands over to a straight-through apron's kerb this far beyond the arc's tangent. */
export const HANDOFF_BEYOND = 2;
/** The ribbon hands over this far past a kerb return's tangent on its edge. */
export const CUT_MARGIN = 1;

const forward = (h: number) => ({ x: Math.sin(h), z: Math.cos(h) });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The blocked arm that continues `route` straight through the junction, if any. */
export function throughArm(j: Junction, route: Arm): Arm | undefined {
  return j.arms.find(
    (c) => c.role === 'blocked' && Math.abs(wrap(c.heading - route.heading - Math.PI)) < 0.05,
  );
}

/** The route's turn at a corner junction, from its arriving to its leaving arm. */
export function junctionTurn(j: Junction): number {
  const inArm = j.arms.find((a) => a.role === 'in');
  const outArm = j.arms.find((a) => a.role === 'out');
  return inArm && outArm ? wrap(outArm.heading - (inArm.heading + Math.PI)) : 0;
}

/**
 * How far along `route`'s arm, from the junction, a straight-through apron's
 * kerb runs before the ribbon takes over: past the arc's tangent, or past the
 * kerb return between `stub`'s edge and the apron's edge when that lies
 * further out (acute wedges push it a long way down the arm).
 */
export function apronEnd(j: Junction, w: Wedge, route: Arm, stub: Arm, through: Arm): number {
  const tangent = tangentLength(junctionTurn(j));
  const c = offsetCorner(
    j,
    w.a,
    w.b,
    (w.a === route ? through.halfWidth : stub.halfWidth) + FILLET,
    (w.b === route ? through.halfWidth : stub.halfWidth) + FILLET,
  );
  const f = forward(route.heading);
  const tr = (c.x - j.x) * f.x + (c.z - j.z) * f.z;
  return Math.max(tangent + HANDOFF_BEYOND, tr + CUT_MARGIN);
}

/**
 * How far along the route, from where it passes the junction, the junction's
 * kerbs reach on either side: the farthest straight-through hand-off, or the
 * arc's tangent and a kerb return where no arm runs straight through.
 */
export function junctionReach(j: Junction): number {
  const turn = junctionTurn(j);
  const tangent = tangentLength(turn);
  // Path distance from the arc's midpoint to its tangent point.
  const halfArc = (cornerRadius(turn) * Math.abs(turn)) / 2;
  let reach = tangent + FILLET + CUT_MARGIN;
  for (const w of wedges(j)) {
    const aBlocked = w.a.role === 'blocked';
    const bBlocked = w.b.role === 'blocked';
    if (aBlocked === bBlocked) continue;
    const stub = aBlocked ? w.a : w.b;
    const route = aBlocked ? w.b : w.a;
    const through = throughArm(j, route);
    if (through) reach = Math.max(reach, apronEnd(j, w, route, stub, through));
  }
  return halfArc + (reach - tangent);
}
