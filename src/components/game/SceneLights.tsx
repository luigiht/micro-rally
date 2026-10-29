'use client';

import type { Ref } from 'react';
import type { DirectionalLight } from 'three';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';

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
  sky: string;
  fog: string;
  sunRef: Ref<DirectionalLight>;
}

/** Sky colour, distance fog and the two lights every drive scene uses. */
export function SceneLights({ sky, fog, sunRef }: SceneLightsProps) {
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[fog, 70, 260]} />
      <hemisphereLight args={['#fff6e0', '#7fa05f', 1.9]} />
      <directionalLight
        ref={sunRef}
        intensity={2.6}
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
