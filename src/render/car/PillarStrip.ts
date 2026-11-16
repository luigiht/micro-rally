import type { HullStation, HullRounding } from './CarHull';

/**
 * A pillar laid along a lofted hull's roof edge where a screen meets the side
 * glass: a thin flat strip folded over that corner, `width` onto the screen
 * and `width` down the side glass, standing `thickness` off them, so it reads
 * as one even-width line flush with the body from the roof's front edge to
 * the cowl. Both sides, as a non-indexed triangle soup wound outward. Pure,
 * free of three.js.
 */

type V2 = [number, number];
type V3 = [number, number, number];

const norm2 = ([x, y]: V2): V2 => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

/** The corner's section at a station: the edge, the way across the screen and down the side. */
function section(s: HullStation, round: HullRounding) {
  const edge: V2 = [s.xRoof, s.roof];
  // The first facet across the top runs from the edge toward the centre line (`rounding.top`
  // facets), or to the point between the edge and a roof groove's outer lip (as `CarHull` lays it).
  const top = round.top ?? 1;
  const g = round.groove;
  const gx = g ? Math.min(g.x, s.xRoof * 0.8) : 0;
  const x1 = g ? (s.xRoof + gx + Math.min(g.width / 2, gx * 0.2)) / 2 : s.xRoof * (1 - 1 / top);
  const crown = s.crown ?? 0;
  const y1 = s.roof + crown * (1 - (x1 / s.xRoof) ** 2);
  const across = norm2([x1 - s.xRoof, y1 - s.roof]);
  // The first facet down the side runs to the first `rounding.upper` point (or the belt).
  const xBelt = s.xBelt ?? s.xBody;
  const upper = round.upper ?? 1;
  const t = 1 / upper;
  const full = round.fullness ?? 1;
  const th = (t * Math.PI) / 2;
  const lx = xBelt + (s.xRoof - xBelt) * t;
  const ly = s.belt + (s.roof - s.belt) * t;
  const ex = s.xRoof + (xBelt - s.xRoof) * Math.cos(th);
  const ey = s.belt + (s.roof - s.belt) * Math.sin(th);
  const down = norm2([lx + (ex - lx) * full - s.xRoof, ly + (ey - ly) * full - s.roof]);
  // Outward normals of the two faces in the section, and between them over the corner.
  const nTop: V2 = [across[1], -across[0]];
  const nSide: V2 = [-down[1], down[0]];
  const nEdge = norm2([nTop[0] + nSide[0], nTop[1] + nSide[1]]);
  return { edge, across, down, nTop, nSide, nEdge };
}

export function pillarStrip(
  stations: readonly HullStation[],
  round: HullRounding,
  width: number,
  thickness: number,
): Float32Array {
  const out: number[] = [];
  const rings = stations.map((s) => {
    const { edge, across, down, nTop, nSide, nEdge } = section(s, round);
    const at = (p: V2): V3 => [p[0], p[1], s.z];
    const o = (base: V2, n: V2, k = 1): V3 =>
      at([base[0] + n[0] * thickness * k, base[1] + n[1] * thickness * k]);
    const onTop: V2 = [edge[0] + across[0] * width, edge[1] + across[1] * width];
    const onSide: V2 = [edge[0] + down[0] * width, edge[1] + down[1] * width];
    return {
      // Outer face: over the screen, over the corner, down the side glass.
      outer: [o(onTop, nTop), o(edge, nEdge, 1.2), o(onSide, nSide)] as V3[],
      // Where it meets the glass on either side.
      inner: [at(onTop), at(onSide)] as V3[],
      n: { top: nTop, side: nSide, edge: nEdge, across, down },
    };
  });
  for (const side of [1, -1]) {
    const m = (p: V3): V3 => [p[0] * side, p[1], p[2]];
    const tri = (a: V3, b: V3, c: V3, ref: V3) => {
      [a, b, c] = [m(a), m(b), m(c)];
      const r: V3 = [ref[0] * side, ref[1], ref[2]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [
        u[1]! * v[2]! - u[2]! * v[1]!,
        u[2]! * v[0]! - u[0]! * v[2]!,
        u[0]! * v[1]! - u[1]! * v[0]!,
      ];
      if (n[0]! * r[0] + n[1]! * r[1] + n[2]! * r[2] < 0) [b, c] = [c, b];
      out.push(...a, ...b, ...c);
    };
    const quad = (a: V3, b: V3, c: V3, d: V3, ref: V3) => {
      tri(a, b, c, ref);
      tri(a, c, d, ref);
    };
    for (let i = 0; i + 1 < rings.length; i++) {
      const A = rings[i]!;
      const B = rings[i + 1]!;
      const n = A.n;
      const v3 = (p: V2): V3 => [p[0], p[1], 0];
      quad(A.outer[0]!, A.outer[1]!, B.outer[1]!, B.outer[0]!, v3(n.top));
      quad(A.outer[1]!, A.outer[2]!, B.outer[2]!, B.outer[1]!, v3(n.side));
      // Its edges: down onto the screen and onto the side glass.
      quad(A.inner[0]!, A.outer[0]!, B.outer[0]!, B.inner[0]!, v3(n.across));
      quad(A.inner[1]!, A.outer[2]!, B.outer[2]!, B.inner[1]!, v3(n.down));
    }
    // End caps.
    for (const [ring, dz] of [
      [rings[0]!, -1],
      [rings[rings.length - 1]!, 1],
    ] as const) {
      const [o0, o1, o2] = ring.outer as [V3, V3, V3];
      const [i0, i1] = ring.inner as [V3, V3];
      const ref: V3 = [0, 0, dz];
      tri(i0, o0, o1, ref);
      tri(i0, o1, i1, ref);
      tri(i1, o1, o2, ref);
    }
  }
  return new Float32Array(out);
}
