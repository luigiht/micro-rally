'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec } from '@/render/car/CarHull';
import { Box, Lamp } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** White shell with a red-over-yellow flank band and yellow pinstripes on bonnet, flares, sills and wings. */
const K = {
  body: '#f4f1ea',
  red: '#d7262c',
  yellow: '#f2c230',
  trim: '#2b2a33',
  glass: '#4d6f8c',
  head: '#fff6d0',
  tail: '#d9343a',
  rim: '#d9d4c7',
} as const;

/** Half-width of the body between the arches, and of the box flares over them. */
const X_BODY = 0.88;
const X_FLARE = 0.97;

/**
 * Short-wheelbase coupé on box flares: the hull steps out to the flare
 * width over each axle and runs wide to the bumpers, so the arches read as
 * slabs rather than lips. Long flat bonnet, upright greenhouse with a
 * quarter window, steep rear glass onto a tall boot that carries the wing.
 * The flank band is six equal sub-bands: a yellow pinstripe just under the
 * belt crease, white, a double red and a double yellow, so the stripes ride
 * the flares and the belt line exactly.
 */
const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.s1),
  colors: {
    body: K.body,
    trim: K.trim,
    glass: K.glass,
    stripe: [K.yellow, K.body, K.red, K.red, K.yellow, K.yellow],
  },
  stripeBand: [0.32, 0.02],
  // Bonnet: twin yellow stripes with a red centre line, louvres between them.
  deck: [
    { x0: 0.33, x1: 0.47, z0: 1.0, z1: 1.95, color: K.yellow, mirror: true },
    { x0: -0.025, x1: 0.025, z0: 1.0, z1: 1.95, color: K.red },
    { x0: -0.25, x1: 0.25, z0: 1.17, z1: 1.23, color: K.trim },
    { x0: -0.25, x1: 0.25, z0: 1.32, z1: 1.38, color: K.trim },
    { x0: -0.25, x1: 0.25, z0: 1.47, z1: 1.53, color: K.trim },
    { x0: -0.25, x1: 0.25, z0: 1.62, z1: 1.68, color: K.trim },
  ],
  stations: [
    {
      z: -2.1,
      floor: 0.38,
      sill: 0.46,
      belt: 0.86,
      roof: 0.86,
      xSill: 0.86,
      xBody: X_FLARE - 0.02,
      xRoof: X_FLARE - 0.02,
    },
    {
      z: -1.6,
      floor: 0.32,
      sill: 0.44,
      belt: 0.9,
      roof: 0.9,
      xSill: 0.88,
      xBody: X_FLARE,
      xRoof: X_FLARE,
      glass: true,
    },
    {
      z: -1.0,
      floor: 0.32,
      sill: 0.44,
      belt: 0.9,
      roof: 1.33,
      xSill: 0.88,
      xBody: X_FLARE,
      xRoof: 0.62,
      glass: true,
    },
    {
      z: -0.65,
      floor: 0.32,
      sill: 0.44,
      belt: 0.9,
      roof: 1.34,
      xSill: 0.88,
      xBody: X_FLARE,
      xRoof: 0.63,
      glass: true,
    },
    {
      z: -0.6,
      floor: 0.32,
      sill: 0.44,
      belt: 0.9,
      roof: 1.34,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.63,
      glass: true,
    },
    {
      z: -0.35,
      floor: 0.32,
      sill: 0.44,
      belt: 0.9,
      roof: 1.34,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.63,
    },
    {
      z: -0.27,
      floor: 0.32,
      sill: 0.44,
      belt: 0.9,
      roof: 1.34,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.63,
      glass: true,
    },
    {
      z: 0.45,
      floor: 0.32,
      sill: 0.44,
      belt: 0.89,
      roof: 1.31,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.6,
      glass: true,
    },
    {
      z: 0.95,
      floor: 0.32,
      sill: 0.44,
      belt: 0.87,
      roof: 0.87,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: X_BODY,
    },
    {
      z: 1.0,
      floor: 0.32,
      sill: 0.44,
      belt: 0.87,
      roof: 0.87,
      xSill: 0.88,
      xBody: X_FLARE,
      xRoof: X_FLARE,
    },
    {
      z: 1.55,
      floor: 0.32,
      sill: 0.42,
      belt: 0.8,
      roof: 0.8,
      xSill: 0.88,
      xBody: X_FLARE,
      xRoof: X_FLARE,
    },
    {
      z: 2.05,
      floor: 0.36,
      sill: 0.42,
      belt: 0.66,
      roof: 0.66,
      xSill: 0.86,
      xBody: X_FLARE - 0.01,
      xRoof: X_FLARE - 0.01,
    },
  ],
};

/** Short-wheelbase Group B coupé. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function S1CoupeBody({ cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.9 * side, 1.0, 0.3]} s={[0.08, 0.04, 0.04]} c={K.trim} />
            <Box p={[0.98 * side, 1.02, 0.3]} s={[0.12, 0.12, 0.08]} c={K.body} />
          </group>
        ))}
      </group>
      {/* Scuttle vent */}
      <Box p={[0, 0.88, 0.75]} s={[0.6, 0.06, 0.3]} c={K.body} />
      <Box p={[0, 0.89, 0.9]} s={[0.5, 0.04, 0.02]} c={K.trim} />
      {/* Flank: yellow-edged black sill blade; door numeral; intake on the rear flare */}
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Box p={[0.92 * side, 0.4, 0.2]} s={[0.08, 0.1, 1.5]} c={K.trim} />
          <Box p={[0.92 * side, 0.456, 0.2]} s={[0.08, 0.012, 1.5]} c={K.yellow} />
          <Box p={[(X_BODY + 0.006) * side, 0.72, 0.05]} s={[0.012, 0.3, 0.3]} c={K.body} />
          <Box p={[(X_BODY + 0.012) * side, 0.72, 0.05]} s={[0.012, 0.22, 0.05]} c={K.trim} />
          <Box p={[(X_FLARE + 0.005) * side, 0.74, -0.8]} s={[0.01, 0.16, 0.24]} c={K.trim} />
          {/* Twin rectangular lamps in the grille, tall tail lamps */}
          <Box p={[0.3 * side, 0.6, 2.06]} s={[0.26, 0.12, 0.04]} c={K.head} glow={0.6} />
          <Box p={[0.62 * side, 0.6, 2.06]} s={[0.26, 0.12, 0.04]} c={K.head} glow={0.6} />
          <Box p={[0.7 * side, 0.74, -2.11]} s={[0.36, 0.16, 0.04]} c={K.tail} glow={0.5} />
        </group>
      ))}
      {/* Nose: grille bar, deep air dam with a white splitter wing on the sides, driving lamps */}
      <Box p={[0, 0.6, 2.06]} s={[0.26, 0.12, 0.04]} c={K.trim} />
      <Box p={[0, 0.42, 2.12]} s={[1.9, 0.2, 0.28]} c={K.trim} />
      <Box p={[0, 0.34, 2.3]} s={[2.0, 0.04, 0.3]} c={K.body} />
      <Box p={[0, 0.366, 2.36]} s={[2.0, 0.012, 0.1]} c={K.yellow} />
      <Box p={[0.98, 0.42, 2.3]} s={[0.04, 0.2, 0.3]} c={K.body} />
      <Box p={[-0.98, 0.42, 2.3]} s={[0.04, 0.2, 0.3]} c={K.body} />
      {[-0.55, -0.2, 0.2, 0.55].map((x) => (
        <Lamp key={x} p={[x, 0.5, 2.27]} radius={0.065} c={K.head} glow={0.5} />
      ))}
      {/* Tail: shelf wing on two blades with end plates, rear bumper, twin exhausts */}
      <Box p={[0.6, 1.02, -1.95]} s={[0.05, 0.3, 0.3]} c={K.trim} r={[0.15, 0, 0]} />
      <Box p={[-0.6, 1.02, -1.95]} s={[0.05, 0.3, 0.3]} c={K.trim} r={[0.15, 0, 0]} />
      <Box p={[0, 1.2, -2.0]} s={[1.9, 0.05, 0.5]} c={K.body} r={[-0.1, 0, 0]} shadow />
      <Box p={[0, 1.252, -1.78]} s={[1.9, 0.012, 0.1]} c={K.yellow} r={[-0.1, 0, 0]} />
      <Box p={[0.95, 1.22, -2.0]} s={[0.04, 0.2, 0.52]} c={K.yellow} />
      <Box p={[-0.95, 1.22, -2.0]} s={[0.04, 0.2, 0.52]} c={K.yellow} />
      <Box p={[0, 1.16, -2.26]} s={[1.9, 0.03, 0.04]} c={K.red} />
      <Box p={[0, 0.62, -2.106]} s={[1.0, 0.07, 0.012]} c={K.red} />
      <Box p={[0, 0.555, -2.106]} s={[1.0, 0.05, 0.012]} c={K.yellow} />
      <Box p={[0, 0.42, -2.14]} s={[1.9, 0.18, 0.16]} c={K.trim} />
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.36, -2.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.18, 8]} />
          <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
