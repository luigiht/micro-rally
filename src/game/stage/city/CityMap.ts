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
  };
}
