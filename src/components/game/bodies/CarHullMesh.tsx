'use client';

import { useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { buildCarHull, type HullMesh, type HullSpec } from '@/render/car/CarHull';
import { paintLivery, type LiveryShapes } from '@/render/car/HullLivery';
import { buildFenderShell, type FenderSpec } from '@/render/car/FenderShell';

/**
 * Draws a flat-shaded triangle soup with per-face vertex colours. Faces
 * marked as glowing (lamp lenses painted into the surface) come last and are
 * drawn unlit as a second material group, so they read as lit whatever the
 * light does. A livery's pieces (`liveryStart`..`glowStart`) stand just
 * proud of the faces and draw as a third group pulled toward the eye in
 * depth too, so they never fight the paint under them from afar. The
 * geometry is declared, so R3F disposes it with the mesh.
 */
export function VertexColorMesh({
  mesh: { positions, colors, glowStart, liveryStart = glowStart },
}: {
  mesh: HullMesh;
}) {
  const count = positions.length / 3;
  return (
    <mesh castShadow>
      <bufferGeometry
        onUpdate={(g: BufferGeometry) => {
          g.computeVertexNormals();
          g.clearGroups();
          g.addGroup(0, liveryStart, 0);
          if (liveryStart < glowStart) g.addGroup(liveryStart, glowStart - liveryStart, 2);
          if (glowStart < count) g.addGroup(glowStart, count - glowStart, 1);
        }}
      >
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <meshStandardMaterial attach="material-0" vertexColors flatShading />
      <meshBasicMaterial attach="material-1" vertexColors />
      <meshStandardMaterial
        attach="material-2"
        vertexColors
        flatShading
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-4}
      />
    </mesh>
  );
}

/**
 * A lofted hull with its glowing lamp lenses drawn unlit; with a `livery`,
 * its shapes painted onto every face in the body colour (`paintLivery`).
 */
export function CarHullMesh({ spec, livery }: { spec: HullSpec; livery?: LiveryShapes }) {
  const hull = useMemo(() => {
    const plain = buildCarHull(spec);
    return livery ? paintLivery(plain, livery, [spec.colors.body]) : plain;
  }, [spec, livery]);
  return <VertexColorMesh mesh={hull} />;
}

/** A pair of free-standing wheel-arch fenders over one axle. */
export function FenderMesh({ spec }: { spec: FenderSpec }) {
  const mesh = useMemo(() => buildFenderShell(spec), [spec]);
  return <VertexColorMesh mesh={mesh} />;
}

/** A flat-shaded soup in one colour: the A-pillar strips (`PillarStrip`) laid over a hull's screen edges. */
export function PillarMesh({ positions, color }: { positions: Float32Array; color: string }) {
  return (
    <mesh castShadow>
      <bufferGeometry onUpdate={(g: BufferGeometry) => g.computeVertexNormals()}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <meshStandardMaterial color={color} flatShading />
    </mesh>
  );
}
