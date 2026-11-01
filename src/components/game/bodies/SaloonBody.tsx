'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec } from '@/render/car/CarHull';
import { ArchLip, Box, Lamp, Roundel } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** World-rally blue over gold: gold flank pinstripe, gold bonnet pinstripes, gold wing plates and wheels. */
const K = {
  body: '#1b3fa6',
  gold: '#e9b949',
  trim: '#2b2a33',
  glass: '#4d6f8c',
  head: '#fff6d0',
  tail: '#d9343a',
  rim: '#d9d4c7',
} as const;

/** Half-width of the body between the arches, and over the blistered arches. */
const X_BODY = 0.85;
const X_FLARE = 0.92;

/**
 * Compact 1990s four-door rally saloon in the Impreza mould: low, wedge-shaped
 * bonnet rising to a scuttle, fast windscreen, low roof over a short cabin with
 * a B-pillar, fast C-pillar onto a short high boot that carries the wing. The
 * hull swells to the flare width over each axle (blistered arches) and runs
 * body-width between them. Stations are listed tail to nose.
 */
const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.saloon),
  colors: { body: K.body, trim: K.trim, glass: K.glass, stripe: K.gold },
  // Gold pinstripes down the bonnet edges, and the dark mouth of the scoop at the scuttle.
  deck: [
    { x0: 0.54, x1: 0.6, z0: 1.0, z1: 2.05, color: K.gold, mirror: true },
    { x0: -0.22, x1: 0.22, z0: 1.62, z1: 1.69, color: K.trim },
  ],
  stations: [
    {
      z: -2.17,
      floor: 0.38,
      sill: 0.44,
      belt: 0.92,
      roof: 0.92,
      xSill: 0.78,
      xBody: 0.84,
      xRoof: 0.84,
    },
    {
      z: -1.95,
      floor: 0.34,
      sill: 0.43,
      belt: 0.95,
      roof: 0.95,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: X_BODY,
    },
    {
      z: -1.65,
      floor: 0.34,
      sill: 0.43,
      belt: 0.95,
      roof: 0.95,
      xSill: 0.84,
      xBody: X_FLARE,
      xRoof: X_FLARE,
    },
    {
      z: -1.45,
      floor: 0.34,
      sill: 0.43,
      belt: 0.93,
      roof: 0.93,
      xSill: 0.84,
      xBody: X_FLARE,
      xRoof: X_FLARE,
      glass: true,
    },
    {
      z: -0.95,
      floor: 0.34,
      sill: 0.43,
      belt: 0.9,
      roof: 1.3,
      xSill: 0.84,
      xBody: X_FLARE,
      xRoof: 0.62,
      glass: true,
    },
    {
      z: -0.85,
      floor: 0.34,
      sill: 0.43,
      belt: 0.9,
      roof: 1.31,
      xSill: 0.84,
      xBody: X_FLARE,
      xRoof: 0.62,
      glass: true,
    },
    {
      z: -0.72,
      floor: 0.34,
      sill: 0.43,
      belt: 0.9,
      roof: 1.32,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.63,
      glass: true,
    },
    {
      z: -0.3,
      floor: 0.34,
      sill: 0.43,
      belt: 0.9,
      roof: 1.34,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.64,
    },
    {
      z: -0.22,
      floor: 0.34,
      sill: 0.43,
      belt: 0.9,
      roof: 1.34,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.64,
      glass: true,
    },
    {
      z: 0.35,
      floor: 0.34,
      sill: 0.43,
      belt: 0.9,
      roof: 1.33,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.64,
      glass: true,
    },
    {
      z: 0.95,
      floor: 0.34,
      sill: 0.43,
      belt: 0.92,
      roof: 0.92,
      xSill: 0.84,
      xBody: X_FLARE,
      xRoof: X_FLARE,
    },
    {
      z: 1.7,
      floor: 0.34,
      sill: 0.42,
      belt: 0.8,
      roof: 0.8,
      xSill: 0.84,
      xBody: X_FLARE,
      xRoof: X_FLARE,
    },
    {
      z: 1.95,
      floor: 0.34,
      sill: 0.42,
      belt: 0.76,
      roof: 0.76,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: X_BODY,
    },
    {
      z: 2.17,
      floor: 0.36,
      sill: 0.42,
      belt: 0.7,
      roof: 0.7,
      xSill: 0.76,
      xBody: 0.8,
      xRoof: 0.8,
    },
  ],
};

/** Turbocharged all-wheel-drive saloon. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function SaloonBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.9 * side, 1.0, 0.32]} s={[0.1, 0.04, 0.04]} c={K.trim} />
            <Box p={[0.99 * side, 1.02, 0.32]} s={[0.14, 0.11, 0.09]} c={K.body} />
          </group>
        ))}
      </group>
      {/* Bonnet scoop laid along the bonnet slope with a dark mouth, roof vent, antenna */}
      <Box p={[0, 0.9, 1.42]} s={[0.5, 0.12, 0.56]} c={K.body} r={[0.16, 0, 0]} shadow />
      <Box p={[0, 0.89, 1.7]} s={[0.42, 0.08, 0.03]} c={K.trim} r={[0.16, 0, 0]} />
      <Box p={[0, 1.36, -0.05]} s={[0.3, 0.06, 0.26]} c={K.body} />
      <Box p={[-0.45, 1.44, -0.9]} s={[0.02, 0.26, 0.02]} c={K.trim} r={[-0.3, 0, 0]} />
      {/* Tall rear wing on uprights with gold end plates, standing on the high boot deck */}
      <Box p={[0.55, 1.08, -1.95]} s={[0.05, 0.44, 0.22]} c={K.trim} />
      <Box p={[-0.55, 1.08, -1.95]} s={[0.05, 0.44, 0.22]} c={K.trim} />
      <Box p={[0, 1.3, -1.98]} s={[1.56, 0.05, 0.36]} c={K.body} r={[-0.1, 0, 0]} shadow />
      <Box p={[0.78, 1.3, -1.98]} s={[0.03, 0.2, 0.44]} c={K.gold} />
      <Box p={[-0.78, 1.3, -1.98]} s={[0.03, 0.2, 0.44]} c={K.gold} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <ArchLip x={X_FLARE * side} z={front} radius={spec.wheelRadius} c={K.trim} />
          <ArchLip x={X_FLARE * side} z={rear} radius={spec.wheelRadius} c={K.trim} />
          <Roundel side={side} y={0.66} z={0.1} />
          <Box p={[0.55 * side, 0.62, 2.17]} s={[0.44, 0.12, 0.04]} c={K.head} glow={0.6} />
          <Box p={[0.6 * side, 0.74, -2.17]} s={[0.38, 0.14, 0.04]} c={K.tail} glow={0.5} />
        </group>
      ))}
      {/* Nose: wide grille, body-colour bumper with two round fogs, splitter; tail: bumper, exhaust */}
      <Box p={[0, 0.62, 2.17]} s={[0.5, 0.1, 0.03]} c={K.trim} />
      <Box p={[0, 0.48, 2.19]} s={[1.72, 0.2, 0.2]} c={K.body} />
      <Box p={[0, 0.38, 2.27]} s={[1.76, 0.04, 0.12]} c={K.trim} />
      {[-0.5, 0.5].map((x) => (
        <Lamp key={x} p={[x, 0.5, 2.31]} radius={0.1} c={K.head} glow={0.5} />
      ))}
      <Box p={[0, 0.48, -2.19]} s={[1.72, 0.2, 0.18]} c={K.body} />
      <mesh position={[0.55, 0.38, -2.26]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.18, 8]} />
        <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
