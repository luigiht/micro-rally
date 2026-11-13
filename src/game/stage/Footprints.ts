import type { Pt } from './TownTerraces';

/**
 * Footprint tests for a city's fitted buildings (`TownInfill.fitLot`): an
 * outline must not fold over itself, and must not reach into another
 * building. Lots share their side lines, so two footprints that only touch
 * along one (or at a corner) are apart: each is shrunk a hair toward its
 * middle before they are compared.
 */

/** Footprints are shrunk this much toward their middles before overlapping is tested. */
const HAIR = 0.1;

/** Whether segment `a`–`b` crosses `c`–`d` at a point inside both (touching does not count). */
function crosses(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

/** Whether (x, z) lies inside the outline, by ray casting. */
function inside(poly: readonly Pt[], x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const a = poly[k]!;
    const b = poly[i]!;
    if (a.z > z !== b.z > z && x < a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z || 1e-12))
      hit = !hit;
  }
  return hit;
}

/** True when no two edges of the closed outline cross (neighbouring edges share a corner). */
export function isSimple(poly: readonly Pt[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++)
    for (let k = i + 2; k < n; k++) {
      if (i === 0 && k === n - 1) continue;
      if (crosses(poly[i]!, poly[(i + 1) % n]!, poly[k]!, poly[(k + 1) % n]!)) return false;
    }
  return true;
}

/** The outline pulled `HAIR` toward its vertices' middle. */
function shrunk(poly: readonly Pt[]): Pt[] {
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p.z, 0) / poly.length;
  return poly.map((p) => {
    const dx = cx - p.x;
    const dz = cz - p.z;
    const l = Math.hypot(dx, dz) || 1;
    const t = Math.min(HAIR, l / 2) / l;
    return { x: p.x + dx * t, z: p.z + dz * t };
  });
}

/** Whether two closed outlines overlap by more than a shared side or corner. */
export function overlaps(a: readonly Pt[], b: readonly Pt[]): boolean {
  const ax = a.map((p) => p.x);
  const az = a.map((p) => p.z);
  const bx = b.map((p) => p.x);
  const bz = b.map((p) => p.z);
  if (
    Math.max(...ax) < Math.min(...bx) ||
    Math.max(...bx) < Math.min(...ax) ||
    Math.max(...az) < Math.min(...bz) ||
    Math.max(...bz) < Math.min(...az)
  )
    return false;
  const sa = shrunk(a);
  const sb = shrunk(b);
  for (let i = 0; i < sa.length; i++)
    for (let k = 0; k < sb.length; k++)
      if (crosses(sa[i]!, sa[(i + 1) % sa.length]!, sb[k]!, sb[(k + 1) % sb.length]!)) return true;
  return inside(sb, sa[0]!.x, sa[0]!.z) || inside(sa, sb[0]!.x, sb[0]!.z);
}
