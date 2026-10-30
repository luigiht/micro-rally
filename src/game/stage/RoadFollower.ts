import type { CarSpec } from '../vehicle/CarSpec';
import { createVehiclePose, type VehiclePose } from '../vehicle/interpolatePose';
import type { TerrainQuery } from '../vehicle/Terrain';
import type { RoadSample } from './RoadPath';
import type { StageDef } from './StageGenerator';

/** Metres ahead/behind the car used to read the slope for pitch. */
const PITCH_PROBE = 2;
/** Coast this far past the finish before looping back to the start. */
const OVERRUN = 20;

function wrapAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  else if (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

/**
 * Drives a car pose along the road centreline at a steady speed, no physics:
 * position and heading come from the arc-length sample, height and pitch
 * from the terrain, steering and lateral g from the heading rate. Used for
 * the attract-mode splash backdrop.
 */
export class RoadFollower {
  readonly pose: VehiclePose = createVehiclePose();
  private distance: number;
  private readonly end: number;
  private readonly wheelbase: number;
  private readonly wheelRadius: number;
  private readonly sample: RoadSample = { x: 0, z: 0, heading: 0 };
  private pitch = 0;

  constructor(
    private readonly stage: StageDef,
    private readonly terrain: TerrainQuery,
    spec: CarSpec,
    readonly speed = 17,
  ) {
    this.wheelbase = spec.cgToFront + spec.cgToRear;
    this.wheelRadius = spec.wheelRadius;
    this.distance = stage.startDistance;
    this.end = Math.min(stage.path.length - 1, stage.startDistance + stage.length + OVERRUN);
    this.place(0, null);
  }

  /** Move `dt` seconds along the road. Returns true when the lap wrapped back to the start. */
  advance(dt: number): boolean {
    const prevHeading = this.pose.yaw;
    this.distance += this.speed * dt;
    if (this.distance < this.end) {
      this.place(dt, prevHeading);
      return false;
    }
    this.distance = this.stage.startDistance;
    this.place(0, null);
    return true;
  }

  private place(dt: number, prevHeading: number | null): void {
    const p = this.pose;
    const s = this.stage.path.sample(this.distance, this.sample);
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    p.x = s.x;
    p.z = s.z;
    p.yaw = s.heading;
    p.y = this.terrain.heightAt(s.x, s.z);
    p.groundHeight = p.y;
    // Positive pitch dips the nose, i.e. the ground ahead is lower.
    const ahead = this.terrain.heightAt(s.x + fx * PITCH_PROBE, s.z + fz * PITCH_PROBE);
    const behind = this.terrain.heightAt(s.x - fx * PITCH_PROBE, s.z - fz * PITCH_PROBE);
    const pitchTarget = Math.atan2(behind - ahead, 2 * PITCH_PROBE);
    this.pitch =
      dt > 0 ? this.pitch + (pitchTarget - this.pitch) * Math.min(1, 6 * dt) : pitchTarget;
    p.pitch = this.pitch;
    p.roll = 0;
    p.speed = this.speed;
    p.vx = fx * this.speed;
    p.vz = fz * this.speed;
    const yawRate = prevHeading === null || dt <= 0 ? 0 : wrapAngle(s.heading - prevHeading) / dt;
    p.yawRate = yawRate;
    p.latAccel = this.speed * yawRate;
    p.steerAngle = Math.atan((this.wheelbase * yawRate) / this.speed);
    p.wheelAngle = wrapAngle(p.wheelAngle + (this.speed * dt) / this.wheelRadius);
    p.rpm = 2800 + this.speed * 60;
    p.grounded = true;
  }
}
