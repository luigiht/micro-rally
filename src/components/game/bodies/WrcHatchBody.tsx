'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec } from '@/render/car/CarHull';
import { ArchLip, Box, Lamp } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** White shell with a flank of sky-blue, navy and red bands over a navy skirt; navy wing and bonnet oval. */
const K = {
  body: '#f4f1ea',
  navy: '#1f2a7a',
  sky: '#5aa0e0',
  red: '#e02a2a',
  trim: '#2b2a33',
  glass: '#4d6f8c',
  head: '#fff6d0',
  tail: '#d9343a',
  rim: '#d9d4c7',
} as const;

/**
 * Tall "new edge" hatch: sloping nose, fast windscreen far forward, high
 * roof over a long cabin, steep rear glass onto a flat, upright tailgate. The
 * stripe band runs from the sill to just under the belt, sky blue on top
 * and a double-height navy skirt at the bottom.
 */
const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.wrc),
  colors: {
    body: K.body,
    trim: K.trim,
    glass: K.glass,
    stripe: [K.sky, K.navy, K.red, K.navy, K.navy],
  },
  stripeBand: [0.54, 0.2],
  // Bonnet: navy oval in five slices, a red and a navy band either side, four vent slots at the scuttle.
  deck: [
    { x0: -0.18, x1: 0.18, z0: 1.2, z1: 1.27, color: K.navy },
    { x0: -0.3, x1: 0.3, z0: 1.27, z1: 1.37, color: K.navy },
    { x0: -0.36, x1: 0.36, z0: 1.37, z1: 1.53, color: K.navy },
    { x0: -0.3, x1: 0.3, z0: 1.53, z1: 1.63, color: K.navy },
    { x0: -0.18, x1: 0.18, z0: 1.63, z1: 1.7, color: K.navy },
    { x0: 0.57, x1: 0.67, z0: 1.05, z1: 2.0, color: K.red, mirror: true },
    { x0: 0.69, x1: 0.75, z0: 1.05, z1: 2.0, color: K.navy, mirror: true },
    { x0: 0.04, x1: 0.16, z0: 1.08, z1: 1.16, color: K.trim, mirror: true },
    { x0: 0.24, x1: 0.36, z0: 1.08, z1: 1.16, color: K.trim, mirror: true },
  ],
  stations: [
    { z: -2.0, floor: 0.4, sill: 0.46, belt: 0.98, roof: 0.98, xSill: 0.8, xBody: 0.9, xRoof: 0.9 },
    {
      z: -1.6,
      floor: 0.34,
      sill: 0.44,
      belt: 1.02,
      roof: 1.02,
      xSill: 0.86,
      xBody: 0.94,
      xRoof: 0.94,
      glass: true,
    },
    {
      z: -1.25,
      floor: 0.34,
      sill: 0.44,
      belt: 0.97,
      roof: 1.4,
      xSill: 0.86,
      xBody: 0.94,
      xRoof: 0.64,
      glass: true,
    },
    {
      z: -0.55,
      floor: 0.34,
      sill: 0.44,
      belt: 0.96,
      roof: 1.43,
      xSill: 0.86,
      xBody: 0.94,
      xRoof: 0.68,
    },
    {
      z: -0.47,
      floor: 0.34,
      sill: 0.44,
      belt: 0.96,
      roof: 1.43,
      xSill: 0.86,
      xBody: 0.94,
      xRoof: 0.68,
      glass: true,
    },
    {
      z: 0.55,
      floor: 0.34,
      sill: 0.44,
      belt: 0.95,
      roof: 1.37,
      xSill: 0.86,
      xBody: 0.94,
      xRoof: 0.66,
      glass: true,
    },
    {
      z: 1.05,
      floor: 0.34,
      sill: 0.44,
      belt: 0.9,
      roof: 0.9,
      xSill: 0.86,
      xBody: 0.94,
      xRoof: 0.94,
    },
    {
      z: 1.6,
      floor: 0.34,
      sill: 0.42,
      belt: 0.8,
      roof: 0.8,
      xSill: 0.84,
      xBody: 0.92,
      xRoof: 0.92,
    },
    {
      z: 2.15,
      floor: 0.38,
      sill: 0.44,
      belt: 0.66,
      roof: 0.66,
      xSill: 0.78,
      xBody: 0.86,
      xRoof: 0.86,
    },
  ],
};

/** Turn-of-the-century World Rally Car hatch. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function WrcHatchBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  const flank = 0.94;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.95 * side, 1.06, 0.5]} s={[0.08, 0.04, 0.04]} c={K.trim} />
            <Box p={[1.03 * side, 1.08, 0.5]} s={[0.12, 0.12, 0.08]} c={K.navy} />
          </group>
        ))}
      </group>
      {/* Roof scoop and antenna */}
      <Box p={[0, 1.45, 0.2]} s={[0.4, 0.07, 0.3]} c={K.navy} />
      <Box p={[0, 1.46, 0.36]} s={[0.34, 0.05, 0.02]} c={K.trim} />
      <Box p={[-0.5, 1.56, -0.7]} s={[0.02, 0.3, 0.02]} c={K.trim} r={[-0.3, 0, 0]} />
      {/* Two-tier wing on the roof's trailing edge, over the top of the rear glass */}
      <Box p={[0.5, 1.47, -1.26]} s={[0.05, 0.16, 0.22]} c={K.trim} r={[0.15, 0, 0]} />
      <Box p={[-0.5, 1.47, -1.26]} s={[0.05, 0.16, 0.22]} c={K.trim} r={[0.15, 0, 0]} />
      <Box p={[0, 1.55, -1.38]} s={[1.6, 0.05, 0.4]} c={K.navy} r={[-0.08, 0, 0]} shadow />
      <Box p={[0, 1.44, -1.5]} s={[1.5, 0.04, 0.18]} c={K.navy} r={[-0.05, 0, 0]} />
      <Box p={[0.8, 1.5, -1.4]} s={[0.04, 0.22, 0.44]} c={K.navy} />
      <Box p={[-0.8, 1.5, -1.4]} s={[0.04, 0.22, 0.44]} c={K.navy} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <ArchLip x={flank * side} z={front} radius={spec.wheelRadius} c={K.navy} tube={0.055} />
          <ArchLip x={flank * side} z={rear} radius={spec.wheelRadius} c={K.navy} tube={0.055} />
          {/* Door number plate: white square with navy header */}
          <Box p={[0.945 * side, 0.74, 0.15]} s={[0.012, 0.36, 0.36]} c={K.body} />
          <Box p={[0.952 * side, 0.89, 0.15]} s={[0.012, 0.06, 0.36]} c={K.navy} />
          <Box p={[0.952 * side, 0.7, 0.15]} s={[0.012, 0.22, 0.05]} c={K.trim} />
          {/* Swept headlamps, tall tail lamps */}
          <Box
            p={[0.56 * side, 0.7, 2.14]}
            s={[0.44, 0.12, 0.04]}
            c={K.head}
            glow={0.6}
            r={[0, 0, 0.25 * side]}
          />
          <Box p={[0.8 * side, 0.78, -2.0]} s={[0.12, 0.32, 0.04]} c={K.tail} glow={0.5} />
        </group>
      ))}
      {/* Nose: slim grille, bumper with a navy lip, fog lamps, splitter; tail: bumper, plate, exhaust */}
      <Box p={[0, 0.66, 2.15]} s={[0.5, 0.08, 0.03]} c={K.trim} />
      <Box p={[0, 0.48, 2.17]} s={[1.72, 0.18, 0.16]} c={K.body} />
      <Box p={[0, 0.5, 2.25]} s={[0.9, 0.12, 0.02]} c={K.trim} />
      <Box p={[0, 0.37, 2.24]} s={[1.74, 0.05, 0.12]} c={K.navy} />
      {[-0.62, 0.62].map((x) => (
        <Lamp key={x} p={[x, 0.5, 2.27]} radius={0.06} c={K.head} glow={0.5} />
      ))}
      <Box p={[0, 0.46, -2.03]} s={[1.72, 0.16, 0.14]} c={K.navy} />
      <Box p={[0, 0.62, -2.01]} s={[0.46, 0.1, 0.02]} c={K.body} />
      <mesh position={[-0.5, 0.38, -2.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.18, 8]} />
        <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
