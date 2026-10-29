import { Vector3 } from 'three';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import { dampFactor, type CameraRig, type CameraRigFrame } from './CameraRig';

/** A long lens flattens perspective toward the classic isometric look. */
const FOV = 28;
const PITCH = (55 * Math.PI) / 180;
const BASE_DIST = 32;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

/**
 * Fixed-heading view from high above and behind the stage's main axis,
 * following the car. Only the car turns on screen; wheel/pinch zooms.
 */
export class IsometricCameraRig implements CameraRig {
  readonly mode = 'iso' as const;
  private zoomScale = 1;
  private readonly focus = new Vector3();
  private readonly pos = new Vector3();

  /** `yaw` is the world heading the camera looks along (stage axis + 45°). */
  constructor(
    private readonly terrain: TerrainQuery,
    private readonly yaw: number,
  ) {}

  snap({ camera, target }: CameraRigFrame): void {
    this.focus.set(target.x, target.y, target.z);
    camera.fov = FOV;
    camera.updateProjectionMatrix();
    this.apply(camera);
  }

  update({ camera, target, dt }: CameraRigFrame): void {
    const k = dampFactor(8, dt);
    this.focus.x += (target.x - this.focus.x) * k;
    this.focus.z += (target.z - this.focus.z) * k;
    // Height follows slowly so jumps and crests don't bounce the whole view.
    this.focus.y += (target.y - this.focus.y) * dampFactor(3, dt);
    this.apply(camera);
  }

  zoom(delta: number): void {
    this.zoomScale = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, this.zoomScale * Math.exp(delta * 0.001)),
    );
  }

  dispose(): void {}

  private apply(camera: CameraRigFrame['camera']): void {
    const dist = BASE_DIST * this.zoomScale;
    const flat = Math.cos(PITCH) * dist;
    this.pos.set(
      this.focus.x - Math.sin(this.yaw) * flat,
      this.focus.y + Math.sin(PITCH) * dist,
      this.focus.z - Math.cos(this.yaw) * flat,
    );
    const floor = this.terrain.heightAt(this.pos.x, this.pos.z) + 2;
    if (this.pos.y < floor) this.pos.y = floor;
    camera.position.copy(this.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(this.focus);
  }
}
