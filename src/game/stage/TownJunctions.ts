import { FILLET, FRONT_SETBACK, JUNCTION_REACH, type Arm, type Junction } from './Town';

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
function offsetCorner(
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
