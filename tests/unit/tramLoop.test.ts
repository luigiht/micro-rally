import { describe, expect, it } from 'vitest';
import { loopAt, MIN_CROSSINGS } from '@/game/stage/city/TramLoop';
import { createRoadHit } from '@/game/stage/RoadPath';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { generateStage } from '@/game/stage/StageGenerator';
import { segmentDistance, streetDistance, townProps } from '@/game/stage/Town';
import { TRAM_BED_HALF } from '@/game/stage/Tram';
import {
  loopFleet,
  loopPose,
  loopSectionPose,
  SECTION_LENGTH,
  TRAM_BELLOWS,
  TRAM_LENGTH,
} from '@/game/stage/TramService';
import { buildingIndex } from '@/game/stage/BuildingIndex';
import { stageIndexOf } from './stageIndex';

const SEEDS = [1, 2, 3, 4, 5, 6];

// Generating a city takes about a second, so tests that build several get time for it.
describe('tram loop', { timeout: 30_000 }, () => {
  const stages = SEEDS.map((seed) => generateStage(seed, stageIndexOf('urban', 1)));

  it('closes round a few blocks, its corners eased, on the streets all the way', () => {
    const hit = createRoadHit();
    for (const stage of stages) {
      const loop = stage.town!.tramLoop!;
      expect(loop).toBeDefined();
      expect(loop.length).toBeGreaterThan(800);
      expect(loop.length).toBeLessThan(2600);
      const n = loop.xs.length;
      // Closed: the last sample runs into the first like any other.
      const gaps = loop.xs.map((x, k) =>
        Math.hypot(loop.xs[(k + 1) % n]! - x, loop.zs[(k + 1) % n]! - loop.zs[k]!),
      );
      expect(Math.max(...gaps)).toBeLessThan(6);
      // Eased: no turn sharper than a 10 m radius between neighbouring samples.
      for (let k = 0; k < n; k++) {
        const [a, b, c] = [k - 1, k, k + 1].map((i) => ((i % n) + n) % n);
        const h1 = Math.atan2(loop.xs[b!]! - loop.xs[a!]!, loop.zs[b!]! - loop.zs[a!]!);
        const h2 = Math.atan2(loop.xs[c!]! - loop.xs[b!]!, loop.zs[c!]! - loop.zs[b!]!);
        const turn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
        const step = (gaps[a!]! + gaps[b!]!) / 2;
        if (turn > 1e-3) expect(step / turn).toBeGreaterThan(10);
      }
      // Every sample lies on a carriageway: the route's or a street's.
      const town = stage.town!;
      const off = loop.xs.filter((x, k) => {
        const z = loop.zs[k]!;
        if (stage.path.nearest(x, z, 30, hit) && hit.distance < halfWidthAt(stage, hit.along) + 0.5)
          return false;
        return !town.streets.some(
          (st) => !st.route && streetDistance(st, x, z) < st.halfWidth + 0.5,
        );
      });
      expect(off.length).toBeLessThan(n * 0.03);
    }
  });

  it('is crossed by the route at four crossroads or more, its rails square across the road', () => {
    const hit = createRoadHit();
    for (const stage of stages) {
      const loop = stage.town!.tramLoop!;
      // Where a loop piece cuts the route at 30° or more, clustered to one point per crossing.
      const { xs, zs, count } = stage.path;
      const points: { x: number; z: number }[] = [];
      const n = loop.xs.length;
      for (let k = 0; k < n; k++) {
        const ax = loop.xs[k]!;
        const az = loop.zs[k]!;
        const bx = loop.xs[(k + 1) % n]!;
        const bz = loop.zs[(k + 1) % n]!;
        if (!stage.path.nearest((ax + bx) / 2, (az + bz) / 2, 6, hit)) continue;
        for (let i = Math.max(0, hit.index - 4); i < Math.min(count - 1, hit.index + 4); i++) {
          const cx = xs[i]!;
          const cz = zs[i]!;
          const dx = xs[i + 1]!;
          const dz = zs[i + 1]!;
          const o = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number) =>
            Math.sign((qx - px) * (rz - pz) - (qz - pz) * (rx - px));
          if (o(ax, az, bx, bz, cx, cz) * o(ax, az, bx, bz, dx, dz) >= 0) continue;
          if (o(cx, cz, dx, dz, ax, az) * o(cx, cz, dx, dz, bx, bz) >= 0) continue;
          const angle = Math.abs(
            Math.sin(Math.atan2(bx - ax, bz - az) - Math.atan2(dx - cx, dz - cz)),
          );
          if (angle > 0.5 && !points.some((p) => Math.hypot(p.x - cx, p.z - cz) < 20))
            points.push({ x: cx, z: cz });
        }
      }
      expect(points.length, `seed ${stage.seed}`).toBeGreaterThanOrEqual(MIN_CROSSINGS);
    }
  });

  it('runs its trams evenly spaced round it, never into each other', () => {
    const stage = stages[0]!;
    const fleet = loopFleet(stage.town!.tramLoop!, stage.seed);
    expect(fleet.offsets.length).toBeGreaterThanOrEqual(2);
    const pose = { x: 0, z: 0, heading: 0, opacity: 1 };
    for (const t of [0, 13, 47, 120]) {
      const at = fleet.offsets.map((_, k) => ({ ...loopPose(fleet, k, t, pose) }));
      for (let a = 0; a < at.length; a++)
        for (let b = a + 1; b < at.length; b++)
          expect(Math.hypot(at[a]!.x - at[b]!.x, at[a]!.z - at[b]!.z)).toBeGreaterThan(TRAM_LENGTH);
    }
    // A pose sits on the loop.
    const p = { x: 0, z: 0, heading: 0 };
    loopAt(stage.town!.tramLoop!, 123, p);
    expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
  });

  it('bends its trams car by car round the curves, joined at the bellows', () => {
    const stage = stages[0]!;
    const fleet = loopFleet(stage.town!.tramLoop!, stage.seed);
    const pose = { x: 0, z: 0, heading: 0, opacity: 1 };
    let bent = 0;
    for (let t = 0; t < 200; t += 0.5) {
      const cars = [0, 1, 2].map((c) => ({ ...loopSectionPose(fleet, 0, c, t, pose) }));
      const headings = cars.map((c) => c.heading);
      const spread = Math.abs(
        Math.atan2(Math.sin(headings[2]! - headings[0]!), Math.cos(headings[2]! - headings[0]!)),
      );
      if (spread > 0.2) bent++;
      // Each car's front end meets the next car's rear end across the bellows.
      for (let c = 0; c < 2; c++) {
        const a = cars[c]!;
        const b = cars[c + 1]!;
        const front = {
          x: a.x + Math.sin(a.heading) * (SECTION_LENGTH / 2),
          z: a.z + Math.cos(a.heading) * (SECTION_LENGTH / 2),
        };
        const rear = {
          x: b.x - Math.sin(b.heading) * (SECTION_LENGTH / 2),
          z: b.z - Math.cos(b.heading) * (SECTION_LENGTH / 2),
        };
        expect(Math.hypot(front.x - rear.x, front.z - rear.z)).toBeLessThan(TRAM_BELLOWS + 0.6);
      }
    }
    // Round the loop's corners the cars turn on their own: the tram does not cut across stiff.
    expect(bent).toBeGreaterThan(5);
  });

  it('hangs the contact wire from span wires anchored on the facades either side', () => {
    for (const stage of stages) {
      const spans = stage.town!.tramLoop!.spans ?? [];
      expect(spans.length).toBeGreaterThan(4);
      const index = buildingIndex(stage.town!.buildings);
      for (const sp of spans)
        for (const [sign, out] of [
          [1, sp.left],
          [-1, sp.right],
        ] as const) {
          const x = sp.x + Math.cos(sp.heading) * out * sign;
          const z = sp.z - Math.sin(sp.heading) * out * sign;
          expect(index.covers(x, z, 0.7)).toBe(true);
          expect(out).toBeGreaterThan(4);
        }
    }
  });

  it('keeps direction boards and cones off the rails, the boards in pairs either side', () => {
    for (const stage of stages) {
      const town = stage.town!;
      const near = (x: number, z: number, d: number) =>
        (town.trams ?? []).some((t) => segmentDistance(t.x0, t.z0, t.x1, t.z1, x, z) < d);
      for (const a of town.arrows) expect(near(a.x, a.z, TRAM_BED_HALF + 0.5)).toBe(false);
      for (const p of townProps(town, { deckAt: () => 0, heightAt: () => 0 }))
        if (p.kind === 'cone') expect(near(p.x, p.z, TRAM_BED_HALF)).toBe(false);
    }
  });
});
