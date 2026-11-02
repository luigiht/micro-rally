import { describe, expect, it } from 'vitest';
import { ReplayTrack } from '@/game/replay/ReplayTrack';
import { createVehiclePose } from '@/game/vehicle/interpolatePose';
import type { VehicleState } from '@/game/vehicle/VehicleSim';

const DT = 1 / 120;

/** A state carrying only what the track records; the rest of the sim's fields are not read. */
function state(over: Partial<VehicleState>): VehicleState {
  return {
    x: 0,
    y: 0.5,
    z: 0,
    groundHeight: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    vx: 0,
    vz: 0,
    speed: 0,
    yawRate: 0,
    latAccel: 0,
    steerAngle: 0,
    wheelAngle: 0,
    rpm: 1000,
    gear: 1,
    grounded: true,
    turboActive: false,
    ...over,
  } as VehicleState;
}

describe('ReplayTrack', () => {
  it('records one sample per step and reports the duration as the time of the last sample', () => {
    const track = new ReplayTrack(DT);
    expect(track.duration).toBe(0);
    for (let k = 0; k < 241; k++) track.record(state({ z: k * 0.2 }));
    expect(track.samples).toBe(241);
    expect(track.duration).toBeCloseTo(2, 9);
  });

  it('blends position, speed and gear between the samples either side of a time', () => {
    const track = new ReplayTrack(DT);
    track.record(state({ x: 1, z: 10, speed: 20, gear: 2, rpm: 3000 }));
    track.record(state({ x: 2, z: 12, speed: 22, gear: 3, rpm: 3200, grounded: false }));
    const pose = createVehiclePose();
    track.sampleAt(DT * 0.25, pose);
    expect(pose.x).toBeCloseTo(1.25, 6);
    expect(pose.z).toBeCloseTo(10.5, 6);
    expect(pose.speed).toBeCloseTo(20.5, 6);
    expect(pose.rpm).toBeCloseTo(3050, 6);
    // Discrete fields take the later sample's value.
    expect(pose.gear).toBe(3);
    expect(pose.grounded).toBe(false);
  });

  it('turns the short way round the ±π seam for yaw and wheel spin', () => {
    const track = new ReplayTrack(DT);
    track.record(state({ yaw: Math.PI - 0.1, wheelAngle: Math.PI - 0.2 }));
    track.record(state({ yaw: -Math.PI + 0.1, wheelAngle: -Math.PI + 0.2 }));
    const pose = createVehiclePose();
    track.sampleAt(DT / 2, pose);
    expect(Math.abs(Math.abs(pose.yaw) - Math.PI)).toBeLessThan(1e-6);
    expect(Math.abs(Math.abs(pose.wheelAngle) - Math.PI)).toBeLessThan(1e-6);
  });

  it('clamps to the first and last samples outside the run', () => {
    const track = new ReplayTrack(DT);
    track.record(state({ z: 0 }));
    track.record(state({ z: 1 }));
    track.record(state({ z: 2 }));
    const pose = createVehiclePose();
    expect(track.sampleAt(-5, pose).z).toBe(0);
    expect(track.sampleAt(99, pose).z).toBe(2);
    expect(track.sampleAt(track.duration, pose).z).toBe(2);
  });

  it('grows past its first buffer without losing samples, and clears for the next run', () => {
    const track = new ReplayTrack(DT);
    const n = 10_000;
    for (let k = 0; k < n; k++) track.record(state({ z: k, yaw: 0.0001 * k }));
    expect(track.samples).toBe(n);
    const pose = createVehiclePose();
    expect(track.sampleAt(0, pose).z).toBe(0);
    expect(track.sampleAt((n - 1) * DT, pose).z).toBe(n - 1);
    expect(track.sampleAt(5000 * DT, pose).z).toBeCloseTo(5000, 3);
    track.clear();
    expect(track.samples).toBe(0);
    expect(track.duration).toBe(0);
    // An empty track leaves the pose alone.
    pose.z = 7;
    expect(track.sampleAt(1, pose).z).toBe(7);
  });
});
