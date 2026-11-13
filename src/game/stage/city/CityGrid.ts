import { hashSeed, mulberry32 } from '../../rng';
import type { UrbanDef } from '../regions';

/**
 * A city's street map: a warped grid of blocks. A lattice of crossroads,
 * its columns (`i`, across) and rows (`j`, along the stage) spaced 80–120 m
 * apart, then bent by two gentle sweeps each way so the streets curve over
 * the whole town and no block is quite square. Each lattice line is one
 * street class all its length (a four-lane avenue every third column and
 * every fourth row, two lanes otherwise), and a few
 * side streets are left out so some blocks run double. The route
 * (`CityRoute`) is a walk along these streets; the rest of the map is built
 * round it. Pure data in the plan frame: +z along the stage, +x to the left.
 */

export interface CityNode {
  id: number;
  /** Lattice column (across, + = left) and row (along the stage). */
  i: number;
  j: number;
  x: number;
  z: number;
}

export interface CityEdge {
  id: number;
  a: number;
  b: number;
  halfWidth: number;
  /** An avenue: the wide lines of the lattice. */
  avenue: boolean;
}

export interface CityGraph {
  nodes: CityNode[];
  edges: CityEdge[];
  /** Edge ids at each node. */
  adjacency: number[][];
  /** Node id at lattice (i, j), or -1 outside it. */
  at(i: number, j: number): number;
  cols: number;
  rows: number;
}

/** Columns either side of the start column, and rows behind the start row. */
export const HALF_COLS = 6;
const ROWS_BEHIND = 1;
const BLOCK_MIN = 80;
const BLOCK_MAX = 120;
/** The warp: two sweeps each way, `sin(v / wave)` (a period of about 1 and 2 km) at most this far each. */
const WARP_WAVE = [150, 300] as const;
const WARP_AMPLITUDE = [14, 18] as const;
/** Avenues: every third column (the start column among them) and every fourth row. */
const AVENUE_COL = 3;
const AVENUE_ROW = 4;
/** Side streets left out, as a share of those that can go without cutting the map. */
const DROP_SHARE = 0.06;

/**
 * The lattice's street class along line `k`: a four-lane avenue every
 * `every`, two lanes otherwise. Always an even count, one each way or two,
 * and one class the whole length of the line, so a street's lanes only
 * change at a junction. The draw is kept so the grid's other draws keep
 * their stream.
 */
function lineWidth(rand: () => number, k: number, every: number, lanes: UrbanDef['lanes']): number {
  rand();
  return k % every === 0 ? lanes.four : lanes.two;
}

/**
 * The grid for a stage, long enough for `span` metres of route: rows run
 * that far ahead even if the route never turned.
 */
export function cityGrid(seed: number, span: number, def: UrbanDef): CityGraph {
  const rand = mulberry32(hashSeed(seed, 'city-grid'));
  const cols = 2 * HALF_COLS + 1;
  const rows = Math.ceil(span / BLOCK_MIN) + ROWS_BEHIND + 3;
  const block = () => BLOCK_MIN + rand() * (BLOCK_MAX - BLOCK_MIN);
  // Column offsets from the start column, rows from the start row.
  const xs: number[] = new Array<number>(cols).fill(0);
  for (let c = HALF_COLS + 1; c < cols; c++) xs[c] = xs[c - 1]! + block();
  for (let c = HALF_COLS - 1; c >= 0; c--) xs[c] = xs[c + 1]! - block();
  const zs: number[] = new Array<number>(rows).fill(0);
  for (let r = ROWS_BEHIND + 1; r < rows; r++) zs[r] = zs[r - 1]! + block();
  for (let r = ROWS_BEHIND - 1; r >= 0; r--) zs[r] = zs[r + 1]! - block();
  const colWidth = xs.map((_, c) => lineWidth(rand, c - HALF_COLS, AVENUE_COL, def.lanes));
  const rowWidth = zs.map((_, r) => lineWidth(rand, r - ROWS_BEHIND, AVENUE_ROW, def.lanes));
  // The warp: smooth sweeps that bend the columns sideways and the rows along, nothing at the start node.
  const phase = [rand(), rand(), rand(), rand()].map((p) => p * Math.PI * 2);
  const amp = [rand(), rand(), rand(), rand()].map(
    (a, k) => (0.4 + 0.6 * a) * WARP_AMPLITUDE[k % 2]!,
  );
  const sweep = (v: number, k: number) =>
    amp[k]! * (Math.sin(v / WARP_WAVE[k % 2]! + phase[k]!) - Math.sin(phase[k]!));
  const nodes: CityNode[] = [];
  const index = new Map<number, number>();
  const key = (i: number, j: number) => (i + 1000) * 10000 + j;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = c - HALF_COLS;
      const j = r - ROWS_BEHIND;
      const x0 = xs[c]!;
      const z0 = zs[r]!;
      const id = nodes.length;
      nodes.push({
        id,
        i,
        j,
        x: x0 + sweep(z0, 0) + sweep(z0, 1),
        z: z0 + sweep(x0, 2) + sweep(x0, 3),
      });
      index.set(key(i, j), id);
    }
  const at = (i: number, j: number) => index.get(key(i, j)) ?? -1;
  const edges: CityEdge[] = [];
  const adjacency: number[][] = nodes.map(() => []);
  const link = (a: number, b: number, halfWidth: number, avenue: boolean) => {
    const id = edges.length;
    edges.push({ id, a, b, halfWidth, avenue });
    adjacency[a]!.push(id);
    adjacency[b]!.push(id);
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = c - HALF_COLS;
      const j = r - ROWS_BEHIND;
      // Along the row (across the stage) and along the column (with it).
      if (c + 1 < cols) link(at(i, j), at(i + 1, j), rowWidth[r]!, j % AVENUE_ROW === 0);
      if (r + 1 < rows) link(at(i, j), at(i, j + 1), colWidth[c]!, i % AVENUE_COL === 0);
    }
  const graph: CityGraph = { nodes, edges, adjacency, at, cols, rows };
  dropSideStreets(graph, rand);
  return graph;
}

/**
 * Leave out a few side streets so some blocks run double: never an avenue,
 * never one at the lattice's edge or at the start node, never two at one
 * crossroads, and only where every node keeps three streets.
 */
function dropSideStreets(g: CityGraph, rand: () => number): void {
  const dropped = new Set<number>();
  const touched = new Set<number>();
  const start = g.at(0, 0);
  for (const e of g.edges) {
    if (e.avenue || rand() >= DROP_SHARE) continue;
    const [na, nb] = [g.nodes[e.a]!, g.nodes[e.b]!];
    const edge = (n: CityNode) =>
      Math.abs(n.i) === HALF_COLS || n.j <= -ROWS_BEHIND || n.j >= g.rows - ROWS_BEHIND - 1;
    if (edge(na) || edge(nb) || e.a === start || e.b === start) continue;
    if (touched.has(e.a) || touched.has(e.b)) continue;
    if (g.adjacency[e.a]!.length < 4 || g.adjacency[e.b]!.length < 4) continue;
    dropped.add(e.id);
    touched.add(e.a);
    touched.add(e.b);
  }
  if (dropped.size === 0) return;
  const kept = g.edges.filter((e) => !dropped.has(e.id));
  g.edges.length = 0;
  for (const a of g.adjacency) a.length = 0;
  for (const e of kept) {
    const id = g.edges.length;
    g.edges.push({ ...e, id });
    g.adjacency[e.a]!.push(id);
    g.adjacency[e.b]!.push(id);
  }
}

/** The other end of edge `e` from node `n`. */
export function across(g: CityGraph, e: number, n: number): number {
  const edge = g.edges[e]!;
  return edge.a === n ? edge.b : edge.a;
}

/** The edge between two nodes, or undefined. */
export function edgeBetween(g: CityGraph, a: number, b: number): CityEdge | undefined {
  for (const id of g.adjacency[a]!) if (across(g, id, a) === b) return g.edges[id];
  return undefined;
}
