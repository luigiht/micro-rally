import { describe, expect, it } from 'vitest';
import { createRoadHit } from '@/game/stage/RoadPath';
import { RoadFollower } from '@/game/stage/RoadFollower';
import { createStageWorld } from '@/game/stage/StageWorld';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';

const SPEED = 20;

function wrap(a: number): number {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  else if (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

describe('RoadFollower', () => {
  it('starts on the start line, sits on the terrain and loops after the finish', () => {
    const world = createStageWorld(5, 0);
    const f = new RoadFollower(world.stage, world.field, CAR_SPECS.hatchback, SPEED);
    const start = { x: 0, z: 0, heading: 0 };
    world.stage.path.sample(world.stage.startDistance, start);
    expect(f.pose.x).toBeCloseTo(start.x, 5);
    expect(f.pose.z).toBeCloseTo(start.z, 5);
    // The follower's heading is the path's own blended one, within a whisker of the start segment's.
    expect(Math.abs(f.pose.yaw - start.heading)).toBeLessThan(0.02);
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

  it('turns continuously: no heading steps at the road samples, no kicks in the lateral g, no crabbing', () => {
    const world = createStageWorld(5, 0);
    const f = new RoadFollower(world.stage, world.field, CAR_SPECS.hatchback, SPEED);
    const dt = 1 / 60;
    const hit = createRoadHit();
    const segment = { x: 0, z: 0, heading: 0 };
    let maxYawStep = 0;
    let maxLatStep = 0;
    let maxDrift = 0;
    let maxLat = 0;
    let prevYaw = f.pose.yaw;
    let prevLat = f.pose.latAccel;
    for (let i = 0; i < 60 * 40; i++) {
      if (f.advance(dt)) break;
      maxYawStep = Math.max(maxYawStep, Math.abs(wrap(f.pose.yaw - prevYaw)));
      maxLatStep = Math.max(maxLatStep, Math.abs(f.pose.latAccel - prevLat));
      maxLat = Math.max(maxLat, Math.abs(f.pose.latAccel));
      expect(world.stage.path.nearest(f.pose.x, f.pose.z, 2, hit)).toBe(true);
      world.stage.path.sample(hit.along, segment);
      maxDrift = Math.max(maxDrift, Math.abs(wrap(f.pose.yaw - segment.heading)));
      prevYaw = f.pose.yaw;
      prevLat = f.pose.latAccel;
    }
    // A 2 m sample passes every 0.1 s at this speed; a heading that stepped there would
    // turn a bend's whole 2 m share in one frame (0.05 rad on a 40 m radius) and the lateral
    // g, a per-frame difference, would spike by tens of m/s². Blended, both stay small.
    expect(maxYawStep).toBeLessThan(0.03);
    expect(maxLatStep).toBeLessThan(1.5);
    expect(maxLat).toBeGreaterThan(1);
    // The car faces the way the road runs under it: the blended heading is the tangent, the segment's
    // the chord, and on a 13 m hairpin the two differ by about 0.08 rad.
    expect(maxDrift).toBeLessThan(0.12);
  });
});
