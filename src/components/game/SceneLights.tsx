'use client';

import type { Ref } from 'react';
import { type Camera, type DirectionalLight, Vector3 } from 'three';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { installShadowEdgeFade } from '@/render/effects/ShadowEdgeFade';
import { ShadowSnap } from '@/render/effects/ShadowSnap';
import type { ThemeLighting } from '@/render/theme/WorldTheme';

installShadowEdgeFade();

/** Where the sun shines from (toward the light from its target); only the direction matters. */
const SUN_DIRECTION = [8, 14, 6] as const;
/**
 * The sun stands this far back along its direction, and its shadow camera
 * reaches this deep, so tall spruces and hillsides at the frustum's edge
 * are never clipped by its near or far plane.
 */
const SUN_DISTANCE = 120;
const SHADOW_FAR = 240;
/** Half the shadow frustum's width, metres, and the shadow map's size, texels. */
const SHADOW_HALF = 40;
const SHADOW_MAP = 2048;
/** The frustum is centred this far ahead of the car, along the camera's view, where the eye looks. */
const SHADOW_AHEAD = 22;

const sunLength = Math.hypot(...SUN_DIRECTION);
const sunOffset = SUN_DIRECTION.map((c) => (c / sunLength) * SUN_DISTANCE);
const snap = new ShadowSnap(SUN_DIRECTION, (2 * SHADOW_HALF) / SHADOW_MAP);
const sunTarget = new Vector3();
const view = new Vector3();

/**
 * Keep the shadow-casting sun over the stretch of road the camera looks at:
 * its 80 m frustum centred a little ahead of the car along the view (not on
 * the car, where half of it would cover road already behind), stepping in
 * whole shadow texels so shadow edges hold still. Shadows fade out toward the
 * frustum's edge (`installShadowEdgeFade`), so ones coming into it grow in.
 */
export function followSun(
  light: DirectionalLight,
  pose: Readonly<VehiclePose>,
  camera?: Camera,
): void {
  sunTarget.set(pose.x, pose.y, pose.z);
  if (camera) {
    camera.getWorldDirection(view);
    view.y = 0;
    // Looking nearly straight down (the isometric view) leaves no horizontal direction to lead by.
    const flat = view.length();
    if (flat > 0.2) sunTarget.addScaledVector(view, SHADOW_AHEAD / flat);
  }
  snap.snap(sunTarget);
  light.position.set(
    sunTarget.x + sunOffset[0]!,
    sunTarget.y + sunOffset[1]!,
    sunTarget.z + sunOffset[2]!,
  );
  light.target.position.copy(sunTarget);
  light.target.updateMatrixWorld();
}

interface SceneLightsProps {
  lighting: ThemeLighting;
  sunRef: Ref<DirectionalLight>;
}

/**
 * Sky colour, distance fog and the two lights every drive scene uses, from the
 * theme. The sun's colour and intensity are props, not constructor args, so the
 * same light (and its shadow map) survives a theme change.
 */
export function SceneLights({ lighting: l, sunRef }: SceneLightsProps) {
  return (
    <>
      <color attach="background" args={[l.background]} />
      <fog attach="fog" args={[l.fog, l.fogNear, l.fogFar]} />
      <hemisphereLight args={[l.hemiSky, l.hemiGround, l.hemiIntensity]} />
      <directionalLight
        ref={sunRef}
        color={l.sunColor}
        intensity={l.sunIntensity}
        castShadow
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={1}
        shadow-camera-far={SHADOW_FAR}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />
    </>
  );
}
