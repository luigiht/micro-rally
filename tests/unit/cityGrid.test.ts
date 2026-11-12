import { describe, expect, it } from 'vitest';
import { across, cityGrid, type CityGraph } from '@/game/stage/city/CityGrid';
import { STAGE_TYPES } from '@/game/stage/regions';

const def = STAGE_TYPES.urban.urban!;
const SEEDS = [1, 2, 3, 4, 5];

const length = (g: CityGraph, e: number) => {
  const { a, b } = g.edges[e]!;
  return Math.hypot(g.nodes[b]!.x - g.nodes[a]!.x, g.nodes[b]!.z - g.nodes[a]!.z);
};

describe('city grid', () => {
  it('is one connected map, the same every time', () => {
    for (const seed of SEEDS) {
      const g = cityGrid(seed, 2500, def);
      expect(cityGrid(seed, 2500, def).nodes).toEqual(g.nodes);
      const seen = new Set([0]);
      const queue = [0];
      while (queue.length) {
        const n = queue.pop()!;
        for (const e of g.adjacency[n]!) {
          const m = across(g, e, n);
          if (!seen.has(m)) {
            seen.add(m);
            queue.push(m);
          }
        }
      }
      expect(seen.size).toBe(g.nodes.length);
      // Long enough for the route straight ahead, and the start node at the origin.
      const start = g.nodes[g.at(0, 0)]!;
      expect([start.x, start.z]).toEqual([0, 0]);
      expect(Math.max(...g.nodes.map((n) => n.z))).toBeGreaterThan(2500);
    }
  });

  it('keeps blocks 80–120 m give or take the warp, streets meeting at 60° or more, none crossing', () => {
    for (const seed of SEEDS) {
      const g = cityGrid(seed, 2500, def);
      for (const e of g.edges) {
        const l = length(g, e.id);
        expect(l).toBeGreaterThan(70);
        expect(l).toBeLessThan(135);
      }
      for (const n of g.nodes) {
        const headings = g.adjacency[n.id]!.map((e) => {
          const m = g.nodes[across(g, e, n.id)]!;
          return Math.atan2(m.x - n.x, m.z - n.z);
        });
        for (let p = 0; p < headings.length; p++)
          for (let q = p + 1; q < headings.length; q++) {
            const d = Math.abs(
              Math.atan2(
                Math.sin(headings[p]! - headings[q]!),
                Math.cos(headings[p]! - headings[q]!),
              ),
            );
            expect(d).toBeGreaterThan(Math.PI / 3);
          }
      }
      // No two streets cross between nodes (checked among neighbours: streets are under 135 m).
      const cross = (a: number, b: number, c: number, d: number) => {
        const [p, q, r, s] = [a, b, c, d].map((k) => g.nodes[k]!);
        const o = (u: typeof p, v: typeof p, w: typeof p) =>
          Math.sign((v!.x - u!.x) * (w!.z - u!.z) - (v!.z - u!.z) * (w!.x - u!.x));
        return o(p, q, r) * o(p, q, s) < 0 && o(r, s, p) * o(r, s, q) < 0;
      };
      const crossing: string[] = [];
      for (const e of g.edges)
        for (const f of g.edges) {
          if (f.id <= e.id || [f.a, f.b].includes(e.a) || [f.a, f.b].includes(e.b)) continue;
          const ea = g.nodes[e.a]!;
          const fa = g.nodes[f.a]!;
          if (Math.hypot(ea.x - fa.x, ea.z - fa.z) > 300) continue;
          if (cross(e.a, e.b, f.a, f.b)) crossing.push(`${e.id}/${f.id}`);
        }
      expect(crossing).toEqual([]);
    }
  });

  it('runs each lattice line as one street class, avenues the widest, and leaves a few side streets out', () => {
    const g = cityGrid(1, 2500, def);
    const avenues = g.edges.filter((e) => e.avenue);
    expect(avenues.length).toBeGreaterThan(20);
    for (const e of avenues) expect(e.halfWidth).toBe(def.lanes.four);
    // A few side streets are left out: fewer edges than the full lattice, every node keeping three or more.
    expect(g.edges.length).toBeLessThan(g.cols * (g.rows - 1) + g.rows * (g.cols - 1));
    for (const n of g.nodes)
      if (Math.abs(n.i) < 6 && n.j > -1 && n.j < g.rows - 2)
        expect(g.adjacency[n.id]!.length).toBeGreaterThanOrEqual(3);
  });
});
