import { Vector3 } from 'three';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { dampAngle, dampFactor, type CameraRig, type CameraRigFrame } from './CameraRig';

const BASE_FOV = 60;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.2;

/** Third-person rally cam: trails the car's motion, pulls back with speed, keeps the horizon level. */
export class ChaseCameraRig implements CameraRig {
  readonly mode = 'chase' as const;
  private heading = 0;
  private baseY = 0;
  private roll = 0;
  private zoomScale = 1;
  private readonly pos = new Vector3();
  private readonly desired = new Vector3();
  private readonly look = new Vector3();

  constructor(private readonly terrain: TerrainQuery) {}

  snap({ camera, target }: CameraRigFrame): void {
    this.heading = target.yaw;
    this.baseY = target.y;
    this.roll = 0;
    this.computeDesired(target);
    this.pos.copy(this.desired);
    this.apply(camera, target);
  }

  update({ camera, target, dt, reducedMotion }: CameraRigFrame): void {
    this.heading = dampAngle(this.heading, this.targetHeading(target), 3.5, dt);
    // Follow height slowly while airborne so jumps don't yank the horizon.
    this.baseY += (target.y - this.baseY) * dampFactor(target.grounded ? 5 : 1.2, dt);
    this.computeDesired(target);
    const kxz = dampFactor(9, dt);
    const ky = dampFactor(6, dt);
    this.pos.x += (this.desired.x - this.pos.x) * kxz;
    this.pos.z += (this.desired.z - this.pos.z) * kxz;
    this.pos.y += (this.desired.y - this.pos.y) * ky;

    const rollTarget = reducedMotion ? 0 : Math.max(-0.05, Math.min(0.05, target.latAccel * 0.005));
    this.roll += (rollTarget - this.roll) * dampFactor(4, dt);

    const speedFov = reducedMotion ? 0 : Math.min(14, Math.abs(target.speed) * 0.25);
    const fov = camera.fov + (BASE_FOV + speedFov - camera.fov) * dampFactor(3, dt);
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    this.apply(camera, target);
  }

  zoom(delta: number): void {
    this.zoomScale = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, this.zoomScale * Math.exp(delta * 0.001)),
    );
  }

  dispose(): void {}

  /** Lean the view toward where the car is actually travelling when it slides. */
  private targetHeading(t: Readonly<VehiclePose>): number {
    if (t.speed < 4) return t.yaw;
    const velYaw = Math.atan2(t.vx, t.vz);
    let d = (velYaw - t.yaw) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    return t.yaw + d * 0.35;
  }

  private computeDesired(t: Readonly<VehiclePose>): void {
    const speed = Math.abs(t.speed);
    const dist = (5.2 + speed * 0.07) * this.zoomScale;
    const height = (1.9 + speed * 0.012) * Math.sqrt(this.zoomScale);
    this.desired.set(
      t.x - Math.sin(this.heading) * dist,
      this.baseY + height,
      t.z - Math.cos(this.heading) * dist,
    );
    const floor = this.terrain.heightAt(this.desired.x, this.desired.z) + 0.6;
    if (this.desired.y < floor) this.desired.y = floor;
  }

  private apply(camera: CameraRigFrame['camera'], t: Readonly<VehiclePose>): void {
    this.look.set(
      t.x + Math.sin(this.heading) * 3,
      this.baseY + 1.0,
      t.z + Math.cos(this.heading) * 3,
    );
    camera.position.copy(this.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(this.look);
    camera.rotateZ(this.roll);
  }
}
