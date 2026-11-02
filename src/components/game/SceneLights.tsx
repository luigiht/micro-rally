'use client';

import type { Ref } from 'react';
import type { DirectionalLight } from 'three';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import type { ThemeLighting } from '@/render/theme/WorldTheme';

const SHADOW_OFFSET = [8, 14, 6] as const;

/** Keep the shadow-casting sun centred on the car so its 60 m frustum always covers it. */
export function followSun(light: DirectionalLight, pose: Readonly<VehiclePose>): void {
  light.position.set(
    pose.x + SHADOW_OFFSET[0],
    pose.y + SHADOW_OFFSET[1],
    pose.z + SHADOW_OFFSET[2],
  );
  light.target.position.set(pose.x, pose.y, pose.z);
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
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0005}
      />
    </>
  );
}
