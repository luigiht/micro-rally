import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import { createVehiclePose } from '@/game/vehicle/interpolatePose';
import { CAMERA_MODES, isCameraMode, nextCameraMode } from '@/lib/cameraMode';
import {
  CAB_VIEW,
  FirstPersonCameraRig,
  INTERIOR_VIEW,
} from '@/components/game/cameras/FirstPersonCameraRig';
import { createCameraRig } from '@/components/game/cameras/createCameraRig';
import { IsometricCameraRig } from '@/components/game/cameras/IsometricCameraRig';

const flat = { heightAt: () => 0 } as unknown as TerrainQuery;

function frame(x: number, z: number, yaw: number) {
  const target = createVehiclePose();
  target.x = x;
  target.z = z;
  target.yaw = yaw;
  return {
    camera: new PerspectiveCamera(60, 16 / 9, 0.1, 500),
    target,
    dt: 1 / 60,
    reducedMotion: false,
  };
}

/** Unit vector from the camera to a point, compared with where the camera looks. */
function alignment(camera: PerspectiveCamera, point: Vector3): number {
  const dir = camera.getWorldDirection(new Vector3());
  return point.clone().sub(camera.position).normalize().dot(dir);
}

describe('camera modes', () => {
  it('cycle chase → cockpit → iso → chase', () => {
    expect(CAMERA_MODES.map(nextCameraMode)).toEqual(['cockpit', 'interior', 'iso', 'chase']);
    expect(isCameraMode('iso')).toBe(true);
    expect(isCameraMode('drone')).toBe(false);
  });

  it('the factory builds a rig of the requested mode', () => {
    for (const mode of CAMERA_MODES) expect(createCameraRig(mode, flat, 0).mode).toBe(mode);
  });
});

describe('IsometricCameraRig', () => {
  it('sits high above and behind the stage axis, looking at the car, and zooms with the wheel', () => {
    const rig = new IsometricCameraRig(flat, Math.PI / 4);
    const f = frame(10, 5, 1.2);
    rig.snap(f);
    const car = new Vector3(10, 0, 5);
    const dist = f.camera.position.distanceTo(car);
    expect(dist).toBeCloseTo(32, 0);
    expect(f.camera.position.y).toBeCloseTo(Math.sin((55 * Math.PI) / 180) * 32, 0);
    expect(f.camera.position.x).toBeLessThan(10);
    expect(f.camera.position.z).toBeLessThan(5);
    expect(alignment(f.camera, car)).toBeGreaterThan(0.999);
    expect(f.camera.fov).toBe(28);

    rig.zoom(1000);
    rig.snap(f);
    expect(f.camera.position.distanceTo(car)).toBeGreaterThan(dist);
  });

  it('follows the car smoothly instead of teleporting', () => {
    const rig = new IsometricCameraRig(flat, 0);
    const f = frame(0, 0, 0);
    rig.snap(f);
    const before = f.camera.position.x;
    f.target.x = 20;
    rig.update(f);
    // One frame moves part of the way; the heading itself never changes.
    expect(f.camera.position.x).toBeGreaterThan(before);
    expect(f.camera.position.x).toBeLessThan(10);
    for (let i = 0; i < 600; i++) rig.update(f);
    expect(f.camera.position.x).toBeCloseTo(20, 1);
  });
});

describe('FirstPersonCameraRig', () => {
  it('puts the cab eye in the left seat and looks along the car heading', () => {
    const rig = new FirstPersonCameraRig(CAB_VIEW);
    const f = frame(3, -2, 0);
    rig.snap(f);
    expect(f.camera.position.x).toBeCloseTo(3.34, 2);
    expect(f.camera.position.y).toBeCloseTo(1.36, 2);
    expect(f.camera.position.z).toBeCloseTo(-1.95, 2);
    const ahead = f.camera.getWorldDirection(new Vector3());
    expect(ahead.z).toBeGreaterThan(0.99);
    expect(ahead.y).toBeLessThan(0); // slight tilt toward the road
    expect(f.camera.fov).toBe(72);

    const turned = frame(0, 0, Math.PI / 2);
    rig.snap(turned);
    const dir = turned.camera.getWorldDirection(new Vector3());
    expect(dir.x).toBeGreaterThan(0.99);
    // The seat offset rotates with the car: left of a car heading +x is -z.
    expect(turned.camera.position.z).toBeCloseTo(-0.34, 2);
  });

  it('keeps the head level under reduced motion', () => {
    const rig = new FirstPersonCameraRig(CAB_VIEW);
    const f = frame(0, 0, 0);
    rig.snap(f);
    f.target.steerAngle = 0.5;
    f.target.roll = 0.3;
    f.reducedMotion = true;
    for (let i = 0; i < 120; i++) rig.update(f);
    expect(f.camera.getWorldDirection(new Vector3()).x).toBeCloseTo(0, 3);
    const up = new Vector3(0, 1, 0).applyQuaternion(f.camera.quaternion);
    expect(up.y).toBeGreaterThan(0.99);
    expect(Math.abs(up.x)).toBeLessThan(1e-3); // no roll
  });

  it('seats the interior eye behind the wheel with a wider lens', () => {
    const rig = new FirstPersonCameraRig(INTERIOR_VIEW);
    const f = frame(0, 0, 0);
    rig.snap(f);
    expect(rig.mode).toBe('interior');
    expect(f.camera.position.x).toBeCloseTo(0.34, 2);
    expect(f.camera.position.y).toBeCloseTo(1.2, 2);
    expect(f.camera.position.z).toBeCloseTo(-0.33, 2);
    expect(f.camera.fov).toBe(70);
    expect(f.camera.getWorldDirection(new Vector3()).z).toBeGreaterThan(0.99);
  });
});
