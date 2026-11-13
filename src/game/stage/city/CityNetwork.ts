import { CROSSING_EXTENT } from '../Crossings';
import { ringOuterRadius, ringPoint, type Roundabout } from '../Roundabout';
import { segmentDistance, type Arm, type Barrier, type Junction } from '../Town';
import { TRAM_BED_HALF, type TramLine } from '../Tram';
import { normHeading, stubCut } from '../TownJunctions';
import { ARROW_AHEAD_OF_CONES, type StubSite } from '../TownSideStreets';
import { at, street, type Pt, type Site } from '../TownTerraces';
import type { TracedLeg } from '../TownGenerator';
import { cityStreets, type CityMap } from './CityMap';

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
/** A direction board is this wide each side of its post line; beside a tram, the two boards stand this far either side of the street's axis, clear of the rails' bed. */
const BOARD_HALF = 0.7;
const BOARD_ASIDE = TRAM_BED_HALF + 0.3 + BOARD_HALF;
/** Corners this sharp carry a direction board on the street straight on. */
const BOARD_TURN = Math.PI / 4;

export interface NetworkOut {
  /** The streets off the route, as sites for their terraces (open at both ends). */
  stubs: StubSite[];
  barriers: Barrier[];
  /** Every node of the city's street graph: its junctions, its rings and the route's two ends. */
  nodes: Map<number, NetworkNode>;
}

/** One street leaving a node: its heading from the node, half width, the node it reaches, and its arm on the junction there. */
export interface NodeArm {
  heading: number;
  halfWidth: number;
  to: number;
  route: boolean;
  arm?: Arm;
}

/**
 * A node of the city's street graph: where it stands (a junction's centre,
 * a ring's island centre, or for the route's two ends outside the city the
 * map's crossroads), its junction or ring, and every street leaving it in
 * heading order, as `sortedArms` orders a junction's.
 */
export interface NetworkNode {
  at: Pt;
  junction?: Junction;
  ring?: Roundabout;
  arms: NodeArm[];
}

const heading = (a: Pt, b: Pt) => Math.atan2(b.x - a.x, b.z - a.z);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Each roundabout's exits on the map: the angles from its centre to the crossroads it links that the route does not drive to. */
export function ringExits(map: CityMap, centre: Pt): number[] {
  const ring = map.roundabouts.find((r) => Math.hypot(r.x - centre.x, r.z - centre.z) < 1);
  if (!ring) return [];
  const { edges } = cityStreets(map);
  return map.adjacency[ring.node]!.filter((e) => edges.has(e)).map((e) =>
    heading(ring, map.nodes[across(map, e, ring.node)]!),
  );
}

function across(map: CityMap, e: number, n: number): number {
  const edge = map.edges[e]!;
  return edge.a === n ? edge.b : edge.a;
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
  const out: NetworkOut = { stubs: [], barriers: [], nodes: new Map() };
  const { nodes: corridor, edges: laid } = cityStreets(map);
  const routeIndex = new Map(map.route.map((n, k) => [n, k]));
  const ringOf = new Map<number, Roundabout>();
  for (const r of map.roundabouts) {
    const built = rings.find((b) => Math.hypot(b.x - r.x, b.z - r.z) < 1);
    if (built) ringOf.set(r.node, built);
  }
  const corridorEdge = (e: number) => laid.has(e);
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
    // A ring's exits run out from its island's centre, so the arms that meet them aim there too.
    const ring = ringOf.get(n);
    position.set(n, leg ? leg.corner! : ring ? { x: ring.x, z: ring.z } : { x: p.x, z: p.z });
  }
  // The junctions.
  const junctionAt = new Map<number, Junction>();
  const armTo = new Map<Arm, number>();
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
      // At a corner each of the route's arms is its own street's width: the ribbon holds the
      // narrower round the arc and widens inside the junction's paving (see `traceWidths`).
      const li = leg ? legs.indexOf(leg) : -1;
      const hwIn = leg ? (legs[li - 1]?.halfWidth ?? leg.halfWidth) : routeHalfWidth;
      const hwOut = leg ? (legs[li + 1]?.halfWidth ?? leg.halfWidth) : routeHalfWidth;
      arms.push({ heading: hin + Math.PI, halfWidth: hwIn, role: 'in' });
      arms.push({ heading: hout, halfWidth: hwOut, role: 'out' });
      armTo.set(arms[0]!, map.route[k - 1]!);
      armTo.set(arms[1]!, map.route[k + 1]!);
      if (leg && Math.abs(leg.turn) >= Math.PI / 9) radius = leg.radius;
    } else if (side.length < 2) continue;
    for (const e of side) {
      const m = across(map, e, n);
      const arm: Arm = {
        heading: heading(here, position.get(m) ?? map.nodes[m]!),
        halfWidth: map.edges[e]!.halfWidth,
        role: 'blocked',
      };
      arms.push(arm);
      armTo.set(arm, m);
    }
    if (arms.length < 2) continue;
    // A corner is a square junction of straight arms (`JunctionBox`), its arc inside the paving.
    const j: Junction = {
      x: here.x,
      z: here.z,
      arms,
      ...(radius !== undefined ? { radius, box: true as const } : {}),
    };
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
  out.nodes = graphNodes(map, laid, position, junctionAt, armTo, ringOf);
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
        const along = cut + CONES_IN - ARROW_AHEAD_OF_CONES;
        const turn = leg.turn > 0 ? 1 : -1;
        const mid = at(j, arm.heading, along, 0);
        // Where a tram runs down the street, a board either side of its rails instead of one on them.
        const tram = rails.some(
          (t) => segmentDistance(t.x0, t.z0, t.x1, t.z1, mid.x, mid.z) < TRAM_BED_HALF + BOARD_HALF,
        );
        for (const across of tram ? [-BOARD_ASIDE, BOARD_ASIDE] : [0]) {
          const a = at(j, arm.heading, along, across);
          site.arrows.push({ x: a.x, z: a.z, yaw: arm.heading, turn });
        }
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
  // collider right across). The cones stand either side of the rails: none is set on a tram bed.
  const tram = rails.some((t) => segmentDistance(t.x0, t.z0, t.x1, t.z1, b.x, b.z) < 1.5);
  const c = at(o, h, cut + CONES_IN, 0);
  site.cones.push({ x: c.x, z: c.z, yaw: h, halfLength: hw - CONE_MARGIN });
  out.barriers.push({
    x: b.x,
    z: b.z,
    yaw: h,
    halfLength: hw - BARRIER_MARGIN,
    ...(tram ? { tramGap: true as const } : {}),
  });
}

/**
 * The city's street graph as nodes (see `NetworkNode`): every junction with
 * its arms, every ring with its exits and the route's arms, and the route's
 * first and last crossroads, which stand outside the city with the route's
 * one street each.
 */
function graphNodes(
  map: CityMap,
  laid: ReadonlySet<number>,
  position: ReadonlyMap<number, Pt>,
  junctionAt: ReadonlyMap<number, Junction>,
  armTo: ReadonlyMap<Arm, number>,
  ringOf: ReadonlyMap<number, Roundabout>,
): Map<number, NetworkNode> {
  const nodes = new Map<number, NetworkNode>();
  const route = map.route;
  const where = (n: number): Pt => position.get(n) ?? { x: map.nodes[n]!.x, z: map.nodes[n]!.z };
  const width = (a: number, b: number) =>
    map.edges[map.adjacency[a]!.find((e) => across(map, e, a) === b)!]!.halfWidth;
  const sorted = (arms: NodeArm[]) =>
    arms.sort((p, q) => normHeading(p.heading) - normHeading(q.heading));
  for (const [n, j] of junctionAt)
    nodes.set(n, {
      at: { x: j.x, z: j.z },
      junction: j,
      arms: sorted(
        j.arms.map((arm) => ({
          heading: arm.heading,
          halfWidth: arm.halfWidth,
          to: armTo.get(arm)!,
          route: arm.role !== 'blocked',
          arm,
        })),
      ),
    });
  const routeAt = new Map(route.map((n, k) => [n, k]));
  for (const [n, ring] of ringOf) {
    const k = routeAt.get(n)!;
    const to = [
      route[k - 1]!,
      route[k + 1]!,
      ...map.adjacency[n]!.filter((e) => laid.has(e)).map((e) => across(map, e, n)),
    ];
    nodes.set(n, {
      at: { x: ring.x, z: ring.z },
      ring,
      arms: sorted(
        to.map((m, i) => ({
          heading: heading(ring, where(m)),
          halfWidth: width(n, m),
          to: m,
          route: i < 2,
        })),
      ),
    });
  }
  for (const [n, m] of [
    [route[0]!, route[1]!],
    [route[route.length - 1]!, route[route.length - 2]!],
  ] as const)
    nodes.set(n, {
      at: where(n),
      arms: [{ heading: heading(where(n), where(m)), halfWidth: width(n, m), to: m, route: true }],
    });
  return nodes;
}
