import type { UrbanDef } from './regions';
import { MEDIAN_HALF, type Median } from './Median';
import { createRoadHit, type RoadPath } from './RoadPath';
import { ringChords, ringOuterRadius, ringPoint, ringSweep, type Roundabout } from './Roundabout';
import type { Junction, Street } from './Town';
import { junctionKerbs } from './TownKerbs';
import { boxArmCut } from './JunctionBox';
import { junctionReach, junctionTurn } from './TownJunctions';
import { tangentLength } from './TownPlan';
import { applyPlan, planStub, stubSite, type StubSite } from './TownSideStreets';
import { PAVEMENT_WIDTH, segmentDistance } from './Town';
import { ROW_SETBACK } from './TownSideStreets';
import { halfWidthAt, type RoadWidthSource } from './RoadWidth';
import { at, type Facade, type Site } from './TownTerraces';
import type { CityMap } from './city/CityMap';
import { ringExits } from './city/CityNetwork';
import { TRAM_BED_HALF, type TramLine } from './Tram';
import { crossroadsStreets, type TracedLeg } from './TownGenerator';

/**
 * What a city adds to the village layout (see `TownGenerator.layoutTown`,
 * which calls these when the stage is urban): crossroads every block along
 * the long legs, the roundabouts the plan drew as curve legs, trams, and the
 * greenery on each island. Pure TS, deterministic from the site's RNG.
 */

/** A city's blocked side streets run this far from their junctions (a village's run 32 m), so the city reads on past the route. */
export const CITY_STUB_LENGTH = 150;
/** Medians: how far from a straight's ends and from a crossroads' reach the divider stops, the first starts past the start gantry, and the shortest piece kept. */
const MEDIAN_END = 6;
const MEDIAN_JUNCTION_MARGIN = 8;
const MEDIAN_FIRST = 45;
const MEDIAN_MIN = 8;
/** Crossroads along a city block at least this long, about every `CROSSROADS_SPACING`. */
const CROSSROADS_MIN = 110;
const CROSSROADS_SPACING = 75;
/** Garden walls round a ring's outer pavement run in chords this long, and keep this clear of the route's pavement where it leaves the ring. */
const RING_WALL_CHORD = 3;
const RING_WALL_ROUTE_GAP = 1.2;
/** A blocked exit keeps this far round the ring from where the route joins and leaves it. */
const EXIT_CLEARANCE = (50 * Math.PI) / 180;
/** Trams: how many crossings a city gets at most, and how far from a roundabout they stay. */
const MAX_TRAM_CROSSINGS = 5;
const TRAM_ROUNDABOUT_CLEARANCE = 45;
/** A tram line stops this short of a side street's end, under the pavement across it. */
const TRAM_END = 1;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Side streets square to a long block, about every 75 m, where they fit among those already planned. */
export function cityCrossroads(site: Site, stubs: StubSite[], legs: readonly TracedLeg[]): void {
  for (const leg of legs) {
    if (leg.kind !== 'straight' || leg.length < CROSSROADS_MIN) continue;
    const n = Math.floor(leg.length / CROSSROADS_SPACING);
    for (let k = 1; k <= n; k++) crossroadsStreets(site, stubs, leg, (leg.length * k) / (n + 1));
  }
}

/**
 * The roundabout a curve leg circles: its centre a lane radius to the inside
 * of the arc's start, the ring's undriven remainder as chord streets, and
 * blocked exits every quarter turn from the entry where they clear the
 * route's own arms.
 */
export function cityRoundabout(
  site: Site,
  stubs: StubSite[],
  leg: TracedLeg,
  stage: RoadWidthSource,
  map?: CityMap,
): Roundabout {
  const path = stage.path;
  const p0 = leg.points[0]!;
  const p1 = leg.points[leg.points.length - 1]!;
  const sense: 1 | -1 = leg.sweep >= 0 ? 1 : -1;
  const c = at(p0, leg.headingIn, 0, sense * leg.radius);
  const hit = createRoadHit();
  path.nearest(p0.x, p0.z, 30, hit);
  const from = hit.along;
  path.nearest(p1.x, p1.z, 30, hit);
  const to = hit.along;
  const r: Roundabout = {
    x: c.x,
    z: c.z,
    islandRadius: leg.roundabout!.islandRadius,
    halfWidth: leg.radius - leg.roundabout!.islandRadius,
    from,
    to,
    angleIn: Math.atan2(p0.x - c.x, p0.z - c.z),
    angleOut: Math.atan2(p1.x - c.x, p1.z - c.z),
    sense,
    exits: [],
  };
  const chords: Street[] = ringChords(r);
  site.streets.push(...chords);
  // A mapped city's exits are its streets to the crossroads round the ring (`cityNetwork` lays them).
  // Its frontage is the city's (`CityFrontage`), round the ring's pavement like every other.
  if (map) {
    r.exits.push(...ringExits(map, r));
    return r;
  }
  for (let k = 1; k <= 3; k++) {
    const a = r.angleIn + (sense * k * Math.PI) / 2;
    // Clear of the route's entry and exit, and on the undriven part of the ring.
    if (Math.abs(wrap(a - r.angleOut)) < EXIT_CLEARANCE) continue;
    if (Math.abs(wrap(a - r.angleIn)) < EXIT_CLEARANCE) continue;
    if (ringSweep(r, r.angleOut, a) > ringSweep(r, r.angleOut, r.angleIn)) continue;
    const s = stubSite(
      ringPoint(r, a, ringOuterRadius(r)),
      a,
      r.halfWidth,
      undefined,
      CITY_STUB_LENGTH,
    );
    const plan = planStub(stubs, s, false);
    if (!plan) continue;
    applyPlan(s, plan);
    stubs.push(s);
    r.exits.push(a);
  }
  ringWalls(site, r, stage);
  return r;
}

/**
 * The lines behind a ring's outer pavement, laid as walls: along the ring's
 * facade in chords, broken for every exit and wherever the route's own
 * pavement runs beside it, and down each exit's facades from the ring to
 * where its terrace rows begin. The city turns them into terraces once its
 * streets are all known (`wallsToTerraces`); what cannot take a building
 * keeps its wall.
 */
function ringWalls(site: Site, r: Roundabout, stage: RoadWidthSource): void {
  const outer = ringOuterRadius(r);
  const facade = outer + PAVEMENT_WIDTH;
  const hit = createRoadHit();
  const path = stage.path;
  // Each mouth, as the half angle it takes of the facade circle: an exit's facade walls start
  // exactly where its facade lines meet the circle, so the arcs run up to them without a slit.
  const mouth = Math.asin(Math.min(1, (r.halfWidth + PAVEMENT_WIDTH) / facade));
  const mouths = [...r.exits, r.angleIn, r.angleOut];
  const inMouth = (a: number) => mouths.some((m) => Math.abs(wrap(a - m)) < mouth - 1e-6);
  // The free arcs between mouths, each laid in chords from edge to edge.
  const edges = mouths.flatMap((m) => [m - mouth, m + mouth]).map((a) => wrap(a));
  edges.sort((p, q) => p - q);
  for (let i = 0; i < edges.length; i++) {
    const a0 = edges[i]!;
    const a1 = i + 1 < edges.length ? edges[i + 1]! : edges[0]! + Math.PI * 2;
    if (a1 - a0 < 1e-6 || inMouth((a0 + a1) / 2)) continue;
    const n = Math.max(1, Math.ceil(((a1 - a0) * facade) / RING_WALL_CHORD));
    for (let k = 0; k < n; k++) {
      const b0 = a0 + ((a1 - a0) * k) / n;
      const b1 = a0 + ((a1 - a0) * (k + 1)) / n;
      const mid = ringPoint(r, (b0 + b1) / 2, facade);
      // Not where the route's pavement runs along or across the facade.
      if (
        path.nearest(mid.x, mid.z, 40, hit) &&
        hit.distance < halfWidthAt(stage, hit.along) + PAVEMENT_WIDTH + RING_WALL_ROUTE_GAP
      )
        continue;
      const p = ringPoint(r, b0, facade);
      const q = ringPoint(r, b1, facade);
      site.walls.push({ x0: p.x, z0: p.z, x1: q.x, z1: q.z });
    }
  }
  for (const e of r.exits) {
    const u = { x: Math.sin(e), z: Math.cos(e) };
    const l = { x: Math.cos(e), z: -Math.sin(e) };
    const o = ringPoint(r, e, outer);
    for (const side of [1, -1] as const) {
      const lat = (r.halfWidth + PAVEMENT_WIDTH) * side;
      // The facade corner: where the exit's facade line meets the ring's facade circle.
      const t0 = Math.sqrt(Math.max(0, facade * facade - lat * lat)) - outer;
      const a = { x: o.x + u.x * t0 + l.x * lat, z: o.z + u.z * t0 + l.z * lat };
      const b = {
        x: o.x + u.x * ROW_SETBACK + l.x * lat,
        z: o.z + u.z * ROW_SETBACK + l.z * lat,
      };
      site.walls.push({ x0: a.x, z0: a.z, x1: b.x, z1: b.z });
    }
  }
}

/** Where the route's inner facade must leave the island bare: the facade distances of the arc's ends, a little either side. */
export function islandGap(r: Roundabout, facade: Facade): [number, number] {
  const inner = r.islandRadius - 2;
  const a = facade.nearest(...xz(ringPoint(r, r.angleIn, inner)));
  const b = facade.nearest(...xz(ringPoint(r, r.angleOut, inner)));
  return [Math.min(a.s, b.s) - 2, Math.max(a.s, b.s) + 2];
}

const xz = (p: { x: number; z: number }): [number, number] => [p.x, p.z];

/** The side street leaving `o` on `heading`, if one was laid. */
function stubFrom(site: Site, o: { x: number; z: number }, heading: number): Street | undefined {
  for (const s of site.streets) {
    if (s.route) continue;
    if (
      Math.hypot(s.x0 - o.x, s.z0 - o.z) < 0.05 &&
      Math.abs(wrap(Math.atan2(s.x1 - s.x0, s.z1 - s.z0) - heading)) < 0.02
    )
      return s;
    // A mapped city's street between two route crossroads may run from the far one: read it back.
    if (
      Math.hypot(s.x1 - o.x, s.z1 - o.z) < 0.05 &&
      Math.abs(wrap(Math.atan2(s.x0 - s.x1, s.z0 - s.z1) - heading)) < 0.02
    )
      return { ...s, x0: s.x1, z0: s.z1, x1: s.x0, z1: s.z0 };
  }
  return undefined;
}

/** The point `TRAM_END` short of a side street's far end. */
function stubEnd(s: Street): { x: number; z: number } {
  const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0);
  const t = Math.max(0, len - TRAM_END) / len;
  return { x: s.x0 + (s.x1 - s.x0) * t, z: s.z0 + (s.z1 - s.z0) * t };
}

/**
 * Tram lines: across the route at some crossroads, from the end of one side
 * street through the junction to the end of the other. None near a
 * roundabout; none along the route, whose boulevards carry green medians.
 */
export function cityTrams(
  site: Site,
  roundabouts: readonly Roundabout[],
  rand: () => number,
): TramLine[] {
  const out: TramLine[] = [];
  const nearRing = (x: number, z: number) =>
    roundabouts.some((r) => Math.hypot(r.x - x, r.z - z) < TRAM_ROUNDABOUT_CLEARANCE);
  // Every crossroads clear of the rings is a candidate; about half are taken, and at least one.
  const candidates: [Street, Street][] = [];
  // How square on each candidate crosses the route (1 = at right angles).
  const square: number[] = [];
  for (const j of site.junctions) {
    const inArm = j.arms.find((a) => a.role === 'in');
    const outArm = j.arms.find((a) => a.role === 'out');
    // Straight through, give or take a mapped city's gentle bend at its crossroads.
    if (!inArm || !outArm || Math.abs(wrap(outArm.heading - inArm.heading - Math.PI)) > 0.2)
      continue;
    const blocked = j.arms.filter((a) => a.role === 'blocked');
    if (blocked.length !== 2 || nearRing(j.x, j.z)) continue;
    const a = stubFrom(site, j, blocked[0]!.heading);
    const b = stubFrom(site, j, blocked[1]!.heading);
    if (a && b) {
      candidates.push([a, b]);
      square.push(Math.abs(Math.sin(blocked[0]!.heading - inArm.heading)));
    }
  }
  const picked = candidates.map(() => rand() < 0.5);
  // At least one line crosses the route square on (or as near as any crossroads does).
  const squarest = square.indexOf(Math.max(...square));
  if (squarest >= 0 && !picked.some((p, i) => p && square[i]! > SQUARE_ON)) picked[squarest] = true;
  const chosen = candidates.filter((_, i) => picked[i]).slice(0, MAX_TRAM_CROSSINGS);
  if (squarest >= 0 && !chosen.includes(candidates[squarest]!))
    chosen[chosen.length - 1] = candidates[squarest]!;
  for (const [a, b] of chosen) {
    const pa = stubEnd(a);
    const pb = stubEnd(b);
    out.push({ x0: pa.x, z0: pa.z, x1: pb.x, z1: pb.z });
  }
  return out;
}

/** A tram line this square on to the route (|sin| of the angle) counts as crossing it at right angles. */
const SQUARE_ON = 0.95;

/** A junction corner without a junction to measure (none in practice) changes the route's width over this middle share of its arc. */
const CORNER_CHANGE = 0.4;
/** A roundabout's deflection changes width over this share of its arc at the end away from the ring. */
const DEFLECTION_CHANGE = 0.4;
/**
 * Where a wider street meets a narrower one at a junction corner, the
 * junction takes the narrower width: it holds from `JUNCTION_HOLD` beyond
 * where the junction's kerbs hand over to the ribbon on either side (room
 * for the crossing and its stop line), and the wider street drops its lanes
 * over `LANE_TAPER` before that, so no kerb steps inside the junction.
 */
export const LANE_TAPER = 30;
export const JUNCTION_HOLD = 6;

/**
 * Half width per path sample from the traced legs: every straight holds its
 * own width along its length; a curve (a roundabout's deflection) eases
 * over its whole length; a corner between streets of two widths holds the
 * narrower through its junction and tapers the wider down to it outside
 * (see `LANE_TAPER`), given the junctions to measure the hold from; without
 * them it eases over the middle of its arc. `base` before the first leg and
 * after the last (both boulevards).
 */
export function traceWidths(
  path: RoadPath,
  legs: readonly TracedLeg[],
  base: number,
  junctions?: readonly Junction[],
): Float64Array {
  const w = new Float64Array(path.count).fill(base);
  const hit = createRoadHit();
  const along = (p: { x: number; z: number }) =>
    path.nearest(p.x, p.z, 30, hit) ? hit.along : NaN;
  const ends: [number, number][] = legs.map((leg) => [
    along(leg.points[0]!),
    along(leg.points[leg.points.length - 1]!),
  ]);
  const own = (leg: TracedLeg) => leg.kind === 'straight' || leg.roundabout !== undefined;
  // Every street and ring at its own width first, then the corners and deflections over them.
  legs.forEach((leg, k) => {
    const [a0, a1] = ends[k]!;
    if (!own(leg) || Number.isNaN(a0) || Number.isNaN(a1) || a1 <= a0) return;
    const i0 = Math.max(0, Math.ceil(a0 / path.spacing));
    const i1 = Math.min(path.count - 1, Math.floor(a1 / path.spacing));
    for (let i = i0; i <= i1; i++) w[i] = leg.halfWidth;
  });
  // The junction corners' holds first, so each one's taper can stop short of a neighbour's hold.
  interface Hold {
    k: number;
    lo: number;
    hi: number;
    narrow: number;
    wide: number;
    /** Which side the wider street lies: -1 before the junction, 1 after. */
    wideSide: -1 | 1;
    /** A square junction's own taper length, inside its paving. */
    taper?: number;
  }
  const holds: Hold[] = [];
  legs.forEach((leg, k) => {
    const [a0, a1] = ends[k]!;
    if (leg.kind !== 'corner' || !leg.corner || Number.isNaN(a0) || Number.isNaN(a1) || a1 <= a0)
      return;
    const from = legs[k - 1]?.halfWidth ?? leg.halfWidth;
    const to = legs[k + 1]?.halfWidth ?? leg.halfWidth;
    if (Math.abs(from - to) < 1e-9) return;
    const j = junctions?.find((q) => Math.hypot(q.x - leg.corner!.x, q.z - leg.corner!.z) < 0.5);
    if (!j) return;
    const wideSide = from > to ? -1 : 1;
    if (j.box) {
      // A square junction (`JunctionBox`): the narrower width round the arc only, the wider
      // street's taking over inside the junction's paving, between the arc's tangent and the arm's
      // cut, so each street keeps its lanes from junction to junction.
      const wideArm = j.arms.find((a) => a.role === (wideSide > 0 ? 'out' : 'in'))!;
      const room = boxArmCut(j, wideArm, base) - tangentLength(junctionTurn(j), j.radius);
      holds.push({
        k,
        lo: a0,
        hi: a1,
        narrow: Math.min(from, to),
        wide: Math.max(from, to),
        wideSide,
        taper: Math.max(0.5, room - 0.5),
      });
      return;
    }
    const mid = (a0 + a1) / 2;
    const hold = junctionReach(j) + JUNCTION_HOLD;
    holds.push({
      k,
      lo: mid - hold,
      hi: mid + hold,
      narrow: Math.min(from, to),
      wide: Math.max(from, to),
      wideSide,
    });
  });
  for (const h of holds) {
    // The taper runs `LANE_TAPER` beyond the hold on the wider side, or as far as the next
    // junction's hold if that comes first. Only ever narrows, so overlaps settle on the narrowest.
    let taper = h.taper ?? LANE_TAPER;
    for (const o of holds) {
      if (o === h) continue;
      if (h.wideSide > 0 && o.lo > h.hi) taper = Math.min(taper, o.lo - h.hi);
      if (h.wideSide < 0 && o.hi < h.lo) taper = Math.min(taper, h.lo - o.hi);
    }
    taper = Math.max(1, taper);
    const lo = h.wideSide < 0 ? h.lo - taper : h.lo;
    const hi = h.wideSide > 0 ? h.hi + taper : h.hi;
    const i0 = Math.max(0, Math.ceil(lo / path.spacing));
    const i1 = Math.min(path.count - 1, Math.floor(hi / path.spacing));
    for (let i = i0; i <= i1; i++) {
      const d = i * path.spacing;
      const out = d < h.lo ? h.lo - d : d > h.hi ? d - h.hi : 0;
      const t = Math.min(1, out / taper);
      w[i] = Math.min(w[i]!, h.narrow + (h.wide - h.narrow) * t);
    }
  }
  const held = new Set(holds.map((h) => h.k));
  legs.forEach((leg, k) => {
    const [a0, a1] = ends[k]!;
    if (own(leg) || held.has(k) || Number.isNaN(a0) || Number.isNaN(a1) || a1 <= a0) return;
    const from = legs[k - 1]?.halfWidth ?? leg.halfWidth;
    const to = legs[k + 1]?.halfWidth ?? leg.halfWidth;
    const i0 = Math.max(0, Math.ceil(a0 / path.spacing));
    const i1 = Math.min(path.count - 1, Math.floor(a1 / path.spacing));
    // A roundabout's deflections change width away from the ring: with the change spread over the
    // whole arc the carriageway is still wider than the ring lane right before the join, while its
    // centre is almost on the lane radius, and its inner edge bites into the island.
    const intoRing = leg.kind === 'curve' && legs[k + 1]?.roundabout !== undefined;
    const offRing = leg.kind === 'curve' && legs[k - 1]?.roundabout !== undefined;
    for (let i = i0; i <= i1; i++) {
      let t = (i * path.spacing - a0) / (a1 - a0);
      if (leg.kind === 'corner')
        t = Math.min(1, Math.max(0, (t - (1 - CORNER_CHANGE) / 2) / CORNER_CHANGE));
      else if (intoRing) t = Math.min(1, t / DEFLECTION_CHANGE);
      else if (offRing) t = Math.max(0, (t - (1 - DEFLECTION_CHANGE)) / DEFLECTION_CHANGE);
      const e = t * t * (3 - 2 * t);
      w[i] = from + (to - from) * e;
    }
  });
  return w;
}

/**
 * Green dividers down the middle of every boulevard: along each four-lane
 * straight from a little after its start to a little before its end, broken
 * round every crossroads on it, never before `MEDIAN_FIRST` metres of road
 * (the start gantry and the grid stand on plain tarmac).
 */
export function cityMedians(
  site: Site,
  legs: readonly TracedLeg[],
  stage: RoadWidthSource,
  def: UrbanDef,
  trams: readonly TramLine[] = [],
): Median[] {
  const out: Median[] = [];
  // No median where a tram runs down the street: the rails take the middle.
  const onRails = (x: number, z: number) =>
    trams.some(
      (t) => segmentDistance(t.x0, t.z0, t.x1, t.z1, x, z) < MEDIAN_HALF + TRAM_BED_HALF + 1,
    );
  const hit = createRoadHit();
  const path = stage.path;
  for (const leg of legs) {
    if (leg.kind !== 'straight' || leg.halfWidth < def.lanes.four - 1e-6) continue;
    const o = leg.points[0]!;
    const h = leg.headingIn;
    const f = { x: Math.sin(h), z: Math.cos(h) };
    const along0 = path.nearest(o.x, o.z, 30, hit) ? hit.along : NaN;
    // Breaks: the straight's ends, and each crossroads on it: the span of the route its paving
    // takes (where the ribbon hands its verges to the junction), the crossings beyond that span,
    // and a margin.
    const breaks: [number, number][] = [];
    for (const j of site.junctions) {
      const t = (j.x - o.x) * f.x + (j.z - o.z) * f.z;
      const off = Math.abs((j.x - o.x) * f.z - (j.z - o.z) * f.x);
      if (off > 0.5 || t < -1 || t > leg.length + 1) continue;
      const k = junctionKerbs(j, stage, stage.halfWidth);
      const all = [...k.openings.left, ...k.openings.right];
      if (all.length === 0 || Number.isNaN(along0)) {
        const reach = junctionReach(j) + MEDIAN_JUNCTION_MARGIN;
        breaks.push([t - reach, t + reach]);
        continue;
      }
      breaks.push([
        Math.min(...all.map((q) => q.from)) - along0 - MEDIAN_JUNCTION_MARGIN,
        Math.max(...all.map((q) => q.to)) - along0 + MEDIAN_JUNCTION_MARGIN,
      ]);
    }
    breaks.sort((p, q) => p[0] - q[0]);
    let start = MEDIAN_END;
    if (!Number.isNaN(along0)) start = Math.max(start, MEDIAN_FIRST - along0);
    const pieces: [number, number][] = [];
    for (const [b0, b1] of breaks) {
      if (b0 > start) pieces.push([start, b0]);
      start = Math.max(start, b1);
    }
    pieces.push([start, leg.length - MEDIAN_END]);
    // The breaks above are read along the straight; the junction spans are path distances, and at
    // a corner the two differ (the route's arc cuts the corner). Trim each piece in path space,
    // walking its ends in until the ribbon there lies outside every span.
    const spans = site.junctions.flatMap((j) => {
      const k = junctionKerbs(j, stage, stage.halfWidth);
      const all = [...k.openings.left, ...k.openings.right];
      return all.length
        ? [
            [
              Math.min(...all.map((q) => q.from)) - MEDIAN_JUNCTION_MARGIN,
              Math.max(...all.map((q) => q.to)) + MEDIAN_JUNCTION_MARGIN,
            ] as [number, number],
          ]
        : [];
    });
    // Also no median where the boulevard has begun dropping its lanes toward a junction.
    const inSpan = (t: number) =>
      onRails(o.x + f.x * t, o.z + f.z * t) ||
      (path.nearest(o.x + f.x * t, o.z + f.z * t, 10, hit) &&
        (spans.some(([a, b]) => hit.along > a && hit.along < b) ||
          halfWidthAt(stage, hit.along) < leg.halfWidth - 1e-3));
    for (let [t0, t1] of pieces) {
      while (t0 < t1 && inSpan(t0)) t0 += 1;
      while (t1 > t0 && inSpan(t1)) t1 -= 1;
      if (t1 - t0 < MEDIAN_MIN) continue;
      out.push({ x0: o.x + f.x * t0, z0: o.z + f.z * t0, x1: o.x + f.x * t1, z1: o.z + f.z * t1 });
    }
  }
  return out;
}
