'use client';

import { useMemo } from 'react';
import { AdditiveBlending, Color } from 'three';
import type { CarSpec } from '@/game/vehicle/CarSpec';

/** Grid segments per side; the alpha falls off radially so the pool needs no texture. */
const SEGMENTS = 6;

/**
 * Neon pooling on the ground under the car: an additive plane just above the
 * road whose vertex alpha falls from one at the centre to nothing at the
 * edge, so it needs no texture. Mounted in the wheels group, so it stays on
 * the ground while the body rides the springs. HDR colour, so it blooms.
 */
export function Underglow({ spec, color }: { spec: CarSpec; color: string }) {
  const w = spec.trackWidth + 1.2;
  const l = spec.cgToFront + spec.cgToRear + 1.6;
  const zc = (spec.cgToFront - spec.cgToRear) / 2;
  const colors = useMemo(() => {
    const c = new Color(color).multiplyScalar(1.6);
    const n = SEGMENTS + 1;
    // PlaneGeometry vertices run row-major, top row first; (u, v) in [-1, 1] over the plane.
    const out = new Float32Array(n * n * 4);
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const u = (ix / SEGMENTS) * 2 - 1;
        const v = (iy / SEGMENTS) * 2 - 1;
        const fall = Math.max(0, 1 - Math.hypot(u, v));
        out.set([c.r, c.g, c.b, fall * fall], (iy * n + ix) * 4);
      }
    }
    return out;
  }, [color]);
  return (
    <mesh position={[0, 0.05, zc]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[w, l, SEGMENTS, SEGMENTS]}>
        <bufferAttribute attach="attributes-color" args={[colors, 4]} />
      </planeGeometry>
      <meshBasicMaterial vertexColors transparent blending={AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}
