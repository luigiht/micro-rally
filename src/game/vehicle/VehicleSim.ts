import type { CarSpec } from './CarSpec';
import type { ControlInput } from './ControlInput';
import { REVERSE_GEAR, autoShift, driveForce, wheelLockedRpm } from './Drivetrain';
import { SURFACES, type Surface } from './surfaces';
import type { TerrainQuery } from './Terrain';

export const GRAVITY = 9.81;
const STEER_RATE = 3.2;
const STEER_RETURN = 5.5;
const LOW_SPEED = 4;
const SLIDE_FALLOFF = 0.18;
const MAX_COMPRESSION = 0.35;
const AIR_EPS = 0.06;
const MAX_GROUND_VY = 15;
const HANDBRAKE_DECEL = 6;

export interface VehicleState {
  x: number;
  y: number;
  z: number;
  /** Heading about +Y; forward = (sin yaw, 0, cos yaw). */
  yaw: number;
  /** Positive = nose down. */
  pitch: number;
  /** Positive = left side up. */
  roll: number;
  vx: number;
  vy: number;
  vz: number;
  /** Positive = turning left. */
  yawRate: number;
  /** Smoothed steering input, -1 left … +1 right. */
  steer: number;
  /** Front wheel angle in radians, positive = left. */
  steerAngle: number;
  rpm: number;
  /** 1..n forward, -1 reverse. */
  gear: number;
  shiftTimer: number;
  /** Signed longitudinal speed, m/s. */
  speed: number;
  lateralSpeed: number;
  longAccel: number;
  latAccel: number;
  grounded: boolean;
  airTime: number;
  landingImpact: number;
  landings: number;
  groundHeight: number;
  surface: Surface;
  turboCharge: number;
  turboActive: boolean;
  slipFront: number;
  slipRear: number;
  /** 0..1 how much drive force exceeded traction. */
  wheelSpin: number;
  wheelAngle: number;
}

export interface SimEnv {
  /** Weather grip multiplier (rain < 1). */
  gripScale: number;
  manualGearbox: boolean;
  steerSensitivity: number;
}

export const DEFAULT_ENV: Readonly<SimEnv> = {
  gripScale: 1,
  manualGearbox: false,
  steerSensitivity: 1,
};

export interface SpawnPose {
  x: number;
  z: number;
  yaw: number;
}

export function createVehicleState(): VehicleState {
  return {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yawRate: 0,
    steer: 0,
    steerAngle: 0,
    rpm: 0,
    gear: 1,
    shiftTimer: 0,
    speed: 0,
    lateralSpeed: 0,
    longAccel: 0,
    latAccel: 0,
    grounded: true,
    airTime: 0,
    landingImpact: 0,
    landings: 0,
    groundHeight: 0,
    surface: 'tarmac',
    turboCharge: 1,
    turboActive: false,
    slipFront: 0,
    slipRear: 0,
    wheelSpin: 0,
    wheelAngle: 0,
  };
}

export function copyVehicleState(dst: VehicleState, src: Readonly<VehicleState>): void {
  Object.assign(dst, src);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function approach(v: number, target: number, maxDelta: number): number {
  return v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target);
}

function wrapAngle(a: number): number {
  return a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
}

/** Linear tyre up to the friction limit, then a gentle fall-off for slides. */
function tyreForce(alpha: number, stiffness: number, maxF: number): number {
  if (stiffness <= 0 || maxF <= 0) return 0;
  const f = -stiffness * alpha;
  if (Math.abs(f) <= maxF) return f;
  const over = Math.abs(alpha) - maxF / stiffness;
  return -Math.sign(alpha) * maxF * (1 - SLIDE_FALLOFF * Math.min(1, over / 0.4));
}

/** Arcade bicycle-model car. Pure, deterministic, allocation-free per step. */
export class VehicleSim {
  readonly state: VehicleState = createVehicleState();
  readonly prev: VehicleState = createVehicleState();

  constructor(public spec: CarSpec) {}

  /** Swap the car in place: position and speed carry over, the gear is clamped to the new box. */
  retune(spec: CarSpec): void {
    this.spec = spec;
    const s = this.state;
    if (s.gear > spec.gearRatios.length) s.gear = spec.gearRatios.length;
    this.prev.gear = s.gear;
  }

  reset(pose: SpawnPose, terrain: TerrainQuery, speed = 0): void {
    const s = this.state;
    const p = this.spec;
    copyVehicleState(s, createVehicleState());
    const h = terrain.heightAt(pose.x, pose.z);
    s.x = pose.x;
    s.z = pose.z;
    s.yaw = pose.yaw;
    s.y = h - GRAVITY / p.suspensionStiffness;
    s.groundHeight = h;
    s.vx = Math.sin(pose.yaw) * speed;
    s.vz = Math.cos(pose.yaw) * speed;
    s.speed = speed;
    s.surface = terrain.surfaceAt(pose.x, pose.z);
    for (let g = autoShift(p, speed, 1); g !== s.gear; g = autoShift(p, speed, s.gear)) s.gear = g;
    s.rpm = Math.max(p.idleRpm, wheelLockedRpm(p, speed, s.gear));
    copyVehicleState(this.prev, s);
  }

  step(
    dt: number,
    input: ControlInput,
    terrain: TerrainQuery,
    env: Readonly<SimEnv> = DEFAULT_ENV,
  ) {
    const s = this.state;
    const p = this.spec;
    copyVehicleState(this.prev, s);

    // Steering: digital keys become a smooth ramp; lock shrinks with speed.
    const target = clamp(input.steer, -1, 1);
    const returning = Math.abs(target) < Math.abs(s.steer) || target * s.steer < 0;
    const rate = (returning ? STEER_RETURN : STEER_RATE) * env.steerSensitivity;
    s.steer = approach(s.steer, target, rate * dt);

    const sinY = Math.sin(s.yaw);
    const cosY = Math.cos(s.yaw);
    const vLong = s.vx * sinY + s.vz * cosY;
    const vLat = s.vx * cosY - s.vz * sinY;
    const speed = Math.hypot(s.vx, s.vz);
    s.steerAngle = (-s.steer * p.maxSteer) / (1 + speed / p.steerFalloffSpeed);

    // Ground contact and suspension.
    const L = p.cgToFront + p.cgToRear;
    const halfTrack = p.trackWidth / 2;
    const h = terrain.heightAt(s.x, s.z);
    const hF = terrain.heightAt(s.x + sinY * p.cgToFront, s.z + cosY * p.cgToFront);
    const hR = terrain.heightAt(s.x - sinY * p.cgToRear, s.z - cosY * p.cgToRear);
    const hL = terrain.heightAt(s.x + cosY * halfTrack, s.z - sinY * halfTrack);
    const hRt = terrain.heightAt(s.x - cosY * halfTrack, s.z + sinY * halfTrack);
    s.surface = terrain.surfaceAt(s.x, s.z);
    const groundVy = clamp((h - s.groundHeight) / dt, -MAX_GROUND_VY, MAX_GROUND_VY);
    s.groundHeight = h;
    const comp = h - s.y;
    const touching = comp > 0;
    const springAcc = touching
      ? Math.max(0, p.suspensionStiffness * comp - p.suspensionDamping * (s.vy - groundVy))
      : 0;

    const wasAirborne = !s.grounded;
    s.grounded = comp > -AIR_EPS;
    if (s.grounded) {
      if (wasAirborne && s.airTime > 0.15) {
        s.landingImpact = Math.max(0, groundVy - s.vy);
        s.landings++;
      }
      s.airTime = 0;
    } else {
      s.airTime += dt;
    }

    // Normalised load: suspension stability filters bump-induced grip swings.
    const rawLoad = clamp(springAcc / GRAVITY, 0, 3);
    const load = touching ? Math.max(0, 1 + (rawLoad - 1) * (1 - 0.7 * p.stability)) : 0;

    const surf = SURFACES[s.surface];
    const mu = surf.grip * p.tyreGrip * env.gripScale * (1 + (p.aeroGrip * speed * speed) / 1000);
    const weight = p.mass * GRAVITY * load;
    const transfer = (p.cgHeight / L) * p.mass * s.longAccel * load;
    const wf = Math.max(0, (p.cgToRear / L) * weight - transfer);
    const wr = Math.max(0, (p.cgToFront / L) * weight + transfer);

    // Pedals: holding brake at a standstill selects reverse, throttle selects first.
    if (s.gear === REVERSE_GEAR) {
      if (input.throttle > 0.05 && vLong > -1) s.gear = 1;
    } else if (input.brake > 0.05 && input.throttle < 0.05 && vLong < 0.5) {
      s.gear = REVERSE_GEAR;
    }
    const reversing = s.gear === REVERSE_GEAR;
    const drivePedal = reversing ? input.brake : input.throttle;
    const brakePedal = reversing ? input.throttle : input.brake;

    s.shiftTimer = Math.max(0, s.shiftTimer - dt);
    if (s.gear >= 1 && s.shiftTimer === 0) {
      let next = s.gear;
      if (env.manualGearbox) {
        if (input.shiftUp && s.gear < p.gearRatios.length) next++;
        else if (input.shiftDown && s.gear > 1) next--;
      } else {
        next = autoShift(p, vLong, s.gear);
      }
      if (next !== s.gear) {
        s.gear = next;
        s.shiftTimer = p.shiftTime;
      }
    }
    input.shiftUp = false;
    input.shiftDown = false;

    // Engine: clutch slip in first/reverse keeps revs up at launch.
    const lockedRpm = wheelLockedRpm(p, vLong, s.gear);
    const launching = s.gear === 1 || reversing;
    const engineRpm = touching
      ? Math.max(lockedRpm, launching ? p.idleRpm + drivePedal * 2600 : p.idleRpm)
      : p.idleRpm + drivePedal * (p.redlineRpm - p.idleRpm);
    s.rpm += (Math.min(engineRpm, p.redlineRpm * 1.02) - s.rpm) * (1 - Math.exp(-18 * dt));

    let force = s.shiftTimer > 0 ? 0 : driveForce(p, engineRpm, s.gear, drivePedal);
    s.turboActive = false;
    if (p.turboForce > 0) {
      if (input.turbo && s.turboCharge > 0 && drivePedal > 0.1) {
        force *= 1 + p.turboForce;
        s.turboCharge = Math.max(0, s.turboCharge - dt / p.turboDuration);
        s.turboActive = true;
      } else {
        s.turboCharge = Math.min(1, s.turboCharge + dt / p.turboRecharge);
      }
    }
    if (reversing) force = -force;

    // Longitudinal tyre forces, limited by the friction circle.
    const dir = vLong > 0.05 ? 1 : vLong < -0.05 ? -1 : 0;
    const brakeF = brakePedal * p.brakeDecel * p.mass;
    const handF = input.handbrake ? p.mass * HANDBRAKE_DECEL : 0;
    const capF = mu * wf;
    const capR = mu * wr;
    const rawFxF = force * p.frontDrive - dir * brakeF * 0.6;
    const rawFxR = force * (1 - p.frontDrive) - dir * (brakeF * 0.4 + handF);
    const fxF = clamp(rawFxF, -capF, capF);
    const fxR = clamp(rawFxR, -capR, capR);
    const excess = Math.abs(rawFxF) - Math.abs(fxF) + Math.abs(rawFxR) - Math.abs(fxR);
    s.wheelSpin = force !== 0 ? clamp(excess / (Math.abs(force) + 1), 0, 1) : 0;

    // Lateral tyre forces from slip angles.
    const vxAbs = Math.max(Math.abs(vLong), 1.5);
    const sgn = vLong >= 0 ? 1 : -1;
    const alphaF = Math.atan2(vLat + s.yawRate * p.cgToFront, vxAbs) - sgn * s.steerAngle;
    const alphaR = Math.atan2(vLat - s.yawRate * p.cgToRear, vxAbs);
    const latCapF = Math.sqrt(Math.max(0, capF * capF - fxF * fxF));
    let latCapR = Math.sqrt(Math.max(0, capR * capR - fxR * fxR));
    if (input.handbrake) latCapR *= p.handbrakeRearGrip;
    const fyF = tyreForce(alphaF, p.corneringFront * wf, latCapF);
    const fyR = tyreForce(alphaR, p.corneringRear * wr, latCapR);
    s.slipFront = Math.abs(alphaF);
    s.slipRear = Math.abs(alphaR);

    const cosD = Math.cos(s.steerAngle);
    const sinD = Math.sin(s.steerAngle);
    let fLong = fxR + fxF * cosD - fyF * sinD;
    let fLat = fyR + fyF * cosD + fxF * sinD;
    fLong -= p.dragCoeff * vLong * Math.abs(vLong) + p.rollingResistance * vLong;
    fLat -= p.dragCoeff * vLat * Math.abs(vLat);
    if (touching) {
      fLong -= p.mass * (surf.drag * vLong + GRAVITY * ((hF - hR) / L));
      fLat -= p.mass * GRAVITY * ((hL - hRt) / p.trackWidth);
      const torque = p.cgToFront * (fyF * cosD + fxF * sinD) - p.cgToRear * fyR;
      s.yawRate += (torque / (p.mass * p.yawInertiaScale)) * dt;
    } else {
      s.yawRate *= 1 - 0.6 * dt;
    }

    const aLong = fLong / p.mass;
    const aLat = fLat / p.mass;
    const smooth = 1 - Math.exp(-10 * dt);
    s.longAccel += (aLong - s.longAccel) * smooth;
    s.latAccel += (aLat - s.latAccel) * smooth;
    let newLong = vLong + aLong * dt;
    let newLat = vLat + aLat * dt;

    if (touching) {
      // Brakes stop the car; they never push it backwards.
      if (dir !== 0 && newLong * dir < 0 && Math.abs(force) < 1) newLong = 0;
      if (dir === 0 && Math.abs(force) < 1 && Math.abs(newLong) < 0.05) newLong = 0;
      // Below walking pace, blend to kinematic steering so the car doesn't pirouette.
      const w = Math.min(1, Math.abs(newLong) / LOW_SPEED);
      s.yawRate = s.yawRate * w + ((newLong * Math.tan(s.steerAngle)) / L) * (1 - w);
      newLat *= 1 - (1 - w) * Math.min(1, 10 * dt);
    }
    s.vx = newLong * sinY + newLat * cosY;
    s.vz = newLong * cosY - newLat * sinY;
    s.vy += (springAcc - GRAVITY) * dt;

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    if (h - s.y > MAX_COMPRESSION) {
      s.y = h - MAX_COMPRESSION;
      if (s.vy < groundVy) s.vy = groundVy;
    }
    s.yaw = wrapAngle(s.yaw + s.yawRate * dt);

    if (s.grounded) {
      const k = 1 - Math.exp(-14 * dt);
      s.pitch += (Math.atan2(hR - hF, L) - s.pitch) * k;
      s.roll += (Math.atan2(hL - hRt, p.trackWidth) - s.roll) * k;
    } else {
      s.pitch += (0.08 - s.pitch) * (1 - Math.exp(-0.8 * dt));
    }

    s.speed = newLong;
    s.lateralSpeed = newLat;
    s.wheelAngle = (s.wheelAngle + (newLong / p.wheelRadius) * dt) % (2 * Math.PI);
  }
}
