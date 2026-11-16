'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import { BERLINETTE_LIVERY } from '@/render/car/BerlinetteLivery';
import {
  BERLINETTE_A_PILLAR,
  BERLINETTE_COLORS,
  BERLINETTE_HULL,
} from '@/render/car/BerlinetteShape';
import { pillarStrip } from '@/render/car/PillarStrip';
import { ArchLip, Box, Lamp } from '../CarParts';
import { CarHullMesh, PillarMesh } from './CarHullMesh';

const K = {
  body: BERLINETTE_COLORS.body,
  trim: BERLINETTE_COLORS.trim,
  chrome: BERLINETTE_COLORS.chrome,
  head: '#fff6d0',
  rally: '#ffd76a',
} as const;

/** The A-pillars: a slim body-coloured strip folded over each side's screen edge, flush with the glass. */
const A_PILLARS = pillarStrip(BERLINETTE_A_PILLAR, BERLINETTE_HULL.rounding ?? {}, 0.03, 0.006);

/**
 * Tiny rear-engined berlinette in 1970s rally trim (`BerlinetteShape`,
 * `BerlinetteLivery`). Coordinates in the root frame. `cabinRef` holds the
 * mirrors.
 */
export function BerlinetteBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={BERLINETTE_HULL} livery={BERLINETTE_LIVERY} />
      <PillarMesh positions={A_PILLARS} color={K.body} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            {/* Chrome bullet mirrors on the doors' leading corners */}
            <Box p={[0.75 * side, 0.81, 0.62]} s={[0.05, 0.02, 0.02]} c={K.chrome} />
            <Box p={[0.79 * side, 0.835, 0.6]} s={[0.05, 0.045, 0.09]} c={K.chrome} />
          </group>
        ))}
      </group>
      {/* Wipers parked at the screen's foot */}
      <Box p={[0.18, 0.83, 0.8]} s={[0.36, 0.01, 0.015]} c={K.trim} r={[0, 0.1, 0]} />
      <Box p={[-0.22, 0.83, 0.8]} s={[0.36, 0.01, 0.015]} c={K.trim} r={[0, -0.06, 0]} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <ArchLip x={0.78 * side} z={front} radius={spec.wheelRadius} c={K.body} tube={0.025} />
          <ArchLip x={0.79 * side} z={rear} radius={spec.wheelRadius} c={K.body} tube={0.025} />
          {/* Big headlamps at the nose's corners, small long-range lamps inboard */}
          <Lamp p={[0.47 * side, 0.58, 1.88]} radius={0.085} c={K.head} glow={0.6} />
          <Lamp p={[0.25 * side, 0.5, 1.95]} radius={0.06} c={K.head} glow={0.6} />
          {/* Yellow rally lamps low on the bumper; chrome blades round the corners */}
          <Lamp p={[0.33 * side, 0.36, 2.03]} radius={0.07} c={K.rally} glow={0.5} />
          <Box p={[0.5 * side, 0.36, 1.94]} s={[0.24, 0.035, 0.06]} c={K.chrome} />
          <Box
            p={[0.64 * side, 0.36, 1.85]}
            s={[0.04, 0.035, 0.2]}
            c={K.chrome}
            r={[0, -0.5 * side, 0]}
          />
          <Box p={[0.45 * side, 0.43, -1.8]} s={[0.3, 0.035, 0.06]} c={K.chrome} />
          <Box
            p={[0.6 * side, 0.43, -1.72]}
            s={[0.04, 0.035, 0.16]}
            c={K.chrome}
            r={[0, 0.5 * side, 0]}
          />
        </group>
      ))}
      {/* The silencer hanging under the tail */}
      <mesh position={[-0.18, 0.33, -1.8]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.36, 10]} />
        <meshStandardMaterial color="#e8e6df" roughness={0.6} />
      </mesh>
      <mesh position={[-0.38, 0.33, -1.87]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.12, 8]} />
        <meshStandardMaterial color={K.chrome} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
