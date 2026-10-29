'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import { Box, CAR_COLORS as C, Lamp } from '../CarParts';

/** Door roundel with a blocky "7"; no fonts needed. */
function Roundel({ side }: { side: 1 | -1 }) {
  const x = 0.875 * side;
  return (
    <group position={[x, 0.58, 0.05]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 14]} />
        <meshStandardMaterial color={C.livery} flatShading />
      </mesh>
      <Box p={[0.012 * side, 0.1, 0]} s={[0.02, 0.05, 0.2]} c={C.trim} />
      <Box
        p={[0.012 * side, -0.02, 0]}
        s={[0.02, 0.22, 0.05]}
        c={C.trim}
        r={[-0.45 * side, 0, 0]}
      />
    </group>
  );
}

/** The starter hatchback's shell. `cabinRef` groups the roof and glass the first-person views hide. */
export function HatchbackBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <>
      {/* Shell */}
      <Box p={[0, 0.55, 0]} s={[1.72, 0.5, 3.7]} c={C.paint} shadow />
      <Box p={[0, 0.84, 1.28]} s={[1.6, 0.1, 1.05]} c={C.paint} r={[0.07, 0, 0]} />
      {/* Cabin + glass: hidden from the driver's seat */}
      <group ref={cabinRef}>
        <Box p={[0, 1.05, -0.25]} s={[1.5, 0.5, 1.85]} c={C.livery} shadow />
        <Box p={[0, 1.31, -0.25]} s={[0.44, 0.02, 1.86]} c={C.paint} />
        <Box p={[0, 1.04, 0.69]} s={[1.36, 0.46, 0.04]} c={C.glass} r={[-0.35, 0, 0]} />
        <Box p={[0, 1.06, -1.19]} s={[1.3, 0.38, 0.04]} c={C.glass} r={[0.25, 0, 0]} />
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.755 * side, 1.07, -0.2]} s={[0.02, 0.32, 1.55]} c={C.glass} />
            <Box p={[0.765 * side, 1.07, -0.2]} s={[0.02, 0.32, 0.06]} c={C.livery} />
            {/* Wing mirror */}
            <Box p={[0.86 * side, 0.98, 0.5]} s={[0.08, 0.04, 0.04]} c={C.trim} />
            <Box p={[0.94 * side, 1.0, 0.5]} s={[0.12, 0.12, 0.08]} c={C.paint} />
          </group>
        ))}
      </group>
      {([1, -1] as const).map((side) => (
        <group key={side}>
          {/* Livery stripe, arch flares */}
          <Box p={[0.865 * side, 0.74, 0]} s={[0.02, 0.07, 3.5]} c={C.livery} />
          <Box p={[0.88 * side, 0.5, front]} s={[0.1, 0.16, 0.95]} c={C.trim} />
          <Box p={[0.88 * side, 0.5, rear]} s={[0.1, 0.16, 0.95]} c={C.trim} />
          <Roundel side={side} />
          {/* Headlight, tail light */}
          <Box p={[0.55 * side, 0.64, 1.86]} s={[0.32, 0.16, 0.04]} c={C.head} glow={0.6} />
          <Box p={[0.6 * side, 0.68, -1.86]} s={[0.3, 0.14, 0.04]} c={C.tail} glow={0.5} />
        </group>
      ))}
      {/* Nose: grille, bumper, plate, rally light pod */}
      <Box p={[0, 0.6, 1.86]} s={[0.7, 0.16, 0.04]} c={C.trim} />
      <Box p={[0, 0.34, 1.9]} s={[1.78, 0.18, 0.22]} c={C.trim} />
      <Box p={[0, 0.35, 2.02]} s={[0.46, 0.11, 0.02]} c={C.livery} />
      <Box p={[0, 0.94, 1.72]} s={[1.2, 0.05, 0.06]} c={C.trim} />
      {[-0.45, -0.15, 0.15, 0.45].map((x) => (
        <Lamp key={x} p={[x, 0.96, 1.78]} radius={0.1} c={C.rally} glow={0.5} />
      ))}
      {/* Tail: bumper, plate, exhaust, roof spoiler */}
      <Box p={[0, 0.34, -1.9]} s={[1.78, 0.18, 0.22]} c={C.trim} />
      <Box p={[0, 0.52, -1.87]} s={[0.46, 0.11, 0.02]} c={C.livery} />
      <mesh position={[0.5, 0.3, -1.98]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.2, 8]} />
        <meshStandardMaterial color={C.rim} metalness={0.5} roughness={0.4} />
      </mesh>
      <Box p={[0, 1.36, -1.18]} s={[1.42, 0.05, 0.32]} c={C.paint} r={[-0.12, 0, 0]} shadow />
      <Box p={[0.5, 1.33, -1.12]} s={[0.05, 0.06, 0.12]} c={C.trim} />
      <Box p={[-0.5, 1.33, -1.12]} s={[0.05, 0.06, 0.12]} c={C.trim} />
      <Box p={[-0.5, 1.48, -0.95]} s={[0.02, 0.32, 0.02]} c={C.trim} r={[-0.3, 0, 0]} />
    </>
  );
}
