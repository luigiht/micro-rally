'use client';

import { useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { buildCarHull, type HullSpec } from '@/render/car/CarHull';

/**
 * Renders a lofted hull with flat shading and per-face vertex colours. The
 * geometry is declared, so R3F disposes it with the mesh.
 */
export function CarHullMesh({ spec }: { spec: HullSpec }) {
  const { positions, colors } = useMemo(() => buildCarHull(spec), [spec]);
  return (
    <mesh castShadow>
      <bufferGeometry onUpdate={(g: BufferGeometry) => g.computeVertexNormals()}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <meshStandardMaterial vertexColors flatShading />
    </mesh>
  );
}
