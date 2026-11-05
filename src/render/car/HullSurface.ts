/**
 * Height of a lofted hull's upper surface (`CarHull.ts`) at a point in plan,
 * and patches that lie on it. A patch is a fan of triangles over an ellipse
 * in (x, z) whose every vertex is lifted onto the surface, so a lamp cover or
 * a roundel follows a doubly curved fender instead of floating as a flat
 * disc. Pure TS, no three.js.
 */
import type { HullStation } from './CarHull';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** The shoulder crease of a station, as the loft draws it: as given, or the belt–roof midpoint. */
function shoulderOf(s: HullStation): { x: number; y: number } {
  return {
    x: s.xShoulder ?? ((s.xBelt ?? s.xBody) + s.xRoof) / 2,
    y: s.shoulder ?? (s.belt + s.roof) / 2,
  };
}

/** Upper profile of a station from the belt inward, as [x, y] points with x falling to 0. */
function upperProfile(s: HullStation, shoulders: boolean): [number, number][] {
  const xBelt = s.xBelt ?? s.xBody;
  const pts: [number, number][] = [[xBelt, s.belt]];
  if (shoulders) {
    const sh = shoulderOf(s);
    pts.push([sh.x, Math.max(sh.y, s.belt)]);
  }
  pts.push([s.xRoof, s.roof], [0, s.roof]);
  return pts;
}

/** Height of the upper surface at (x, z): the profile blended between the two stations around z. */
export function hullTopAt(input: readonly HullStation[], x: number, z: number): number {
  const stations = [...input].sort((a, b) => a.z - b.z);
  const shoulders = stations.some((u) => u.shoulder !== undefined);
  let i = 0;
  while (i < stations.length - 2 && stations[i + 1]!.z <= z) i++;
  const a = stations[i]!;
  const b = stations[i + 1]!;
  const t = b.z === a.z ? 0 : Math.min(1, Math.max(0, (z - a.z) / (b.z - a.z)));
  const pa = upperProfile(a, shoulders);
  const pb = upperProfile(b, shoulders);
  const pts = pa.map(([xa, ya], k): [number, number] => [
    lerp(xa, pb[k]![0], t),
    lerp(ya, pb[k]![1], t),
  ]);
  const ax = Math.abs(x);
  if (ax >= pts[0]![0]) return pts[0]![1];
  for (let k = 0; k < pts.length - 1; k++) {
    const [x0, y0] = pts[k]!;
    const [x1, y1] = pts[k + 1]!;
    if (ax <= x0 && ax >= x1)
      return x0 === x1 ? Math.max(y0, y1) : lerp(y1, y0, (ax - x1) / (x0 - x1));
  }
  return pts[pts.length - 1]![1];
}

export interface EllipseOnHull {
  cx: number;
  cz: number;
  /** Semi-axes across and along the car. */
  rx: number;
  rz: number;
  /** Height above the surface, enough to clear the loft's flat facets. */
  lift: number;
  rings?: number;
  segments?: number;
}

/** Non-indexed triangles of an ellipse lying on the hull's upper surface, wound to face up. */
export function ellipseOnHull(stations: readonly HullStation[], e: EllipseOnHull): Float32Array {
  const rings = e.rings ?? 5;
  const segments = e.segments ?? 28;
  const at = (r: number, k: number): [number, number, number] => {
    const a = (2 * Math.PI * k) / segments;
    const x = e.cx + e.rx * r * Math.cos(a);
    const z = e.cz + e.rz * r * Math.sin(a);
    return [x, hullTopAt(stations, x, z) + e.lift, z];
  };
  const out: number[] = [];
  const push = (...vs: [number, number, number][]) => {
    for (const v of vs) out.push(v[0], v[1], v[2]);
  };
  for (let ring = 0; ring < rings; ring++) {
    const r0 = ring / rings;
    const r1 = (ring + 1) / rings;
    for (let k = 0; k < segments; k++) {
      const a1 = at(r1, k);
      const b1 = at(r1, k + 1);
      if (ring === 0) {
        push(at(0, 0), b1, a1);
        continue;
      }
      const a0 = at(r0, k);
      const b0 = at(r0, k + 1);
      push(a0, b0, b1, a0, b1, a1);
    }
  }
  return new Float32Array(out);
}
