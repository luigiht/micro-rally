import { describe, expect, it } from 'vitest';
import { CATALOG_IDS } from '@/game/economy/cars';
import { CAR_SPECS, type CarId } from '@/game/vehicle/CarSpec';
import { autoShift, torqueAt } from '@/game/vehicle/Drivetrain';
import { SURFACES } from '@/game/vehicle/surfaces';
import { flatTerrain } from '@/game/vehicle/Terrain';
import { testTrackTerrain, TEST_TRACK } from '@/game/stage/TestTrack';
import { GRAVITY, VehicleSim } from '@/game/vehicle/VehicleSim';
import { input, makeSim, run } from './vehicleHarness';

const tarmac = flatTerrain('tarmac');

function topSpeedKmh(id: CarId): number {
  const sim = makeSim(CAR_SPECS[id], tarmac);
  run(sim, tarmac, 90, input({ throttle: 1 }));
  return sim.state.speed * 3.6;
}

function brakingDistance(id: CarId, surface: keyof typeof SURFACES): number {
  const ground = flatTerrain(surface);
  const sim = makeSim(CAR_SPECS[id], ground, 100 / 3.6);
  const z0 = sim.state.z;
  const controls = input({ brake: 1 });
  for (let i = 0; i < 120 * 30 && sim.state.speed > 0.01; i++) sim.step(1 / 120, controls, ground);
  return sim.state.z - z0;
}

/** Mean lateral acceleration on a skidpad with full lock at ~60 km/h. */
function skidpadLateralG(surface: keyof typeof SURFACES): number {
  const ground = flatTerrain(surface);
  const sim = makeSim(CAR_SPECS.hatchback, ground, 16);
  let sum = 0;
  let n = 0;
  run(sim, ground, 2, input({ steer: 1, throttle: 0.35 }), (s) => {
    sum += Math.abs(s.state.latAccel);
    n++;
  });
  return sum / n / 9.81;
}

describe('Drivetrain', () => {
  it('torque curve peaks mid-range and cuts at the limiter', () => {
    const spec = CAR_SPECS.hatchback;
    expect(torqueAt(spec, spec.redlineRpm * 0.6)).toBeCloseTo(spec.peakTorque);
    expect(torqueAt(spec, spec.redlineRpm * 0.2)).toBeLessThan(spec.peakTorque);
    expect(torqueAt(spec, spec.redlineRpm + 1)).toBe(0);
  });

  it('upshifts at high revs and downshifts when slow', () => {
    const spec = CAR_SPECS.hatchback;
    expect(autoShift(spec, 17, 1)).toBe(2);
    expect(autoShift(spec, 5, 3)).toBe(2);
    expect(autoShift(spec, 14, 2)).toBe(2);
  });
});

/** Largest body slip angle (rad) while cornering under power from ~70 km/h. */
function maxBodySlip(id: CarId, surface: keyof typeof SURFACES, steer = 1, throttle = 0.5): number {
  const ground = flatTerrain(surface);
  const sim = makeSim(CAR_SPECS[id], ground, 20);
  let worst = 0;
  run(sim, ground, 2.5, input({ steer, throttle }), (s) => {
    worst = Math.max(worst, Math.abs(Math.atan2(s.state.lateralSpeed, Math.abs(s.state.speed))));
  });
  return worst;
}

describe('VehicleSim', () => {
  it('top speeds sit in their intended bands and order', () => {
    const v = {
      hatchback: topSpeedKmh('hatchback'),
      coupe: topSpeedKmh('coupe'),
      pickup: topSpeedKmh('pickup'),
      monster: topSpeedKmh('monster'),
    };
    expect(v.hatchback).toBeGreaterThan(135);
    expect(v.hatchback).toBeLessThan(170);
    expect(v.coupe).toBeGreaterThan(170);
    expect(v.coupe).toBeLessThan(215);
    expect(v.pickup).toBeGreaterThan(115);
    expect(v.pickup).toBeLessThan(150);
    expect(v.monster).toBeGreaterThan(185);
    expect(v.monster).toBeLessThan(240);
    expect(v.monster).toBeGreaterThan(v.coupe);
    expect(v.coupe).toBeGreaterThan(v.hatchback);
    expect(v.hatchback).toBeGreaterThan(v.pickup);
  });

  it('reaches 100 km/h from rest in a cozy-but-lively time', () => {
    const sim = makeSim(CAR_SPECS.hatchback, tarmac);
    let t = 0;
    while (sim.state.speed < 100 / 3.6 && t < 30) {
      sim.step(1 / 120, input({ throttle: 1 }), tarmac);
      t += 1 / 120;
    }
    expect(t).toBeGreaterThan(5);
    expect(t).toBeLessThan(11);
  });

  it('brakes from 100 km/h in 35–55 m on tarmac', () => {
    const d = brakingDistance('hatchback', 'tarmac');
    expect(d).toBeGreaterThan(35);
    expect(d).toBeLessThan(55);
  });

  it('braking distance grows as grip falls', () => {
    const tarmacD = brakingDistance('hatchback', 'tarmac');
    const gravelD = brakingDistance('hatchback', 'gravel');
    const snowD = brakingDistance('hatchback', 'snow');
    expect(gravelD).toBeGreaterThan(tarmacD);
    expect(snowD).toBeGreaterThan(gravelD);
  });

  it('cornering grip orders tarmac > gravel > grass > mud > snow', () => {
    const g = (['tarmac', 'gravel', 'grass', 'mud', 'snow'] as const).map(skidpadLateralG);
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeLessThan(g[i - 1]!);
    expect(g[0]).toBeGreaterThan(0.6);
  });

  it('grass and mud slow the car compared with tarmac', () => {
    const speedOn = (surface: 'tarmac' | 'grass' | 'mud') => {
      const ground = flatTerrain(surface);
      const sim = makeSim(CAR_SPECS.hatchback, ground);
      run(sim, ground, 20, input({ throttle: 1 }));
      return sim.state.speed;
    };
    expect(speedOn('grass')).toBeLessThan(speedOn('tarmac') * 0.85);
    expect(speedOn('mud')).toBeLessThan(speedOn('grass'));
  });

  it('every car stays composed through a fast corner under power on tarmac', () => {
    for (const id of CATALOG_IDS) {
      expect(maxBodySlip(id, 'tarmac'), id).toBeLessThan(0.1);
    }
  });

  it('every car holds on through a gravel corner, on and off the throttle', () => {
    for (const id of CATALOG_IDS) {
      expect(maxBodySlip(id, 'gravel'), id).toBeLessThan(0.12);
      expect(maxBodySlip(id, 'gravel', 0.5, 0), `${id} lift-off`).toBeLessThan(0.12);
    }
  });

  it('settles with the wheels on the ground and the body sagging on its springs', () => {
    const spec = CAR_SPECS.hatchback;
    const sim = makeSim(spec, tarmac, 0);
    run(sim, tarmac, 2, input({}));
    const s = sim.state;
    // The pose exposes both heights so the model can keep the tyres on the surface.
    expect(s.groundHeight - s.y).toBeCloseTo(GRAVITY / spec.suspensionStiffness, 2);
    expect(s.groundHeight - s.y).toBeGreaterThan(0);
  });

  it('steering assist keeps full lock from ploughing the front tyres', () => {
    const sim = makeSim(CAR_SPECS.hatchback, tarmac, 20);
    let worst = 0;
    run(sim, tarmac, 2, input({ steer: 1, throttle: 0.4 }), (s) => {
      worst = Math.max(worst, s.state.slipFront);
    });
    expect(worst).toBeLessThan(0.2);
    expect(Math.abs(sim.state.steerAngle)).toBeLessThan(CAR_SPECS.hatchback.maxSteer / 2);
  });

  it('reports the handbrake and per-axle spin for the tyre marks', () => {
    const sim = makeSim(CAR_SPECS.coupe, flatTerrain('snow'), 5);
    run(sim, flatTerrain('snow'), 0.5, input({ throttle: 1 }));
    expect(sim.state.spinRear).toBeGreaterThan(0.2);
    expect(sim.state.spinFront).toBe(0);
    expect(sim.state.handbrake).toBe(false);
    run(sim, flatTerrain('snow'), 0.1, input({ handbrake: true }));
    expect(sim.state.handbrake).toBe(true);
  });

  it('steer right turns right and steer left turns left', () => {
    const right = makeSim(CAR_SPECS.hatchback, tarmac, 10);
    run(right, tarmac, 1, input({ steer: 1, throttle: 0.3 }));
    expect(right.state.x).toBeLessThan(-0.5);
    const left = makeSim(CAR_SPECS.hatchback, tarmac, 10);
    run(left, tarmac, 1, input({ steer: -1, throttle: 0.3 }));
    expect(left.state.x).toBeGreaterThan(0.5);
  });

  it('holding brake from rest reverses', () => {
    const sim = makeSim(CAR_SPECS.hatchback, tarmac);
    run(sim, tarmac, 2, input({ brake: 1 }));
    expect(sim.state.gear).toBe(-1);
    expect(sim.state.speed).toBeLessThan(-2);
  });

  it('handbrake at speed kicks the rear out', () => {
    const plain = makeSim(CAR_SPECS.hatchback, tarmac, 20);
    run(plain, tarmac, 0.8, input({ steer: 0.5 }));
    const flick = makeSim(CAR_SPECS.hatchback, tarmac, 20);
    run(flick, tarmac, 0.8, input({ steer: 0.5, handbrake: true }));
    expect(flick.state.slipRear).toBeGreaterThan(plain.state.slipRear * 2);
  });

  it('settles on flat ground without drifting', () => {
    const sim = makeSim(CAR_SPECS.pickup, tarmac);
    run(sim, tarmac, 3, input({}));
    expect(Math.abs(sim.state.vy)).toBeLessThan(0.01);
    expect(Math.hypot(sim.state.x, sim.state.z)).toBeLessThan(0.01);
    expect(sim.state.grounded).toBe(true);
  });

  it('gets airborne off the test ramp and lands', () => {
    const r = TEST_TRACK.ramp;
    const sim = new VehicleSim(CAR_SPECS.hatchback);
    sim.reset({ x: r.cx, z: r.z0 - 30, yaw: 0 }, testTrackTerrain, 22);
    let maxAir = 0;
    run(sim, testTrackTerrain, 4, input({ throttle: 0.6 }), (s) => {
      maxAir = Math.max(maxAir, s.state.airTime);
    });
    expect(maxAir).toBeGreaterThan(0.3);
    expect(sim.state.landings).toBeGreaterThanOrEqual(1);
    expect(sim.state.grounded).toBe(true);
  });

  it('turbo adds acceleration only when fitted', () => {
    const withTurbo = { ...CAR_SPECS.hatchback, turboForce: 0.5 };
    const boosted = makeSim(withTurbo, tarmac, 15);
    run(boosted, tarmac, 2, input({ throttle: 1, turbo: true }));
    const plain = makeSim(CAR_SPECS.hatchback, tarmac, 15);
    run(plain, tarmac, 2, input({ throttle: 1, turbo: true }));
    expect(boosted.state.speed).toBeGreaterThan(plain.state.speed + 1);
    expect(boosted.state.turboCharge).toBeLessThan(1);
  });

  it('is deterministic', () => {
    const a = makeSim(CAR_SPECS.coupe, testTrackTerrain);
    const b = makeSim(CAR_SPECS.coupe, testTrackTerrain);
    const controls = input({ throttle: 1, steer: 0.4 });
    run(a, testTrackTerrain, 5, controls);
    run(b, testTrackTerrain, 5, controls);
    expect(a.state).toEqual(b.state);
  });

  it('retunes to another car without moving, clamping the gear to the new box', () => {
    const sim = new VehicleSim(CAR_SPECS.hatchback);
    sim.state.x = 12;
    sim.state.speed = 20;
    sim.state.gear = 5;
    const twoSpeed = { ...CAR_SPECS.coupe, gearRatios: [3, 2] };
    sim.retune(twoSpeed);
    expect(sim.spec).toBe(twoSpeed);
    expect(sim.state.x).toBe(12);
    expect(sim.state.speed).toBe(20);
    expect(sim.state.gear).toBe(2);
  });
});
