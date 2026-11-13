import { describe, expect, it } from 'vitest';
import { BUILDING_SIZE, MAX_WIDEN } from '@/game/stage/BuildingCatalog';
import { buildingIndex } from '@/game/stage/BuildingIndex';
import { generateStage } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { FRONT_SETBACK, streetDistance, townProps } from '@/game/stage/Town';
import type { Pt } from '@/game/stage/TownTerraces';
import { createRoadHit } from '@/game/stage/RoadPath';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { onMedian } from '@/game/stage/Median';
import { ringOuterRadius } from '@/game/stage/Roundabout';
import { stageIndexOf } from './stageIndex';

// Generating a city takes about a second, so tests that build several get time for it.
describe('city terraces', { timeout: 30_000 }, () => {
  const town = generateStage(1, stageIndexOf('urban', 1)).town!;
  const ground = { deckAt: () => 0, heightAt: () => 0 };

  it('stand wall to wall: hardly a garden wall left between two buildings', () => {
    const idx = buildingIndex(town.buildings);
    const between = town.walls.filter(
      (w) => idx.covers(w.x0, w.z0, 0.6) && idx.covers(w.x1, w.z1, 0.6),
    );
    // A village row leaves a wall in every party gap: one per building, near enough. A city's
    // few are at its crossroads' corners (5 % with every block round the route built).
    expect(between.length).toBeLessThan(town.buildings.length * 0.06);
    // And no slivers: what is left between two buildings is a real gap nothing could close.
    expect(between.filter((w) => Math.hypot(w.x1 - w.x0, w.z1 - w.z0) < 0.6)).toEqual([]);
  });

  it('stretch or narrow a building to close a gap, and draw it that wide', () => {
    const props = townProps(town, ground);
    let widened = 0;
    town.buildings.forEach((b, i) => {
      const ratio = b.hx / BUILDING_SIZE[b.style].hx;
      expect(ratio).toBeGreaterThanOrEqual(0.6 - 1e-6);
      expect(ratio).toBeLessThanOrEqual(MAX_WIDEN + 1e-6);
      if (Math.abs(ratio - 1) > 1e-3) {
        widened++;
        expect(props[i]!.widen).toBeCloseTo(ratio, 6);
      } else expect(props[i]!.widen).toBeUndefined();
    });
    expect(widened).toBeGreaterThan(20);
  });

  it("grow nothing green but the street trees and the medians' shrubs and grass: no gardens, hedges or wild trees", () => {
    expect(town.plantings).toEqual([]);
    const world = createStageWorld(1, stageIndexOf('urban', 1));
    const kinds = new Set(world.props.map((p) => p.kind));
    for (const kind of ['tree', 'broadleaf', 'bush', 'spruce', 'palm'] as const)
      expect(kinds.has(kind)).toBe(false);
    // Shrubs only down the boulevards' green dividers, in more than one shape.
    const shrubs = world.props.filter((p) => p.kind === 'shrub');
    expect(shrubs.length).toBeGreaterThan(0);
    for (const b of shrubs) expect(onMedian(world.stage.town!.medians ?? [], b.x, b.z)).toBe(true);
    expect(new Set(shrubs.map((b) => b.variant)).size).toBeGreaterThan(1);
    // Tall grass between them, on the dividers too, in the green tints only.
    const grass = world.props.filter((p) => p.kind === 'grass');
    expect(grass.length).toBeGreaterThan(shrubs.length);
    for (const g of grass) {
      expect(onMedian(world.stage.town!.medians ?? [], g.x, g.z)).toBe(true);
      expect([0, 1]).toContain(g.variant);
    }
    // Every street tree stands in a tree pit on a pavement, the city's in several species.
    const pits = world.props.filter((p) => p.kind === 'treePit');
    const trees = world.props.filter((p) => p.kind === 'streetTree');
    expect(trees.length).toBe(pits.length);
    expect(new Set(trees.map((t) => t.variant)).size).toBeGreaterThanOrEqual(4);
    // And they line the streets: about one per 7.5 m of pavement, both sides of the route.
    expect(pits.length).toBeGreaterThan(world.stage.path.length / 7.5);
  });

  it('draw no walls: each one left is the front of a building fitted to its plot, behind the pavement', () => {
    const infills = town.infills ?? [];
    expect(infills.length).toBeGreaterThan(10);
    const fronts = infills.flatMap((f) =>
      f.front.slice(1).map((q, i) => [f.front[i]!, q] as const),
    );
    const segment = (
      x: number,
      z: number,
      a: { x: number; z: number },
      b: { x: number; z: number },
    ) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const t = Math.max(
        0,
        Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)),
      );
      return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    };
    const loose = town.walls.filter((w) => {
      const mx = (w.x0 + w.x1) / 2;
      const mz = (w.z0 + w.z1) / 2;
      return !fronts.some(([p, q]) => segment(mx, mz, p, q) < 0.1);
    });
    expect(loose).toEqual([]);
    // Every fitted footprint's back stays off every street and its pavement.
    const stage = generateStage(1, stageIndexOf('urban', 1));
    const hit = createRoadHit();
    const onStreet: string[] = [];
    for (const f of infills)
      for (const c of f.back) {
        const route =
          stage.path.nearest(c.x, c.z, 30, hit) &&
          hit.distance < halfWidthAt(stage, hit.along) + FRONT_SETBACK - 0.2;
        const side = town.streets.some(
          (st) => !st.route && streetDistance(st, c.x, c.z) < st.halfWidth + FRONT_SETBACK - 0.2,
        );
        if (route || side) onStreet.push(`${c.x.toFixed(1)},${c.z.toFixed(1)}`);
      }
    expect(onStreet).toEqual([]);
    // Each footprint is one simple outline, never crossing itself.
    const cross = (a: Pt, b: Pt, c: Pt, d: Pt) => {
      const o = (p: Pt, q: Pt, r: Pt) =>
        Math.sign((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x));
      return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
    };
    const tangled = infills.filter((f) => {
      const ring = [...f.front, ...f.back];
      for (let i = 0; i < ring.length; i++)
        for (let j = i + 2; j < ring.length; j++) {
          if (i === 0 && j === ring.length - 1) continue;
          if (cross(ring[i]!, ring[(i + 1) % ring.length]!, ring[j]!, ring[(j + 1) % ring.length]!))
            return true;
        }
      return false;
    });
    expect(tangled).toEqual([]);
    // Corners are one building with a face and a door on each street; every door faces the street
    // from its front, its step on the pavement.
    expect(infills.filter((f) => (f.doors?.length ?? 0) >= 2).length).toBeGreaterThan(20);
    const astray: string[] = [];
    for (const f of infills) {
      expect(f.doors?.length ?? 0).toBeGreaterThan(0);
      for (const d of f.doors ?? []) {
        const onFront = fronts.some(([p, q]) => segment(d.x, d.z, p, q) < 0.05);
        const sx = d.x + d.nx * 1.5;
        const sz = d.z + d.nz * 1.5;
        const pavement =
          (stage.path.nearest(sx, sz, 30, hit) &&
            hit.distance < halfWidthAt(stage, hit.along) + FRONT_SETBACK) ||
          town.streets.some(
            (st) => !st.route && streetDistance(st, sx, sz) < st.halfWidth + FRONT_SETBACK,
          ) ||
          (town.roundabouts ?? []).some(
            (r) => Math.hypot(sx - r.x, sz - r.z) < ringOuterRadius(r) + FRONT_SETBACK,
          );
        if (!onFront || !pavement) astray.push(`${d.x.toFixed(1)},${d.z.toFixed(1)}`);
      }
    }
    expect(astray).toEqual([]);
  });
});
