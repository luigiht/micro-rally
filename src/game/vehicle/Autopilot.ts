import type { RoadHit, RoadPath, RoadSample } from '../stage/RoadPath';
import { createRoadHit } from '../stage/RoadPath';
import type { CarSpec } from './CarSpec';
import type { ControlInput } from './ControlInput';
import { SURFACES } from './surfaces';
import type { SimEnv, VehicleState } from './VehicleSim';

/**
 * A driver for recordings and demos: follows a stage's centreline with
 * pure-pursuit steering toward a point ahead on the road, and picks its speed
 * from the bends ahead, braking early enough to make each one. Pure: it reads
 * the car's state and the road and writes a control input.
 */
export interface AutopilotOptions {
  /** Top speed, m/s. */
  maxSpeed: number;
  /** Sideways acceleration it will corner at on tarmac, m/s²; scaled by the surface's and the region's grip. */
  cornering: number;
  /** Deceleration it brakes at, m/s². */
  braking: number;
}

export const DEFAULT_AUTOPILOT: AutopilotOptions = { maxSpeed: 30, cornering: 7, braking: 7 };

/** Lookahead for steering: this many seconds of travel, never under the minimum. */
const LOOK_SECONDS = 0.55;
const LOOK_MIN = 6;
/** How far ahead it reads the bends, and in what steps; curvature is averaged over `CURVE_SPAN`. */
const SCAN_SECONDS = 3;
const SCAN_MIN = 40;
const SCAN_STEP = 3;
const CURVE_SPAN = 8;
/** The car is lost beyond this from the centreline: it holds its last road distance. */
const SEARCH = 40;

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export class Autopilot {
  private readonly hit: RoadHit = createRoadHit();
  private readonly a: RoadSample = { x: 0, z: 0, heading: 0 };
  private readonly b: RoadSample = { x: 0, z: 0, heading: 0 };
  private along: number;
  private readonly wheelbase: number;

  constructor(
    private readonly path: RoadPath,
    private readonly spec: CarSpec,
    private readonly opts: AutopilotOptions = DEFAULT_AUTOPILOT,
    startAlong = 0,
  ) {
    this.wheelbase = spec.cgToFront + spec.cgToRear;
    this.along = startAlong;
  }

  /** Where along the road it last found the car. */
  get distance(): number {
    return this.along;
  }

  /** The inputs for this step: steer toward the road ahead, throttle or brake toward the safe speed. */
  drive(s: VehicleState, env: SimEnv, out: ControlInput): ControlInput {
    const path = this.path;
    if (path.nearest(s.x, s.z, SEARCH, this.hit)) this.along = this.hit.along;
    const v = Math.max(0, s.speed);

    // Steering: the wheel angle that carries the car through the lookahead point.
    const look = Math.max(LOOK_MIN, v * LOOK_SECONDS);
    path.sample(path.wrap(this.along + look), this.a);
    const dx = this.a.x - s.x;
    const dz = this.a.z - s.z;
    const fwd = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw);
    const left = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw);
    const alpha = Math.atan2(left, fwd);
    const angle = Math.atan2(2 * this.wheelbase * Math.sin(alpha), Math.hypot(dx, dz));
    const lock = (this.spec.maxSteer * env.steerLock) / (1 + v / this.spec.steerFalloffSpeed);
    out.steer = Math.max(-1, Math.min(1, -angle / lock));

    // Speed: the slowest of the bends ahead, each allowed for the braking distance to it.
    // Snow grips at under half of tarmac: the car is driven to the ground it is on.
    const grip = env.gripScale * Math.min(1, SURFACES[s.surface].grip);
    const lateral = this.opts.cornering * grip;
    const decel = this.opts.braking * grip;
    let target = this.opts.maxSpeed;
    const scan = Math.max(SCAN_MIN, v * SCAN_SECONDS);
    for (let d = 0; d <= scan; d += SCAN_STEP) {
      const at = this.along + d;
      path.sample(path.wrap(at), this.a);
      path.sample(path.wrap(at + CURVE_SPAN), this.b);
      const k = Math.abs(wrapAngle(this.b.heading - this.a.heading)) / CURVE_SPAN;
      if (k < 1e-4) continue;
      const corner = Math.sqrt(lateral / k);
      target = Math.min(target, Math.sqrt(corner * corner + 2 * decel * d));
    }
    const gap = target - v;
    out.throttle = gap > 0 ? Math.min(1, gap * 0.6 + 0.15) : 0;
    out.brake = gap < -0.5 ? Math.min(1, -gap * 0.35) : 0;
    out.handbrake = false;
    out.turbo = false;
    out.shiftUp = false;
    out.shiftDown = false;
    return out;
  }
}
