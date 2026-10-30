'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec } from '@/render/car/CarHull';
import { ArchLip, Box, CAR_COLORS as C, Lamp, Roundel } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** Lofted shell: orange paint, cream roof and belt stripe, glass greenhouse with B-pillar. */
const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.hatchback),
  colors: { body: C.paint, trim: C.trim, glass: C.glass, stripe: C.livery, roof: C.livery },
  stations: [
    {
      z: -1.85,
      floor: 0.36,
      sill: 0.46,
      belt: 0.9,
      roof: 0.9,
      xSill: 0.76,
      xBody: 0.86,
      xRoof: 0.86,
    },
    {
      z: -1.5,
      floor: 0.32,
      sill: 0.44,
      belt: 0.93,
      roof: 0.93,
      xSill: 0.8,
      xBody: 0.86,
      xRoof: 0.86,
      glass: true,
    },
    {
      z: -1.15,
      floor: 0.32,
      sill: 0.44,
      belt: 0.93,
      roof: 1.42,
      xSill: 0.8,
      xBody: 0.86,
      xRoof: 0.68,
      glass: true,
    },
    {
      z: -0.4,
      floor: 0.32,
      sill: 0.44,
      belt: 0.93,
      roof: 1.46,
      xSill: 0.8,
      xBody: 0.86,
      xRoof: 0.7,
    },
    {
      z: -0.32,
      floor: 0.32,
      sill: 0.44,
      belt: 0.93,
      roof: 1.46,
      xSill: 0.8,
      xBody: 0.86,
      xRoof: 0.7,
      glass: true,
    },
    {
      z: 0.45,
      floor: 0.32,
      sill: 0.44,
      belt: 0.92,
      roof: 1.42,
      xSill: 0.8,
      xBody: 0.86,
      xRoof: 0.68,
      glass: true,
    },
    {
      z: 0.85,
      floor: 0.32,
      sill: 0.44,
      belt: 0.9,
      roof: 0.9,
      xSill: 0.8,
      xBody: 0.86,
      xRoof: 0.86,
    },
    {
      z: 1.4,
      floor: 0.32,
      sill: 0.42,
      belt: 0.82,
      roof: 0.82,
      xSill: 0.8,
      xBody: 0.86,
      xRoof: 0.86,
    },
    {
      z: 1.85,
      floor: 0.34,
      sill: 0.42,
      belt: 0.72,
      roof: 0.72,
      xSill: 0.76,
      xBody: 0.84,
      xRoof: 0.84,
    },
  ],
};

/** The starter hatchback. Coordinates are in the root frame (ground at 0). `cabinRef` holds the mirrors. */
export function HatchbackBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  const flank = 0.86;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      {/* Mirrors: hidden from the driver's seat */}
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.9 * side, 1.02, 0.55]} s={[0.08, 0.04, 0.04]} c={C.trim} />
            <Box p={[0.98 * side, 1.04, 0.55]} s={[0.12, 0.12, 0.08]} c={C.paint} />
          </group>
        ))}
      </group>
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <ArchLip x={flank * side} z={front} radius={spec.wheelRadius} c={C.trim} />
          <ArchLip x={flank * side} z={rear} radius={spec.wheelRadius} c={C.trim} />
          <Roundel side={side} y={0.68} z={0.05} />
          {/* Headlight, tail light */}
          <Box p={[0.5 * side, 0.6, 1.86]} s={[0.3, 0.14, 0.04]} c={C.head} glow={0.6} />
          <Box p={[0.55 * side, 0.74, -1.86]} s={[0.3, 0.14, 0.04]} c={C.tail} glow={0.5} />
        </group>
      ))}
      {/* Nose: grille, bumper, plate, rally light pod */}
      <Box p={[0, 0.6, 1.86]} s={[0.6, 0.12, 0.04]} c={C.trim} />
      <Box p={[0, 0.42, 1.9]} s={[1.72, 0.16, 0.2]} c={C.trim} />
      <Box p={[0, 0.42, 2.01]} s={[0.46, 0.1, 0.02]} c={C.livery} />
      <Box p={[0, 0.8, 1.6]} s={[1.2, 0.05, 0.06]} c={C.trim} />
      {[-0.45, -0.15, 0.15, 0.45].map((x) => (
        <Lamp key={x} p={[x, 0.82, 1.66]} radius={0.1} c={C.rally} glow={0.5} />
      ))}
      {/* Tail: bumper, plate, exhaust, roof spoiler, antenna */}
      <Box p={[0, 0.42, -1.9]} s={[1.72, 0.16, 0.2]} c={C.trim} />
      <Box p={[0, 0.58, -1.87]} s={[0.46, 0.1, 0.02]} c={C.livery} />
      <mesh position={[0.5, 0.36, -1.98]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.2, 8]} />
        <meshStandardMaterial color={C.rim} metalness={0.5} roughness={0.4} />
      </mesh>
      <Box p={[0, 1.46, -1.2]} s={[1.3, 0.05, 0.3]} c={C.paint} r={[-0.12, 0, 0]} shadow />
      <Box p={[0.45, 1.42, -1.14]} s={[0.05, 0.06, 0.1]} c={C.trim} />
      <Box p={[-0.45, 1.42, -1.14]} s={[0.05, 0.06, 0.1]} c={C.trim} />
      <Box p={[-0.5, 1.58, -0.95]} s={[0.02, 0.3, 0.02]} c={C.trim} r={[-0.3, 0, 0]} />
    </group>
  );
}
