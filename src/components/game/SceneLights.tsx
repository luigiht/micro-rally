'use client';

import type { Ref } from 'react';
import { type DirectionalLight, Vector3 } from 'three';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { ShadowSnap } from '@/render/effects/ShadowSnap';
import type { ThemeLighting } from '@/render/theme/WorldTheme';

const SHADOW_OFFSET = [8, 14, 6] as const;
/** Half the shadow frustum's width, metres, and the shadow map's size, texels. */
const SHADOW_HALF = 30;
const SHADOW_MAP = 2048;
const snap = new ShadowSnap(SHADOW_OFFSET, (2 * SHADOW_HALF) / SHADOW_MAP);
const sunTarget = new Vector3();

/**
 * Keep the shadow-casting sun centred on the car so its 60 m frustum always
 * covers it, stepping in whole shadow texels so shadow edges hold still.
 */
export function followSun(light: DirectionalLight, pose: Readonly<VehiclePose>): void {
  snap.snap(sunTarget.set(pose.x, pose.y, pose.z));
  light.position.set(
    sunTarget.x + SHADOW_OFFSET[0],
    sunTarget.y + SHADOW_OFFSET[1],
    sunTarget.z + SHADOW_OFFSET[2],
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
        shadow-camera-far={60}
        shadow-bias={-0.0005}
      />
    </>
  );
}
