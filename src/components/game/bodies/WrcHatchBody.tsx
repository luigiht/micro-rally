'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec } from '@/render/car/CarHull';
import { WRC_STATIONS } from '@/render/car/HullShapes';
import { RIVIERA_LIVERY } from '@/render/car/RivieraLivery';
import { ArchLip, Box, Lamp, Prism } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** White shell under the livery (`RivieraLivery`), black trim and glass. */
const K = {
  body: '#f4f1ea',
  trim: '#2b2a33',
  grey: '#8a8d96',
  glass: '#3f5b73',
  head: '#fff6d0',
  tail: '#d9343a',
  amber: '#f0931f',
  rim: '#d9d4c7',
} as const;

/**
 * The hull (`WRC_STATIONS`: a boxy late-80s Group A five-door after
 * `context/lancia-delta-integrale`), white under its livery: our own shapes
 * (`RivieraLivery`) painted onto every white face by `paintLivery`. The
 * bonnet's louvres and the scuttle grille are the hull's own trim.
 */
const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.wrc),
  colors: { body: K.body, trim: K.trim, glass: K.glass },
  deck: [
    // Bonnet louvres either side of its middle, toward the nose.
    ...[0, 1, 2, 3].map((k) => ({
      x0: 0.2,
      x1: 0.5,
      z0: 1.48 + 0.09 * k,
      z1: 1.53 + 0.09 * k,
      color: K.trim,
      mirror: true,
    })),
    // Scuttle grille under the screen.
    { x0: -0.6, x1: 0.6, z0: 0.64, z1: 0.7, color: K.trim },
  ],
  stations: WRC_STATIONS,
};

const FLARE = 0.95;
const ROOF_R = 1.43;
/** The nose's face, the tail's face. */
const NOSE = 2.0;
const TAIL = -1.97;

/** The roof spoiler's side plates: from the roof's end back over the rear screen, rising to the blade. */
const SPOILER_PLATE: readonly (readonly [number, number])[] = [
  [-1.46, ROOF_R - 0.02],
  [-1.84, ROOF_R - 0.04],
  [-1.84, ROOF_R + 0.12],
  [-1.46, ROOF_R + 0.05],
];

/** Boxy Group A five-door. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function WrcHatchBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} livery={RIVIERA_LIVERY} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            {/* Door mirrors on short stalks at the screen's foot */}
            <Box p={[0.87 * side, 1.1, 0.5]} s={[0.14, 0.03, 0.05]} c={K.trim} />
            <Box p={[0.98 * side, 1.12, 0.5]} s={[0.12, 0.1, 0.07]} c={K.body} />
          </group>
        ))}
      </group>
      {/* Roof spoiler over the rear screen, its side plates, two antennas, a vent at the screen's top */}
      <Box
        p={[0, ROOF_R + 0.08, -1.68]}
        s={[1.42, 0.035, 0.36]}
        c={K.body}
        r={[0.14, 0, 0]}
        shadow
      />
      {([1, -1] as const).map((side) => (
        <Prism key={side} x={0.71 * side} points={SPOILER_PLATE} thickness={0.03} c={K.body} />
      ))}
      <Box p={[0.32, ROOF_R + 0.17, -1.22]} s={[0.015, 0.34, 0.015]} c={K.trim} r={[-0.25, 0, 0]} />
      <Box
        p={[-0.32, ROOF_R + 0.17, -1.22]}
        s={[0.015, 0.34, 0.015]}
        c={K.trim}
        r={[-0.25, 0, 0]}
      />
      <Box p={[0, 1.465, -0.05]} s={[0.34, 0.03, 0.16]} c={K.trim} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          {/* Box flares' lips over both axles */}
          <ArchLip x={FLARE * side} z={front} radius={spec.wheelRadius} c={K.body} tube={0.05} />
          <ArchLip x={FLARE * side} z={rear} radius={spec.wheelRadius} c={K.body} tube={0.05} />
          {/* Door handles */}
          <Box p={[0.876 * side, 0.97, 0.18]} s={[0.012, 0.03, 0.1]} c={K.trim} />
          <Box p={[0.876 * side, 0.97, -0.6]} s={[0.012, 0.03, 0.1]} c={K.trim} />
          {/* Twin round headlamps each side in the black band, amber indicators in the bumper's corners */}
          <Lamp p={[0.68 * side, 0.79, NOSE + 0.02]} radius={0.075} c={K.head} glow={0.6} />
          <Lamp p={[0.49 * side, 0.79, NOSE + 0.02]} radius={0.075} c={K.head} glow={0.6} />
          <Box p={[0.85 * side, 0.63, NOSE + 0.09]} s={[0.12, 0.05, 0.02]} c={K.amber} glow={0.3} />
          {/* Side intakes either side of the bumper's mesh */}
          <Box p={[0.74 * side, 0.54, NOSE + 0.095]} s={[0.18, 0.08, 0.02]} c={K.trim} />
          {/* Tall tail lamps at the tailgate's corners, red over amber */}
          <Box p={[0.68 * side, 0.88, TAIL - 0.01]} s={[0.24, 0.14, 0.03]} c={K.tail} glow={0.5} />
          <Box p={[0.68 * side, 0.78, TAIL - 0.01]} s={[0.24, 0.06, 0.03]} c={K.amber} glow={0.3} />
        </group>
      ))}
      {/* Nose: the black band across the face with the grille's bars between the lamps */}
      <Box p={[0, 0.79, NOSE + 0.005]} s={[1.66, 0.18, 0.02]} c={K.trim} />
      <Box p={[0, 0.82, NOSE + 0.02]} s={[0.66, 0.015, 0.01]} c={K.grey} />
      <Box p={[0, 0.76, NOSE + 0.02]} s={[0.66, 0.015, 0.01]} c={K.grey} />
      {/* Four big rally lamps on a pod across the nose */}
      <Box p={[0, 0.97, NOSE - 0.02]} s={[1.0, 0.05, 0.1]} c={K.trim} />
      {[-0.39, -0.13, 0.13, 0.39].map((x) => (
        <Lamp key={x} p={[x, 1.01, NOSE + 0.03]} radius={0.095} c={K.head} glow={0.6} />
      ))}
      {/* Deep white bumper: a black mesh intake split by three bars, a black splitter */}
      <Box p={[0, 0.56, NOSE + 0.03]} s={[1.88, 0.24, 0.12]} c={K.body} />
      <Box p={[0, 0.54, NOSE + 0.095]} s={[1.08, 0.14, 0.02]} c={K.trim} />
      {[-0.27, 0, 0.27].map((x) => (
        <Box key={x} p={[x, 0.54, NOSE + 0.1]} s={[0.04, 0.14, 0.02]} c={K.body} />
      ))}
      <Box p={[0, 0.42, NOSE + 0.06]} s={[1.9, 0.04, 0.2]} c={K.trim} />
      {/* Tail: the white bumper with a black lip, the exhaust on the left */}
      <Box p={[0, 0.52, TAIL - 0.04]} s={[1.86, 0.18, 0.12]} c={K.body} />
      <Box p={[0, 0.42, TAIL - 0.04]} s={[1.86, 0.04, 0.13]} c={K.trim} />
      <mesh position={[-0.55, 0.4, TAIL - 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.16, 8]} />
        <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
