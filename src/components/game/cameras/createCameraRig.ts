import type { TerrainQuery } from '@/game/vehicle/Terrain';
import type { CameraMode } from '@/lib/cameraMode';
import type { CameraRig } from './CameraRig';
import { ChaseCameraRig } from './ChaseCameraRig';
import { CAB_VIEW, FirstPersonCameraRig, INTERIOR_VIEW } from './FirstPersonCameraRig';
import { IsometricCameraRig } from './IsometricCameraRig';

/**
 * Build the rig for a mode. `axisYaw` is the stage's main heading (the spawn
 * yaw); `eyeDrop` lowers first-person eyes for cars with a lower cabin.
 */
export function createCameraRig(
  mode: CameraMode,
  terrain: TerrainQuery,
  axisYaw: number,
  eyeDrop = 0,
): CameraRig {
  switch (mode) {
    case 'cockpit':
      return new FirstPersonCameraRig(CAB_VIEW, eyeDrop);
    case 'interior':
      return new FirstPersonCameraRig(INTERIOR_VIEW, eyeDrop);
    case 'iso':
      return new IsometricCameraRig(terrain, axisYaw + Math.PI / 4);
    case 'chase':
      return new ChaseCameraRig(terrain);
  }
}
