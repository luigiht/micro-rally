import type { UrbanDef } from './regions';
import type { Median } from './Median';
import { createRoadHit, type RoadPath } from './RoadPath';
import { ringChords, ringOuterRadius, ringPoint, ringSweep, type Roundabout } from './Roundabout';
import type { Planting, Street } from './Town';
import { junctionKerbs } from './TownKerbs';
import { junctionReach } from './TownJunctions';
import { applyPlan, planStub, stubSite, type StubSite } from './TownSideStreets';
import { PAVEMENT_WIDTH } from './Town';
import { ROW_SETBACK } from './TownSideStreets';
import { halfWidthAt, type RoadWidthSource } from './RoadWidth';
import { at, type Facade, type Site } from './TownTerraces';
import type { TramLine } from './Tram';
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
/** Bushes along a median's grass, this far apart, this far in from its ends, small enough for the strip. */
const MEDIAN_BUSH_SPACING = 7;
const MEDIAN_BUSH_END = 3;
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
 * Garden walls behind a ring's outer pavement, as a junction's wedges have:
 * along the ring's facade in chords, broken for every exit and wherever the
 * route's own pavement runs beside it, and down each exit's facades from the
 * ring to where its terrace rows begin, with a bush in every corner. Without
 * them the ground between two pavements lies open and reads as a bare patch
 * beside the road.
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
      // A bush just inside the corner.
      const bx = a.x + u.x * 2.2 + l.x * side * 1.8;
      const bz = a.z + u.z * 2.2 + l.z * side * 1.8;
      site.plantings.push({
        kind: 'bush',
        x: bx,
        z: bz,
        scale: 0.6 + site.rand() * 0.4,
        rotation: site.rand() * Math.PI * 2,
        variant: site.rand() < 0.5 ? 0 : 1,
      });
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

/** A tree in the middle of each island and a ring of bushes round it. */
export function islandPlantings(rs: readonly Roundabout[], rand: () => number): Planting[] {
  const out: Planting[] = [];
  for (const r of rs) {
    out.push({
      kind: 'tree',
      x: r.x,
      z: r.z,
      scale: 1 + rand() * 0.3,
      rotation: rand() * Math.PI * 2,
      variant: rand() < 0.5 ? 0 : 1,
    });
    const n = 3 + Math.floor(rand() * 3);
    const a0 = rand() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k * Math.PI * 2) / n;
      const p = ringPoint(r, a, r.islandRadius * 0.5);
      out.push({
        kind: 'bush',
        x: p.x,
        z: p.z,
        scale: 0.7 + rand() * 0.4,
        rotation: rand() * Math.PI * 2,
        variant: rand() < 0.5 ? 0 : 1,
      });
    }
  }
  return out;
}

/** The side street leaving `o` on `heading`, if one was laid. */
function stubFrom(site: Site, o: { x: number; z: number }, heading: number): Street | undefined {
  return site.streets.find(
    (s) =>
      !s.route &&
      Math.hypot(s.x0 - o.x, s.z0 - o.z) < 0.05 &&
      Math.abs(wrap(Math.atan2(s.x1 - s.x0, s.z1 - s.z0) - heading)) < 0.02,
  );
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
export function cityTrams(site: Site, roundabouts: readonly Roundabout[]): TramLine[] {
  const out: TramLine[] = [];
  const nearRing = (x: number, z: number) =>
    roundabouts.some((r) => Math.hypot(r.x - x, r.z - z) < TRAM_ROUNDABOUT_CLEARANCE);
  // Every crossroads clear of the rings is a candidate; about half are taken, and at least one.
  const candidates: [Street, Street][] = [];
  for (const j of site.junctions) {
    const inArm = j.arms.find((a) => a.role === 'in');
    const outArm = j.arms.find((a) => a.role === 'out');
    if (!inArm || !outArm || Math.abs(wrap(outArm.heading - inArm.heading - Math.PI)) > 0.01)
      continue;
    const blocked = j.arms.filter((a) => a.role === 'blocked');
    if (blocked.length !== 2 || nearRing(j.x, j.z)) continue;
    const a = stubFrom(site, j, blocked[0]!.heading);
    const b = stubFrom(site, j, blocked[1]!.heading);
    if (a && b) candidates.push([a, b]);
  }
  const chosen = candidates.filter(() => site.rand() < 0.5).slice(0, MAX_TRAM_CROSSINGS);
  if (chosen.length === 0 && candidates.length > 0) chosen.push(candidates[0]!);
  for (const [a, b] of chosen) {
    const pa = stubEnd(a);
    const pb = stubEnd(b);
    out.push({ x0: pa.x, z0: pa.z, x1: pb.x, z1: pb.z });
  }
  return out;
}

/** A junction corner changes the route's width over this middle share of its arc, centred on the junction. */
const CORNER_CHANGE = 0.4;
/** A roundabout's deflection changes width over this share of its arc at the end away from the ring. */
const DEFLECTION_CHANGE = 0.4;

/**
 * Half width per path sample from the traced legs: every straight holds its
 * own width along its length; a corner eases from one street's width to the
 * next's over the middle of its arc, inside the junction, so both streets
 * reach the junction at their own width; a curve (a roundabout's deflection)
 * eases over its whole length. `base` before the first leg and after the
 * last (both boulevards).
 */
export function traceWidths(
  path: RoadPath,
  legs: readonly TracedLeg[],
  base: number,
): Float64Array {
  const w = new Float64Array(path.count).fill(base);
  const hit = createRoadHit();
  const along = (p: { x: number; z: number }) =>
    path.nearest(p.x, p.z, 30, hit) ? hit.along : NaN;
  for (let k = 0; k < legs.length; k++) {
    const leg = legs[k]!;
    const a0 = along(leg.points[0]!);
    const a1 = along(leg.points[leg.points.length - 1]!);
    if (Number.isNaN(a0) || Number.isNaN(a1) || a1 <= a0) continue;
    // A straight, and the arc round a roundabout's island, hold their own width; a corner or a
    // deflection eases from the previous leg's to the next's.
    const own = leg.kind === 'straight' || leg.roundabout !== undefined;
    const from = own ? leg.halfWidth : (legs[k - 1]?.halfWidth ?? leg.halfWidth);
    const to = own ? leg.halfWidth : (legs[k + 1]?.halfWidth ?? leg.halfWidth);
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
  }
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
): Median[] {
  const out: Median[] = [];
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
    const inSpan = (t: number) =>
      path.nearest(o.x + f.x * t, o.z + f.z * t, 10, hit) &&
      spans.some(([a, b]) => hit.along > a && hit.along < b);
    for (let [t0, t1] of pieces) {
      while (t0 < t1 && inSpan(t0)) t0 += 1;
      while (t1 > t0 && inSpan(t1)) t1 -= 1;
      if (t1 - t0 < MEDIAN_MIN) continue;
      out.push({ x0: o.x + f.x * t0, z0: o.z + f.z * t0, x1: o.x + f.x * t1, z1: o.z + f.z * t1 });
      for (let t = t0 + MEDIAN_BUSH_END; t <= t1 - MEDIAN_BUSH_END; t += MEDIAN_BUSH_SPACING)
        site.plantings.push({
          kind: 'bush',
          x: o.x + f.x * t,
          z: o.z + f.z * t,
          scale: 0.45 + site.rand() * 0.2,
          rotation: site.rand() * Math.PI * 2,
          variant: site.rand() < 0.5 ? 0 : 1,
        });
    }
  }
  return out;
}
