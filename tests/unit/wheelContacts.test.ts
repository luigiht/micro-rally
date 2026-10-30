import { describe, expect, it } from 'vitest';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { flatTerrain } from '@/game/vehicle/Terrain';
import { createVehicleState, type VehicleState } from '@/game/vehicle/VehicleSim';
import { createWheelContacts, wheelContacts } from '@/game/vehicle/wheelContacts';
import { input, makeSim, run } from './vehicleHarness';

const spec = CAR_SPECS.hatchback;
const ground = flatTerrain('tarmac', 2);

function rolling(patch: Partial<VehicleState>): VehicleState {
  return { ...createVehicleState(), speed: 15, grounded: true, surface: 'tarmac', ...patch };
}

describe('wheelContacts', () => {
  it('places the patches at the track corners on the ground', () => {
    const out = createWheelContacts();
    wheelContacts(out, { x: 10, z: 5, yaw: 0 }, rolling({}), spec, ground);
    const half = spec.trackWidth / 2;
    expect(out[0]!.x).toBeCloseTo(10 + half);
    expect(out[0]!.z).toBeCloseTo(5 + spec.cgToFront);
    expect(out[3]!.x).toBeCloseTo(10 - half);
    expect(out[3]!.z).toBeCloseTo(5 - spec.cgToRear);
    for (const c of out) expect(c.y).toBe(2);
  });

  it('rotates with the heading', () => {
    const out = createWheelContacts();
    wheelContacts(out, { x: 0, z: 0, yaw: Math.PI / 2 }, rolling({}), spec, ground);
    // Facing +X: the front axle is ahead along +X and the left side is on -Z.
    expect(out[0]!.x).toBeCloseTo(spec.cgToFront);
    expect(out[0]!.z).toBeCloseTo(-spec.trackWidth / 2);
  });

  it('leaves no marks when rolling straight or cornering hard with grip', () => {
    const out = createWheelContacts();
    const sim = makeSim(spec, ground, 20);
    run(sim, ground, 2, input({ throttle: 0.5 }));
    wheelContacts(out, sim.state, sim.state, spec, ground);
    for (const c of out) expect(c.intensity).toBe(0);
    run(sim, ground, 2.5, input({ throttle: 0.5, steer: 1 }), (s) => {
      wheelContacts(out, s.state, s.state, spec, ground);
      for (const c of out) expect(c.intensity).toBe(0);
    });
  });

  it('marks a handbrake turn', () => {
    const out = createWheelContacts();
    const sim = makeSim(spec, ground, 20);
    run(sim, ground, 0.5, input({ steer: 1, handbrake: true }));
    wheelContacts(out, sim.state, sim.state, spec, ground);
    expect(out[2]!.intensity).toBe(1);
    expect(out[3]!.intensity).toBe(1);
  });

  it('marks the rear wheels under the handbrake and the slipping axle otherwise', () => {
    const out = createWheelContacts();
    wheelContacts(out, { x: 0, z: 0, yaw: 0 }, rolling({ handbrake: true }), spec, ground);
    expect(out[0]!.intensity).toBe(0);
    expect(out[2]!.intensity).toBe(1);
    wheelContacts(out, { x: 0, z: 0, yaw: 0 }, rolling({ slipRear: 0.5 }), spec, ground);
    expect(out[1]!.intensity).toBe(0);
    expect(out[3]!.intensity).toBeGreaterThan(0.9);
    wheelContacts(out, { x: 0, z: 0, yaw: 0 }, rolling({ spinFront: 1 }), spec, ground);
    expect(out[0]!.intensity).toBeGreaterThan(0.9);
    expect(out[2]!.intensity).toBe(0);
  });

  it('is silent in the air and when crawling', () => {
    const out = createWheelContacts();
    wheelContacts(
      out,
      { x: 0, z: 0, yaw: 0 },
      rolling({ handbrake: true, grounded: false }),
      spec,
      ground,
    );
    expect(out[2]!.intensity).toBe(0);
    wheelContacts(
      out,
      { x: 0, z: 0, yaw: 0 },
      rolling({ handbrake: true, speed: 1 }),
      spec,
      ground,
    );
    expect(out[2]!.intensity).toBe(0);
  });
});
