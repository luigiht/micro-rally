import type { VehicleState } from './VehicleSim';

/** Render-facing pose, blended between two physics steps. */
export interface VehiclePose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  vx: number;
  vz: number;
  speed: number;
  yawRate: number;
  latAccel: number;
  steerAngle: number;
  wheelAngle: number;
  grounded: boolean;
}

export function createVehiclePose(): VehiclePose {
  return {
    x: 0,
    y: 0,
    z: 0,
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
    grounded: true,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

export function interpolatePose(
  out: VehiclePose,
  prev: Readonly<VehicleState>,
  curr: Readonly<VehicleState>,
  alpha: number,
): VehiclePose {
  out.x = lerp(prev.x, curr.x, alpha);
  out.y = lerp(prev.y, curr.y, alpha);
  out.z = lerp(prev.z, curr.z, alpha);
  out.yaw = lerpAngle(prev.yaw, curr.yaw, alpha);
  out.pitch = lerp(prev.pitch, curr.pitch, alpha);
  out.roll = lerp(prev.roll, curr.roll, alpha);
  out.vx = lerp(prev.vx, curr.vx, alpha);
  out.vz = lerp(prev.vz, curr.vz, alpha);
  out.speed = lerp(prev.speed, curr.speed, alpha);
  out.yawRate = lerp(prev.yawRate, curr.yawRate, alpha);
  out.latAccel = lerp(prev.latAccel, curr.latAccel, alpha);
  out.steerAngle = lerp(prev.steerAngle, curr.steerAngle, alpha);
  out.wheelAngle = lerpAngle(prev.wheelAngle, curr.wheelAngle, alpha);
  out.grounded = curr.grounded;
  return out;
}
