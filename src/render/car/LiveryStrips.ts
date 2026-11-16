import type { LiveryView } from './HullLivery';

/**
 * Building blocks for liveries drawn as shapes (`HullLivery`): eased curves,
 * bands laid in narrow strips, and round panels. Pure, free of three.js.
 */

/** Smooth curve through `points` (ascending in their first value): eased between each pair, held past the ends. */
export function curve(points: readonly (readonly [number, number])[]): (z: number) => number {
  return (z) => {
    if (z <= points[0]![0]) return points[0]![1];
    for (let i = 0; i + 1 < points.length; i++) {
      const [za, ya] = points[i]!;
      const [zb, yb] = points[i + 1]!;
      if (z > zb) continue;
      const t = (z - za) / (zb - za);
      return ya + (yb - ya) * (t * t * (3 - 2 * t));
    }
    return points[points.length - 1]![1];
  };
}

export const smoothstep = (a: number, b: number, z: number): number => {
  const t = Math.min(1, Math.max(0, (z - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** One colour between two edges, each a function of the view's first axis. */
export interface Layer {
  color: string;
  bottom: (u: number) => number;
  top: (u: number) => number;
}

/** Strips are this long along the view's first axis. */
const STRIP = 0.04;

/** Each layer as quads of `STRIP` between `u0` and `u1`, two triangles each. */
export function strips(u0: number, u1: number, layers: readonly Layer[]): LiveryView['paint'] {
  const out = new Map<string, number[]>();
  const n = Math.ceil((u1 - u0) / STRIP);
  for (let k = 0; k < n; k++) {
    const a = u0 + ((u1 - u0) * k) / n;
    const b = u0 + ((u1 - u0) * (k + 1)) / n;
    for (const l of layers) {
      const [ab, at, bb, bt] = [l.bottom(a), l.top(a), l.bottom(b), l.top(b)];
      if (at - ab < 1e-4 && bt - bb < 1e-4) continue;
      const tris = out.get(l.color) ?? [];
      tris.push(a, ab, b, bb, b, Math.max(bt, bb), a, ab, b, Math.max(bt, bb), a, Math.max(at, ab));
      out.set(l.color, tris);
    }
  }
  return [...out].map(([color, tris]) => ({ color, tris }));
}

/** A round panel of `color` at (`u`, `v`): a fan of `sides` triangles. */
export function disc(
  u: number,
  v: number,
  radius: number,
  color: string,
  sides = 20,
): LiveryView['paint'][number] {
  const tris: number[] = [];
  for (let k = 0; k < sides; k++) {
    const a = (2 * Math.PI * k) / sides;
    const b = (2 * Math.PI * (k + 1)) / sides;
    tris.push(
      u,
      v,
      u + Math.cos(a) * radius,
      v + Math.sin(a) * radius,
      u + Math.cos(b) * radius,
      v + Math.sin(b) * radius,
    );
  }
  return { color, tris };
}

/** Several paints merged by colour, in first-seen order. */
export function mergePaint(...parts: LiveryView['paint'][]): LiveryView['paint'] {
  const merged = new Map<string, number[]>();
  for (const part of parts)
    for (const p of part) merged.set(p.color, [...(merged.get(p.color) ?? []), ...p.tris]);
  return [...merged].map(([color, tris]) => ({ color, tris }));
}

export type Paint = LiveryView['paint'][number];

/** A plain rectangle in a view, two triangles. */
export function rect(u0: number, u1: number, v0: number, v1: number, color: string): Paint {
  return { color, tris: [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1] };
}

/** A convex polygon in a view (corners in order, either way round), fanned from its first corner. */
export function poly(points: readonly (readonly [number, number])[], color: string): Paint {
  const tris: number[] = [];
  for (let k = 1; k + 1 < points.length; k++) {
    const [a, b, c] = [points[0]!, points[k]!, points[k + 1]!];
    tris.push(a[0], a[1], b[0], b[1], c[0], c[1]);
  }
  return { color, tris };
}

/** A ring between radii `r0` and `r1` round (`u`, `v`): a bezel or a lamp's rim. */
export function ring(
  u: number,
  v: number,
  r0: number,
  r1: number,
  color: string,
  sides = 24,
): Paint {
  const tris: number[] = [];
  for (let k = 0; k < sides; k++) {
    const a = (2 * Math.PI * k) / sides;
    const b = (2 * Math.PI * (k + 1)) / sides;
    const p = (r: number, t: number) => [u + Math.cos(t) * r, v + Math.sin(t) * r] as const;
    const [a0, a1, b0, b1] = [p(r0, a), p(r1, a), p(r0, b), p(r1, b)];
    tris.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
  }
  return { color, tris };
}

/** A line `width` wide through `points` in a view: a panel gap, a pinstripe, a trim line. */
export function line(
  points: readonly (readonly [number, number])[],
  width: number,
  color: string,
): Paint {
  const tris: number[] = [];
  for (let k = 0; k + 1 < points.length; k++) {
    const [a, b] = [points[k]!, points[k + 1]!];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nu = (-(b[1] - a[1]) / len) * (width / 2);
    const nv = ((b[0] - a[0]) / len) * (width / 2);
    // Each segment runs on half a width past its ends, so corners close.
    const eu = ((b[0] - a[0]) / len) * (width / 2);
    const ev = ((b[1] - a[1]) / len) * (width / 2);
    const [a0, a1] = [a[0] - eu, a[1] - ev];
    const [b0, b1] = [b[0] + eu, b[1] + ev];
    tris.push(a0 + nu, a1 + nv, b0 + nu, b1 + nv, b0 - nu, b1 - nv);
    tris.push(a0 + nu, a1 + nv, b0 - nu, b1 - nv, a0 - nu, a1 - nv);
  }
  return { color, tris };
}

/** Points along a curve `f` from `u0` to `u1`, for `line`. */
export function trace(
  f: (u: number) => number,
  u0: number,
  u1: number,
  n = 24,
): [number, number][] {
  return Array.from({ length: n + 1 }, (_, k) => {
    const u = u0 + ((u1 - u0) * k) / n;
    return [u, f(u)];
  });
}
