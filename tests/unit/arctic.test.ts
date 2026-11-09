import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/game/stage/regions';
import { stageHasTown, stageRegion } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { DEFAULT_ENV } from '@/game/vehicle/VehicleSim';
import { stageIndexOf } from './stageIndex';

const ARCTIC_INDEX = stageIndexOf('arctic');
const SEEDS = [1, 2, 3];
const ARCTIC = REGIONS.arctic;

describe('Arctic stages', () => {
  it('sit in the rally mix, never through a village, on snow', () => {
    expect(ARCTIC_INDEX).toBe(4);
    expect(stageRegion(ARCTIC_INDEX).region).toBe('arctic');
    expect(ARCTIC.towns).toBe(false);
    for (let i = 0; i < 200; i++)
      if (stageRegion(i).region === 'arctic') expect(stageHasTown(i), `stage ${i}`).toBe(false);
    for (const seed of SEEDS) {
      const stage = createStageWorld(seed, ARCTIC_INDEX).stage;
      expect(stage.region).toBe('arctic');
      expect(stage.surface).toBe('snow');
      expect(stage.town).toBeUndefined();
    }
  });

  it('heap a snow bank beside the carriageway that the wheels climb', () => {
    const banks = ARCTIC.terrain.banks!;
    for (const seed of SEEDS) {
      const { field, stage } = createStageWorld(seed, ARCTIC_INDEX);
      const s = { x: 0, z: 0, heading: 0 };
      stage.path.sample(300, s);
      const lx = Math.cos(s.heading);
      const lz = -Math.sin(s.heading);
      const onRoad = field.heightAt(s.x, s.z);
      const crest = stage.halfWidth + 0.6 + banks.width / 2;
      const onBank = field.heightAt(s.x + lx * crest, s.z + lz * crest);
      expect(onBank - onRoad).toBeGreaterThan(banks.height * 0.6);
      // The mesh heaps it too.
      const sample = field.sample(s.x + lx * crest, s.z + lz * crest, {
        height: 0,
        roadBlend: 0,
        roadDistance: 0,
      });
      expect(sample.height - onRoad).toBeGreaterThan(banks.height * 0.5);
    }
  });

  it('raise crests on the straights, a hump the car can jump, clear of the gates', () => {
    const crests = ARCTIC.terrain.crests!;
    for (const seed of SEEDS) {
      const { field, stage } = createStageWorld(seed, ARCTIC_INDEX);
      expect(field.crestsAt.length).toBeGreaterThanOrEqual(3);
      for (const at of field.crestsAt) {
        const top = field.roadHeightAt(at);
        const foot =
          (field.roadHeightAt(at - crests.length / 2) +
            field.roadHeightAt(at + crests.length / 2)) /
          2;
        expect(top - foot).toBeGreaterThan(crests.height * 0.7);
        for (const g of stage.gates)
          expect(Math.abs(g.distance - at)).toBeGreaterThan(crests.length / 2 + 10);
      }
      // Never on a steep road: the limiter's grade plus the hump's stays under 17 %.
      for (let d = 2; d < stage.path.length - 4; d += 2)
        expect(Math.abs(field.roadHeightAt(d + 2) - field.roadHeightAt(d)) / 2).toBeLessThan(0.17);
    }
  });

  it('handle with studded-tyre grip and quicker, deeper steering than the defaults', () => {
    expect(DEFAULT_ENV.steerLock).toBe(1);
    const h = ARCTIC.handling!;
    expect(h.grip).toBeGreaterThan(1.2);
    expect(h.steer).toBeGreaterThan(1);
    expect(h.lock).toBeGreaterThan(1);
    expect(REGIONS.alpine.handling).toBeUndefined();
  });
});
