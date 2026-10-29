import type { PerspectiveCamera } from 'three';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';

export type CameraMode = 'cockpit' | 'chase' | 'iso';

export interface CameraRigFrame {
  camera: PerspectiveCamera;
  target: Readonly<VehiclePose>;
  dt: number;
  reducedMotion: boolean;
}

/** Shared contract for all camera rigs so switching is instant and leak-free. */
export interface CameraRig {
  readonly mode: CameraMode;
  /** Snap to the target with no smoothing (on switch or reset). */
  snap(frame: CameraRigFrame): void;
  update(frame: CameraRigFrame): void;
  /** Positive delta zooms out. */
  zoom(delta: number): void;
  dispose(): void;
}

/** Frame-rate independent exponential smoothing factor. */
export function dampFactor(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt);
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let d = (target - current) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d < -Math.PI) d += 2 * Math.PI;
  return current + d * dampFactor(lambda, dt);
}
