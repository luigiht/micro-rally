'use client';

import { useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { buildCarHull, type HullSpec } from '@/render/car/CarHull';

/**
 * Renders a lofted hull with flat shading and per-face vertex colours. Faces
 * the hull marks as glowing (lamp lenses painted into the surface) come last
 * and are drawn unlit as a second material group, so they read as lit
 * whatever the light does; `glow` scales their colours (HDR above 1). The
 * geometry is declared, so R3F disposes it with the mesh.
 */
export function CarHullMesh({ spec, glow = 1 }: { spec: HullSpec; glow?: number }) {
  const { positions, colors, glowStart } = useMemo(() => {
    const hull = buildCarHull(spec);
    // Glow faces are drawn unlit; above 1 they carry HDR colour for the bloom pass (Nightcity).
    if (glow !== 1)
      for (let i = hull.glowStart * 3; i < hull.colors.length; i++) hull.colors[i]! *= glow;
    return hull;
  }, [spec, glow]);
  const count = positions.length / 3;
  return (
    <mesh castShadow>
      <bufferGeometry
        onUpdate={(g: BufferGeometry) => {
          g.computeVertexNormals();
          g.clearGroups();
          g.addGroup(0, glowStart, 0);
          if (glowStart < count) g.addGroup(glowStart, count - glowStart, 1);
        }}
      >
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <meshStandardMaterial attach="material-0" vertexColors flatShading />
      <meshBasicMaterial attach="material-1" vertexColors />
    </mesh>
  );
}
