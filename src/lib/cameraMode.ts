/** Camera views, in the order the C key cycles them. */
export const CAMERA_MODES = ['chase', 'interior', 'iso'] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];
export const DEFAULT_CAMERA: CameraMode = 'chase';

export function nextCameraMode(mode: CameraMode): CameraMode {
  const i = CAMERA_MODES.indexOf(mode);
  return CAMERA_MODES[(i + 1) % CAMERA_MODES.length]!;
}

export function isCameraMode(value: unknown): value is CameraMode {
  return typeof value === 'string' && (CAMERA_MODES as readonly string[]).includes(value);
}
