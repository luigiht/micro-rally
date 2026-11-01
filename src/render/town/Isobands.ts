/** A polygon vertex carrying a field value that varies linearly along each edge, and its height once known. */
export interface Vert {
  x: number;
  z: number;
  f: number;
  h?: number;
}

/** The part of a convex polygon where `side(v) >= 0` (Sutherland–Hodgman against a linear predicate). */
export function clip(poly: readonly Vert[], side: (v: Vert) => number): Vert[] {
  const out: Vert[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) out.push(p);
    if (sp < 0 !== sq < 0) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t, f: p.f + (q.f - p.f) * t });
    }
  }
  return out;
}

/** The part of a polygon whose field lies within [lo, hi]. */
export function band(poly: readonly Vert[], lo: number, hi: number): Vert[] {
  return clip(
    clip(poly, (v) => v.f - lo),
    (v) => hi - v.f,
  );
}
