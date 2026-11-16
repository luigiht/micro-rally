'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import { pillarStrip } from '@/render/car/PillarStrip';
import { SATORY_BLUE, SATORY_LIVERY, SATORY_RED } from '@/render/car/SatoryLivery';
import { SATORY_A_PILLAR, SATORY_HULL } from '@/render/car/SatoryShape';
import { ArchLip, Box, Prism } from '../CarParts';
import { CarHullMesh, PillarMesh } from './CarHullMesh';

const K = {
  body: SATORY_RED,
  blue: SATORY_BLUE,
  trim: '#1f1e24',
  carbon: '#2b2a33',
  rim: '#d9d4c7',
  red: '#d9343a',
} as const;

/** The wing's end plates, traced off the model: standing on the hatch, swept back to the blade's tip. */
const WING_PLATE: readonly (readonly [number, number])[] = [
  [-1.932, 1.237],
  [-1.906, 1.102],
  [-1.878, 1.0],
  [-1.649, 1.001],
  [-1.609, 1.048],
  [-1.728, 1.204],
];
/** The blade between them, in section: a deep slab leaning back from the hatch up to its tip at 1.31 m. */
const WING_BLADE: readonly (readonly [number, number])[] = [
  [-1.958, 1.308],
  [-1.937, 1.098],
  [-1.904, 1.078],
  [-1.69, 1.071],
  [-1.625, 1.097],
  [-1.757, 1.307],
];
/** The roof scoop at the screen's top: a low wedge, open at the front. */
const SCOOP: readonly (readonly [number, number])[] = [
  [-0.02, 1.37],
  [0.26, 1.33],
  [0.26, 1.41],
  [0.02, 1.42],
];
/** Each mirror's housing, round the mirror glass traced off the model (z 0.57–0.65, y 0.91–0.98). */
const MIRROR: readonly (readonly [number, number])[] = [
  [0.565, 0.9],
  [0.66, 0.9],
  [0.7, 0.94],
  [0.66, 0.99],
  [0.565, 0.99],
];

/** The A-pillars: a thin strip folded over each side's screen edge, flush with the glass. */
const A_PILLARS = pillarStrip(SATORY_A_PILLAR, SATORY_HULL.rounding ?? {}, 0.045, 0.008);

/**
 * Mid-2000s three-door WRC in works trim (`SatoryShape`, `SatoryLivery`).
 * Coordinates in the root frame. `cabinRef` holds the mirrors.
 */
export function SatoryHatchBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={SATORY_HULL} livery={SATORY_LIVERY} />
      <PillarMesh positions={A_PILLARS} color={K.trim} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            {/* Mirrors on a stalk at the door glass's front corner, the glass facing back */}
            <Box p={[0.8 * side, 0.92, 0.66]} s={[0.08, 0.025, 0.05]} c={K.trim} />
            <Prism x={0.855 * side} points={MIRROR} thickness={0.16} c={K.body} />
            <Box p={[0.855 * side, 0.945, 0.562]} s={[0.15, 0.07, 0.008]} c={K.trim} />
          </group>
        ))}
      </group>
      {/* Wipers parked at the screen's foot; the roof scoop; two antennas */}
      <Box p={[0.22, 0.9, 0.9]} s={[0.5, 0.012, 0.02]} c={K.trim} r={[0, 0.12, 0]} />
      <Box p={[-0.3, 0.9, 0.9]} s={[0.46, 0.012, 0.02]} c={K.trim} r={[0, -0.08, 0]} />
      <Prism x={0} points={SCOOP} thickness={0.3} c={K.carbon} />
      <Box p={[0.26, 1.52, -0.95]} s={[0.012, 0.36, 0.012]} c={K.trim} r={[-0.3, 0, 0]} />
      <Box p={[-0.26, 1.48, -1.05]} s={[0.012, 0.28, 0.012]} c={K.trim} r={[-0.3, 0, 0]} />
      {/* The rear wing: end plates standing on the hatch, the deep carbon blade between them */}
      {([1, -1] as const).map((side) => (
        <Prism
          key={side}
          x={0.67 * side}
          points={WING_PLATE}
          thickness={0.025}
          c={K.carbon}
          shadow
        />
      ))}
      <Prism x={0} points={WING_BLADE} thickness={1.32} c={K.carbon} shadow />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          {/* Flare lips: red over the front wheel, blue over the rear */}
          <ArchLip x={0.88 * side} z={front} radius={spec.wheelRadius} c={K.body} tube={0.03} />
          <ArchLip x={0.88 * side} z={rear} radius={spec.wheelRadius} c={K.blue} tube={0.03} />
          {/* Side skirt under the doors */}
          <Box p={[0.82 * side, 0.15, -0.02]} s={[0.05, 0.05, 1.6]} c={K.carbon} />
          {/* Red tow hooks under the bumpers */}
          <Box p={[0.32 * side, 0.24, 2.1]} s={[0.05, 0.04, 0.06]} c={K.red} />
        </group>
      ))}
      {/* Splitter under the nose; the diffuser, tow hook and exhaust under the tail */}
      <Box p={[0, 0.17, 2.0]} s={[1.5, 0.025, 0.26]} c={K.carbon} />
      <Box p={[0, 0.3, -1.98]} s={[1.3, 0.06, 0.12]} c={K.carbon} />
      {[-0.3, -0.1, 0.1, 0.3].map((x) => (
        <Box key={x} p={[x, 0.29, -2.03]} s={[0.015, 0.07, 0.08]} c={K.trim} />
      ))}
      <Box p={[0.45, 0.32, -2.04]} s={[0.05, 0.04, 0.06]} c={K.red} />
      <mesh position={[-0.45, 0.32, -2.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.16, 10]} />
        <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
