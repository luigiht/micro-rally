'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec } from '@/render/car/CarHull';
import { ArchLip, Box, Lamp } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** Repsol-style livery: orange upper works, navy lower cab and skirt, white band with a red rule on the box. */
const K = {
  orange: '#f0741f',
  navy: '#1c2a63',
  white: '#f4f1ea',
  red: '#d7262c',
  trim: '#2b2a33',
  glass: '#4d6f8c',
  head: '#fff6d0',
  tail: '#d9343a',
  steel: '#9a9690',
} as const;

const X_BODY = 1.2;
const FLOOR = 0.95;
const SILL = 1.0;
const BELT = 1.95;
const CAB_ROOF = 3.0;
const BOX_ROOF = 3.1;

/**
 * Cab-over cab: a tall box with a steep windscreen falling from the roof to
 * the belt at the nose and side glass along its length. Orange above the
 * belt crease, a navy band below it down to the floor.
 */
const CAB: HullSpec = {
  wells: wellsFor(CAR_SPECS.dakar),
  colors: { body: K.orange, trim: K.trim, glass: K.glass, stripe: K.navy },
  stripeBand: [1.0, 0.3],
  wrapStripes: true,
  stations: [
    {
      z: 0.75,
      floor: FLOOR,
      sill: SILL,
      belt: BELT,
      roof: BELT,
      xSill: 1.1,
      xBody: X_BODY,
      xRoof: X_BODY,
    },
    {
      z: 0.85,
      floor: FLOOR,
      sill: SILL,
      belt: BELT,
      roof: CAB_ROOF,
      xSill: 1.1,
      xBody: X_BODY,
      xRoof: 1.14,
      glass: true,
    },
    {
      z: 2.45,
      floor: FLOOR,
      sill: SILL,
      belt: BELT,
      roof: CAB_ROOF,
      xSill: 1.1,
      xBody: X_BODY,
      xRoof: 1.14,
      glass: true,
    },
    {
      z: 2.75,
      floor: FLOOR,
      sill: SILL,
      belt: BELT,
      roof: BELT,
      xSill: 1.1,
      xBody: X_BODY,
      xRoof: X_BODY,
    },
  ],
};

/**
 * Cargo box behind the cab: orange top, then a white band, a red rule and a
 * navy skirt, running over the rear wheel arch.
 */
const BOX: HullSpec = {
  wells: wellsFor(CAR_SPECS.dakar),
  colors: {
    body: K.orange,
    trim: K.trim,
    glass: K.glass,
    stripe: [K.white, K.white, K.red, K.navy, K.navy, K.navy],
  },
  stripeBand: [2.3, 1.0],
  wrapStripes: true,
  stations: [
    {
      z: -3.15,
      floor: FLOOR,
      sill: SILL,
      belt: BOX_ROOF,
      roof: BOX_ROOF,
      xSill: 1.1,
      xBody: X_BODY,
      xRoof: X_BODY,
    },
    {
      z: 0.55,
      floor: FLOOR,
      sill: SILL,
      belt: BOX_ROOF,
      roof: BOX_ROOF,
      xSill: 1.1,
      xBody: X_BODY,
      xRoof: X_BODY,
    },
  ],
};

/** Dakar rally truck. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function DakarTruckBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={CAB} />
      <CarHullMesh spec={BOX} />
      {/* Chassis rails and the gap between cab and box; exhaust stack behind the cab */}
      <Box p={[0, 1.05, 0.65]} s={[2.0, 0.3, 0.34]} c={K.trim} />
      <mesh position={[1.0, 2.2, 0.66]}>
        <cylinderGeometry args={[0.08, 0.08, 2.0, 8]} />
        <meshStandardMaterial color={K.steel} flatShading metalness={0.4} roughness={0.5} />
      </mesh>
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[1.3 * side, 2.45, 2.35]} s={[0.24, 0.04, 0.04]} c={K.trim} />
            <Box p={[1.44 * side, 2.4, 2.35]} s={[0.06, 0.36, 0.2]} c={K.navy} />
          </group>
        ))}
      </group>
      {/* Roof: sun visor, light bar with four lamps, roof rails */}
      <Box p={[0, 2.98, 2.62]} s={[2.3, 0.08, 0.36]} c={K.orange} />
      <Box p={[0, 3.1, 2.45]} s={[1.9, 0.12, 0.14]} c={K.trim} />
      {[-0.7, -0.24, 0.24, 0.7].map((x) => (
        <Lamp key={x} p={[x, 3.1, 2.53]} radius={0.08} c={K.head} glow={0.5} />
      ))}
      <Box p={[0.95, 3.08, 1.6]} s={[0.06, 0.16, 1.4]} c={K.trim} />
      <Box p={[-0.95, 3.08, 1.6]} s={[0.06, 0.16, 1.4]} c={K.trim} />
      {/* Nose: navy grille, headlamps, orange bumper with four round lamps, skid plate */}
      <Box p={[0, 1.55, 2.78]} s={[1.6, 0.5, 0.06]} c={K.navy} />
      <Box p={[0, 1.55, 2.82]} s={[1.2, 0.06, 0.02]} c={K.steel} />
      <Box p={[0, 1.4, 2.82]} s={[1.2, 0.06, 0.02]} c={K.steel} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Box p={[0.9 * side, 1.5, 2.8]} s={[0.36, 0.22, 0.06]} c={K.head} glow={0.6} />
          <Box p={[0.9 * side, 1.9, -3.17]} s={[0.36, 0.2, 0.06]} c={K.tail} glow={0.5} />
          <ArchLip x={X_BODY * side} z={front} radius={spec.wheelRadius} c={K.trim} tube={0.06} />
          <ArchLip x={X_BODY * side} z={rear} radius={spec.wheelRadius} c={K.trim} tube={0.06} />
          {/* Cab step and grab handle */}
          <Box p={[1.22 * side, 0.7, 1.3]} s={[0.3, 0.06, 0.5]} c={K.trim} />
          <Box p={[1.23 * side, 2.2, 0.9]} s={[0.04, 0.8, 0.04]} c={K.steel} />
        </group>
      ))}
      <Box p={[0, 1.0, 2.88]} s={[2.4, 0.36, 0.3]} c={K.orange} shadow />
      <Box p={[0, 0.78, 2.96]} s={[2.0, 0.08, 0.2]} c={K.trim} />
      {[-0.75, -0.3, 0.3, 0.75].map((x) => (
        <Lamp key={x} p={[x, 1.26, 3.0]} radius={0.1} c={K.head} glow={0.5} />
      ))}
      {/* Tail: bumper, spare wheel on the back wall */}
      <Box p={[0, 1.0, -3.2]} s={[2.3, 0.3, 0.2]} c={K.navy} />
      <mesh position={[0, 2.5, -3.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.3, 12]} />
        <meshStandardMaterial color={K.trim} flatShading />
      </mesh>
      <mesh position={[0, 2.5, -3.24]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 8]} />
        <meshStandardMaterial color={K.orange} flatShading />
      </mesh>
    </group>
  );
}
