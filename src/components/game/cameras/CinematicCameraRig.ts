import { Vector3 } from 'three';
import { hashSeed } from '@/game/rng';
import type { RoadWidthSource } from '@/game/stage/RoadWidth';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { dampAngle, dampFactor, type CameraRig, type CameraRigFrame } from './CameraRig';
import {
  createDirector,
  isFixed,
  nextShot,
  trackingPosition,
  travelHeading,
  type Director,
  type Shot,
} from './CinematicShots';

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2;
/** A trackside lens frames this much height around the car (scaled by the wheel zoom) within the shot's lens limits. */
const FRAME_HEIGHT = 12;
/** Lead room: a fixed camera aims this many seconds ahead of the car. */
const LEAD = 0.25;
/** A shot holds at least this long before the pass-by, lost and hidden cuts apply. */
const MIN_HOLD = 1;
/** A fixed camera cuts once the car is this far past it, this far away, or hidden behind terrain this long. */
const PASSED = 10;
const LOST = 170;
const HIDDEN = 0.5;
const SIGHT_SAMPLES = 4;
/** Operator wobble on a trackside camera as the car comes close: metres of aim drift. */
const WOBBLE = 0.12;
/** Position damping: the helicopter trails lazily, the camera cars hold their place. */
const HELICOPTER_LAMBDA = 2.5;
const TRACKING_LAMBDA = 6;
const HEIGHT_LAMBDA = 4;
const HEADING_LAMBDA = 4;
const AIM_LAMBDA = 8;
const MAX_DT = 0.1;

/**
 * Broadcast-style coverage of the car: a director (`CinematicShots`) picks
 * trackside, helicopter, chase-car, camera-car and reverse tracking shots
 * and the rig runs each one, panning, following and zooming smoothly, then
 * hard-cuts to the next when the shot's time is up or the car has passed a
 * trackside camera.
 */
export class CinematicCameraRig implements CameraRig {
  readonly mode = 'cinematic' as const;
  private director: Director = createDirector(1);
  private shot: Shot | null = null;
  private elapsed = 0;
  private hidden = 0;
  private phase = 0;
  private heading = 0;
  private zoomScale = 1;
  private fov = 40;
  private readonly pos = new Vector3();
  private readonly desired = new Vector3();
  private readonly aim = new Vector3();
  private readonly look = new Vector3();

  /** `road` places trackside cameras beside the stage; without it (the test track) they stand straight ahead. */
  constructor(
    private readonly terrain: TerrainQuery,
    private readonly road: RoadWidthSource | null = null,
    private readonly bodyScale = 1,
  ) {}

  /** The running shot. */
  get current(): Readonly<Shot> | null {
    return this.shot;
  }

  snap(frame: CameraRigFrame): void {
    const t = frame.target;
    this.director = createDirector(hashSeed(Math.round(t.x), Math.round(t.z), 'cinematic'));
    this.cutTo(
      nextShot(
        this.director,
        t,
        null,
        this.road,
        this.terrain,
        this.bodyScale,
        frame.reducedMotion,
      ),
      frame,
    );
  }

  /** Hard cut to `shot`: the camera takes its opening position, aim and lens at once. */
  cutTo(shot: Shot, frame: CameraRigFrame): void {
    const t = frame.target;
    this.shot = shot;
    this.elapsed = 0;
    this.hidden = 0;
    this.phase = 0;
    this.heading = travelHeading(t);
    this.computeDesired(shot, t);
    this.pos.copy(this.desired);
    this.computeAim(shot, t, frame.reducedMotion);
    this.look.copy(this.aim);
    this.fov = this.targetFov(shot, t, frame.reducedMotion);
    this.apply(frame.camera, true);
  }

  update(frame: CameraRigFrame): void {
    const shot = this.shot;
    if (!shot) {
      this.snap(frame);
      return;
    }
    const { camera, target: t, reducedMotion } = frame;
    const dt = Math.min(frame.dt, MAX_DT);
    this.elapsed += dt;
    if (this.over(shot, t, dt)) {
      this.cut(frame);
      return;
    }
    this.heading = dampAngle(this.heading, travelHeading(t), HEADING_LAMBDA, dt);
    if (!isFixed(shot.kind)) {
      this.phase += shot.orbit * dt;
      this.computeDesired(shot, t);
      const lambda = shot.kind === 'helicopter' ? HELICOPTER_LAMBDA : TRACKING_LAMBDA;
      const kxz = dampFactor(lambda, dt);
      const ky = dampFactor(Math.min(lambda, HEIGHT_LAMBDA), dt);
      this.pos.x += (this.desired.x - this.pos.x) * kxz;
      this.pos.z += (this.desired.z - this.pos.z) * kxz;
      this.pos.y += (this.desired.y - this.pos.y) * ky;
    }
    this.computeAim(shot, t, reducedMotion);
    this.look.lerp(this.aim, dampFactor(AIM_LAMBDA, dt));
    const fovLambda = isFixed(shot.kind) ? 4 : 3;
    this.fov += (this.targetFov(shot, t, reducedMotion) - this.fov) * dampFactor(fovLambda, dt);
    this.apply(camera, false);
  }

  zoom(delta: number): void {
    this.zoomScale = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, this.zoomScale * Math.exp(delta * 0.001)),
    );
  }

  dispose(): void {}

  private cut(frame: CameraRigFrame): void {
    const shot = nextShot(
      this.director,
      frame.target,
      this.pos,
      this.road,
      this.terrain,
      this.bodyScale,
      frame.reducedMotion,
    );
    this.cutTo(shot, frame);
  }

  /** The shot is over: it has run its time, or a fixed camera has been passed, left far behind or hidden by a hill. */
  private over(shot: Shot, t: Readonly<VehiclePose>, dt: number): boolean {
    if (this.elapsed >= shot.duration) return true;
    if (!isFixed(shot.kind) || this.elapsed < MIN_HOLD) return false;
    const dx = t.x - this.pos.x;
    const dz = t.z - this.pos.z;
    if (Math.hypot(dx, dz) > LOST) return true;
    const h = travelHeading(t);
    if (dx * Math.sin(h) + dz * Math.cos(h) > PASSED) return true;
    let blocked = false;
    for (let k = 1; k <= SIGHT_SAMPLES && !blocked; k++) {
      const f = k / (SIGHT_SAMPLES + 1);
      const ground = this.terrain.heightAt(this.pos.x + dx * f, this.pos.z + dz * f) + 0.3;
      blocked = ground > this.pos.y + (t.y + 0.8 - this.pos.y) * f;
    }
    this.hidden = blocked ? this.hidden + dt : 0;
    return this.hidden > HIDDEN;
  }

  private computeDesired(shot: Shot, t: Readonly<VehiclePose>): void {
    if (isFixed(shot.kind)) {
      this.desired.set(shot.x, shot.y, shot.z);
      return;
    }
    trackingPosition(shot, t, this.heading, this.phase, this.zoomScale, this.desired);
    if (shot.kind !== 'helicopter') {
      // Damping trails a moving target by v/λ; feeding the velocity forward holds the composition at speed.
      this.desired.x += t.vx / TRACKING_LAMBDA;
      this.desired.z += t.vz / TRACKING_LAMBDA;
    }
    const clearance = shot.kind === 'helicopter' ? 3 : 0.5;
    const floor = this.terrain.heightAt(this.desired.x, this.desired.z) + clearance;
    if (this.desired.y < floor) this.desired.y = floor;
  }

  private computeAim(shot: Shot, t: Readonly<VehiclePose>, reducedMotion: boolean): void {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.aim.set(t.x + fx * shot.aimAhead, t.y + shot.aimUp, t.z + fz * shot.aimAhead);
    if (!isFixed(shot.kind)) return;
    // Lead room: frame the road the car is about to take, with a little operator wobble as it comes close.
    this.aim.x += t.vx * LEAD;
    this.aim.z += t.vz * LEAD;
    if (reducedMotion) return;
    const near = Math.max(0, 1 - this.pos.distanceTo(this.aim) / 60);
    this.aim.x += Math.sin(this.elapsed * 1.3) * WOBBLE * near;
    this.aim.y += Math.sin(this.elapsed * 1.7 + 1) * WOBBLE * 0.6 * near;
  }

  private targetFov(shot: Shot, t: Readonly<VehiclePose>, reducedMotion: boolean): number {
    if (isFixed(shot.kind)) {
      const dist = Math.max(1, this.pos.distanceTo(this.aim));
      const wanted = (2 * Math.atan((FRAME_HEIGHT * this.zoomScale) / (2 * dist)) * 180) / Math.PI;
      return Math.min(shot.maxFov, Math.max(shot.minFov, wanted));
    }
    const kick =
      shot.kind === 'lowChase' && !reducedMotion ? Math.min(12, Math.abs(t.speed) * 0.2) : 0;
    return shot.fov + kick;
  }

  private apply(camera: CameraRigFrame['camera'], force: boolean): void {
    camera.position.copy(this.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(this.look);
    if (force || Math.abs(camera.fov - this.fov) > 0.01) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
  }
}
