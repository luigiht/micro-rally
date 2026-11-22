import { describe, expect, it } from 'vitest';
import { parseSaveFile, SAVE_VERSION } from '@/game/save/SaveFile';
import { coneHeight } from '@/game/stage/Cones';
import { createRoadHit } from '@/game/stage/RoadPath';
import { STAGE_TYPES, stageSlot } from '@/game/stage/regions';
import { generateStage } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { SURFACES, type Surface } from '@/game/vehicle/surfaces';
import { DEFAULT_ENV } from '@/game/vehicle/VehicleSim';
import { stageIndexOf, typeV15 } from './stageIndex';
import { DT, input, makeSim } from './vehicleHarness';

const SEEDS = [1, 2, 3, 4];

describe('Savanna', () => {
  it('runs last in the rally mix: clear skies over red murram, no towns', () => {
    const index = stageIndexOf('savanna');
    expect(index).toBe(11);
    expect(stageSlot(index)).toBe('savanna');
    for (const seed of SEEDS) {
      const stage = generateStage(seed, index);
      expect(stage.surface).toBe('gravel');
      expect(stage.weather).toBe('clear');
      expect(stage.town).toBeUndefined();
    }
    expect(STAGE_TYPES.savanna.palette.road).toBeDefined();
  });

  it('breaks the murram with fech-fech, fords a river or three, and rises to crests', () => {
    for (const seed of SEEDS) {
      const world = createStageWorld(seed, stageIndexOf('savanna'));
      const { stage, field } = world;
      const fech = (stage.surfaces ?? []).filter((s) => s.surface === 'fechfech');
      expect(fech.length, `seed ${seed}`).toBeGreaterThan(0);
      // `surfaceAt` reads it on the carriageway, wherever no ford lies across it.
      const span = fech[0]!;
      const along = (span.from + Math.min(span.to, stage.path.length)) / 2;
      if (!field.splashes.some((s) => along >= s.from - 1 && along <= s.to + 1)) {
        const at = { x: 0, z: 0, heading: 0 };
        stage.path.sample(along, at);
        expect(field.surfaceAt(at.x, at.z)).toBe('fechfech');
      }
      expect(field.splashes.length).toBeGreaterThanOrEqual(1);
      expect(field.splashes.length).toBeLessThanOrEqual(3);
      expect(field.crestsAt.length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('stands its volcanic cones far off every road', () => {
    for (const seed of SEEDS) {
      const { stage, field } = createStageWorld(seed, stageIndexOf('savanna'));
      expect(field.cones.length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      const hit = createRoadHit();
      for (const c of field.cones) {
        expect(c.height).toBeGreaterThan(40);
        expect(stage.path.nearest(c.x, c.z, c.radius, hit)).toBe(false);
        expect(coneHeight([c], c.x, c.z)).toBeGreaterThan(c.height * 0.6);
      }
    }
  });

  it('keeps its herds, plantations and mounds off the road, and the plants and mounds solid', () => {
    for (const seed of SEEDS) {
      const world = createStageWorld(seed, stageIndexOf('savanna'));
      const d = world.wildlife!;
      expect(d.animals.some((a) => a.kind === 'giraffe')).toBe(true);
      expect(d.animals.some((a) => a.kind === 'zebra')).toBe(true);
      expect(d.poles.length + d.mounds.length).toBeGreaterThan(0);
      const hit = createRoadHit();
      const { stage, field } = world;
      for (const a of d.animals)
        expect(stage.path.nearest(a.x, a.z, stage.halfWidth + 9, hit)).toBe(false);
      for (const p of [...d.poles, ...d.mounds]) {
        expect(stage.path.nearest(p.x, p.z, stage.halfWidth + 4, hit)).toBe(false);
        expect(field.inLake(p.x, p.z)).toBe(false);
      }
      expect(world.obstacles.boxes.length).toBeGreaterThanOrEqual(d.poles.length + d.mounds.length);
    }
  });

  it('slows a car through fech-fech without spinning it', () => {
    expect(SURFACES.fechfech.grip).toBeLessThan(SURFACES.gravel.grip);
    expect(SURFACES.fechfech.drag).toBeGreaterThan(SURFACES.gravel.drag);
    const run = (patch: Surface) => {
      const terrain = {
        heightAt: () => 0,
        surfaceAt: (_x: number, z: number): Surface => (z > 60 && z < 160 ? patch : 'gravel'),
      };
      const sim = makeSim(CAR_SPECS.wrc, terrain, 25);
      const yaw0 = sim.state.yaw;
      for (let i = 0; i < Math.round(5 / DT); i++)
        sim.step(DT, input({ throttle: 0.7 }), terrain, DEFAULT_ENV);
      return { z: sim.state.z, yaw: Math.abs(sim.state.yaw - yaw0) };
    };
    const gravel = run('gravel');
    const fech = run('fechfech');
    expect(fech.z).toBeLessThan(gravel.z);
    expect(fech.z).toBeGreaterThan(gravel.z * 0.8);
    expect(fech.yaw).toBeLessThan((3 * Math.PI) / 180);
  });

  it('moves v15 saves to v16, keeping records only where the stage and its town are unchanged', () => {
    const rec = { best: 90, splits: [30, 60, 90] };
    // Stage 11 was a Pinewood on the nine-type mix and is the first Savanna now; 0 is still a
    // Pinewood; 8 is a city on every calendar.
    expect(typeV15(11)).toBe('pinewood');
    expect(stageSlot(11)).toBe('savanna');
    const save = parseSaveFile({
      version: 15,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: 12,
      records: { 0: rec, 8: rec, 11: rec },
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: 1,
    })!;
    expect(SAVE_VERSION).toBe(16);
    expect(save.version).toBe(16);
    expect(
      Object.keys(save.records)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([0, 8]);
  });
});
