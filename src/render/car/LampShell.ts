import type { HullMesh } from './CarHull';
import { clipPlanes, solidCuts, type LiverySolid } from './HullLivery';

/**
 * A lamp with some volume: the patch of a hull's surface inside a livery
 * solid (`LiverySolid`, the region inside its side, front and top outlines),
 * lifted `depth` off the surface along its normals smoothed across the faces
 * (so neighbouring pieces lift together into one body), with walls down
 * to the surface along the patch's rim. So a lens wrapping a corner stands
 * proud of the body as one raised shape. Pure, free of three.js: a flat
 * triangle soup, xyz per vertex.
 */

type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** A rim point lies on one of the solid's planes. */
const ON = 1e-5;

/** Rim points closer than this are one point (a key for sharing their lift). */
const WELD = 1e4;
const key = (q: V3) =>
  `${Math.round(q[0] * WELD)},${Math.round(q[1] * WELD)},${Math.round(q[2] * WELD)}`;

export function lampShell(hull: HullMesh, solid: LiverySolid, depth: number): Float32Array {
  const out: number[] = [];
  const tri = (a: V3, b: V3, c: V3) => out.push(...a, ...b, ...c);
  const { positions: p } = hull;
  const end = hull.liveryStart ?? hull.glowStart;
  for (const cut of solidCuts(solid)) {
    const [lo, hi] = cut.box;
    // First every face's patch inside the solid, each point's lift the faces meeting there
    // averaged, so neighbouring patches lift together and the lamp stays one body.
    const patches: V3[][] = [];
    const normals = new Map<string, V3>();
    for (let i = 0; i + 8 < end * 3; i += 9) {
      const a: V3 = [p[i]!, p[i + 1]!, p[i + 2]!];
      const b: V3 = [p[i + 3]!, p[i + 4]!, p[i + 5]!];
      const c: V3 = [p[i + 6]!, p[i + 7]!, p[i + 8]!];
      let away = false;
      for (let k = 0; k < 3 && !away; k++)
        away =
          Math.max(a[k]!, b[k]!, c[k]!) < lo[k]! - 1e-6 ||
          Math.min(a[k]!, b[k]!, c[k]!) > hi[k]! + 1e-6;
      if (away) continue;
      const n = cross(sub(b, a), sub(c, a));
      const len = Math.hypot(...n);
      if (len < 1e-9) continue;
      const poly = clipPlanes([a, b, c], cut.planes);
      if (poly.length < 3) continue;
      patches.push(poly);
      for (const q of poly) {
        const m = normals.get(key(q)) ?? [0, 0, 0];
        normals.set(key(q), [m[0] + n[0] / len, m[1] + n[1] / len, m[2] + n[2] / len]);
      }
    }
    const lift = (q: V3): V3 => {
      const m = normals.get(key(q))!;
      const l = Math.hypot(...m) || 1;
      return [q[0] + (m[0] / l) * depth, q[1] + (m[1] / l) * depth, q[2] + (m[2] / l) * depth];
    };
    for (const poly of patches) {
      const up = poly.map(lift);
      // The lens: the lifted patch, wound as the face it lies on.
      for (let k = 1; k + 1 < up.length; k++) tri(up[0]!, up[k]!, up[k + 1]!);
      // The walls: along every rim edge, the stretch where both ends lie on the same plane of the solid.
      for (let k = 0; k < poly.length; k++) {
        const j = (k + 1) % poly.length;
        const rim = cut.planes.some(
          (f) => Math.abs(f(poly[k]!)) < ON && Math.abs(f(poly[j]!)) < ON,
        );
        if (!rim) continue;
        tri(poly[k]!, poly[j]!, up[j]!);
        tri(poly[k]!, up[j]!, up[k]!);
      }
    }
  }
  return Float32Array.from(out);
}
