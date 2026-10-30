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
