import { CROSSING_EXTENT } from '../Crossings';
import { ringOuterRadius, ringPoint, type Roundabout } from '../Roundabout';
import { segmentDistance, type Arm, type Barrier, type Junction } from '../Town';
import type { TramLine } from '../Tram';
import { stubCut } from '../TownJunctions';
import { ARROW_AHEAD_OF_CONES, type StubSite } from '../TownSideStreets';
import { at, street, type Pt, type Site } from '../TownTerraces';
import type { TracedLeg } from '../TownGenerator';
import type { CityMap } from './CityMap';

/**
 * A city's streets off the route: the map's streets round every block the
 * route borders, as real streets from crossroads to crossroads. Every
 * crossroads among them is a junction: on the route its arms are the way in,
 * the way on and the streets it passes (blocked); off it every arm is a side
 * street's. Wherever a street leaves the route (at a crossroads or a
 * roundabout), cones and a crowd barrier close it a few metres in, so the
 * car stays on the route while the street runs on into the town beyond.
 */

/** Cones stand this far into a closed street past its junction's paving (beyond its zebra and stop line); the barrier this far. */
const CONES_IN = CROSSING_EXTENT + 1.5;
const BARRIER_IN = CONES_IN + 1.5;
/** A barrier stops this short of the kerbs each side. */
const BARRIER_MARGIN = 0.3;
const CONE_MARGIN = 0.5;
/** Corners this sharp carry a direction board on the street straight on. */
const BOARD_TURN = Math.PI / 4;

export interface NetworkOut {
  /** The streets off the route, as sites for their terraces (open at both ends). */
  stubs: StubSite[];
  barriers: Barrier[];
}

const heading = (a: Pt, b: Pt) => Math.atan2(b.x - a.x, b.z - a.z);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Each roundabout's exits on the map: the angles from its centre to the crossroads it links that the route does not drive to. */
export function ringExits(map: CityMap, centre: Pt): number[] {
  const ring = map.roundabouts.find((r) => Math.hypot(r.x - centre.x, r.z - centre.z) < 1);
  if (!ring) return [];
  const k = map.route.indexOf(ring.node);
  const routeNeighbours = new Set([map.route[k - 1], map.route[k + 1]]);
  const corridor = corridorNodes(map);
  return map.adjacency[ring.node]!.map((e) => across(map, e, ring.node))
    .filter((n) => !routeNeighbours.has(n) && corridor.has(n))
    .map((n) => heading(ring, map.nodes[n]!));
}

function across(map: CityMap, e: number, n: number): number {
  const edge = map.edges[e]!;
  return edge.a === n ? edge.b : edge.a;
}

/** The route's crossroads and every crossroads one street from them. */
function corridorNodes(map: CityMap): Set<number> {
  const out = new Set<number>();
  for (const n of map.route.slice(1)) {
    out.add(n);
    for (const e of map.adjacency[n]!) out.add(across(map, e, n));
  }
  out.delete(map.route[0]!);
  return out;
}

/**
 * Lay the network: junctions, streets, cones, boards and barriers. `legs` is
 * the trace (its corners place the route's junctions exactly where the
 * ribbon turns); `rings` the roundabouts already laid on the route.
 */
export function cityNetwork(
  site: Site,
  map: CityMap,
  legs: readonly TracedLeg[],
  rings: readonly Roundabout[],
  routeHalfWidth: number,
  rails: readonly TramLine[] = [],
): NetworkOut {
  const out: NetworkOut = { stubs: [], barriers: [] };
  const corridor = corridorNodes(map);
  const routeIndex = new Map(map.route.map((n, k) => [n, k]));
  const ringOf = new Map<number, Roundabout>();
  for (const r of map.roundabouts) {
    const built = rings.find((b) => Math.hypot(b.x - r.x, b.z - r.z) < 1);
    if (built) ringOf.set(r.node, built);
  }
  const routeEdge = (a: number, b: number) => {
    const ka = routeIndex.get(a);
    const kb = routeIndex.get(b);
    return ka !== undefined && kb !== undefined && Math.abs(ka - kb) === 1;
  };
  const corridorEdge = (e: number) => {
    const { a, b } = map.edges[e]!;
    return corridor.has(a) && corridor.has(b) && !routeEdge(a, b);
  };
  // Where each crossroads stands: a route corner's polygon corner as traced, else the map's.
  const corners = legs.filter((l) => l.kind === 'corner' && l.corner);
  const position = new Map<number, Pt>();
  const cornerLeg = new Map<number, TracedLeg>();
  for (const n of corridor) {
    const p = map.nodes[n]!;
    const leg = routeIndex.has(n)
      ? corners.find((l) => Math.hypot(l.corner!.x - p.x, l.corner!.z - p.z) < 1.5)
      : undefined;
    if (leg) cornerLeg.set(n, leg);
    position.set(n, leg ? leg.corner! : { x: p.x, z: p.z });
  }
  // The junctions.
  const junctionAt = new Map<number, Junction>();
  for (const n of corridor) {
    if (ringOf.has(n)) continue;
    const here = position.get(n)!;
    const side = map.adjacency[n]!.filter(corridorEdge);
    const k = routeIndex.get(n);
    const arms: Arm[] = [];
    let radius: number | undefined;
    if (k !== undefined && k > 0 && k < map.route.length - 1) {
      const leg = cornerLeg.get(n);
      const prev = map.nodes[map.route[k - 1]!]!;
      const next = map.nodes[map.route[k + 1]!]!;
      const hin = leg ? leg.headingIn : heading(prev, here);
      const hout = leg ? leg.headingOut : heading(here, next);
      // The junction is as wide as the narrower of the route's two streets (see `traceWidths`).
      const li = leg ? legs.indexOf(leg) : -1;
      const hw = leg
        ? Math.min(
            legs[li - 1]?.halfWidth ?? leg.halfWidth,
            legs[li + 1]?.halfWidth ?? leg.halfWidth,
          )
        : routeHalfWidth;
      arms.push({ heading: hin + Math.PI, halfWidth: hw, role: 'in' });
      arms.push({ heading: hout, halfWidth: hw, role: 'out' });
      if (leg && Math.abs(leg.turn) >= Math.PI / 9) radius = leg.radius;
    } else if (side.length < 2) continue;
    for (const e of side) {
      const m = across(map, e, n);
      arms.push({
        heading: heading(here, position.get(m) ?? map.nodes[m]!),
        halfWidth: map.edges[e]!.halfWidth,
        role: 'blocked',
      });
    }
    if (arms.length < 2) continue;
    const j: Junction = { x: here.x, z: here.z, arms, ...(radius !== undefined ? { radius } : {}) };
    site.junctions.push(j);
    junctionAt.set(n, j);
  }
  // The streets: each once, from a route end if it has one, as an open street and a terrace site.
  for (let e = 0; e < map.edges.length; e++) {
    if (!corridorEdge(e)) continue;
    let { a, b } = map.edges[e]!;
    if (!routeIndex.has(a) && routeIndex.has(b)) [a, b] = [b, a];
    if (ringOf.has(b)) [a, b] = [b, a];
    const hw = map.edges[e]!.halfWidth;
    const far = position.get(b)!;
    const ring = ringOf.get(a);
    let from: Pt;
    if (ring) {
      if (ringOf.has(b)) continue;
      // A ring exit starts at the ring's outer edge, aimed at the crossroads it reaches.
      const angle = heading(ring, far);
      from = ringPoint(ring, angle, ringOuterRadius(ring));
      closeStreet(site, out, from, angle, hw, 0, rails);
    } else {
      from = position.get(a)!;
      if (!junctionAt.has(a)) continue;
    }
    if (!ring && !junctionAt.has(b)) continue;
    const h = heading(from, far);
    const length = Math.hypot(far.x - from.x, far.z - from.z);
    const st = street(from, far, hw, false);
    st.open = true;
    site.streets.push(st);
    out.stubs.push({ j: from, heading: h, hw, length, full: length, open: true, endClear: 0 });
  }
  // Every side street a route junction passes is closed a few metres in.
  for (const [n, j] of junctionAt) {
    const k = routeIndex.get(n);
    if (k === undefined || k === 0 || k === map.route.length - 1) continue;
    const leg = cornerLeg.get(n);
    for (const arm of j.arms) {
      if (arm.role !== 'blocked') continue;
      const cut = stubCut(j, arm, routeHalfWidth);
      closeStreet(site, out, j, arm.heading, arm.halfWidth, cut, rails);
      // On a sharp corner, a board on the street straight on points the way.
      if (
        leg &&
        Math.abs(leg.turn) >= BOARD_TURN &&
        Math.abs(wrap(arm.heading - leg.headingIn)) < 0.3
      ) {
        const a = at(j, arm.heading, cut + CONES_IN - ARROW_AHEAD_OF_CONES, 0);
        site.arrows.push({ x: a.x, z: a.z, yaw: arm.heading, turn: leg.turn > 0 ? 1 : -1 });
      }
    }
  }
  return out;
}

/** Cones and a barrier across a street leaving the route at `o` on `h`, `cut` metres along where its own carriageway begins. */
function closeStreet(
  site: Site,
  out: NetworkOut,
  o: Pt,
  h: number,
  hw: number,
  cut: number,
  rails: readonly TramLine[],
): void {
  const b = at(o, h, cut + BARRIER_IN, 0);
  // A tram runs down this street: the barrier leaves its rails a gap (the car still meets a
  // collider right across), and no cones stand on them.
  const tram = rails.some((t) => segmentDistance(t.x0, t.z0, t.x1, t.z1, b.x, b.z) < 1.5);
  if (!tram) {
    const c = at(o, h, cut + CONES_IN, 0);
    site.cones.push({ x: c.x, z: c.z, yaw: h, halfLength: hw - CONE_MARGIN });
  }
  out.barriers.push({
    x: b.x,
    z: b.z,
    yaw: h,
    halfLength: hw - BARRIER_MARGIN,
    ...(tram ? { tramGap: true as const } : {}),
  });
}
