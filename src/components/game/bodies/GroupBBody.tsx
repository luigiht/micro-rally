'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec } from '@/render/car/CarHull';
import { ArchLip, Box, Lamp } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

const K = {
  body: '#f1ece0',
  red: '#d9343a',
  blue: '#24407a',
  trim: '#2b2a33',
  glass: '#4d6f8c',
  head: '#fff6d0',
  tail: '#d9343a',
  rim: '#d9d4c7',
} as const;

/** Boxy hatch: tall flat bonnet, upright greenhouse with pillars, low rear deck behind the cabin, tall tail lip. */
const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.groupb),
  colors: { body: K.body, trim: K.trim, glass: K.glass, stripe: [K.red, K.blue], roof: K.red },
  stripeBand: [0.2, 0.08],
  stations: [
    {
      z: -2.0,
      floor: 0.36,
      sill: 0.44,
      belt: 0.95,
      roof: 0.95,
      xSill: 0.74,
      xBody: 0.84,
      xRoof: 0.84,
    },
    {
      z: -1.7,
      floor: 0.32,
      sill: 0.42,
      belt: 0.76,
      roof: 0.76,
      xSill: 0.78,
      xBody: 0.86,
      xRoof: 0.86,
    },
    {
      z: -1.3,
      floor: 0.32,
      sill: 0.42,
      belt: 0.94,
      roof: 0.94,
      xSill: 0.78,
      xBody: 0.86,
      xRoof: 0.86,
      glass: true,
    },
    {
      z: -1.05,
      floor: 0.32,
      sill: 0.42,
      belt: 0.94,
      roof: 1.36,
      xSill: 0.78,
      xBody: 0.86,
      xRoof: 0.6,
    },
    {
      z: -0.95,
      floor: 0.32,
      sill: 0.42,
      belt: 0.94,
      roof: 1.38,
      xSill: 0.78,
      xBody: 0.86,
      xRoof: 0.6,
      glass: true,
    },
    {
      z: -0.2,
      floor: 0.32,
      sill: 0.42,
      belt: 0.94,
      roof: 1.39,
      xSill: 0.78,
      xBody: 0.86,
      xRoof: 0.6,
    },
    {
      z: -0.12,
      floor: 0.32,
      sill: 0.42,
      belt: 0.94,
      roof: 1.39,
      xSill: 0.78,
      xBody: 0.86,
      xRoof: 0.6,
      glass: true,
    },
    {
      z: 0.55,
      floor: 0.32,
      sill: 0.42,
      belt: 0.94,
      roof: 1.36,
      xSill: 0.78,
      xBody: 0.86,
      xRoof: 0.58,
      glass: true,
    },
    {
      z: 0.95,
      floor: 0.32,
      sill: 0.42,
      belt: 0.92,
      roof: 0.92,
      xSill: 0.78,
      xBody: 0.86,
      xRoof: 0.86,
    },
    { z: 1.5, floor: 0.32, sill: 0.4, belt: 0.9, roof: 0.9, xSill: 0.78, xBody: 0.86, xRoof: 0.86 },
    {
      z: 2.0,
      floor: 0.34,
      sill: 0.4,
      belt: 0.82,
      roof: 0.82,
      xSill: 0.74,
      xBody: 0.82,
      xRoof: 0.82,
    },
  ],
};

/** Mid-engined Group B hatch. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function GroupBBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  const flank = 0.86;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.88 * side, 1.04, 0.7]} s={[0.08, 0.04, 0.04]} c={K.trim} />
            <Box p={[0.96 * side, 1.06, 0.7]} s={[0.12, 0.12, 0.08]} c={K.body} />
          </group>
        ))}
      </group>
      {/* Bonnet scoop and louvres, bonnet bands */}
      <Box p={[0, 0.95, 1.0]} s={[0.4, 0.08, 0.3]} c={K.body} />
      <Box p={[0, 0.96, 1.16]} s={[0.34, 0.05, 0.02]} c={K.trim} />
      {[1.25, 1.4, 1.55].map((z) => (
        <Box key={z} p={[0, 0.9 + (1.5 - z) * 0.0 + 0.012, z]} s={[1.0, 0.012, 0.05]} c={K.trim} />
      ))}
      <Box p={[-0.3, 0.911, 1.3]} s={[0.16, 0.012, 0.9]} c={K.red} />
      <Box p={[-0.52, 0.911, 1.3]} s={[0.1, 0.012, 0.9]} c={K.blue} />
      {/* Roof-mounted rear wing: raked struts, blade, end plates; low deck lip; tail spoiler */}
      <Box p={[0.5, 1.4, -1.22]} s={[0.05, 0.1, 0.5]} c={K.trim} r={[0.25, 0, 0]} />
      <Box p={[-0.5, 1.4, -1.22]} s={[0.05, 0.1, 0.5]} c={K.trim} r={[0.25, 0, 0]} />
      <Box p={[0, 1.48, -1.48]} s={[1.5, 0.05, 0.5]} c={K.body} r={[0.08, 0, 0]} shadow />
      <Box p={[0.75, 1.48, -1.48]} s={[0.04, 0.16, 0.5]} c={K.trim} />
      <Box p={[-0.75, 1.48, -1.48]} s={[0.04, 0.16, 0.5]} c={K.trim} />
      <Box p={[0, 1.0, -1.98]} s={[1.6, 0.05, 0.24]} c={K.body} r={[0.1, 0, 0]} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Box p={[0.87 * side, 0.86, -0.95]} s={[0.1, 0.2, 0.5]} c={K.trim} />
          <ArchLip x={flank * side} z={front} radius={spec.wheelRadius} c={K.body} tube={0.07} />
          <ArchLip x={flank * side} z={rear} radius={spec.wheelRadius} c={K.body} tube={0.07} />
          <Box p={[0.3 * side, 0.74, 2.01]} s={[0.24, 0.14, 0.04]} c={K.head} glow={0.6} />
          <Box p={[0.6 * side, 0.74, 2.01]} s={[0.24, 0.14, 0.04]} c={K.head} glow={0.6} />
          <Box p={[0.55 * side, 0.8, -2.01]} s={[0.4, 0.14, 0.04]} c={K.tail} glow={0.5} />
        </group>
      ))}
      {/* Nose grille, bumper, splitter, driving lamps; tail bumper, exhaust */}
      <Box p={[0, 0.56, 2.01]} s={[1.2, 0.12, 0.04]} c={K.trim} />
      <Box p={[0, 0.42, 2.03]} s={[1.7, 0.16, 0.14]} c={K.trim} />
      <Box p={[0, 0.35, 2.1]} s={[1.74, 0.04, 0.08]} c={K.trim} />
      {[-0.7, 0.7].map((x) => (
        <Lamp key={x} p={[x, 0.56, 2.05]} radius={0.06} c={K.head} glow={0.5} />
      ))}
      <Box p={[0, 0.42, -2.03]} s={[1.7, 0.16, 0.14]} c={K.trim} />
      <mesh position={[0.4, 0.38, -2.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.18, 8]} />
        <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
