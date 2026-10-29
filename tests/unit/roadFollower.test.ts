import { describe, expect, it } from 'vitest';
import { RoadFollower } from '@/game/stage/RoadFollower';
import { createStageWorld } from '@/game/stage/StageWorld';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';

const SPEED = 20;

describe('RoadFollower', () => {
  it('starts on the start line, sits on the terrain and loops after the finish', () => {
    const world = createStageWorld(5, 0);
    const f = new RoadFollower(world.stage, world.field, CAR_SPECS.hatchback, SPEED);
    const start = { x: 0, z: 0, heading: 0 };
    world.stage.path.sample(world.stage.startDistance, start);
    expect(f.pose.x).toBeCloseTo(start.x, 5);
    expect(f.pose.z).toBeCloseTo(start.z, 5);
    expect(f.pose.yaw).toBeCloseTo(start.heading, 5);
    expect(f.pose.y).toBeCloseTo(world.field.heightAt(start.x, start.z), 5);

    const dt = 1 / 60;
    let seconds = 0;
    let wrapped = false;
    while (!wrapped && seconds < 600) {
      wrapped = f.advance(dt);
      seconds += dt;
    }
    expect(wrapped).toBe(true);
    expect(seconds).toBeGreaterThan(world.stage.length / SPEED - 1);
    expect(seconds).toBeLessThan(world.stage.length / SPEED + 5);
    expect(f.pose.x).toBeCloseTo(start.x, 5);
    expect(f.pose.z).toBeCloseTo(start.z, 5);
  });

  it('steers with the bends, rolls the wheels and keeps a steady speed', () => {
    const world = createStageWorld(5, 0);
    const f = new RoadFollower(world.stage, world.field, CAR_SPECS.hatchback, SPEED);
    const wheel0 = f.pose.wheelAngle;
    let maxSteer = 0;
    let signsAgree = true;
    for (let i = 0; i < 600; i++) {
      f.advance(1 / 60);
      maxSteer = Math.max(maxSteer, Math.abs(f.pose.steerAngle));
      if (f.pose.yawRate !== 0 && Math.sign(f.pose.steerAngle) !== Math.sign(f.pose.yawRate)) {
        signsAgree = false;
      }
    }
    expect(maxSteer).toBeGreaterThan(0.02);
    expect(signsAgree).toBe(true);
    expect(f.pose.speed).toBe(SPEED);
    expect(f.pose.grounded).toBe(true);
    expect(f.pose.wheelAngle).not.toBe(wheel0);
  });
});
