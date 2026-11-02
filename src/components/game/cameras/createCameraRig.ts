import type { RoadWidthSource } from '@/game/stage/RoadWidth';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import type { CameraMode } from '@/lib/cameraMode';
import type { CameraRig } from './CameraRig';
import { ChaseCameraRig } from './ChaseCameraRig';
import { CinematicCameraRig } from './CinematicCameraRig';
import { FirstPersonCameraRig, INTERIOR_VIEW } from './FirstPersonCameraRig';
import { IsometricCameraRig } from './IsometricCameraRig';

/**
 * Build the rig for a mode. `axisYaw` is the stage's main heading (the spawn
 * yaw); `eyeDrop` / `eyeForward` move first-person eyes for cars whose cabin
 * sits lower/higher or further forward than the hatchback's; `bodyScale`
 * pushes the chase, isometric and cinematic cameras back for bigger
 * vehicles; `road` is the stage, whose centreline the cinematic director
 * places its trackside cameras beside (absent on the test track).
 */
export function createCameraRig(
  mode: CameraMode,
  terrain: TerrainQuery,
  axisYaw: number,
  eyeDrop = 0,
  eyeForward = 0,
  bodyScale = 1,
  road?: RoadWidthSource,
): CameraRig {
  switch (mode) {
    case 'interior':
      return new FirstPersonCameraRig(INTERIOR_VIEW, eyeDrop, eyeForward);
    case 'iso':
      return new IsometricCameraRig(terrain, axisYaw + Math.PI / 4, Math.sqrt(bodyScale));
    case 'chase':
      return new ChaseCameraRig(terrain, bodyScale);
    case 'cinematic':
      return new CinematicCameraRig(terrain, road ?? null, bodyScale);
  }
}
