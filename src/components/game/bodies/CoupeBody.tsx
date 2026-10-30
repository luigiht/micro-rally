'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec } from '@/render/car/CarHull';
import { ArchLip, Box, Disc, Lamp } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

const K = {
  body: '#efe9dc',
  green: '#2f8f5b',
  white: '#ffffff',
  red: '#d9343a',
  trim: '#2b2a33',
  glass: '#3f5c76',
  head: '#fff6d0',
  rally: '#ffd76a',
  tail: '#d9343a',
  rim: '#d9d4c7',
} as const;

/** Low wide wedge: forward cabin with a narrow roof, wraparound glass, high haunches, dipping nose. */
const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.coupe),
  colors: { body: K.body, trim: K.trim, glass: K.glass, stripe: [K.green, K.white, K.red] },
  stripeBand: [0.16, 0.02],
  stations: [
    {
      z: -1.85,
      floor: 0.34,
      sill: 0.42,
      belt: 0.8,
      roof: 0.8,
      xSill: 0.78,
      xBody: 0.86,
      xRoof: 0.86,
    },
    {
      z: -1.55,
      floor: 0.3,
      sill: 0.4,
      belt: 0.84,
      roof: 0.84,
      xSill: 0.84,
      xBody: 0.9,
      xRoof: 0.9,
    },
    {
      z: -1.05,
      floor: 0.3,
      sill: 0.4,
      belt: 0.84,
      roof: 0.84,
      xSill: 0.84,
      xBody: 0.9,
      xRoof: 0.9,
    },
    {
      z: -0.8,
      floor: 0.3,
      sill: 0.4,
      belt: 0.82,
      roof: 0.82,
      xSill: 0.84,
      xBody: 0.9,
      xRoof: 0.9,
      glass: true,
    },
    {
      z: -0.56,
      floor: 0.3,
      sill: 0.4,
      belt: 0.82,
      roof: 1.1,
      xSill: 0.84,
      xBody: 0.9,
      xRoof: 0.54,
    },
    {
      z: -0.48,
      floor: 0.3,
      sill: 0.4,
      belt: 0.82,
      roof: 1.11,
      xSill: 0.84,
      xBody: 0.9,
      xRoof: 0.55,
      glass: true,
    },
    {
      z: 0.26,
      floor: 0.3,
      sill: 0.4,
      belt: 0.82,
      roof: 1.12,
      xSill: 0.84,
      xBody: 0.9,
      xRoof: 0.56,
    },
    {
      z: 0.34,
      floor: 0.3,
      sill: 0.4,
      belt: 0.82,
      roof: 1.1,
      xSill: 0.84,
      xBody: 0.9,
      xRoof: 0.56,
      glass: true,
    },
    { z: 0.65, floor: 0.3, sill: 0.4, belt: 0.78, roof: 0.78, xSill: 0.84, xBody: 0.9, xRoof: 0.9 },
    { z: 1.05, floor: 0.3, sill: 0.4, belt: 0.72, roof: 0.72, xSill: 0.84, xBody: 0.9, xRoof: 0.9 },
    {
      z: 1.5,
      floor: 0.3,
      sill: 0.38,
      belt: 0.62,
      roof: 0.62,
      xSill: 0.82,
      xBody: 0.88,
      xRoof: 0.88,
    },
    {
      z: 1.85,
      floor: 0.32,
      sill: 0.38,
      belt: 0.56,
      roof: 0.56,
      xSill: 0.78,
      xBody: 0.84,
      xRoof: 0.84,
    },
  ],
};

/** 1970s wedge coupé. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function CoupeBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  const flank = 0.9;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.78 * side, 0.9, 0.35]} s={[0.08, 0.03, 0.03]} c={K.trim} />
            <Box p={[0.86 * side, 0.92, 0.35]} s={[0.1, 0.09, 0.07]} c={K.body} />
          </group>
        ))}
      </group>
      {/* Engine-cover louvres, rear lip spoiler, roof lip */}
      {[-1.4, -1.25, -1.1, -0.95].map((z) => (
        <Box key={z} p={[0, 0.85, z]} s={[1.3, 0.015, 0.05]} c={K.trim} />
      ))}
      <Box p={[0, 0.9, -1.8]} s={[1.7, 0.05, 0.2]} c={K.body} r={[0.12, 0, 0]} shadow />
      <Box p={[0.6, 0.86, -1.78]} s={[0.05, 0.06, 0.14]} c={K.trim} />
      <Box p={[-0.6, 0.86, -1.78]} s={[0.05, 0.06, 0.14]} c={K.trim} />
      <Box p={[0, 1.14, -0.82]} s={[1.06, 0.04, 0.16]} c={K.trim} />
      {/* Tricolour roof bands (the flank bands come from the hull) */}
      {(
        [
          [-0.18, K.green],
          [0, K.white],
          [0.18, K.red],
        ] as const
      ).map(([x, c]) => (
        <Box key={x} p={[x, 1.126, -0.12]} s={[0.16, 0.016, 0.7]} c={c} />
      ))}
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Box p={[0.9 * side, 0.8, -0.62]} s={[0.06, 0.1, 0.3]} c={K.trim} />
          <ArchLip x={flank * side} z={front} radius={spec.wheelRadius} c={K.trim} />
          <ArchLip x={flank * side} z={rear} radius={spec.wheelRadius} c={K.trim} tube={0.055} />
          {/* Closed pop-up lamp lids, round tail lamps, exhausts */}
          <Box p={[0.5 * side, 0.68, 1.4]} s={[0.34, 0.025, 0.26]} c={K.trim} />
          <group position={[0.55 * side, 0.64, -1.87]} rotation={[0, Math.PI, 0]}>
            <Disc p={[0, 0, 0]} radius={0.09} depth={0.04} c={K.tail} />
          </group>
          <mesh position={[0.3 * side, 0.36, -1.9]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.16, 8]} />
            <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Nose: bumper, splitter, grille slot, four-lamp pod on the bonnet lip, headlight slots */}
      <Box p={[0, 0.4, 1.86]} s={[1.78, 0.12, 0.14]} c={K.trim} />
      <Box p={[0, 0.34, 1.93]} s={[1.8, 0.04, 0.1]} c={K.trim} />
      <Box p={[0, 0.5, 1.87]} s={[0.9, 0.05, 0.03]} c={K.trim} />
      <group position={[0, 0.6, 1.8]} rotation={[0.17, 0, 0]}>
        <Box p={[0, 0, 0]} s={[1.0, 0.1, 0.22]} c={K.trim} />
        {[-0.36, -0.12, 0.12, 0.36].map((x) => (
          <Lamp key={x} p={[x, 0.01, 0.16]} radius={0.095} c={K.rally} glow={0.5} />
        ))}
      </group>
      <Box p={[0.5, 0.6, 1.87]} s={[0.3, 0.07, 0.03]} c={K.head} glow={0.4} />
      <Box p={[-0.5, 0.6, 1.87]} s={[0.3, 0.07, 0.03]} c={K.head} glow={0.4} />
    </group>
  );
}
