'use client';

import { useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { bullPositions } from '@/render/car/BullSilhouette';
import { fenderPoint, type FenderSpec } from '@/render/car/FenderShell';
import { Box } from '../CarParts';

/** Energy-drink livery: navy shell, a red charging bull over a yellow sun on each door, white lettering on the nose. */
export const BUGGY_COLORS = {
  navy: '#1a337a',
  red: '#d7262c',
  yellow: '#f2c230',
  white: '#f4f1ea',
  orange: '#f0741f',
  trim: '#2b2a33',
  carbon: '#1f1f26',
  glass: '#4d6f8c',
  head: '#fff6d0',
  tail: '#d9343a',
  steel: '#9a9690',
  tyre: '#2b2a33',
  rim: '#b7b4ac',
} as const;

const K = BUGGY_COLORS;
const SIDES = [1, -1] as const;
/** Metres per SVG unit: the 30-unit bull comes out 0.84 m long, 0.58 m tall, between the sill and the belt. */
const BULL_SCALE = 0.028;

/** A thin disc on a flank, facing outward. */
function SideDisc({
  x,
  y,
  z,
  radius,
  c,
}: {
  x: number;
  y: number;
  z: number;
  radius: number;
  c: string;
}) {
  return (
    <mesh position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[radius, radius, 0.02, 18]} />
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  );
}

/** The charging bull standing proud of a flank at `x`, centred on (`z`, `y`): the icon silhouette, extruded, its head forward in the sun. */
function ChargingBull({ x, y, z, c }: { x: number; y: number; z: number; c: string }) {
  const positions = useMemo(() => bullPositions(BULL_SCALE, 0.02), []);
  return (
    <mesh position={[x, y, z]}>
      <bufferGeometry onUpdate={(g: BufferGeometry) => g.computeVertexNormals()}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  );
}

/** A sponsor disc lying on a fender's dome at `angle`, offset `x` across the car. */
function FenderDisc({
  fender,
  angle,
  x,
  c,
}: {
  fender: FenderSpec;
  angle: number;
  x: number;
  c: string;
}) {
  const { y, z, tilt } = fenderPoint(fender, angle, 0.006);
  return (
    <mesh position={[x, y, z]} rotation={[tilt, 0, 0]}>
      <cylinderGeometry args={[0.09, 0.09, 0.012, 12]} />
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  );
}

/** A plate on a fender's outboard wall at `angle`, lying along the arch. */
function FenderPlate({
  fender,
  angle,
  side,
  len,
}: {
  fender: FenderSpec;
  angle: number;
  side: 1 | -1;
  len: number;
}) {
  const a = (angle * Math.PI) / 180;
  const r = fender.inner + 0.13;
  return (
    <Box
      p={[(fender.xOut + 0.01) * side, fender.axleY + r * Math.cos(a), fender.z + r * Math.sin(a)]}
      s={[0.02, 0.1, len]}
      c={K.white}
      r={[a, 0, 0]}
    />
  );
}

/**
 * The buggy's livery parts, both sides: on each door a yellow sun with the
 * red bull charging across it toward the nose, a race-number plate behind
 * the front fender, sponsor plates on the fender walls and discs on their
 * domes. `flank` is the door skin's half-width.
 */
export function BuggyLivery({
  flank,
  front,
  rear,
}: {
  flank: number;
  front: FenderSpec;
  rear: FenderSpec;
}) {
  const skin = flank + 0.012;
  return (
    <>
      {SIDES.map((side) => (
        <group key={side}>
          <SideDisc x={skin * side} y={0.82} z={0.22} radius={0.3} c={K.yellow} />
          <ChargingBull x={(skin + 0.012) * side} y={0.815} z={-0.12} c={K.red} />
          {/* Race number: white plate, red header rule, three dark numerals */}
          <Box p={[skin * side, 0.84, 0.68]} s={[0.02, 0.26, 0.22]} c={K.white} />
          <Box p={[(skin + 0.01) * side, 0.945, 0.68]} s={[0.012, 0.03, 0.2]} c={K.red} />
          {[0.61, 0.68, 0.75].map((z) => (
            <Box key={z} p={[(skin + 0.01) * side, 0.83, z]} s={[0.012, 0.13, 0.03]} c={K.carbon} />
          ))}
          <FenderPlate fender={front} angle={30} side={side} len={0.3} />
          <FenderPlate fender={rear} angle={-30} side={side} len={0.26} />
          <FenderDisc fender={front} angle={-20} x={0.9 * side} c={K.orange} />
          <FenderDisc fender={rear} angle={40} x={0.9 * side} c={K.orange} />
        </group>
      ))}
    </>
  );
}
