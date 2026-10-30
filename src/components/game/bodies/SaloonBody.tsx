'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec } from '@/render/car/CarHull';
import { ArchLip, Box, Lamp, Roundel } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

const K = {
  body: '#1f3fae',
  gold: '#e9b949',
  trim: '#2b2a33',
  glass: '#4d6f8c',
  head: '#fff6d0',
  tail: '#d9343a',
  rim: '#d9d4c7',
} as const;

/** Long saloon: four-door greenhouse with B-pillar, boot deck, gentle bonnet slope. */
const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.saloon),
  colors: { body: K.body, trim: K.trim, glass: K.glass, stripe: K.gold },
  stations: [
    {
      z: -2.15,
      floor: 0.38,
      sill: 0.46,
      belt: 0.86,
      roof: 0.86,
      xSill: 0.8,
      xBody: 0.92,
      xRoof: 0.92,
    },
    {
      z: -1.75,
      floor: 0.34,
      sill: 0.44,
      belt: 0.92,
      roof: 0.92,
      xSill: 0.86,
      xBody: 0.95,
      xRoof: 0.95,
    },
    {
      z: -1.35,
      floor: 0.34,
      sill: 0.44,
      belt: 0.92,
      roof: 0.92,
      xSill: 0.86,
      xBody: 0.95,
      xRoof: 0.95,
      glass: true,
    },
    {
      z: -0.95,
      floor: 0.34,
      sill: 0.44,
      belt: 0.92,
      roof: 1.28,
      xSill: 0.86,
      xBody: 0.95,
      xRoof: 0.66,
      glass: true,
    },
    {
      z: -0.2,
      floor: 0.34,
      sill: 0.44,
      belt: 0.92,
      roof: 1.33,
      xSill: 0.86,
      xBody: 0.95,
      xRoof: 0.68,
    },
    {
      z: -0.12,
      floor: 0.34,
      sill: 0.44,
      belt: 0.92,
      roof: 1.33,
      xSill: 0.86,
      xBody: 0.95,
      xRoof: 0.68,
      glass: true,
    },
    {
      z: 0.55,
      floor: 0.34,
      sill: 0.44,
      belt: 0.92,
      roof: 1.3,
      xSill: 0.86,
      xBody: 0.95,
      xRoof: 0.66,
      glass: true,
    },
    {
      z: 1.0,
      floor: 0.34,
      sill: 0.44,
      belt: 0.9,
      roof: 0.9,
      xSill: 0.86,
      xBody: 0.95,
      xRoof: 0.95,
    },
    {
      z: 1.6,
      floor: 0.34,
      sill: 0.42,
      belt: 0.82,
      roof: 0.82,
      xSill: 0.86,
      xBody: 0.94,
      xRoof: 0.94,
    },
    { z: 2.15, floor: 0.36, sill: 0.42, belt: 0.7, roof: 0.7, xSill: 0.82, xBody: 0.9, xRoof: 0.9 },
  ],
};

/** Turbocharged all-wheel-drive saloon. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function SaloonBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  const flank = 0.95;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.96 * side, 1.02, 0.75]} s={[0.08, 0.04, 0.04]} c={K.trim} />
            <Box p={[1.04 * side, 1.04, 0.75]} s={[0.12, 0.12, 0.08]} c={K.body} />
          </group>
        ))}
      </group>
      {/* Bonnet scoop, rear wing on uprights with end plates, antenna */}
      <Box p={[0, 0.9, 1.15]} s={[0.5, 0.08, 0.4]} c={K.body} />
      <Box p={[0, 0.91, 1.36]} s={[0.42, 0.06, 0.02]} c={K.trim} />
      <Box p={[0.55, 1.08, -1.95]} s={[0.06, 0.32, 0.2]} c={K.trim} />
      <Box p={[-0.55, 1.08, -1.95]} s={[0.06, 0.32, 0.2]} c={K.trim} />
      <Box p={[0, 1.28, -1.95]} s={[1.6, 0.06, 0.4]} c={K.body} r={[-0.08, 0, 0]} shadow />
      <Box p={[0.8, 1.28, -1.95]} s={[0.04, 0.16, 0.44]} c={K.gold} />
      <Box p={[-0.8, 1.28, -1.95]} s={[0.04, 0.16, 0.44]} c={K.gold} />
      <Box p={[-0.45, 1.42, -0.9]} s={[0.02, 0.26, 0.02]} c={K.trim} r={[-0.3, 0, 0]} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <ArchLip x={flank * side} z={front} radius={spec.wheelRadius} c={K.trim} />
          <ArchLip x={flank * side} z={rear} radius={spec.wheelRadius} c={K.trim} />
          <Roundel side={side} y={0.66} z={0.25} />
          <Box p={[0.55 * side, 0.74, 2.16]} s={[0.42, 0.14, 0.04]} c={K.head} glow={0.6} />
          <Box p={[0.6 * side, 0.78, -2.16]} s={[0.34, 0.14, 0.04]} c={K.tail} glow={0.5} />
        </group>
      ))}
      {/* Nose: grille, bumper with four fog lamps, splitter; tail: bumper, exhaust */}
      <Box p={[0, 0.74, 2.16]} s={[0.6, 0.1, 0.03]} c={K.trim} />
      <Box p={[0, 0.46, 2.18]} s={[1.86, 0.18, 0.18]} c={K.trim} />
      <Box p={[0, 0.37, 2.26]} s={[1.86, 0.04, 0.1]} c={K.trim} />
      {[-0.6, -0.25, 0.25, 0.6].map((x) => (
        <Lamp key={x} p={[x, 0.52, 2.31]} radius={0.07} c={K.head} glow={0.5} />
      ))}
      <Box p={[0, 0.46, -2.18]} s={[1.86, 0.18, 0.18]} c={K.trim} />
      <mesh position={[0.55, 0.38, -2.26]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.18, 8]} />
        <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
