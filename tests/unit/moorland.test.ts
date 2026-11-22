import { describe, expect, it } from 'vitest';
import { parseSaveFile, SAVE_VERSION } from '@/game/save/SaveFile';
import { RAIN_GRIP, STAGE_TYPES, stageGripScale, stageSlot } from '@/game/stage/regions';
import { generateStage, stageBrief } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { TerrainField } from '@/game/stage/TerrainField';
import { SPLASH_PAR_SECONDS, splashCount } from '@/game/stage/Watersplashes';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import type { Surface } from '@/game/vehicle/surfaces';
import { resolveObstacleCollisions } from '@/game/vehicle/Collisions';
import { DEFAULT_ENV, VehicleSim } from '@/game/vehicle/VehicleSim';
import { DT, input, makeSim } from './vehicleHarness';
import { stageIndexOf, typeV14 } from './stageIndex';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('Moorland', () => {
  it('rains on wet gravel, last in the rally mix', () => {
    const index = stageIndexOf('moorland');
    expect(stageSlot(index)).toBe('moorland');
    // The ninth rally stage: after the eight types that came before it.
    expect(index).toBe(10);
    for (const seed of SEEDS) {
      const stage = generateStage(seed, index);
      expect(stage.surface).toBe('gravel');
      expect(stage.weather).toBe('rain');
      expect(stage.town).toBeUndefined();
    }
    // Rain takes a tenth off the grip; dry stages keep theirs.
    expect(stageGripScale('moorland', 'rain')).toBeCloseTo(RAIN_GRIP);
    expect(stageGripScale('pinewood', 'clear')).toBe(1);
    expect(stageGripScale('autumnal', 'clear')).toBe(STAGE_TYPES.autumnal.handling!.grip);
  });

  it('builds no houses and bridges no lake, on any loop', () => {
    for (const nth of [0, 3, 6])
      for (const seed of SEEDS.slice(0, 4)) {
        const world = createStageWorld(seed, stageIndexOf('moorland', nth));
        expect(world.props.some((p) => p.kind === 'house')).toBe(false);
        expect(world.field.lakes.some((l) => l.bridge)).toBe(false);
      }
  });

  it('fences the open road in wood that stops a car, a post at each end', () => {
    for (const seed of SEEDS.slice(0, 3)) {
      const world = createStageWorld(seed, stageIndexOf('moorland'));
      const farms = world.farms!;
      expect(farms.fences.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(farms.sheep.length).toBeGreaterThan(0);
      const spans = farms.fences.reduce((n, f) => n + f.posts.length - 1, 0);
      expect(world.obstacles.boxes.length).toBeGreaterThanOrEqual(spans);
      // A car driven square at a fence span's middle is stopped short of crossing it.
      const fence = farms.fences[0]!;
      const a = fence.posts[1]!;
      const b = fence.posts[2] ?? fence.posts[0]!;
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const along = Math.atan2(b.x - a.x, b.z - a.z);
      const sim = new VehicleSim(CAR_SPECS.hatchback);
      const flat = { heightAt: () => 0, surfaceAt: (): Surface => 'grass' };
      // Start 6 m off the fence on one side, facing it.
      const yaw = along + Math.PI / 2;
      sim.reset({ x: mx - Math.sin(yaw) * 6, z: mz - Math.cos(yaw) * 6, yaw }, flat, 8);
      for (let i = 0; i < Math.round(2 / DT); i++) {
        sim.step(DT, input({ throttle: 1 }), flat, DEFAULT_ENV);
        resolveObstacleCollisions(sim.state, world.obstacles);
      }
      // Still on its own side: its distance ahead of the fence line never turned positive.
      const ahead = (sim.state.x - mx) * Math.sin(yaw) + (sim.state.z - mz) * Math.cos(yaw);
      expect(ahead, `seed ${seed}`).toBeLessThan(0);
    }
  });

  it('lays six to ten watersplashes across the road, apart and clear of the gates', () => {
    for (const seed of SEEDS)
      for (const nth of [0, 1]) {
        const stage = generateStage(seed, stageIndexOf('moorland', nth));
        const field = new TerrainField(stage);
        const style = STAGE_TYPES.moorland.splashes!;
        const splashes = field.splashes;
        expect(splashes.length, `seed ${seed}`).toBe(splashCount(stage.seed, style));
        expect(splashes.length).toBeGreaterThanOrEqual(6);
        expect(splashes.length).toBeLessThanOrEqual(10);
        const finish = stage.startDistance + stage.length;
        for (const [k, s] of splashes.entries()) {
          expect(s.to - s.from).toBeGreaterThanOrEqual(style.length[0] - 1e-6);
          expect(s.to - s.from).toBeLessThanOrEqual(style.length[1] + 1e-6);
          expect(s.from).toBeGreaterThan(stage.startDistance + 100);
          expect(s.to).toBeLessThan(finish - 100);
          for (const g of stage.gates) expect(Math.abs(g.distance - s.along)).toBeGreaterThan(40);
          if (k > 0) expect(s.along - splashes[k - 1]!.along).toBeGreaterThanOrEqual(110);
        }
      }
  });

  it('floods the carriageway from edge to edge inside a splash, and only there', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const stage = generateStage(seed, stageIndexOf('moorland'));
      const field = new TerrainField(stage);
      const at = { x: 0, z: 0, heading: 0 };
      for (const s of field.splashes) {
        const hw = halfWidthAt(stage, s.along);
        stage.path.sample(s.along, at);
        for (const lat of [-hw + 0.2, -hw / 2, 0, hw / 2, hw - 0.2]) {
          const x = at.x + Math.cos(at.heading) * lat;
          const z = at.z - Math.sin(at.heading) * lat;
          expect(field.surfaceAt(x, z)).toBe('water');
        }
        for (const d of [s.from - 2, s.to + 2]) {
          stage.path.sample(d, at);
          expect(field.surfaceAt(at.x, at.z)).toBe('gravel');
        }
      }
    }
  });

  it("allows for each splash's wading in the par time", () => {
    const index = stageIndexOf('moorland');
    for (const seed of SEEDS) {
      const brief = stageBrief(seed, index);
      const def = STAGE_TYPES.moorland;
      const dry = brief.length / def.parSpeed;
      const wading = splashCount(brief.seed, def.splashes!) * SPLASH_PAR_SECONDS;
      expect(brief.parTime).toBe(Math.round(dry + wading));
      expect(generateStage(seed, index).parTime).toBe(brief.parTime);
    }
  });

  it('slows a car through a splash noticeably, without stopping or spinning it', () => {
    // A straight gravel road with ten metres of water across it from 60 m on.
    const terrain = {
      heightAt: () => 0,
      surfaceAt: (_x: number, z: number): Surface => (z > 60 && z < 70 ? 'water' : 'gravel'),
    };
    const env = { ...DEFAULT_ENV, gripScale: RAIN_GRIP };
    for (const car of ['hatchback', 'wrc', 'dakar'] as const) {
      const sim = makeSim(CAR_SPECS[car], terrain, 25);
      const coast = input({ throttle: 0.6 });
      let before = 0;
      let after = 0;
      const yaw0 = sim.state.yaw;
      for (let i = 0; i < Math.round(6 / DT); i++) {
        sim.step(DT, coast, terrain, env);
        const v = Math.hypot(sim.state.vx, sim.state.vz) * 3.6;
        if (sim.state.z < 60) before = v;
        else if (sim.state.z >= 70 && after === 0) after = v;
      }
      const loss = before - after;
      expect(loss, car).toBeGreaterThan(5);
      expect(loss, car).toBeLessThan(20);
      expect(after, car).toBeGreaterThan(55);
      expect(Math.abs(sim.state.yaw - yaw0), car).toBeLessThan((3 * Math.PI) / 180);
    }
  });

  it('moves v14 saves on, keeping records only where the stage and its town are unchanged', () => {
    const rec = { best: 90, splits: [30, 60, 90] };
    // Stage 10 was a Pinewood on the eight-type mix and is the first Moorland now; 0 is still a
    // Pinewood; 8 is a city on every calendar.
    expect(typeV14(10)).toBe('pinewood');
    expect(stageSlot(10)).toBe('moorland');
    const save = parseSaveFile({
      version: 14,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: 11,
      records: { 0: rec, 8: rec, 10: rec },
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: 1,
    })!;
    // Read on through v16 (Savanna), which keeps both: stage 0 and the city never moved.
    expect(save.version).toBe(SAVE_VERSION);
    expect(
      Object.keys(save.records)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([0, 8]);
  });
});
