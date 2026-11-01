'use client';

import { useMemo } from 'react';
import type { BufferGeometry } from 'three';

/** Shared palette and primitives for the procedural car models. */
export const CAR_COLORS = {
  paint: '#e8623a',
  livery: '#f4ecd8',
  trim: '#3a3944',
  seat: '#4a4650',
  lining: '#d9d4c7',
  glass: '#4d6f8c',
  tyre: '#2b2a33',
  rim: '#d9d4c7',
  head: '#fff6d0',
  rally: '#ffd76a',
  tail: '#d9343a',
} as const;

export type V3 = readonly [number, number, number];

export interface BoxProps {
  p: V3;
  s: V3;
  c: string;
  r?: V3;
  glow?: number;
  shadow?: boolean;
}

export function Box({ p, s, c, r, glow, shadow }: BoxProps) {
  return (
    <mesh position={p} rotation={r} castShadow={shadow}>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={c}
        flatShading
        emissive={glow ? c : '#000000'}
        emissiveIntensity={glow ?? 0}
      />
    </mesh>
  );
}

/** Door roundel: cream disc with a blocky numeral built from two trim bars. */
export function Roundel({ side, y = 0.58, z = 0.05 }: { side: 1 | -1; y?: number; z?: number }) {
  const x = 0.875 * side;
  return (
    <group position={[x, y, z]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 14]} />
        <meshStandardMaterial color={CAR_COLORS.livery} flatShading />
      </mesh>
      <Box p={[0.012 * side, 0.1, 0]} s={[0.02, 0.05, 0.2]} c={CAR_COLORS.trim} />
      <Box
        p={[0.012 * side, -0.02, 0]}
        s={[0.02, 0.22, 0.05]}
        c={CAR_COLORS.trim}
        r={[-0.45 * side, 0, 0]}
      />
    </group>
  );
}

/** Rounded wheel-arch lip: a half torus around the axle. */
export function ArchLip({
  x,
  z,
  radius,
  c,
  tube = 0.045,
}: {
  x: number;
  z: number;
  radius: number;
  c: string;
  tube?: number;
}) {
  return (
    <mesh position={[x, radius, z]} rotation={[0, Math.PI / 2, 0]}>
      <torusGeometry args={[radius + 0.07, tube, 6, 12, Math.PI]} />
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  );
}

/** Round lamp: a glowing lens facing forward (+z) in a dark housing, so it reads as a lamp from behind too. */
export function Lamp({ p, radius, c, glow }: { p: V3; radius: number; c: string; glow: number }) {
  return (
    <group position={p} rotation={[Math.PI / 2, 0, 0]}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[radius, radius, 0.04, 10]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={glow} />
      </mesh>
      <mesh position={[0, -0.025, 0]}>
        <cylinderGeometry args={[radius + 0.012, radius + 0.012, 0.06, 10]} />
        <meshStandardMaterial color={CAR_COLORS.trim} flatShading />
      </mesh>
    </group>
  );
}

/** Short cylinder whose flat face points along -z (toward the driver / viewer). */
export function Disc({ p, radius, depth, c }: { p: V3; radius: number; depth: number; c: string }) {
  return (
    <mesh position={p} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[radius, radius, depth, 16]} />
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  );
}

export interface PrismProps {
  /** Centre of the prism along x; it extends ±thickness/2 either side. */
  x: number;
  /** Convex outline in the (z, y) plane, in order around the polygon. */
  points: readonly (readonly [number, number])[];
  thickness: number;
  c: string;
  shadow?: boolean;
}

/** Flat-sided prism extruded along x from a convex (z, y) polygon: wing plates, fins, wedges. */
export function Prism({ x, points, thickness, c, shadow }: PrismProps) {
  const positions = useMemo(() => prismPositions(points, thickness), [points, thickness]);
  return (
    <mesh position={[x, 0, 0]} castShadow={shadow}>
      <bufferGeometry onUpdate={(g: BufferGeometry) => g.computeVertexNormals()}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  );
}

/** Non-indexed triangles for `Prism`, every face wound to point away from the centroid. */
export function prismPositions(
  points: readonly (readonly [number, number])[],
  thickness: number,
): Float32Array {
  const h = thickness / 2;
  const n = points.length;
  const cz = points.reduce((a, p) => a + p[0], 0) / n;
  const cy = points.reduce((a, p) => a + p[1], 0) / n;
  const out: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => {
    const ux = b[0]! - a[0]!;
    const uy = b[1]! - a[1]!;
    const uz = b[2]! - a[2]!;
    const vx = c[0]! - a[0]!;
    const vy = c[1]! - a[1]!;
    const vz = c[2]! - a[2]!;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const mx = (a[0]! + b[0]! + c[0]!) / 3;
    const my = (a[1]! + b[1]! + c[1]!) / 3 - cy;
    const mz = (a[2]! + b[2]! + c[2]!) / 3 - cz;
    const flip = nx * mx + ny * my + nz * mz < 0;
    for (const q of flip ? [a, c, b] : [a, b, c]) out.push(q[0]!, q[1]!, q[2]!);
  };
  const at = (i: number, sx: number) => [sx, points[i]![1], points[i]![0]];
  for (const sx of [h, -h]) {
    for (let i = 1; i < n - 1; i++) tri(at(0, sx), at(i, sx), at(i + 1, sx));
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(at(i, h), at(j, h), at(j, -h));
    tri(at(i, h), at(j, -h), at(i, -h));
  }
  return new Float32Array(out);
}
