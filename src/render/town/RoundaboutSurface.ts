import { createRoadHit } from '@/game/stage/RoadPath';
import { halfWidthAt, type RoadWidthSource } from '@/game/stage/RoadWidth';
import {
  handoffRadius,
  ringHandoff,
  ringLaneRadius,
  ringOuterRadius,
  type Roundabout,
} from '@/game/stage/Roundabout';
import { PAVEMENT_WIDTH, streetDistance, type Street } from '@/game/stage/Town';

/**
 * Everything round a roundabout that is not the ring's own tarmac, from one
 * distance field of the carriageways in reach (the ring, the blocked exits,
 * the route): `d` is the distance to their union. Dilating the union by the
 * pavement width and eroding it back (a morphological closing) rounds every
 * concave corner where a road meets the ring by that width, which is the
 * kerb return a junction has; the closed shape's edge is the kerb line.
 * That line is traced once (the contour, at the pavement width, of the
 * exact distance back from the dilation's edge), smoothed, and every band
 * is an exact offset of it along the field's gradient:
 *
 * - tarmac fillets, between the kerb line and the raw union edge (empty
 *   except in the corners);
 * - the pavement, between the kerb line and the dilation's edge, with a kerb
 *   face along each;
 * - the white edge line, `LINE_INSET` inside the kerb line.
 *
 * The surface lives inside the ring's hand-off disc (`handoffRadius`). The
 * roads hand over to it there: their own pavements, kerbs and lines stop
 * (the ribbon inside its openings, a side street at its kerb cut) and the
 * bands here are clipped to the same places, so the two meet edge to edge.
 */

/** Grid cell for the field and its contours. */
const CELL = 0.25;
/** The grid reaches this far beyond the hand-off radius, so the contours there are not grid edges. */
const MARGIN = 4;
/** The edge line's inset from the kerb and its width, as on every road. */
const LINE_INSET = 0.35;
const LINE_WIDTH = 0.22;
/** Step for numerical gradients. */
const EPS = 0.1;

export interface Band {
  /** One edge of the band. */
  a: [number, number][];
  /** The other edge, vertex for vertex. */
  b: [number, number][];
  /** Unit direction from `b` toward `a` at each vertex. */
  n: [number, number][];
}

export interface RoundaboutSurfaceBands {
  fillets: Band[];
  pavements: Band[];
  lines: Band[];
}

type Pt = [number, number];

/** Polyline segments hashed into cells, for nearest-point queries within `cap`. */
class SegmentIndex {
  private readonly segs: [number, number, number, number][] = [];
  private readonly cells = new Map<number, number[]>();

  constructor(
    lines: Pt[][],
    private readonly cap: number,
  ) {
    for (const line of lines)
      for (let i = 0; i + 1 < line.length; i++)
        this.segs.push([line[i]![0], line[i]![1], line[i + 1]![0], line[i + 1]![1]]);
    for (let k = 0; k < this.segs.length; k++) {
      const [ax, az, bx, bz] = this.segs[k]!;
      for (
        let cx = Math.floor(Math.min(ax, bx) / cap);
        cx <= Math.floor(Math.max(ax, bx) / cap);
        cx++
      )
        for (
          let cz = Math.floor(Math.min(az, bz) / cap);
          cz <= Math.floor(Math.max(az, bz) / cap);
          cz++
        ) {
          const kk = this.key(cx, cz);
          (this.cells.get(kk) ?? this.cells.set(kk, []).get(kk)!).push(k);
        }
    }
  }

  private key(cx: number, cz: number): number {
    return (cx + 0x8000) * 0x10000 + (cz + 0x8000);
  }

  /** The nearest point on the polylines to (x, z) and its distance, or the cap and (x, z) itself when none is within it. */
  nearest(x: number, z: number): { p: Pt; d: number } {
    const cx = Math.floor(x / this.cap);
    const cz = Math.floor(z / this.cap);
    let best = this.cap * this.cap;
    let p: Pt = [x, z];
    for (let ux = cx - 1; ux <= cx + 1; ux++)
      for (let uz = cz - 1; uz <= cz + 1; uz++) {
        const list = this.cells.get(this.key(ux, uz));
        if (!list) continue;
        for (const k of list) {
          const [ax, az, bx, bz] = this.segs[k]!;
          const dx = bx - ax;
          const dz = bz - az;
          const len2 = dx * dx + dz * dz;
          let t = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = ax + dx * t;
          const qz = az + dz * t;
          const d2 = (x - qx) * (x - qx) + (z - qz) * (z - qz);
          if (d2 < best) {
            best = d2;
            p = [qx, qz];
          }
        }
      }
    return { p, d: Math.sqrt(best) };
  }
}

/**
 * Distance from every grid node inside the dilated union to the dilation's
 * edge, measured against the edge's own contour (a polyline accurate well
 * inside a cell) rather than to the nearest outside node, so the kerb line
 * it yields is not offset by part of a cell. Nodes outside are 0; distances
 * are capped at the index's cap, all the field needs.
 */
function distanceToEdge(
  dv: Float64Array,
  n: number,
  x0: number,
  z0: number,
  edge: SegmentIndex,
  level: number,
): Float64Array {
  const out = new Float64Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      if (dv[j * n + i]! > level) continue;
      out[j * n + i] = edge.nearest(x0 + i * CELL, z0 + j * CELL).d;
    }
  return out;
}

/** Resample a polyline to about `step` spacing, then relax it once (ends fixed), taking the grid's aliasing out of a contour. */
function smooth(line: Pt[], step: number): Pt[] {
  const even: Pt[] = [line[0]!];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = step - carry;
    while (s <= len) {
      even.push([a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len]);
      s += step;
    }
    carry = len - (s - step);
  }
  const last = line[line.length - 1]!;
  const tail = even[even.length - 1]!;
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.3) even.push(last);
  else even[even.length - 1] = last;
  if (even.length < 3) return even;
  const out: Pt[] = even.map((p) => [p[0], p[1]]);
  for (let i = 1; i + 1 < even.length; i++) {
    const a = even[i - 1]!;
    const b = even[i]!;
    const c = even[i + 1]!;
    out[i] = [0.25 * a[0] + 0.5 * b[0] + 0.25 * c[0], 0.25 * a[1] + 0.5 * b[1] + 0.25 * c[1]];
  }
  return out;
}

/** A scalar field sampled on the grid, read anywhere by bilinear interpolation. */
class Grid {
  constructor(
    readonly v: Float64Array,
    readonly n: number,
    readonly x0: number,
    readonly z0: number,
  ) {}

  at(x: number, z: number): number {
    const fx = Math.min(this.n - 1.0001, Math.max(0, (x - this.x0) / CELL));
    const fz = Math.min(this.n - 1.0001, Math.max(0, (z - this.z0) / CELL));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const a = this.v[j * this.n + i]!;
    const b = this.v[j * this.n + i + 1]!;
    const c = this.v[(j + 1) * this.n + i]!;
    const d = this.v[(j + 1) * this.n + i + 1]!;
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  gradient(x: number, z: number): Pt {
    const gx = (this.at(x + EPS, z) - this.at(x - EPS, z)) / (2 * EPS);
    const gz = (this.at(x, z + EPS) - this.at(x, z - EPS)) / (2 * EPS);
    const g = Math.hypot(gx, gz) || 1;
    return [gx / g, gz / g];
  }
}

/** Marching squares: the contour `f = level` on the grid, as linked polylines. */
function contours(grid: Grid, level: number): Pt[][] {
  const { v, n, x0, z0 } = grid;
  const at = (i: number, j: number) => v[j * n + i]! - level;
  const hKey = (i: number, j: number) => 2 * (j * n + i);
  const vKey = (i: number, j: number) => 2 * (j * n + i) + 1;
  const point = (key: number): Pt => {
    const idx = key >> 1;
    const i = idx % n;
    const j = (idx - i) / n;
    if (key % 2 === 0) {
      const a = at(i, j);
      const b = at(i + 1, j);
      return [x0 + (i + a / (a - b)) * CELL, z0 + j * CELL];
    }
    const a = at(i, j);
    const b = at(i, j + 1);
    return [x0 + i * CELL, z0 + (j + a / (a - b)) * CELL];
  };
  const links = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };
  for (let j = 0; j + 1 < n; j++)
    for (let i = 0; i + 1 < n; i++) {
      const code =
        (at(i, j) > 0 ? 1 : 0) |
        (at(i + 1, j) > 0 ? 2 : 0) |
        (at(i + 1, j + 1) > 0 ? 4 : 0) |
        (at(i, j + 1) > 0 ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const bottom = hKey(i, j);
      const top = hKey(i, j + 1);
      const left = vKey(i, j);
      const right = vKey(i + 1, j);
      switch (code) {
        case 1:
        case 14:
          link(left, bottom);
          break;
        case 2:
        case 13:
          link(bottom, right);
          break;
        case 3:
        case 12:
          link(left, right);
          break;
        case 4:
        case 11:
          link(right, top);
          break;
        case 6:
        case 9:
          link(bottom, top);
          break;
        case 7:
        case 8:
          link(left, top);
          break;
        case 5:
          link(left, bottom);
          link(right, top);
          break;
        case 10:
          link(bottom, right);
          link(left, top);
          break;
      }
    }
  const seen = new Set<number>();
  const out: Pt[][] = [];
  const walk = (start: number) => {
    const line: Pt[] = [];
    let prev: number | null = null;
    let cur: number | null = start;
    while (cur !== null && !seen.has(cur)) {
      const here: number = cur;
      seen.add(here);
      line.push(point(here));
      const next: number | undefined = (links.get(here) ?? []).find(
        (k) => k !== prev && !seen.has(k),
      );
      prev = here;
      cur = next ?? null;
    }
    // A closed loop (the island's kerb line, say) comes back to its start: close it, or its last
    // segment would be missing from every band built on it.
    if (prev !== null && line.length > 2 && (links.get(prev) ?? []).includes(start))
      line.push(point(start));
    if (line.length >= 2) out.push(line);
  };
  for (const [k, ls] of links) if (ls.length === 1 && !seen.has(k)) walk(k);
  for (const k of links.keys()) if (!seen.has(k)) walk(k);
  return out;
}

/**
 * Split polylines where `excess` turns positive (beyond a hand-off), with
 * an interpolated vertex at the crossing so a band ends exactly where the
 * road's own strips begin.
 */
function clip(lines: Pt[][], excess: (p: Pt) => number): Pt[][] {
  const out: Pt[][] = [];
  for (const line of lines) {
    let cur: Pt[] = [];
    const ex = line.map(excess);
    for (let i = 0; i < line.length; i++) {
      const p = line[i]!;
      if (ex[i]! <= 0) {
        if (i > 0 && ex[i - 1]! > 0) {
          const q = line[i - 1]!;
          const t = ex[i - 1]! / (ex[i - 1]! - ex[i]!);
          cur.push([q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t]);
        }
        cur.push(p);
      } else {
        if (i > 0 && ex[i - 1]! <= 0) {
          const q = line[i - 1]!;
          const t = ex[i - 1]! / (ex[i - 1]! - ex[i]!);
          cur.push([q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t]);
        }
        if (cur.length >= 2) out.push(cur);
        cur = [];
      }
    }
    if (cur.length >= 2) out.push(cur);
  }
  return out;
}

/** Spacing of the kerb line's vertices after resampling. */
const STEP = 0.4;

/** The bands of one roundabout's surface. */
export function roundaboutSurface(
  r: Roundabout,
  stage: RoadWidthSource,
  exits: readonly Street[],
): RoundaboutSurfaceBands {
  const lane = ringLaneRadius(r);
  const outer = ringOuterRadius(r);
  const handoff = handoffRadius(r);
  const hit = createRoadHit();
  // For the field each exit runs on back into the ring's carriageway: a street that started at the
  // ring's edge would carry its rounded end cap into the mouth, and the field would take that cap
  // for the carriageway edge there and leave the mouth's corners no fillet.
  const roads: Street[] = exits.map((st) => {
    const dx = st.x1 - st.x0;
    const dz = st.z1 - st.z0;
    const len = Math.hypot(dx, dz) || 1;
    const back = st.halfWidth + 1;
    return { ...st, x0: st.x0 - (dx / len) * back, z0: st.z0 - (dz / len) * back };
  });
  /** Distance to the nearest carriageway edge, negative on a carriageway. */
  const d = (x: number, z: number): number => {
    const rho = Math.hypot(x - r.x, z - r.z);
    let v = Math.abs(rho - lane) - r.halfWidth;
    for (const s of roads) v = Math.min(v, streetDistance(s, x, z) - s.halfWidth);
    if (stage.path.nearest(x, z, 60, hit))
      v = Math.min(v, hit.distance - halfWidthAt(stage, hit.along));
    // The island is a circle whatever runs onto the ring: an exit's extension (its round end cap)
    // or the route's deflection may reach inside it, but the field never does.
    return rho < r.islandRadius ? Math.max(v, r.islandRadius - rho) : v;
  };
  const reach = handoff + MARGIN;
  const n = Math.ceil((2 * reach) / CELL) + 1;
  const x0 = r.x - reach;
  const z0 = r.z - reach;
  const dv = new Float64Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) dv[j * n + i] = d(x0 + i * CELL, z0 + j * CELL);
  const field = new Grid(dv, n, x0, z0);
  // The dilation's edge, then the exact distance back from it: its level at the pavement width is
  // the closing's edge, the kerb line.
  const dilated = new SegmentIndex(contours(field, PAVEMENT_WIDTH), PAVEMENT_WIDTH + 2);
  const dc = distanceToEdge(dv, n, x0, z0, dilated, PAVEMENT_WIDTH);
  const closed = new Grid(dc, n, x0, z0);

  // Hand-offs: along a road, where its own strips begin; elsewhere, the hand-off disc.
  const along = ringHandoff(r, stage);
  const excess = (p: Pt): number => {
    if (stage.path.nearest(p[0], p[1], 60, hit)) {
      if (hit.distance <= halfWidthAt(stage, hit.along) + PAVEMENT_WIDTH + 0.6)
        return Math.max(along.from - hit.along, hit.along - along.to);
    }
    for (const s of exits) {
      const dx = s.x1 - s.x0;
      const dz = s.z1 - s.z0;
      const len = Math.hypot(dx, dz);
      const t = ((p[0] - s.x0) * dx + (p[1] - s.z0) * dz) / len;
      const lat = Math.abs(((p[0] - s.x0) * dz - (p[1] - s.z0) * dx) / len);
      if (lat <= s.halfWidth + PAVEMENT_WIDTH + 0.6 && t > 0) return t - (handoff - outer);
    }
    return Math.hypot(p[0] - r.x, p[1] - r.z) - handoff;
  };

  /**
   * The nearest point on a carriageway edge to (x, z), found piece by piece
   * (the ring's outer or inner edge, a street's edge, the route's edge) with
   * the piece it lies on, so a fillet's inner edge sits exactly on the
   * tarmac it meets rather than where a grid gradient lands.
   */
  const nearestEdge = (x: number, z: number): { p: Pt; piece: number } => {
    const rho = Math.hypot(x - r.x, z - r.z) || 1e-9;
    const ringEdge = rho >= lane ? outer : r.islandRadius;
    let best = Math.abs(rho - ringEdge);
    let p: Pt = [r.x + ((x - r.x) / rho) * ringEdge, r.z + ((z - r.z) / rho) * ringEdge];
    let piece = 0;
    roads.forEach((st, k) => {
      const dx = st.x1 - st.x0;
      const dz = st.z1 - st.z0;
      const len2 = dx * dx + dz * dz;
      let t = len2 > 0 ? ((x - st.x0) * dx + (z - st.z0) * dz) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const fx = st.x0 + dx * t;
      const fz = st.z0 + dz * t;
      const dist = Math.hypot(x - fx, z - fz) || 1e-9;
      const v = Math.abs(dist - st.halfWidth);
      if (v < best) {
        best = v;
        p = [fx + ((x - fx) / dist) * st.halfWidth, fz + ((z - fz) / dist) * st.halfWidth];
        piece = 1 + k;
      }
    });
    if (stage.path.nearest(x, z, 60, hit)) {
      const hw = halfWidthAt(stage, hit.along);
      const v = Math.abs(hit.distance - hw);
      if (v < best) {
        const sm = { x: 0, z: 0, heading: 0 };
        stage.path.sample(hit.along, sm);
        const side = hit.lateral >= 0 ? 1 : -1;
        p = [sm.x + Math.cos(sm.heading) * hw * side, sm.z - Math.sin(sm.heading) * hw * side];
        piece = 1 + exits.length;
      }
    }
    return { p, piece };
  };
  /** Where a street's edge meets the ring's outer edge: the raw corner of the union, for the fillet to reach. */
  const rawCorner = (k: number, side: 1 | -1): Pt => {
    const st = exits[k]!;
    const dx = st.x1 - st.x0;
    const dz = st.z1 - st.z0;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const lx = uz * side;
    const lz = -ux * side;
    const t = Math.sqrt(Math.max(0, outer * outer - st.halfWidth * st.halfWidth)) - outer;
    return [st.x0 + ux * t + lx * st.halfWidth, st.z0 + uz * t + lz * st.halfWidth];
  };

  const kerbLines = clip(contours(closed, PAVEMENT_WIDTH), excess).map((l) => smooth(l, STEP));
  const fillets: Band[] = [];
  const pavements: Band[] = [];
  const lines: Band[] = [];
  for (const kerb of kerbLines) {
    const fillet: Band = { a: [], b: [], n: [] };
    const pavement: Band = { a: [], b: [], n: [] };
    const line: Band = { a: [], b: [], n: [] };
    let lastPiece = -1;
    for (const p of kerb) {
      // Inward along the closed field's gradient; outward to the exact nearest point of the
      // dilation's edge (at a mouth corner every vertex of the kerb's arc maps to the one corner
      // of that edge, so the pavement fans to it without a notch).
      const g = closed.gradient(p[0], p[1]);
      // Three metres out along the gradient lands on the dilation's edge; the exact contour point
      // nearby replaces it (so a mouth corner's fan meets exactly), unless the nearest contour
      // point is another road's edge across a narrow gap, where the estimate stands.
      const est: Pt = [p[0] - g[0] * PAVEMENT_WIDTH, p[1] - g[1] * PAVEMENT_WIDTH];
      const snap = dilated.nearest(est[0], est[1]);
      const edge = snap.d < 1 ? snap.p : est;
      pavement.a.push(edge);
      pavement.b.push(p);
      const nl = Math.hypot(edge[0] - p[0], edge[1] - p[1]) || 1;
      pavement.n.push([(edge[0] - p[0]) / nl, (edge[1] - p[1]) / nl]);
      line.a.push([p[0] + g[0] * LINE_INSET, p[1] + g[1] * LINE_INSET]);
      line.b.push([
        p[0] + g[0] * (LINE_INSET + LINE_WIDTH),
        p[1] + g[1] * (LINE_INSET + LINE_WIDTH),
      ]);
      line.n.push([-g[0], -g[1]]);
      // The raw union's edge, exactly; where the nearest edge changes from a street to the ring (or
      // back), the raw corner between them goes in so the fillet fills the notch to its apex.
      const near = nearestEdge(p[0], p[1]);
      if (lastPiece >= 0 && near.piece !== lastPiece) {
        const streetPiece = near.piece === 0 ? lastPiece : lastPiece === 0 ? near.piece : -1;
        if (streetPiece > 0 && streetPiece <= exits.length) {
          const st = exits[streetPiece - 1]!;
          const dx = st.x1 - st.x0;
          const dz = st.z1 - st.z0;
          const side: 1 | -1 = (p[0] - st.x0) * dz - (p[1] - st.z0) * dx >= 0 ? 1 : -1;
          fillet.a.push(p);
          fillet.b.push(rawCorner(streetPiece - 1, side));
          fillet.n.push(g);
        }
      }
      lastPiece = near.piece;
      fillet.a.push(p);
      fillet.b.push(near.p);
      fillet.n.push(g);
    }
    pavements.push(pavement);
    lines.push(line);
    if (fillet.a.some((p, i) => Math.hypot(p[0] - fillet.b[i]![0], p[1] - fillet.b[i]![1]) > 0.02))
      fillets.push(fillet);
  }
  // Where the route leaves the ring (and where it joins), its carriageway and the ring's run side
  // by side with a gap that opens slowly; the closing makes that gap tarmac while it is under two
  // pavements wide, but the kerb line runs round the outside of both roads there, so no band off
  // it reaches in. A web of quads between the route's ring-side edge and the ring's edge does.
  for (const [start, step] of [
    [r.to, 1],
    [r.from, -1],
  ] as const) {
    const web: Band = { a: [], b: [], n: [] };
    const sm = { x: 0, z: 0, heading: 0 };
    for (let k = 0; k <= 80; k++) {
      const along = start + step * k * 0.5;
      stage.path.sample(along, sm);
      const hw = halfWidthAt(stage, along);
      // The route's edge on the ring's side (toward the centre).
      const toCentre =
        Math.sign((r.x - sm.x) * Math.cos(sm.heading) - (r.z - sm.z) * Math.sin(sm.heading)) || 1;
      const ex = sm.x + Math.cos(sm.heading) * hw * toCentre;
      const ez = sm.z - Math.sin(sm.heading) * hw * toCentre;
      const rho = Math.hypot(ex - r.x, ez - r.z);
      const gap = rho - outer;
      if (gap > 2 * PAVEMENT_WIDTH) break;
      if (gap <= 0.01) continue;
      const ux = (ex - r.x) / rho;
      const uz = (ez - r.z) / rho;
      web.a.push([ex, ez]);
      web.b.push([r.x + ux * outer, r.z + uz * outer]);
      web.n.push([ux, uz]);
    }
    if (web.a.length >= 2) fillets.push(web);
  }
  return { fillets, pavements, lines };
}
