import { describe, expect, it } from 'vitest';
import { createRoadHit } from '@/game/stage/RoadPath';
import { bridgeObstacles, bridgeSpan } from '@/game/stage/Rivers';
import { scatterGrass } from '@/game/stage/TallGrass';
import { ROAD_LIFT, TerrainField } from '@/game/stage/TerrainField';
import { stageV13, worldV13 } from './stageIndex';

const alpine = (seed: number, nth: number) => stageV13(seed, 'alpine', nth);

describe('Alpine frozen rivers', () => {
  it('cross every Alpine stage at least twice, at the road’s lows, and nothing else has them', () => {
    // How far a crossing stands over the lowest road 100 m either way.
    const lift = (field: TerrainField, d: number) => {
      let lowest = Infinity;
      for (let e = -100; e <= 100; e += 4) lowest = Math.min(lowest, field.roadHeightAt(d + e));
      return field.roadHeightAt(d) - lowest;
    };
    let crossings = 0;
    let atDips = 0;
    for (let seed = 1; seed <= 10; seed++)
      for (const nth of [0, 1, 3]) {
        const stage = alpine(seed * 131, nth);
        const field = new TerrainField(stage);
        expect(field.rivers.length, `${seed * 131}/${nth}`).toBeGreaterThanOrEqual(2);
        // The first river crosses the road's deepest dip; the rest at its other dips where there are
        // any, or failing those (a road falling steadily) its lowest stretch left.
        expect(lift(field, field.rivers[0]!.crossing.along)).toBeLessThan(1.5);
        for (const r of field.rivers) {
          crossings++;
          if (lift(field, r.crossing.along) < 1.5) atDips++;
        }
      }
    expect(atDips).toBeGreaterThan(crossings * 0.8);
    expect(new TerrainField(stageV13(1, 'pinewood', 1)).rivers).toHaveLength(0);
    expect(new TerrainField(stageV13(1, 'forest', 1)).rivers).toHaveLength(0);
  });

  it('wind off through the hills on both sides, clear of every other stretch of road', () => {
    for (const seed of [1, 2, 3]) {
      const stage = alpine(seed, 1);
      const field = new TerrainField(stage);
      const hit = createRoadHit();
      for (const r of field.rivers) {
        const i = r.crossing.index;
        const ends = [r.points[0]!, r.points[r.points.length - 1]!];
        for (const end of ends) {
          // Far out from the road it crossed: more than 90 m in a straight line.
          expect(Math.hypot(end.x - r.crossing.x, end.z - r.crossing.z)).toBeGreaterThan(90);
          // And it fades into the ground there.
          expect(end.fade).toBeLessThan(0.05);
        }
        expect(i).toBeGreaterThan(10);
        expect(r.points.length - i).toBeGreaterThan(10);
        // Away from its crossing, no point of it lies on any road.
        for (const [k, p] of r.points.entries()) {
          if (Math.abs(k - i) < 10) continue;
          expect(stage.path.nearest(p.x, p.z, stage.halfWidth + 6, hit)).toBe(false);
        }
      }
    }
  });

  it('run under a bridge: the gorge well below the deck, the deck still where the wheels ride', () => {
    const stage = alpine(1, 1);
    const field = new TerrainField(stage);
    const bed = { height: 0, roadBlend: 0, roadDistance: 0 };
    for (const r of field.rivers) {
      const deck = field.roadHeightAt(r.crossing.along) + ROAD_LIFT;
      expect(deck - r.points[r.crossing.index]!.level).toBeGreaterThanOrEqual(4.4);
      // The mesh's ground under the middle of the bridge lies in the gorge.
      field.sample(r.crossing.x, r.crossing.z, bed);
      expect(bed.height).toBeLessThan(deck - 4);
      // The wheels ride the deck across the whole carriageway.
      const lx = Math.cos(r.crossing.heading);
      const lz = -Math.sin(r.crossing.heading);
      for (const e of [-stage.halfWidth + 0.3, 0, stage.halfWidth - 0.3])
        expect(field.heightAt(r.crossing.x + lx * e, r.crossing.z + lz * e)).toBeCloseTo(deck, 1);
      // Just past the parapets the gorge falls away.
      const off = stage.halfWidth + 3;
      expect(field.heightAt(r.crossing.x + lx * off, r.crossing.z + lz * off)).toBeLessThan(
        deck - 2,
      );
    }
  });

  it('wall each bridge with parapets on both edges', () => {
    const stage = alpine(1, 1);
    const field = new TerrainField(stage);
    const boxes = bridgeObstacles(stage, field.rivers);
    for (const r of field.rivers) {
      const span = bridgeSpan(r);
      const along = { x: 0, z: 0, heading: 0 };
      stage.path.sample((span.from + span.to) / 2, along);
      const near = boxes.filter(
        (b) => Math.hypot(b.x - along.x, b.z - along.z) < stage.halfWidth + 2,
      );
      expect(near.length).toBeGreaterThanOrEqual(2);
      for (const b of near) {
        const d = Math.hypot(b.x - along.x, b.z - along.z);
        expect(d).toBeGreaterThan(stage.halfWidth);
      }
    }
  });

  it('keep trees, rocks, grass and spectators off the ice', () => {
    const w = worldV13(2, 'alpine', 1);
    expect(w.field.rivers.length).toBeGreaterThanOrEqual(2);
    for (const p of w.props)
      if (p.kind !== 'house') expect(w.field.inRiver(p.x, p.z), p.kind).toBe(false);
    for (const g of scatterGrass(w.field, w.props)) expect(w.field.inRiver(g.x, g.z)).toBe(false);
    // Same stage, same rivers.
    const again = new TerrainField(w.stage);
    expect(again.rivers.map((r) => r.crossing.along)).toEqual(
      w.field.rivers.map((r) => r.crossing.along),
    );
  });
});
