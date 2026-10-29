import { Euler, Quaternion, Vector3 } from 'three';
import type { CameraMode } from '@/lib/cameraMode';
import { dampFactor, type CameraRig, type CameraRigFrame } from './CameraRig';

export interface FirstPersonView {
  mode: CameraMode;
  /** Eye in the car frame: +x is the car's left, +z forward. */
  eye: Vector3;
  fov: number;
  /** Radians of downward tilt so the road, not the sky, fills the view. */
  tiltDown: number;
}

/** Bonnet cam: high under the roofline; the car hides its cabin. */
export const CAB_VIEW: FirstPersonView = {
  mode: 'cockpit',
  eye: new Vector3(0.34, 1.36, 0.05),
  fov: 72,
  tiltDown: 0.05,
};

/** Behind the wheel, inside the modelled interior. */
export const INTERIOR_VIEW: FirstPersonView = {
  mode: 'interior',
  eye: new Vector3(0.34, 1.2, -0.33),
  fov: 70,
  tiltDown: 0.07,
};

const LOOK_AHEAD = 12;
/** How far the driver glances into a corner per radian of steering. */
const GLANCE = 0.5;

/** First-person view bolted to the chassis; the car model picks what to show for each mode. */
export class FirstPersonCameraRig implements CameraRig {
  readonly mode: CameraMode;
  private glance = 0;
  private pitch = 0;
  private roll = 0;
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private readonly quat = new Quaternion();
  private readonly base = new Vector3();
  private readonly pos = new Vector3();
  private readonly forward = new Vector3();
  private readonly up = new Vector3();
  private readonly look = new Vector3();

  /** `eyeDrop` lowers the eye for cars with a lower cabin than the hatchback. */
  constructor(
    private readonly view: FirstPersonView,
    private readonly eyeDrop = 0,
  ) {
    this.mode = view.mode;
  }

  snap({ camera, target }: CameraRigFrame): void {
    this.glance = 0;
    this.pitch = target.pitch;
    this.roll = target.roll;
    camera.fov = this.view.fov;
    camera.updateProjectionMatrix();
    this.apply(camera, target);
  }

  update({ camera, target, dt, reducedMotion }: CameraRigFrame): void {
    // Under reduced motion the head stays level and doesn't follow the steering.
    const glanceTarget = reducedMotion ? 0 : target.steerAngle * GLANCE;
    this.glance += (glanceTarget - this.glance) * dampFactor(4, dt);
    const follow = dampFactor(reducedMotion ? 3 : 10, dt);
    this.pitch += (target.pitch - this.pitch) * follow;
    this.roll += ((reducedMotion ? 0 : target.roll) - this.roll) * follow;
    this.apply(camera, target);
  }

  /** No zoom from the driver's seat. */
  zoom(): void {}

  dispose(): void {}

  private apply(camera: CameraRigFrame['camera'], t: CameraRigFrame['target']): void {
    // Eye position rides the chassis exactly (same Euler order as the car model).
    this.euler.set(t.pitch, t.yaw, t.roll);
    this.quat.setFromEuler(this.euler);
    this.base.set(t.x, t.y, t.z);
    this.pos.copy(this.view.eye);
    this.pos.y += this.eyeDrop;
    this.pos.applyQuaternion(this.quat).add(this.base);
    // View direction uses the smoothed pitch/roll, the tilt and the glance.
    this.euler.set(this.pitch + this.view.tiltDown, t.yaw + this.glance, this.roll);
    this.quat.setFromEuler(this.euler);
    this.forward.set(0, 0, 1).applyQuaternion(this.quat);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);
    this.look.copy(this.pos).addScaledVector(this.forward, LOOK_AHEAD);
    camera.position.copy(this.pos);
    camera.up.copy(this.up);
    camera.lookAt(this.look);
  }
}
