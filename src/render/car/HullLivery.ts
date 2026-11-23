/**
 * A livery of flat shapes painted onto a lofted hull (`CarHull`). The
 * livery is given as coloured triangles in three views of the car: its
 * left and right flanks (along the car and up) and its top (along the car
 * and across). Every face of the hull painted in the body colour is
 * projected into the view it faces most; each livery triangle overlapping
 * it is clipped to it, and the pieces are laid back onto the face a few
 * millimetres proud, in the livery's colour. They stand off along the hull's
 * normals smoothed across its corners (the face's corners' normals blended
 * over it), so where two faces meet at an angle their pieces still meet
 * edge to edge instead of opening a sliver of white. So the livery's edges are
 * exact lines on the hull at any distance, and it follows the hull's every
 * bend. Faces in any other colour (trim, glass, the wheel wells, decals,
 * lamp lenses) are left as they are, and so are the nose and tail panels
 * unless the livery has `front` and `back` views. Pure,
 * unit-testable, free of three.js.
 */
import type { HullMesh } from './CarHull';

/** Which car axis a view's axis runs along (0 x, 1 y, 2 z), and the range it spans. */
export type ViewAxis = readonly [axis: 0 | 1 | 2, from: number, to: number];

export interface LiveryView {
  u: ViewAxis;
  v: ViewAxis;
  /** Each colour's triangles, flat [u0, v0, u1, v1, u2, v2, ...] in metres along the view's axes. */
  paint: readonly { color: string; tris: readonly number[] }[];
}

export interface LiveryShapes {
  left: LiveryView;
  right: LiveryView;
  top: LiveryView;
  /** The nose and tail panels (across the car and up); optional. */
  front?: LiveryView;
  back?: LiveryView;
  /**
   * Details over the livery (lamps, panel gaps, vents, roundels): painted the same way one layer
   * further off the hull, so they may overlap the shapes under them without fighting them.
   */
  over?: Omit<LiveryShapes, 'over'>;
  /**
   * Solid details (lamp lenses) painted on the details layer onto every body face they pass
   * through, whichever view the face belongs to: the region inside all three outlines at once,
   * so a lens wrapping a corner stays one shape across the faces.
   */
  solids?: readonly LiverySolid[];
}

type Outline = readonly (readonly [number, number])[];

/** A region of the car: inside its side (z, y), front (x, y) and top (z, x) outlines, all convex. */
export interface LiverySolid {
  color: string;
  side: Outline;
  front: Outline;
  top: Outline;
  /** Also the same region mirrored to the other side (x → −x). */
  mirror?: boolean;
  /**
   * Stacking: solids lie a layer off the hull (the details layer); each `layer` up stands one more
   * `PROUD` out, so a solid over another (a lens on its dark recess) never fights it. Default 0.
   */
  layer?: number;
}

/** A solid as half-spaces: each `f(p) ≥ 0` inside, linear in p, plus its bounds. */
export interface SolidCut {
  rgb: V3;
  /** How far off the hull it lies, metres. */
  lift: number;
  planes: ((q: V3) => number)[];
  box: [V3, V3];
}

export function solidCuts(solid: LiverySolid): SolidCut[] {
  const out: SolidCut[] = [];
  for (const sx of solid.mirror ? [1, -1] : [1]) {
    const planes: ((q: V3) => number)[] = [];
    const lo: V3 = [Infinity, Infinity, Infinity];
    const hi: V3 = [-Infinity, -Infinity, -Infinity];
    const views: [Outline, 0 | 1 | 2, 0 | 1 | 2][] = [
      [solid.side, 2, 1],
      [solid.front, 0, 1],
      [solid.top, 2, 0],
    ];
    for (const [outline, i, j] of views) {
      let pts = outline.map(([a, b]) => {
        const u = i === 0 ? a * sx : a;
        const v = j === 0 ? b * sx : b;
        return [u, v] as V2;
      });
      let area = 0;
      for (let k = 0; k < pts.length; k++)
        area += cross2([0, 0], pts[k]!, pts[(k + 1) % pts.length]!);
      if (area < 0) pts = pts.reverse();
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k]!;
        const b = pts[(k + 1) % pts.length]!;
        planes.push((q) => cross2(a, b, [q[i], q[j]]));
        lo[i] = Math.min(lo[i], a[0]);
        hi[i] = Math.max(hi[i], a[0]);
        lo[j] = Math.min(lo[j], a[1]);
        hi[j] = Math.max(hi[j], a[1]);
      }
    }
    out.push({
      rgb: hexToLinear(solid.color),
      lift: PROUD * (2 + (solid.layer ?? 0)),
      planes,
      box: [lo, hi],
    });
  }
  return out;
}

/** The part of a planar polygon inside every half-space (Sutherland–Hodgman in 3D). */
export function clipPlanes(poly: V3[], planes: readonly ((q: V3) => number)[]): V3[] {
  let out = poly;
  for (const f of planes) {
    if (out.length === 0) break;
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const p = input[k]!;
      const q = input[(k + 1) % input.length]!;
      const fp = f(p);
      const fq = f(q);
      if (fp >= 0) out.push(p);
      if (fp >= 0 !== fq >= 0) {
        const t = fp / (fp - fq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
      }
    }
  }
  return out;
}

/** The livery stands this far off the hull, clear of it in depth even from afar. */
const PROUD = 0.005;
/**
 * A face turned at least this far to the side (its normal's x) takes its flank's view even when
 * it faces more along the car: the steps where a flare stands out of the body, which belong to
 * the flank's livery, not the nose's or the tail's.
 */
const SIDE_LEAN = 0.3;
/** Pieces smaller than this (m², in the view) are dropped. */
const MIN_AREA = 1e-7;

type V2 = [number, number];
type V3 = [number, number, number];

/** sRGB hex → linear RGB, as the hull's vertex colours hold it. */
function hexToLinear(hex: string): V3 {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)];
}

const cross2 = (o: V2, a: V2, b: V2) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** The part of convex polygon `poly` inside convex counter-clockwise polygon `clip` (Sutherland–Hodgman). */
function clipConvex(poly: V2[], clip: readonly V2[]): V2[] {
  let out = poly;
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const p = input[k]!;
      const q = input[(k + 1) % input.length]!;
      const ip = cross2(a, b, p) >= 0;
      const iq = cross2(a, b, q) >= 0;
      if (ip) out.push(p);
      if (ip !== iq) {
        const dp = cross2(a, b, p);
        const dq = cross2(a, b, q);
        const t = dp / (dp - dq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

interface Piece {
  tri: [V2, V2, V2];
  rgb: V3;
  box: [number, number, number, number];
}

/** A view's triangles, counter-clockwise, with their colours and bounds. */
function piecesOf(view: LiveryView): Piece[] {
  const out: Piece[] = [];
  for (const { color, tris } of view.paint) {
    const rgb = hexToLinear(color);
    for (let i = 0; i + 5 < tris.length; i += 6) {
      let a: V2 = [tris[i]!, tris[i + 1]!];
      const b: V2 = [tris[i + 2]!, tris[i + 3]!];
      let c: V2 = [tris[i + 4]!, tris[i + 5]!];
      if (cross2(a, b, c) < 0) [a, c] = [c, a];
      out.push({
        tri: [a, b, c],
        rgb,
        box: [
          Math.min(a[0], b[0], c[0]),
          Math.max(a[0], b[0], c[0]),
          Math.min(a[1], b[1], c[1]),
          Math.max(a[1], b[1], c[1]),
        ],
      });
    }
  }
  return out;
}

/**
 * `mesh` with `livery` painted onto every face coloured one of `paintHex`:
 * the hull's own triangles, then the livery's pieces, then the glowing faces
 * (still last, so the mesh still draws them unlit from `glowStart`).
 */
export function paintLivery(
  mesh: HullMesh,
  livery: LiveryShapes,
  paintHex: readonly string[],
): HullMesh {
  const paint = paintHex.map(hexToLinear);
  const none: LiveryView = { u: [0, 0, 1], v: [1, 0, 1], paint: [] };
  const viewsOf = (l: Omit<LiveryShapes, 'over'>) => ({
    left: { view: l.left, pieces: piecesOf(l.left) },
    right: { view: l.right, pieces: piecesOf(l.right) },
    top: { view: l.top, pieces: piecesOf(l.top) },
    front: { view: l.front ?? none, pieces: piecesOf(l.front ?? none) },
    back: { view: l.back ?? none, pieces: piecesOf(l.back ?? none) },
  });
  // The livery, then its details a layer further out.
  const solids = (livery.solids ?? []).flatMap(solidCuts);
  const layers = [
    { views: viewsOf(livery), lift: PROUD },
    ...(livery.over ? [{ views: viewsOf(livery.over), lift: PROUD * 2 }] : []),
  ];
  const { positions: p, colors: c, glowStart } = mesh;
  const pos: number[] = [];
  const col: number[] = [];
  const painted = (i: number) =>
    paint.some(
      (q) =>
        Math.abs(c[i * 3]! - q[0]) < 1e-4 &&
        Math.abs(c[i * 3 + 1]! - q[1]) < 1e-4 &&
        Math.abs(c[i * 3 + 2]! - q[2]) < 1e-4,
    );
  // Every corner's normal: the faces meeting there, each by its area.
  const key = (i: number) =>
    `${Math.round(p[i * 3]! * 1e4)},${Math.round(p[i * 3 + 1]! * 1e4)},${Math.round(p[i * 3 + 2]! * 1e4)}`;
  const corner = new Map<string, V3>();
  for (let t = 0; t < glowStart; t += 3) {
    const [a, b, d] = [t, t + 1, t + 2].map((i) => [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!]) as [
      V3,
      V3,
      V3,
    ];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const fn = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ];
    for (let k = 0; k < 3; k++) {
      const sum = corner.get(key(t + k)) ?? [0, 0, 0];
      corner.set(key(t + k), [sum[0] + fn[0]!, sum[1] + fn[1]!, sum[2] + fn[2]!]);
    }
  }
  /** Each solid's part of face `t` (corners `P`), on the details layer, wound as the face. */
  const paintSolids = (P: V3[], t: number) => {
    const fmin = [0, 1, 2].map((k) => Math.min(P[0]![k]!, P[1]![k]!, P[2]![k]!));
    const fmax = [0, 1, 2].map((k) => Math.max(P[0]![k]!, P[1]![k]!, P[2]![k]!));
    const cn = [0, 1, 2].map((k) => {
      const m = corner.get(key(t + k))!;
      const l = Math.hypot(m[0], m[1], m[2]) || 1;
      return m.map((x) => x / l) as V3;
    });
    const e1 = [0, 1, 2].map((k) => P[1]![k]! - P[0]![k]!);
    const e2 = [0, 1, 2].map((k) => P[2]![k]! - P[0]![k]!);
    const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
    const d00 = dot(e1, e1);
    const d01 = dot(e1, e2);
    const d11 = dot(e2, e2);
    const den = d00 * d11 - d01 * d01;
    if (Math.abs(den) < 1e-14) return;
    for (const sc of solids) {
      const [lo, hi] = sc.box;
      if ([0, 1, 2].some((k) => fmax[k]! < lo[k]! || fmin[k]! > hi[k]!)) continue;
      const poly = clipPlanes([P[0]!, P[1]!, P[2]!], sc.planes);
      if (poly.length < 3) continue;
      const lifted = poly.map((q) => {
        const e = [q[0] - P[0]![0], q[1] - P[0]![1], q[2] - P[0]![2]];
        const d20 = dot(e, e1);
        const d21 = dot(e, e2);
        const w1 = (d11 * d20 - d01 * d21) / den;
        const w2 = (d00 * d21 - d01 * d20) / den;
        const w0 = 1 - w1 - w2;
        const m = [0, 1, 2].map((k) => cn[0]![k]! * w0 + cn[1]![k]! * w1 + cn[2]![k]! * w2);
        const ml = Math.hypot(m[0]!, m[1]!, m[2]!) || 1;
        return [0, 1, 2].map((k) => q[k]! + (m[k]! / ml) * sc.lift) as V3;
      });
      for (let k = 1; k + 1 < lifted.length; k++) {
        for (const q of [lifted[0]!, lifted[k]!, lifted[k + 1]!]) {
          pos.push(q[0], q[1], q[2]);
          col.push(...sc.rgb);
        }
      }
    }
  };
  for (let t = 0; t < glowStart; t += 3) {
    if (!painted(t)) continue;
    const P: V3[] = [0, 1, 2].map((k) => [
      p[(t + k) * 3]!,
      p[(t + k) * 3 + 1]!,
      p[(t + k) * 3 + 2]!,
    ]);
    const u: V3 = [P[1]![0] - P[0]![0], P[1]![1] - P[0]![1], P[1]![2] - P[0]![2]];
    const v: V3 = [P[2]![0] - P[0]![0], P[2]![1] - P[0]![1], P[2]![2] - P[0]![2]];
    const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-9) continue;
    if (solids.length > 0) paintSolids(P, t);
    const [ax, ay, az] = n.map(Math.abs) as V3;
    const which =
      ay >= ax && ay >= az
        ? n[1] > 0
          ? 'top'
          : null
        : ax >= az || ax >= SIDE_LEAN * len
          ? n[0] > 0
            ? 'left'
            : 'right'
          : n[2] > 0
            ? 'front'
            : 'back';
    if (!which) continue;
    for (const layer of layers) {
      const { view, pieces } = layer.views[which];
      const proj = (q: V3): V2 => [q[view.u[0]], q[view.v[0]]];
      let F = P.map(proj) as [V2, V2, V2];
      let order = [0, 1, 2];
      if (cross2(F[0], F[1], F[2]) < 0) {
        F = [F[0], F[2], F[1]];
        order = [0, 2, 1];
      }
      const det = cross2(F[0], F[1], F[2]);
      if (Math.abs(det) < 1e-9) continue;
      // The face's corners' normals, unit length (the face's own where its corners' cancel out).
      const cornerN = order.map((k) => {
        const m = corner.get(key(t + k))!;
        const l = Math.hypot(m[0], m[1], m[2]);
        return l > 1e-9 ? m.map((x) => x / l) : n.map((x) => x / len);
      }) as [V3, V3, V3];
      const box = [
        Math.min(F[0][0], F[1][0], F[2][0]),
        Math.max(F[0][0], F[1][0], F[2][0]),
        Math.min(F[0][1], F[1][1], F[2][1]),
        Math.max(F[0][1], F[1][1], F[2][1]),
      ];
      // A point of the view back on the face: its barycentric weights over the face's corners.
      const lift = (q: V2): V3 => {
        const w1 = cross2(F[0], q, F[2]) / det;
        const w2 = cross2(F[0], F[1], q) / det;
        const w0 = 1 - w1 - w2;
        const [a, b, d] = order.map((k) => P[k]!) as [V3, V3, V3];
        // Off along the corners' normals blended over the face: the same along a shared edge.
        const m = [0, 1, 2].map(
          (k) => cornerN[0][k]! * w0 + cornerN[1][k]! * w1 + cornerN[2][k]! * w2,
        ) as V3;
        const ml = Math.hypot(m[0], m[1], m[2]) || 1;
        return [0, 1, 2].map(
          (k) => a[k]! * w0 + b[k]! * w1 + d[k]! * w2 + (m[k]! / ml) * layer.lift,
        ) as V3;
      };
      for (const piece of pieces) {
        const pb = piece.box;
        if (pb[1] < box[0]! || pb[0] > box[1]! || pb[3] < box[2]! || pb[2] > box[3]!) continue;
        const poly = clipConvex([F[0], F[1], F[2]], piece.tri);
        if (poly.length < 3) continue;
        let area = 0;
        for (let k = 1; k + 1 < poly.length; k++) area += cross2(poly[0]!, poly[k]!, poly[k + 1]!);
        if (area / 2 < MIN_AREA) continue;
        const lifted = poly.map(lift);
        for (let k = 1; k + 1 < lifted.length; k++) {
          // Wound as the face is (its corners in their own order, not the view's).
          const tri =
            order[1] === 1
              ? [lifted[0]!, lifted[k]!, lifted[k + 1]!]
              : [lifted[0]!, lifted[k + 1]!, lifted[k]!];
          for (const q of tri) {
            pos.push(q[0], q[1], q[2]);
            col.push(...piece.rgb);
          }
        }
      }
    }
  }
  const glowCount = p.length - glowStart * 3;
  const positions = new Float32Array(glowStart * 3 + pos.length + glowCount);
  positions.set(p.subarray(0, glowStart * 3));
  positions.set(pos, glowStart * 3);
  positions.set(p.subarray(glowStart * 3), glowStart * 3 + pos.length);
  const colors = new Float32Array(positions.length);
  colors.set(c.subarray(0, glowStart * 3));
  colors.set(col, glowStart * 3);
  colors.set(c.subarray(glowStart * 3), glowStart * 3 + col.length);
  return { positions, colors, glowStart: glowStart + pos.length / 3, liveryStart: glowStart };
}
