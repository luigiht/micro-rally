import type { CarSpec } from './CarSpec';
import { SURFACES } from './surfaces';
import type { TerrainQuery } from './Terrain';
import { REAR_GRIP_BIAS, type VehicleState } from './VehicleSim';

/** One tyre's contact patch on the ground and how hard it is scrubbing. */
export interface WheelContact {
  x: number;
  y: number;
  z: number;
  /** 0..1: lateral slide, wheelspin or a locked wheel; 0 when airborne or crawling. */
  intensity: number;
}

/** Order: front-left, front-right, rear-left, rear-right. */
export const WHEEL_COUNT = 4;

/**
 * Slip past this multiple of the tyre's peak slip angle starts a mark; at `SLIP_FULL` it is
 * solid. Hard cornering sits around 1.3× peak (the steering assist holds it there), so only
 * genuine slides — sharp turns, drifts, handbrake — leave rubber.
 */
const SLIP_START = 2.2;
const SLIP_FULL = 5;
/** Share of longitudinal force the axle could not deliver: only a real burnout or lock-up marks. */
const SPIN_START = 0.6;
const SPIN_FULL = 0.95;
/** Marks need some road speed: slip angles are meaningless when crawling. */
const SPEED_START = 2;
const SPEED_FULL = 6;

export interface ContactPose {
  x: number;
  z: number;
  yaw: number;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createWheelContacts(): WheelContact[] {
  const out: WheelContact[] = [];
  for (let i = 0; i < WHEEL_COUNT; i++) out.push({ x: 0, y: 0, z: 0, intensity: 0 });
  return out;
}

/**
 * Fill `out` with the four contact patches for a car at `pose` (the rendered,
 * interpolated pose) using the sim's slip readings. Allocation-free.
 */
export function wheelContacts(
  out: WheelContact[],
  pose: Readonly<ContactPose>,
  s: Readonly<VehicleState>,
  spec: CarSpec,
  terrain: TerrainQuery,
): void {
  const sinY = Math.sin(pose.yaw);
  const cosY = Math.cos(pose.yaw);
  const half = spec.trackWidth / 2;
  const grip = SURFACES[s.surface].grip * spec.tyreGrip;
  const peakF = grip / spec.corneringFront;
  const peakR = (grip * REAR_GRIP_BIAS) / spec.corneringRear;
  const gate = s.grounded ? smoothstep(SPEED_START, SPEED_FULL, Math.abs(s.speed)) : 0;
  const front =
    gate *
    Math.max(
      smoothstep(SLIP_START * peakF, SLIP_FULL * peakF, s.slipFront),
      smoothstep(SPIN_START, SPIN_FULL, s.spinFront),
    );
  const rear =
    gate *
    Math.max(
      smoothstep(SLIP_START * peakR, SLIP_FULL * peakR, s.slipRear),
      smoothstep(SPIN_START, SPIN_FULL, s.spinRear),
      s.handbrake ? 1 : 0,
    );
  for (let i = 0; i < WHEEL_COUNT; i++) {
    const along = i < 2 ? spec.cgToFront : -spec.cgToRear;
    const side = i % 2 === 0 ? half : -half;
    const c = out[i]!;
    c.x = pose.x + sinY * along + cosY * side;
    c.z = pose.z + cosY * along - sinY * side;
    c.y = terrain.heightAt(c.x, c.z);
    c.intensity = i < 2 ? front : rear;
  }
}
