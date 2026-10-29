'use client';

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

/** Round lamp lens facing forward (+z). */
export function Lamp({ p, radius, c, glow }: { p: V3; radius: number; c: string; glow: number }) {
  return (
    <mesh position={p} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[radius, radius, 0.08, 10]} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={glow} />
    </mesh>
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
