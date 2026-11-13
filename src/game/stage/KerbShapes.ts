import type { Arm, Junction } from './Town';

/**
 * The shapes junction kerbs are built from (see `TownKerbs`, `JunctionBox`):
 * kerb points and outlines, an arm's straight edges, kerb-return arcs, the
 * crescents that pave them, and a junction's paved ground as polygons.
 */

/** A point on a kerb line with the unit normal pointing onto the pavement. */
export interface KerbPoint {
  x: number;
  z: number;
  nx: number;
  nz: number;
}

/** The kerb between two neighbouring arms of a junction, from one arm's cut round the kerb return to the other's. */
export interface KerbOutline {
  points: KerbPoint[];
}

/** The paved ground of a junction beyond the ribbon: a polygon per blocked arm's mouth and per kerb return. */
export interface JunctionSurface {
  x: number;
  z: number;
  /** Radius from the junction within which `distance` can be negative. */
  zone: number;
  polygons: Pt[][];
  /** Distance to the paved ground outside it; a constant `INSIDE` depth anywhere on it. */
  distance(x: number, z: number): number;
}

export interface Pt {
  x: number;
  z: number;
}

/** Kerb returns are laid as facets at most this long. */
const ARC_STEP = 0.35;
/** Straight kerbs along an arm are laid in pieces at most this long, so they follow the deck. */
export const STUB_STEP = 2;
/** A blocked arm's mouth polygon reaches this far back under the ribbon past where its edges meet it. */
export const MOUTH_OVERLAP = 0.5;
/** Reported depth anywhere inside the paved ground: the polygons share internal edges, so true depth is not available. */
const INSIDE = -2;
/** Fill polygons overlap their neighbours by this much along shared edges, so no hairline opens between them. */
export const SEAM = 0.06;

export const forward = (h: number): Pt => ({ x: Math.sin(h), z: Math.cos(h) });
export const left = (h: number): Pt => ({ x: Math.cos(h), z: -Math.sin(h) });
export const at = (o: Pt, heading: number, along: number, across: number): Pt => ({
  x: o.x + Math.sin(heading) * along + Math.cos(heading) * across,
  z: o.z + Math.cos(heading) * along - Math.sin(heading) * across,
});
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** A point on the arm's edge (`sign` 1 left, -1 right) `t` along it, its normal onto the pavement. */
export function stubEdge(j: Pt, arm: Arm, sign: 1 | -1, t: number): KerbPoint {
  const l = left(arm.heading);
  const p = at(j, arm.heading, t, sign * arm.halfWidth);
  return { x: p.x, z: p.z, nx: l.x * sign, nz: l.z * sign };
}

/** The arm's edge from `t0` to `t1` in pieces, ends included. */
export function stubRun(j: Pt, arm: Arm, sign: 1 | -1, t0: number, t1: number): KerbPoint[] {
  const n = Math.max(1, Math.ceil(Math.abs(t1 - t0) / STUB_STEP));
  const out: KerbPoint[] = [];
  for (let k = 0; k <= n; k++) out.push(stubEdge(j, arm, sign, t0 + ((t1 - t0) * k) / n));
  return out;
}

/** Facets of the kerb return round `c` from `from` to `to` (ends excluded), normals toward the centre. */
export function arc(c: Pt, r: number, from: Pt, to: Pt, out: KerbPoint[]): void {
  const a0 = Math.atan2(from.x - c.x, from.z - c.z);
  const sweep = wrap(Math.atan2(to.x - c.x, to.z - c.z) - a0);
  const steps = Math.max(2, Math.ceil((Math.abs(sweep) * r) / ARC_STEP));
  for (let k = 1; k < steps; k++) {
    const a = a0 + (sweep * k) / steps;
    const x = c.x + Math.sin(a) * r;
    const z = c.z + Math.cos(a) * r;
    out.push({ x, z, nx: (c.x - x) / r, nz: (c.z - z) / r });
  }
}

/**
 * A kerb return's crescent from the outline points `from` the return's first
 * point to its last: the corner where the two edges meet, then the return.
 * The straight edges are pulled a seam into the neighbouring carriageways,
 * so no hairline opens between fill polygons.
 */
export function crescentOf(points: KerbPoint[], from: number, corner: Pt): Pt[] {
  const first = points[from]!;
  const last = points[points.length - 1]!;
  const out: Pt[] = [
    { x: corner.x - (first.nx + last.nx) * SEAM, z: corner.z - (first.nz + last.nz) * SEAM },
    { x: first.x - first.nx * SEAM, z: first.z - first.nz * SEAM },
  ];
  for (let k = from + 1; k < points.length - 1; k++) out.push({ x: points[k]!.x, z: points[k]!.z });
  out.push({ x: last.x - last.nx * SEAM, z: last.z - last.nz * SEAM });
  return out;
}

/** Signed distance to a polygon (negative inside), by edge distance and ray casting. */
function polygonDistance(poly: Pt[], x: number, z: number): number {
  let inside = false;
  let best = Infinity;
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const a = poly[k]!;
    const b = poly[i]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 0 ? ((x - a.x) * dx + (z - a.z) * dz) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = x - (a.x + dx * t);
    const pz = z - (a.z + dz * t);
    best = Math.min(best, px * px + pz * pz);
    if (a.z > z !== b.z > z && x < a.x + ((z - a.z) * dx) / (dz || 1e-12)) inside = !inside;
  }
  return inside ? -Math.sqrt(best) : Math.sqrt(best);
}

export function surfaceOf(j: Junction, polygons: Pt[][]): JunctionSurface {
  let zone = 0;
  for (const poly of polygons)
    for (const p of poly) zone = Math.max(zone, Math.hypot(p.x - j.x, p.z - j.z));
  zone += 2;
  return {
    x: j.x,
    z: j.z,
    zone,
    polygons,
    distance(x, z) {
      let d = Infinity;
      for (const poly of polygons) {
        const pd = polygonDistance(poly, x, z);
        if (pd <= 0) return INSIDE;
        d = Math.min(d, pd);
      }
      return d;
    },
  };
}
