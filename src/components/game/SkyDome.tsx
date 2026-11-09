'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BackSide, Color, type Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { SkyGradient } from '@/render/theme/WorldTheme';

/** Inside the camera's far plane (500 m), outside the fog's reach. */
const RADIUS = 420;

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 glow;
uniform vec3 glowHot;
uniform vec3 sunset;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float up = d.y;
  vec3 col = mix(horizon, zenith, smoothstep(0.0, 0.6, up));
  vec2 flat2 = d.xz;
  float len = length(flat2);
  float toward = len > 0.0001 ? max(dot(flat2 / len, sunset.xz), 0.0) : 0.0;
  float low = smoothstep(-0.04, 0.03, up);
  col = mix(col, glow, pow(toward, 3.0) * (1.0 - smoothstep(0.0, 0.32, up)) * low * 0.85);
  col = mix(col, glowHot, pow(toward, 10.0) * (1.0 - smoothstep(0.0, 0.1, up)) * low * 0.9);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * A gradient dome round the camera for a twilight sky: indigo overhead, the
 * fog's colour at the horizon so distant ground melts into it, and an
 * afterglow (pink, then orange low down) toward where the sun has set.
 */
export function SkyDome({ sky, sunset }: { sky: SkyGradient; sunset: readonly number[] }) {
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => new SphereGeometry(RADIUS, 32, 16), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          zenith: { value: new Color() },
          horizon: { value: new Color() },
          glow: { value: new Color() },
          glowHot: { value: new Color() },
          sunset: { value: new Vector3() },
        },
        vertexShader,
        fragmentShader,
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );

  useEffect(() => {
    const u = material.uniforms;
    (u.zenith!.value as Color).set(sky.zenith);
    (u.horizon!.value as Color).set(sky.horizon);
    (u.glow!.value as Color).set(sky.glow);
    (u.glowHot!.value as Color).set(sky.glowHot);
    (u.sunset!.value as Vector3).set(sunset[0]!, 0, sunset[2]!).normalize();
  }, [material, sky, sunset]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      renderOrder={-1}
      frustumCulled={false}
    />
  );
}
