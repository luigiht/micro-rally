import { describe, expect, it } from 'vitest';
import { STAGE_TYPES, type StageTypeId } from '@/game/stage/regions';
import { CAR_SPECS, type CarId } from '@/game/vehicle/CarSpec';
import { SURFACES } from '@/game/vehicle/surfaces';
import { DEFAULT_ENV } from '@/game/vehicle/VehicleSim';
import { DT, input, makeSim } from './vehicleHarness';

/** km/h after `seconds` of full throttle from a standstill up a steady `grade` on the stage type's road. */
function climb(stageType: StageTypeId, car: CarId, gripScale: number, grade = 0.1, seconds = 8) {
  const terrain = {
    heightAt: (_x: number, z: number) => z * grade,
    surfaceAt: () => STAGE_TYPES[stageType].surface,
  };
  const sim = makeSim(CAR_SPECS[car], terrain);
  const env = { ...DEFAULT_ENV, gripScale };
  const throttle = input({ throttle: 1 });
  for (let i = 0; i < Math.round(seconds / DT); i++) sim.step(DT, throttle, terrain, env);
  return Math.hypot(sim.state.vx, sim.state.vz) * 3.6;
}

describe('climbing grip on the Alpine and Autumnal stages', () => {
  it('raises grip without touching steering, keeping snow and mud below gravel', () => {
    for (const id of ['alpine', 'autumnal'] as const) {
      const def = STAGE_TYPES[id];
      const h = def.handling!;
      expect(h.grip).toBeGreaterThan(1.2);
      expect([h.steer, h.lock]).toEqual([1, 1]);
      expect(SURFACES[def.surface].grip * h.grip).toBeLessThan(SURFACES.gravel.grip);
    }
  });

  it('lets the cars climb a 10 % grade markedly faster than the old grip did', () => {
    for (const id of ['alpine', 'autumnal'] as const) {
      const grip = STAGE_TYPES[id].handling!.grip;
      for (const car of ['wrc', 'groupb', 'coupe'] as const)
        expect(climb(id, car, grip) - climb(id, car, 1)).toBeGreaterThan(10);
      // No car climbs slower for the extra grip.
      for (const car of Object.keys(CAR_SPECS) as CarId[])
        expect(climb(id, car, grip)).toBeGreaterThanOrEqual(climb(id, car, 1) - 0.5);
    }
  });
});
