import { describe, expect, it } from 'vitest';
import { ringPassage } from '@/game/stage/city/CityRoute';
import { createRoadHit } from '@/game/stage/RoadPath';
import { generateStage } from '@/game/stage/StageGenerator';
import { stageIndexOf } from './stageIndex';

const SEEDS = [1, 2, 3, 4, 5, 6];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe('city route', () => {
  it('drives along the map: every crossroads it passes lies on the road, every corner at its arc', () => {
    for (const seed of SEEDS) {
      const stage = generateStage(seed, stageIndexOf('urban', 1));
      const map = stage.town!.map!;
      expect(map.route.length).toBeGreaterThan(10);
      expect(new Set(map.route).size).toBe(map.route.length);
      const hit = createRoadHit();
      const rings = new Set(map.roundabouts.map((r) => r.node));
      let lefts = 0;
      let rights = 0;
      for (let k = 1; k < map.route.length - 1; k++) {
        const [p, n, q] = [map.route[k - 1]!, map.route[k]!, map.route[k + 1]!].map(
          (i) => map.nodes[i]!,
        );
        const turn = wrap(
          Math.atan2(q!.x - n!.x, q!.z - n!.z) - Math.atan2(n!.x - p!.x, n!.z - p!.z),
        );
        if (turn > 0.7) lefts++;
        if (turn < -0.7) rights++;
        if (rings.has(map.route[k]!)) continue;
        expect(stage.path.nearest(n!.x, n!.z, 40, hit)).toBe(true);
        // A corner's arc cuts inside its crossroads by r(sec(t/2) − 1), r at most 15 m.
        const cut = 15 * (1 / Math.cos(Math.abs(turn) / 2) - 1);
        expect(hit.distance, `${seed} node ${k}`).toBeLessThan(cut + 1);
      }
      expect(lefts).toBeGreaterThan(0);
      expect(rights).toBeGreaterThan(0);
    }
  });

  it('builds each roundabout round the island the map planned', () => {
    let rings = 0;
    for (const seed of SEEDS) {
      const town = generateStage(seed, stageIndexOf('urban', 1)).town!;
      const planned = town.map!.roundabouts;
      expect(planned.length).toBe(town.roundabouts?.length ?? 0);
      for (const r of planned) {
        const built = town.roundabouts!.find((b) => Math.hypot(b.x - r.x, b.z - r.z) < 1);
        expect(built, `seed ${seed}`).toBeDefined();
        rings++;
      }
    }
    expect(rings).toBeGreaterThan(3);
  });

  it('works out a roundabout passage that comes back onto its line', () => {
    const through = ringPassage(15, 0);
    expect(through.before).toBeCloseTo(through.after, 6);
    // The island lies left of the line.
    expect(through.centre.x).toBeGreaterThan(5);
    const left = ringPassage(15, Math.PI / 2);
    expect(left.before).toBeGreaterThan(0);
    expect(left.after).toBeGreaterThan(0);
  });
});
