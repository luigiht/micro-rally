import { createControlInput, type ControlInput } from '@/game/vehicle/ControlInput';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import { VehicleSim } from '@/game/vehicle/VehicleSim';

export const DT = 1 / 120;

export function makeSim(spec: CarSpec, terrain: TerrainQuery, speed = 0, yaw = 0): VehicleSim {
  const sim = new VehicleSim(spec);
  sim.reset({ x: 0, z: 0, yaw }, terrain, speed);
  return sim;
}

export function input(partial: Partial<ControlInput>): ControlInput {
  return { ...createControlInput(), ...partial };
}

export function run(
  sim: VehicleSim,
  terrain: TerrainQuery,
  seconds: number,
  controls: ControlInput,
  each?: (sim: VehicleSim) => void,
): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    sim.step(DT, controls, terrain);
    each?.(sim);
  }
}
