import { hashSeed, mulberry32 } from '../rng';
import { CITY_VARIANTS } from './BuildingCatalog';
import type { UrbanDef } from './regions';
import { createRoadHit, type RoadPath } from './RoadPath';
import { buildWidths, halfWidthAt } from './RoadWidth';
import { roundaboutsClear, type Roundabout } from './Roundabout';
import { FRONT_SETBACK, streetDistance, type Junction, type TownDef } from './Town';
import { junctionKerbs } from './TownKerbs';
import { tangentLength } from './TownPlan';
import {
  CITY_STUB_LENGTH,
  cityCrossroads,
  cityMedians,
  cityRoundabout,
  cityTrams,
  islandGap,
  islandPlantings,
  traceWidths,
} from './UrbanGenerator';
import { MIN_JUNCTION_TURN } from './UrbanPlan';
import { clipStubsToRoads, joinStubs } from './UrbanStreets';
import { closeWallGaps } from './TownWallGaps';
import {
  junctionWalls,
  plantCorners,
  applyPlan,
  layStub,
  planStub,
  stubSite,
  stubEnd,
  stubRows,
  type Corner,
  type RouteFacades,
  type StubSite,
} from './TownSideStreets';
import { at, polylineFacade, row, street, type Pt, type Site } from './TownTerraces';

export { STUB_LENGTH } from './TownSideStreets';
/** Entry and exit legs at least this long get a crossroads halfway along. */
export const CROSSROADS_BLOCK = 80;
/** Terraces may start this close to the town's entry and exit points. */
const EDGE_SETBACK = 4;
/** Plateau margin beyond the street grid: along the route (room for the approach ramps) and across. */
const MARGIN_U = 70;
const MARGIN_V = 40;

/** One leg of the route as the centreline builder laid it in the world; corners are the arcs between straights. */
export interface TracedLeg {
  kind: 'straight' | 'curve' | 'corner';
  /** Two points for a straight; the arc's chord points for a curve or corner. */
  points: Pt[];
  headingIn: number;
  /** Heading at the leg's end, before its corner. */
  headingOut: number;
  turn: number;
  halfWidth: number;
  radius: number;
  sweep: number;
  /** Straight length (after its corner tangents), or arc length. */
  length: number;
  /** Corners: the polygon corner the arc cuts, where the side streets meet. */
  corner?: Pt;
  /** Curves that circle a city roundabout's island. */
  roundabout?: { islandRadius: number };
}

/** Where the builder laid the town: entry point and heading, every leg, the exit point. */
export interface TownTrace {
  entry: Pt & { heading: number };
  legs: TracedLeg[];
  exit: Pt;
}

/** Long entry and exit straights carry a crossroads halfway along. */
function hasCrossroads(legs: TracedLeg[], i: number): boolean {
  const leg = legs[i]!;
  if (leg.kind !== 'straight' || (i !== 0 && i !== legs.length - 1)) return false;
  const prev = legs[i - 1];
  const next = legs[i + 1];
  const tangents =
    (prev?.kind === 'corner' ? tangentLength(prev.turn, prev.radius) : 0) +
    (next?.kind === 'corner' ? tangentLength(next.turn, next.radius) : 0);
  return leg.length + tangents >= CROSSROADS_BLOCK - 1e-6;
}

/** Junction and blocked arms of a corner: back and on along the route, straight on and across blocked. */
function cornerStreets(
  site: Site,
  stubs: StubSite[],
  legs: TracedLeg[],
  i: number,
  first: boolean,
) {
  const leg = legs[i]!;
  const c = leg.corner!;
  const hin = leg.headingIn;
  const hout = leg.headingOut;
  const junction: Junction = {
    x: c.x,
    z: c.z,
    arms: [
      { heading: hin + Math.PI, halfWidth: legs[i - 1]?.halfWidth ?? leg.halfWidth, role: 'in' },
      { heading: hout, halfWidth: legs[i + 1]?.halfWidth ?? leg.halfWidth, role: 'out' },
      { heading: hin, halfWidth: leg.halfWidth, role: 'blocked' },
      { heading: hout + Math.PI, halfWidth: leg.halfWidth, role: 'blocked' },
    ],
    radius: leg.radius,
  };
  site.junctions.push(junction);
  // The first corner's blocked straight ends in the town hall, the landmark the driver brakes toward,
  // and carries the direction board. A corner cannot do without its streets: each is fitted among
  // those already planned, cut down to what fits if it must.
  const on = stubSite(c, hin, leg.halfWidth, first ? 'hall' : undefined, site.stubLength);
  on.arrowTurn = leg.turn > 0 ? 1 : -1;
  for (const s of [on, stubSite(c, hout + Math.PI, leg.halfWidth, undefined, site.stubLength)]) {
    applyPlan(s, planStub(stubs, s, true)!);
    stubs.push(s);
  }
}

/**
 * A crossroads `along` a straight (halfway by default): two blocked arms
 * square to the route. Optional, so it only goes in where both its streets
 * fit among the streets already planned without cutting any below the
 * minimum.
 */
export function crossroadsStreets(
  site: Site,
  stubs: StubSite[],
  leg: TracedLeg,
  along = leg.length / 2,
): void {
  const h = leg.headingIn;
  const m = at(leg.points[0]!, h, along, 0);
  const pair = ([1, -1] as const).map((side) =>
    stubSite(m, h + (side * Math.PI) / 2, leg.halfWidth, undefined, site.stubLength),
  );
  const plans = pair.map((s) => planStub(stubs, s, false));
  if (plans.some((p) => p === null)) return;
  pair.forEach((s, k) => applyPlan(s, plans[k]!));
  site.junctions.push({
    x: m.x,
    z: m.z,
    arms: [
      { heading: h + Math.PI, halfWidth: leg.halfWidth, role: 'in' },
      { heading: h, halfWidth: leg.halfWidth, role: 'out' },
      { heading: h + Math.PI / 2, halfWidth: leg.halfWidth, role: 'blocked' },
      { heading: h - Math.PI / 2, halfWidth: leg.halfWidth, role: 'blocked' },
    ],
  });
  stubs.push(...pair);
}

/**
 * The route's facade on one side: a pavement beyond the carriageway's actual
 * (tapered) edge at every path vertex, offset along the vertex's own heading,
 * which bisects its two segments, so the line stands a pavement's width off
 * both of them.
 */
export function routeFacade(
  path: RoadPath,
  widths: Float64Array | undefined,
  base: number,
  from: number,
  to: number,
  side: 1 | -1,
) {
  const source = { halfWidth: base, path, ...(widths ? { widths } : {}) };
  const s = { x: 0, z: 0, heading: 0 };
  const pts: Pt[] = [];
  const offset = (d: number) => side * (halfWidthAt(source, d) + FRONT_SETBACK);
  path.sample(from, s);
  pts.push(at(s, s.heading, 0, offset(from)));
  for (let i = Math.ceil(from / path.spacing); i * path.spacing < to; i++) {
    const d = i * path.spacing;
    if (d <= from) continue;
    const p = { x: path.xs[i]!, z: path.zs[i]! };
    pts.push(at(p, path.headings[i]!, 0, offset(d)));
  }
  path.sample(to, s);
  pts.push(at(s, s.heading, 0, offset(to)));
  return polylineFacade(pts, side);
}

/**
 * Lay the village: streets, junctions, cones, boards, terraces, garden walls,
 * corner greenery and the footprint around the traced route. With `city`
 * (an urban stage, whose trace spans the whole road) the layout is a city:
 * crossroads every block, roundabouts on the curve legs that circle an
 * island, trams, taller buildings and more of the hills kept.
 */
export function layoutTown(
  trace: TownTrace,
  path: RoadPath,
  seed: number,
  base: number,
  city?: UrbanDef,
): TownDef {
  const site: Site = {
    rand: mulberry32(hashSeed(seed, 'town-layout')),
    clear: () => true,
    streets: [],
    cones: [],
    buildings: [],
    walls: [],
    arrows: [],
    junctions: [],
    plantings: [],
    ...(city ? { styles: city.styles, stubLength: CITY_STUB_LENGTH, variants: CITY_VARIANTS } : {}),
  };
  const stubs: StubSite[] = [];
  const roundabouts: Roundabout[] = [];
  const legs = trace.legs;
  // A city's per-sample widths come straight from the trace, so they are known before anything is laid.
  const cityWidths = city ? traceWidths(path, legs, base) : undefined;
  const citySource = { halfWidth: base, path, ...(cityWidths ? { widths: cityWidths } : {}) };
  // Every street and junction first, so each house can be checked against all of them. The
  // corners' streets are planned before any crossroads, so a crossroads whose streets would run
  // into them is left out rather than cutting them down; then every side street is laid. A
  // city's gentle kinks are not junctions: the route just bends.
  let corners = 0;
  legs.forEach((leg, i) => {
    if (leg.kind === 'straight') {
      site.streets.push(street(leg.points[0]!, leg.points[1]!, leg.halfWidth, true));
      return;
    }
    for (let k = 0; k < leg.points.length - 1; k++)
      site.streets.push(street(leg.points[k]!, leg.points[k + 1]!, leg.halfWidth, true));
    if (leg.kind === 'corner' && Math.abs(leg.turn) >= MIN_JUNCTION_TURN)
      cornerStreets(site, stubs, legs, i, corners++ === 0);
    if (leg.kind === 'curve' && leg.roundabout)
      roundabouts.push(cityRoundabout(site, stubs, leg, citySource));
  });
  if (city) cityCrossroads(site, stubs, legs);
  else
    legs.forEach((leg, i) => {
      if (leg.kind === 'straight' && hasCrossroads(legs, i)) crossroadsStreets(site, stubs, leg);
    });
  // A city's long side streets stop short of the route's other legs and of every ring.
  if (city) {
    clipStubsToRoads(
      site,
      stubs,
      { halfWidth: base, path, widths: traceWidths(path, legs, base) },
      roundabouts,
    );
    joinStubs(stubs, { halfWidth: base, path, widths: traceWidths(path, legs, base) });
  }
  for (const s of stubs) layStub(site, s);
  const hit = createRoadHit();
  path.nearest(trace.entry.x, trace.entry.z, 20, hit);
  const from = hit.along;
  path.nearest(trace.exit.x, trace.exit.z, 20, hit);
  const to = hit.along;
  // A city's streets each hold one width along their length and change it across the corner arcs;
  // a village narrows its streets from the junctions and widens back beyond them.
  const widths = city ? cityWidths : buildWidths(path, site, base);
  const source = { halfWidth: base, path, ...(widths ? { widths } : {}) };
  site.clear = (x, z, slack) => {
    if (
      path.nearest(x, z, 20, hit) &&
      hit.distance < halfWidthAt(source, hit.along) + FRONT_SETBACK - slack
    )
      return false;
    if (!roundaboutsClear(roundabouts, x, z, slack)) return false;
    for (const st of site.streets)
      if (!st.route && streetDistance(st, x, z) < st.halfWidth + FRONT_SETBACK - slack)
        return false;
    return true;
  };
  const facades: RouteFacades = {
    left: routeFacade(path, widths, base, from, to, 1),
    right: routeFacade(path, widths, base, from, to, -1),
  };
  // The hall and the other end buildings before the terraces, so the landmarks survive.
  for (const s of stubs) stubEnd(site, s);
  // Junction walls, and where they interrupt the route's facades; then terraces between the interruptions.
  const gaps = { left: [] as [number, number][], right: [] as [number, number][] };
  const greens: Corner[] = [];
  for (const j of site.junctions) {
    const cuts = junctionWalls(site, j, facades, junctionKerbs(j, source, base));
    greens.push(...cuts.corners);
    for (const side of ['left', 'right'] as const)
      if (cuts[side].length >= 2)
        gaps[side].push([Math.min(...cuts[side]), Math.max(...cuts[side])]);
  }
  // No terrace on a roundabout's island: the route's inner facade skips the arc round it.
  for (const r of roundabouts) {
    const side = r.sense > 0 ? 'left' : 'right';
    gaps[side].push(islandGap(r, facades[side]));
  }
  for (const side of ['left', 'right'] as const) {
    const facade = facades[side];
    let s0 = EDGE_SETBACK;
    for (const [a, b] of gaps[side].sort((p, q) => p[0] - q[0])) {
      row(site, facade, s0, a);
      s0 = Math.max(s0, b);
    }
    row(site, facade, s0, facade.length - EDGE_SETBACK);
  }
  for (const s of stubs) stubRows(site, s);
  closeWallGaps(site);
  plantCorners(site, greens);
  site.plantings.push(...islandPlantings(roundabouts, site.rand));
  const trams = city ? cityTrams(site, roundabouts) : [];
  const medians = city ? cityMedians(site, legs, citySource, city) : [];

  // Footprint: the bounding box of everything in the town frame, with ramp room along the route.
  const h0 = trace.entry.heading;
  const sy = Math.sin(h0);
  const cy = Math.cos(h0);
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  const extend = (x: number, z: number) => {
    const dx = x - trace.entry.x;
    const dz = z - trace.entry.z;
    const u = dx * sy + dz * cy;
    const v = dx * cy - dz * sy;
    uMin = Math.min(uMin, u);
    uMax = Math.max(uMax, u);
    vMin = Math.min(vMin, v);
    vMax = Math.max(vMax, v);
  };
  for (const s of site.streets) {
    extend(s.x0, s.z0);
    extend(s.x1, s.z1);
  }
  for (const b of site.buildings) extend(b.x, b.z);
  for (const w of site.walls) {
    extend(w.x0, w.z0);
    extend(w.x1, w.z1);
  }
  const cu = (uMin + uMax) / 2;
  const cv = (vMin + vMax) / 2;
  return {
    x: trace.entry.x + cu * sy + cv * cy,
    z: trace.entry.z + cu * cy - cv * sy,
    heading: h0,
    halfU: (uMax - uMin) / 2 + MARGIN_U,
    halfV: (vMax - vMin) / 2 + MARGIN_V,
    from,
    to,
    streets: site.streets,
    buildings: site.buildings,
    cones: site.cones,
    arrows: site.arrows,
    junctions: site.junctions,
    walls: site.walls,
    plantings: site.plantings,
    ...(city && widths
      ? { relief: city.relief, roundabouts, trams, medians, widths, city: true as const }
      : {}),
  };
}
