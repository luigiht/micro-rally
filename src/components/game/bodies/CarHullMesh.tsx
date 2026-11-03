'use client';

import { useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { buildCarHull, type HullMesh, type HullSpec } from '@/render/car/CarHull';
import { buildFenderShell, type FenderSpec } from '@/render/car/FenderShell';

/**
 * Draws a flat-shaded triangle soup with per-face vertex colours. Faces
 * marked as glowing (lamp lenses painted into the surface) come last and are
 * drawn unlit as a second material group, so they read as lit whatever the
 * light does. The geometry is declared, so R3F disposes it with the mesh.
 */
export function VertexColorMesh({ mesh: { positions, colors, glowStart } }: { mesh: HullMesh }) {
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

/** A lofted hull; `glow` scales the colours of its glowing faces (HDR above 1, for the Nightcity bloom pass). */
export function CarHullMesh({ spec, glow = 1 }: { spec: HullSpec; glow?: number }) {
  const hull = useMemo(() => {
    const hull = buildCarHull(spec);
    if (glow !== 1)
      for (let i = hull.glowStart * 3; i < hull.colors.length; i++) hull.colors[i]! *= glow;
    return hull;
  }, [spec, glow]);
  return <VertexColorMesh mesh={hull} />;
}

/** A pair of free-standing wheel-arch fenders over one axle. */
export function FenderMesh({ spec }: { spec: FenderSpec }) {
  const mesh = useMemo(() => buildFenderShell(spec), [spec]);
  return <VertexColorMesh mesh={mesh} />;
}
