import { createRoadHit, type RoadHit } from './RoadPath';
import { halfWidthAt, type RoadWidthSource } from './RoadWidth';
import { FILLET, type Arm, type Junction, type TownDef } from './Town';
import {
  apronEnd,
  CUT_MARGIN,
  offsetCorner,
  stubCut,
  throughArm,
  wedges,
  type Wedge,
} from './TownJunctions';

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

/** A stretch of the route, as path distances, where the ribbon leaves its verge and edge line to a junction. */
export interface RouteOpening {
  from: number;
  to: number;
}

export interface Openings {
  left: RouteOpening[];
  right: RouteOpening[];
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

/**
 * The apron of an arm that continues the route straight through a corner:
 * the ribbon's edge line from where the ribbon leaves it (`e1`, heading
 * `u` toward the junction, pavement normal `n`) to the junction.
 */
export interface Apron {
  /** The blocked arm whose mouth the apron is, and the route arm it continues. */
  arm: Arm;
  route: Arm;
  /** The arm's side whose edge lies on the line (1 left, -1 right). */
  sign: 1 | -1;
  /** The route's side of travel the apron lies on. */
  side: 1 | -1;
  e1: KerbPoint;
  u: Pt;
  /** How far past `e1` the apron reaches under the ribbon, and where the junction lies along the line. */
  back: number;
  knee: number;
  /** Path distance where the ribbon hands its verge and line to the junction, and the kerb point there. */
  cut: number;
  handoff: KerbPoint;
}

export interface JunctionKerbs {
  outlines: KerbOutline[];
  openings: Openings;
  surface: JunctionSurface;
  aprons: Apron[];
}

export interface Pt {
  x: number;
  z: number;
}

/** Kerb returns are laid as facets at most this long; straight kerbs in pieces at most `EDGE_STEP` long. */
const ARC_STEP = 0.35;
/** Straight kerbs along a blocked arm are laid in pieces at most this long, so they follow the deck. */
const STUB_STEP = 2;
/** The route's edge is followed at this spacing between the kerb return and the ribbon's cut. */
const EDGE_STEP = 1;
/** Fillet centres are searched along the arm at this step, then bisected. */
const SEARCH_STEP = 0.5;
/** A blocked arm's mouth polygon reaches this far back under the ribbon past where its edges meet it. */
const MOUTH_OVERLAP = 0.5;
/** Reported depth anywhere inside the paved ground: the polygons share internal edges, so true depth is not available. */
const INSIDE = -2;
/** Fill polygons overlap their neighbours by this much along shared edges, so no hairline opens between them. */
const SEAM = 0.06;

const forward = (h: number): Pt => ({ x: Math.sin(h), z: Math.cos(h) });
const left = (h: number): Pt => ({ x: Math.cos(h), z: -Math.sin(h) });
const at = (o: Pt, heading: number, along: number, across: number): Pt => ({
  x: o.x + Math.sin(heading) * along + Math.cos(heading) * across,
  z: o.z + Math.cos(heading) * along - Math.sin(heading) * across,
});
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Point on the route's edge at path distance `d`, `extra` beyond the
 * carriageway on `side` (1 left of travel), with the ribbon's own convention:
 * the vertex heading at a sample, the segment heading between samples.
 */
export function routeEdge(
  stage: RoadWidthSource,
  d: number,
  side: 1 | -1,
  extra: number,
): KerbPoint {
  const path = stage.path;
  const f = d / path.spacing;
  const i = Math.round(f);
  let x: number;
  let z: number;
  let heading: number;
  if (Math.abs(f - i) < 1e-6 && i >= 0 && i < path.count) {
    x = path.xs[i]!;
    z = path.zs[i]!;
    heading = path.headings[i]!;
  } else {
    const s = { x: 0, z: 0, heading: 0 };
    path.sample(d, s);
    x = s.x;
    z = s.z;
    heading = s.heading;
  }
  const nx = Math.cos(heading) * side;
  const nz = -Math.sin(heading) * side;
  const off = halfWidthAt(stage, d) + extra;
  return { x: x + nx * off, z: z + nz * off, nx, nz };
}

/** Point on a blocked arm's edge (`sign` 1 for its left edge, -1 right) `t` along it, normal away from the carriageway. */
function stubEdge(j: Pt, arm: Arm, sign: 1 | -1, t: number): KerbPoint {
  const l = left(arm.heading);
  const p = at(j, arm.heading, t, sign * arm.halfWidth);
  return { x: p.x, z: p.z, nx: l.x * sign, nz: l.z * sign };
}

/** The arm's edge from `t0` to `t1` in pieces, ends included. */
function stubRun(j: Pt, arm: Arm, sign: 1 | -1, t0: number, t1: number): KerbPoint[] {
  const n = Math.max(1, Math.ceil(Math.abs(t1 - t0) / STUB_STEP));
  const out: KerbPoint[] = [];
  for (let k = 0; k <= n; k++) out.push(stubEdge(j, arm, sign, t0 + ((t1 - t0) * k) / n));
  return out;
}

/** Facets of the kerb return round `c` from `from` to `to` (ends excluded), normals toward the centre. */
function arc(c: Pt, r: number, from: Pt, to: Pt, out: KerbPoint[]): void {
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
function crescentOf(points: KerbPoint[], from: number, corner: Pt): Pt[] {
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

/** Kerb between two blocked arms: both edges straight, the classic fillet between them, and its crescent. */
function stubStub(
  j: Junction,
  w: Wedge,
  routeHalfWidth: number,
): { outline: KerbOutline; crescent: Pt[] } {
  const c = offsetCorner(j, w.a, w.b, w.a.halfWidth + FILLET, w.b.halfWidth + FILLET);
  const fa = forward(w.a.heading);
  const fb = forward(w.b.heading);
  const oa = at(j, w.a.heading, 0, w.a.halfWidth);
  const ob = at(j, w.b.heading, 0, -w.b.halfWidth);
  const cutA = stubCut(j, w.a, routeHalfWidth);
  const cutB = stubCut(j, w.b, routeHalfWidth);
  const ta = Math.min(cutA - 0.1, (c.x - oa.x) * fa.x + (c.z - oa.z) * fa.z);
  const tb = Math.min(cutB - 0.1, (c.x - ob.x) * fb.x + (c.z - ob.z) * fb.z);
  const points = stubRun(j, w.a, 1, cutA, ta);
  const from = points.length - 1;
  arc(c, FILLET, points[from]!, stubEdge(j, w.b, -1, tb), points);
  points.push(stubEdge(j, w.b, -1, tb));
  const crescent = crescentOf(points, from, { x: w.px, z: w.pz });
  points.push(...stubRun(j, w.b, -1, tb, cutB).slice(1));
  return { outline: { points }, crescent };
}

interface RouteStub {
  outline: KerbOutline;
  side: 1 | -1;
  role: 'in' | 'out';
  cut: number;
  /** The kerb return's crescent: the mouth corner where the arm's edge meets the route's, then the return itself. */
  crescent: Pt[];
  apron?: Apron;
}

/** First crossing of `g` from inside (≤ 0) to outside (> 0) walking `t` from `t0` to `t1`, bisected; NaN when none. */
function firstCrossing(
  g: (t: number) => number,
  t0: number,
  t1: number,
  accept?: (t: number) => boolean,
): number {
  let prev = g(t0);
  for (let t = t0 + SEARCH_STEP; t <= t1; t += SEARCH_STEP) {
    const v = g(t);
    if (prev <= 0 && v > 0) {
      let lo = t - SEARCH_STEP;
      let hi = t;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (g(mid) <= 0) lo = mid;
        else hi = mid;
      }
      const tc = (lo + hi) / 2;
      if (!accept || accept(tc)) return tc;
    }
    prev = v;
  }
  return NaN;
}

/**
 * Where a blocked arm's edge (`sign` 1 left, -1 right) meets the route's
 * carriageway, as a parameter along the arm: walking back from the cut,
 * where the arm is clear of the ribbon, to the first point inside it. A
 * straight-on arm's edge may run along the arriving road and cross it
 * again further back, so the walk stops at the first crossing; `onArm`
 * additionally requires it to lie on the given side of the junction's apex
 * (before it for the arriving arm, after it for the leaving one). NaN when
 * there is none.
 */
function mouthCorner(
  j: Junction,
  arm: Arm,
  sign: 1 | -1,
  stage: RoadWidthSource,
  routeHalfWidth: number,
  cut: number,
  hit: RoadHit,
  onArm?: { role: 'in' | 'out'; apex: number },
): number {
  const o = at(j, arm.heading, 0, sign * arm.halfWidth);
  const f = forward(arm.heading);
  const g = (t: number) =>
    stage.path.nearest(o.x + f.x * t, o.z + f.z * t, 60, hit)
      ? hit.distance - halfWidthAt(stage, hit.along)
      : Infinity;
  let prev = g(cut);
  for (let t = cut - SEARCH_STEP; t >= -(routeHalfWidth + 20); t -= SEARCH_STEP) {
    const v = g(t);
    if (v <= 0 && prev > 0) {
      let lo = t;
      let hi = t + SEARCH_STEP;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (g(mid) <= 0) lo = mid;
        else hi = mid;
      }
      const tc = (lo + hi) / 2;
      if (!onArm) return tc;
      stage.path.nearest(o.x + f.x * tc, o.z + f.z * tc, 60, hit);
      if (onArm.role === 'in' ? hit.along < onArm.apex : hit.along > onArm.apex) return tc;
    }
    prev = v;
  }
  return NaN;
}

/**
 * Kerb between a blocked arm and the route: the fillet centre lies a radius
 * off the arm's edge and a radius off the route's (curved) edge, found by
 * walking out along the arm; the kerb runs from the arm's cut, round the
 * return, then along the route's edge to where the ribbon takes over.
 */
function routeStub(
  j: Junction,
  w: Wedge,
  stage: RoadWidthSource,
  routeHalfWidth: number,
  apex: number,
  hit: RoadHit,
): RouteStub {
  const stub = w.a.role === 'blocked' ? w.a : w.b;
  const route = stub === w.a ? w.b : w.a;
  const sign: 1 | -1 = stub === w.a ? 1 : -1;
  const role = route.role === 'in' ? 'in' : 'out';
  // The wedge lies left of `a` and right of `b`; an arm pointing back up the route has the route's right on its left.
  const side: 1 | -1 = (route === w.a) === (route.role === 'out') ? 1 : -1;
  const cut = stubCut(j, stub, routeHalfWidth);
  // At a corner a blocked arm continues the route's arm straight through the junction: their
  // edges share a line, the bend's arc only leaves it at its tangent, and the apron between
  // is that arm's mouth. The kerb then follows the shared line, not the arc.
  const through = throughArm(j, route);
  if (through)
    return straightThrough(j, w, stub, route, through, sign, side, role, stage, cut, hit);
  const f = forward(stub.heading);
  const oc = at(j, stub.heading, 0, sign * (stub.halfWidth + FILLET));
  const gap = (t: number) => {
    if (!stage.path.nearest(oc.x + f.x * t, oc.z + f.z * t, 60, hit)) return Infinity;
    return hit.distance - halfWidthAt(stage, hit.along) - FILLET;
  };
  // Walk out along the arm; at each crossing from within a radius of the route's edge to
  // beyond it, the centre is tangent to the route somewhere. Take the first crossing whose
  // tangent falls on this wedge's own arm of the route (before the junction for the arriving
  // arm, after it for the leaving one): at a sharp corner the line brushes the other arm first.
  const tStar = firstCrossing(gap, -(routeHalfWidth + FILLET + 3), cut, (tc) => {
    stage.path.nearest(oc.x + f.x * tc, oc.z + f.z * tc, 60, hit);
    return role === 'in' ? hit.along < apex - 0.5 : hit.along > apex + 0.5;
  });
  // The crescent fans out from where this edge meets the wedge's own arm of the route.
  const tMouth = mouthCorner(j, stub, sign, stage, routeHalfWidth, cut, hit, { role, apex });
  const mouth = stubEdge(j, stub, sign, Number.isNaN(tMouth) ? Math.min(tStar, cut - 0.1) : tMouth);
  let points: KerbPoint[];
  let dr: number;
  let crescent: Pt[] = [];
  if (Number.isNaN(tStar)) {
    // No return fits: a sharp kerb corner where the two edges meet.
    stage.path.nearest(w.px, w.pz, 60, hit);
    dr = hit.along;
    const corner = stubEdge(j, stub, sign, 0);
    points = stubRun(j, stub, sign, cut, (w.px - j.x) * f.x + (w.pz - j.z) * f.z);
    points.push({ ...corner, x: w.px, z: w.pz });
  } else {
    const c = { x: oc.x + f.x * tStar, z: oc.z + f.z * tStar };
    points = stubRun(j, stub, sign, cut, Math.min(tStar, cut - 0.1));
    stage.path.nearest(c.x, c.z, 60, hit);
    dr = hit.along;
    const tr = routeEdge(stage, dr, side, 0);
    const from = points.length - 1;
    arc(c, FILLET, points[from]!, tr, points);
    points.push(tr);
    crescent = crescentOf(points, from, mouth);
  }
  const dCut = role === 'in' ? dr - CUT_MARGIN : dr + CUT_MARGIN;
  const dir = role === 'in' ? -1 : 1;
  for (let d = dr + dir * EDGE_STEP; dir > 0 ? d < dCut : d > dCut; d += dir * EDGE_STEP)
    points.push(routeEdge(stage, d, side, 0));
  points.push(routeEdge(stage, dCut, side, 0));
  return { outline: { points }, side, role, cut: dCut, crescent };
}

/** Where line `pa + da·t` meets line `pb + db·s`, with `t`; null when parallel. */
export function meet(pa: Pt, da: Pt, pb: Pt, db: Pt): (Pt & { t: number }) | null {
  const det = da.x * -db.z - da.z * -db.x;
  if (Math.abs(det) < 1e-9) return null;
  const rx = pb.x - pa.x;
  const rz = pb.z - pa.z;
  const t = (rx * -db.z - rz * -db.x) / det;
  return { x: pa.x + da.x * t, z: pa.z + da.z * t, t };
}

/**
 * Kerb between a blocked arm and a route arm that another blocked arm
 * continues straight. The apron's edge is the ribbon's own edge line from
 * beyond the bend's tangent, continued toward the junction; the kerb return
 * is the classic fillet between it and the blocked arm's edge, and the kerb
 * then follows the apron's edge to the tangent, where the ribbon takes over.
 */
function straightThrough(
  j: Junction,
  w: Wedge,
  stub: Arm,
  route: Arm,
  through: Arm,
  sign: 1 | -1,
  side: 1 | -1,
  role: 'in' | 'out',
  stage: RoadWidthSource,
  cut: number,
  hit: RoadHit,
): RouteStub {
  // The apron's edge is the through arm's own edge line, continued back along the route arm; the
  // straight is pinned to that line to within a metre of the arc, and keeps the corner's width,
  // so the ribbon's edge lies on it where it hands over.
  const f = forward(route.heading);
  const routeSign: 1 | -1 = route === w.a ? 1 : -1;
  const l = left(route.heading);
  const nL = { x: l.x * routeSign, z: l.z * routeSign };
  const o = at(j, route.heading, 0, routeSign * through.halfWidth);
  const onLine = (t: number): KerbPoint => ({
    x: o.x + f.x * t,
    z: o.z + f.z * t,
    nx: nL.x,
    nz: nL.z,
  });
  const fs = forward(stub.heading);
  const ls = left(stub.heading);
  const oStub = at(j, stub.heading, 0, sign * stub.halfWidth);
  const mouth = meet(oStub, fs, o, f) ?? { x: w.px, z: w.pz, t: 0 };
  const c = meet(
    { x: oStub.x + ls.x * sign * FILLET, z: oStub.z + ls.z * sign * FILLET },
    fs,
    { x: o.x + nL.x * FILLET, z: o.z + nL.z * FILLET },
    f,
  ) ?? { x: mouth.x, z: mouth.z, t: 0 };
  const ts = Math.min((c.x - oStub.x) * fs.x + (c.z - oStub.z) * fs.z, cut - 0.1);
  const tr = (c.x - o.x) * f.x + (c.z - o.z) * f.z;
  const trPt = onLine(tr);
  const points = stubRun(j, stub, sign, cut, ts);
  const from = points.length - 1;
  arc(c, FILLET, points[from]!, trPt, points);
  points.push(trPt);
  const crescent = crescentOf(points, from, mouth);
  // Along the apron's edge past the arc's tangent, in pieces, to where the ribbon takes over
  // (the same distance the carriageway's width is held to).
  const tEnd = apronEnd(j, w, route, stub, through);
  const n = Math.max(1, Math.ceil((tEnd - tr) / STUB_STEP));
  for (let k = 1; k < n; k++) points.push(onLine(tr + ((tEnd - tr) * k) / n));
  stage.path.nearest(o.x + f.x * tEnd, o.z + f.z * tEnd, 60, hit);
  const dCut = hit.along;
  const e1 = onLine(tEnd);
  const u = { x: -f.x, z: -f.z };
  const handoff = routeEdge(stage, dCut, side, 0);
  points.push(handoff);
  // The route arm's edge is the through arm's opposite edge: the apron's side of that arm.
  const apron: Apron = {
    arm: through,
    route,
    sign: -routeSign as 1 | -1,
    side,
    e1,
    u,
    back: -MOUTH_OVERLAP,
    knee: tEnd,
    cut: dCut,
    handoff,
  };
  return { outline: { points }, side, role, cut: dCut, crescent, apron };
}

/** Every kerb outline of a junction, the stretches of the route it takes over per side, and its paved ground. */
export function junctionKerbs(
  j: Junction,
  stage: RoadWidthSource,
  routeHalfWidth: number,
): JunctionKerbs {
  const hit = createRoadHit();
  const outlines: KerbOutline[] = [];
  const polygons: Pt[][] = [];
  const aprons: Apron[] = [];
  const bounds = {
    left: { from: Infinity, to: -Infinity },
    right: { from: Infinity, to: -Infinity },
  };
  // Where the route passes the junction: a corner's arc apex, a crossroads' centre.
  stage.path.nearest(j.x, j.z, 60, hit);
  const apex = hit.along;
  for (const w of wedges(j)) {
    const aBlocked = w.a.role === 'blocked';
    const bBlocked = w.b.role === 'blocked';
    if (!aBlocked && !bBlocked) continue;
    if (aBlocked && bBlocked) {
      const ss = stubStub(j, w, routeHalfWidth);
      outlines.push(ss.outline);
      polygons.push(ss.crescent);
      continue;
    }
    const r = routeStub(j, w, stage, routeHalfWidth, apex, hit);
    outlines.push(r.outline);
    if (r.crescent.length > 2) polygons.push(r.crescent);
    if (r.apron) aprons.push(r.apron);
    const b = r.side === 1 ? bounds.left : bounds.right;
    if (r.role === 'in') b.from = Math.min(b.from, r.cut);
    else b.to = Math.max(b.to, r.cut);
  }
  const openings: Openings = { left: [], right: [] };
  for (const side of ['left', 'right'] as const) {
    const b = bounds[side];
    if (!Number.isFinite(b.from) && !Number.isFinite(b.to)) continue;
    // A junction normally cuts the ribbon on both sides of its mouth; fall back to a span round the junction otherwise.
    const span = routeHalfWidth + FILLET + 2;
    openings[side].push({
      from: Number.isFinite(b.from) ? b.from : apex - span,
      to: Number.isFinite(b.to) ? b.to : apex + span,
    });
  }
  // Each blocked arm's mouth: from where its edges leave the ribbon (a little under it) to its cut.
  // A straight-through arm's apron side follows the ribbon's edge line instead, back to the bend's
  // tangent, as a polygon of its own behind the junction; its strip then starts at the junction.
  for (const arm of j.arms) {
    if (arm.role !== 'blocked') continue;
    const cut = stubCut(j, arm, routeHalfWidth);
    const corner = (sign: 1 | -1, t: number) => {
      const p = stubEdge(j, arm, sign, t);
      return { x: p.x, z: p.z };
    };
    const apron = aprons.find((a) => a.arm === arm);
    if (apron) {
      const along = (sAlong: number): Pt => ({
        x: apron.e1.x + apron.u.x * sAlong,
        z: apron.e1.z + apron.u.z * sAlong,
      });
      const other = -apron.sign as 1 | -1;
      const reach = apron.knee - apron.back;
      // The apron reaches a seam past the junction, over the start of the arm's strip.
      const f = forward(arm.heading);
      const past = (p: Pt): Pt => ({ x: p.x + f.x * SEAM, z: p.z + f.z * SEAM });
      polygons.push([
        along(apron.back),
        corner(other, -(reach + MOUTH_OVERLAP)),
        past(corner(other, 0)),
        past(along(apron.knee)),
      ]);
      polygons.push([corner(1, 0), corner(-1, 0), corner(-1, cut), corner(1, cut)]);
      continue;
    }
    const exit = (sign: 1 | -1) => {
      const t = mouthCorner(j, arm, sign, stage, routeHalfWidth, cut, hit);
      return (Number.isNaN(t) ? 0 : t) - MOUTH_OVERLAP;
    };
    polygons.push([corner(1, exit(1)), corner(-1, exit(-1)), corner(-1, cut), corner(1, cut)]);
  }
  return { outlines, openings, surface: surfaceOf(j, polygons), aprons };
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

function surfaceOf(j: Junction, polygons: Pt[][]): JunctionSurface {
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

/** Where the ribbon leaves its verges and lines to the town's junctions, per side, in path order. */
export function routeOpenings(town: TownDef, stage: RoadWidthSource): Openings {
  const out: Openings = { left: [], right: [] };
  for (const j of town.junctions) {
    const k = junctionKerbs(j, stage, stage.halfWidth);
    out.left.push(...k.openings.left);
    out.right.push(...k.openings.right);
  }
  out.left.sort((p, q) => p.from - q.from);
  out.right.sort((p, q) => p.from - q.from);
  return out;
}
