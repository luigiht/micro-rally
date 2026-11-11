import { describe, expect, it } from 'vitest';
import { STAGE_TYPES } from '@/game/stage/regions';
import { createRoadHit } from '@/game/stage/RoadPath';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { createStageWorld } from '@/game/stage/StageWorld';
import { Autopilot } from '@/game/vehicle/Autopilot';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { createControlInput } from '@/game/vehicle/ControlInput';
import { DEFAULT_ENV, VehicleSim } from '@/game/vehicle/VehicleSim';
import { stageIndexOf } from './stageIndex';

const DT = 1 / 120;

/** Drive `seconds` (or to `until` metres along the road); the furthest it got and how far off the road it strayed. */
function drive(seed: number, index: number, carId: keyof typeof CAR_SPECS, seconds: number) {
  const { stage, field } = createStageWorld(seed, index);
  const spec = CAR_SPECS[carId];
  const handling = STAGE_TYPES[stage.stageType].handling;
  const env = handling
    ? {
        ...DEFAULT_ENV,
        gripScale: handling.grip,
        steerSensitivity: handling.steer,
        steerLock: handling.lock,
      }
    : DEFAULT_ENV;
  const sim = new VehicleSim(spec);
  sim.reset(stage.spawn, field);
  const pilot = new Autopilot(stage.path, spec, undefined, stage.startDistance);
  const input = createControlInput();
  const hit = createRoadHit();
  let off = 0;
  let travelled = 0;
  let last = stage.startDistance;
  for (let t = 0; t < seconds; t += DT) {
    sim.step(DT, pilot.drive(sim.state, env, input), field, env);
    const s = sim.state;
    if (stage.path.nearest(s.x, s.z, 60, hit)) {
      off = Math.max(off, hit.distance - halfWidthAt(stage, hit.along));
      let d = hit.along - last;
      if (stage.circuit) d -= Math.round(d / stage.path.length) * stage.path.length;
      if (Math.abs(d) < 20) travelled += d;
      last = hit.along;
    }
  }
  return { travelled, off, length: stage.length };
}

describe('autopilot', () => {
  it('drives every rally stage type a long way down the road without leaving it', () => {
    for (const stageType of [
      'pinewood',
      'autumnal',
      'alpine',
      'arctic',
      'coastal',
      'desert',
    ] as const) {
      const r = drive(1, stageIndexOf(stageType), 'hatchback', 40);
      expect(r.travelled, stageType).toBeGreaterThan(350);
      expect(r.off, stageType).toBeLessThan(1.5);
    }
  }, 60_000);

  it('drives a city and laps a circuit', () => {
    const city = drive(1, stageIndexOf('urban'), 'saloon', 40);
    expect(city.travelled).toBeGreaterThan(300);
    expect(city.off).toBeLessThan(1);
    const circuit = drive(1, stageIndexOf('circuit'), 'lemans', 40);
    expect(circuit.travelled).toBeGreaterThan(500);
    expect(circuit.off).toBeLessThan(2);
  }, 60_000);
});
