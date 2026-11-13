import type { CityEdge } from './CityGrid';
import type { CityPlan, CityRoundabout } from './CityRoute';

/**
 * A city's map in the world: the plan's grid moved and turned onto the
 * route as the centreline builder laid it (the plan's origin at the trace's
 * entry, its +z along the entry heading). Plain data, so it travels with the
 * town to the renderer and the terrain worker.
 */
export interface CityMap {
  nodes: { x: number; z: number; i: number; j: number }[];
  edges: Omit<CityEdge, 'id'>[];
  /** Edge indices at each node. */
  adjacency: number[][];
  /** The route's crossroads in order. */
  route: number[];
  roundabouts: CityRoundabout[];
  /** The tram loop's crossroads in order round it (empty when the city has none). */
  tram: number[];
}

/** The plan's map placed at the trace's entry (`heading`: forward is (sin h, cos h), left (cos h, −sin h)). */
export function cityToWorld(
  plan: CityPlan,
  entry: { x: number; z: number; heading: number },
): CityMap {
  const c = Math.cos(entry.heading);
  const s = Math.sin(entry.heading);
  const place = (x: number, z: number) => ({
    x: entry.x + x * c + z * s,
    z: entry.z - x * s + z * c,
  });
  const g = plan.graph;
  return {
    nodes: g.nodes.map((n) => ({ ...place(n.x, n.z), i: n.i, j: n.j })),
    edges: g.edges.map(({ a, b, halfWidth, avenue }) => ({ a, b, halfWidth, avenue })),
    adjacency: g.adjacency.map((a) => [...a]),
    route: [...plan.route],
    roundabouts: plan.roundabouts.map((r) => ({ ...r, ...place(r.x, r.z) })),
    tram: [...plan.tram],
  };
}

/** The crossroads and streets a city lays off its route (see `cityStreets`). */
export interface CityStreets {
  nodes: Set<number>;
  /** Edge indices: every street laid that the route does not drive. */
  edges: Set<number>;
}

/**
 * The part of the map a city builds: every crossroads round the route's own
 * (diagonals too, so the blocks either side of a corner close), less the
 * route's first and last, which lie behind the start and past the run-out,
 * and the tram loop's streets all round. Then any crossroads off the route
 * left with fewer than two streets is
 * dropped with its street, and again until none is, so every street runs
 * from junction to junction and none the route passes leads nowhere.
 */
export function cityStreets(map: CityMap): CityStreets {
  const route = map.route;
  const routeAt = new Map(route.map((n, k) => [n, k]));
  const ends = new Set([route[0]!, route[route.length - 1]!]);
  const lattice = new Map<string, number>();
  map.nodes.forEach((n, id) => lattice.set(`${n.i},${n.j}`, id));
  const nodes = new Set<number>();
  for (const n of route.slice(1, -1)) {
    const { i, j } = map.nodes[n]!;
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const id = lattice.get(`${i + di},${j + dj}`);
        if (id !== undefined && !ends.has(id)) nodes.add(id);
      }
  }
  for (const n of map.tram) if (!ends.has(n)) nodes.add(n);
  const driven = (a: number, b: number) => {
    const ka = routeAt.get(a);
    const kb = routeAt.get(b);
    return ka !== undefined && kb !== undefined && Math.abs(ka - kb) === 1;
  };
  const edges = new Set<number>();
  map.edges.forEach((e, id) => {
    if (nodes.has(e.a) && nodes.has(e.b) && !driven(e.a, e.b)) edges.add(id);
  });
  const other = (e: number, n: number) =>
    map.edges[e]!.a === n ? map.edges[e]!.b : map.edges[e]!.a;
  const queue = [...nodes].filter((n) => !routeAt.has(n));
  while (queue.length > 0) {
    const n = queue.pop()!;
    if (!nodes.has(n)) continue;
    const laid = map.adjacency[n]!.filter((e) => edges.has(e));
    if (laid.length >= 2) continue;
    nodes.delete(n);
    for (const e of laid) {
      edges.delete(e);
      const m = other(e, n);
      if (!routeAt.has(m)) queue.push(m);
    }
  }
  return { nodes, edges };
}
