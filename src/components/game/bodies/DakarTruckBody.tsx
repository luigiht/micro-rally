'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec } from '@/render/car/CarHull';
import { ArchLip, Box, Disc, Lamp, Tube } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** Repsol-style livery: navy cab under an orange roof and works, orange / white / red / navy box. */
const K = {
  orange: '#f0741f',
  navy: '#1c2a63',
  white: '#f4f1ea',
  red: '#d7262c',
  green: '#2a9d4a',
  yellow: '#f2d43a',
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
const NOSE = 2.75;
const TAIL = -3.15;
/** Windscreen plane: from the belt at the nose back to the roof. */
const SCREEN_SLOPE = (NOSE - 2.45) / (CAB_ROOF - BELT);
const screenZ = (y: number) => NOSE - (y - BELT) * SCREEN_SLOPE;
const SIDES = [1, -1] as const;

/**
 * Cab-over cab: a tall box with a steep windscreen falling from the roof to
 * the belt at the nose and side glass along its length. Navy from the floor
 * to the belt (the band wraps the nose as the grille surround), orange above.
 */
const CAB: HullSpec = {
  wells: wellsFor(CAR_SPECS.dakar),
  colors: { body: K.orange, trim: K.trim, glass: K.glass, stripe: K.navy },
  stripeBand: [1.0, 0.0],
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
      z: NOSE,
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

/** Cargo box behind the cab: orange top, white band, red rule, navy skirt, running over the rear arch. */
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
      z: TAIL,
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

/** Sponsor plate on a flank: a pale rectangle with a coloured rule, [y, z, height, length, rule colour]. */
const PLATES: readonly (readonly [number, number, number, number, string])[] = [
  [2.72, -1.2, 0.4, 0.9, K.green],
  [2.62, -2.5, 0.34, 0.5, K.red],
  [2.62, 0.1, 0.34, 0.6, K.navy],
  [1.2, -2.9, 0.3, 0.44, K.yellow],
  [1.2, -0.6, 0.3, 0.7, K.red],
];
/** Letter blocks of the big red REPSOL on the white band, z centres. */
const LETTERS = [-2.6, -2.24, -1.88, -1.52, -1.16, -0.8] as const;

/** Rally-raid truck. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function DakarTruckBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  const flank = X_BODY + 0.012;
  const stripZ = screenZ(2.88) + 0.03;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={CAB} />
      <CarHullMesh spec={BOX} />
      {/* Chassis between cab and box; exhaust stack with heat shield and cap; snorkel opposite */}
      <Box p={[0, 1.05, 0.65]} s={[2.0, 0.3, 0.34]} c={K.trim} />
      <mesh position={[1.0, 2.2, 0.66]}>
        <cylinderGeometry args={[0.08, 0.08, 2.0, 8]} />
        <meshStandardMaterial color={K.steel} flatShading metalness={0.4} roughness={0.5} />
      </mesh>
      <Box p={[1.0, 1.7, 0.66]} s={[0.24, 1.0, 0.24]} c={K.navy} />
      <Box p={[1.0, 3.24, 0.66]} s={[0.2, 0.1, 0.2]} c={K.steel} />
      <Box p={[-1.0, 2.4, 0.66]} s={[0.3, 1.6, 0.3]} c={K.navy} />
      <Box p={[-1.0, 3.26, 0.7]} s={[0.34, 0.2, 0.4]} c={K.trim} />
      {/* Mirrors: orange arms and housings with a wide-angle glass below */}
      <group ref={cabinRef}>
        {SIDES.map((side) => (
          <group key={side}>
            <Box p={[1.3 * side, 2.45, 2.35]} s={[0.24, 0.04, 0.04]} c={K.orange} />
            <Box p={[1.44 * side, 2.4, 2.35]} s={[0.06, 0.36, 0.2]} c={K.orange} />
            <Box p={[1.44 * side, 2.4, 2.24]} s={[0.05, 0.3, 0.012]} c={K.glass} />
            <Box p={[1.44 * side, 2.12, 2.35]} s={[0.06, 0.14, 0.18]} c={K.orange} />
            <Box p={[1.44 * side, 2.12, 2.25]} s={[0.05, 0.1, 0.012]} c={K.glass} />
          </group>
        ))}
      </group>
      {/* Screen top: visor, orange sun strip with the white sponsor bar on the glass */}
      <Box p={[0, 2.98, 2.62]} s={[2.3, 0.08, 0.36]} c={K.orange} />
      <group position={[0, 2.88, stripZ]} rotation={[-0.28, 0, 0]}>
        <Box p={[0, 0, 0]} s={[2.28, 0.2, 0.04]} c={K.orange} />
        <Box p={[0, 0, 0.024]} s={[1.3, 0.09, 0.01]} c={K.white} />
      </group>
      {/* Orange tubular roof frame with four lamps on its front bar */}
      <Tube a={[-1.2, 3.3, 2.5]} b={[1.2, 3.3, 2.5]} r={0.05} c={K.orange} />
      <Tube a={[-1.2, 3.15, 0.9]} b={[1.2, 3.15, 0.9]} r={0.05} c={K.orange} />
      {SIDES.map((side) => (
        <group key={side}>
          <Tube a={[1.2 * side, 2.95, 2.62]} b={[1.2 * side, 3.3, 2.5]} r={0.05} c={K.orange} />
          <Tube a={[1.2 * side, 3.3, 2.5]} b={[1.2 * side, 3.15, 0.9]} r={0.05} c={K.orange} />
          <Tube a={[1.2 * side, 2.98, 0.9]} b={[1.2 * side, 3.15, 0.9]} r={0.05} c={K.orange} />
        </group>
      ))}
      {[-0.8, -0.35, 0.35, 0.8].map((x) => (
        <Lamp key={x} p={[x, 3.3, 2.56]} radius={0.09} c={K.head} glow={0.5} />
      ))}
      {/* Nose: grille recess with bars and the MAN badge, six spot lamps on a bar at the screen base */}
      <Box p={[0, 1.5, NOSE + 0.02]} s={[1.5, 0.5, 0.05]} c={K.trim} />
      {[1.36, 1.5, 1.64].map((y) => (
        <Box key={y} p={[0, y, NOSE + 0.05]} s={[1.3, 0.04, 0.02]} c={K.steel} />
      ))}
      <Box p={[0, 1.78, NOSE + 0.05]} s={[0.5, 0.11, 0.03]} c={K.white} />
      <Box p={[0, 1.78, NOSE + 0.07]} s={[0.3, 0.05, 0.01]} c={K.navy} />
      <Disc p={[0, 1.5, NOSE + 0.06]} radius={0.07} depth={0.02} c={K.steel} />
      <Box p={[0, BELT, NOSE + 0.04]} s={[2.0, 0.07, 0.07]} c={K.trim} />
      {[-0.85, -0.55, -0.25, 0.25, 0.55, 0.85].map((x) => (
        <Lamp key={x} p={[x, BELT, NOSE + 0.11]} radius={0.11} c={K.head} glow={0.5} />
      ))}
      {/* Orange bumper: headlamps at the ends, mesh with two fog lamps, plate, tow hooks, skid plate */}
      <Box p={[0, 1.0, 2.88]} s={[2.4, 0.36, 0.3]} c={K.orange} shadow />
      {SIDES.map((side) => (
        <Box
          key={side}
          p={[0.95 * side, 1.04, 3.04]}
          s={[0.36, 0.18, 0.03]}
          c={K.head}
          glow={0.6}
        />
      ))}
      <Box p={[0, 1.02, 3.035]} s={[1.1, 0.22, 0.02]} c={K.trim} />
      {[-0.38, 0.38].map((x) => (
        <Lamp key={x} p={[x, 1.02, 3.06]} radius={0.07} c={K.head} glow={0.5} />
      ))}
      <Box p={[0, 0.86, 3.04]} s={[0.5, 0.1, 0.02]} c={K.white} />
      <Box p={[0, 0.86, 3.052]} s={[0.36, 0.04, 0.005]} c={K.trim} />
      {[-0.6, 0.6].map((x) => (
        <Box key={x} p={[x, 0.84, 3.0]} s={[0.1, 0.1, 0.14]} c={K.red} />
      ))}
      <Box p={[0, 0.78, 2.96]} s={[2.0, 0.08, 0.2]} c={K.trim} />
      {/* Flanks: mudguards, steps, door strip, handle, door plate, sponsor plates, REPSOL letters */}
      {SIDES.map((side) => (
        <group key={side}>
          <ArchLip x={X_BODY * side} z={front} radius={spec.wheelRadius} c={K.orange} tube={0.07} />
          <ArchLip x={X_BODY * side} z={rear} radius={spec.wheelRadius} c={K.trim} tube={0.06} />
          <Box p={[1.26 * side, 0.7, 1.3]} s={[0.3, 0.06, 0.5]} c={K.orange} />
          <Box p={[1.24 * side, 0.98, 1.3]} s={[0.22, 0.05, 0.42]} c={K.orange} />
          <Box p={[1.23 * side, 2.2, 0.9]} s={[0.04, 0.8, 0.04]} c={K.steel} />
          <Box p={[flank * side, 1.45, 2.3]} s={[0.03, 1.0, 0.1]} c={K.orange} />
          <Box p={[flank * side, 1.78, 1.5]} s={[0.03, 0.05, 0.28]} c={K.orange} />
          <Box p={[flank * side, 1.55, 1.3]} s={[0.025, 0.36, 0.36]} c={K.white} />
          <Box p={[(flank + 0.01) * side, 1.55, 1.3]} s={[0.012, 0.1, 0.22]} c={K.navy} />
          <Box p={[flank * side, 1.15, 1.7]} s={[0.025, 0.12, 0.5]} c={K.white} />
          {PLATES.map(([y, z, h, len, rule], i) => (
            <group key={i}>
              <Box p={[flank * side, y, z]} s={[0.025, h, len]} c={K.white} />
              <Box p={[(flank + 0.01) * side, y, z]} s={[0.012, h * 0.3, len * 0.75]} c={rule} />
            </group>
          ))}
          {LETTERS.map((z) => (
            <Box key={z} p={[flank * side, 1.9, z]} s={[0.025, 0.22, 0.26]} c={K.red} />
          ))}
          {/* Tail lamps, rear plate, ladder on the left of the back wall */}
          <Box p={[0.9 * side, 1.9, TAIL - 0.02]} s={[0.36, 0.2, 0.06]} c={K.tail} glow={0.5} />
        </group>
      ))}
      <Box p={[0, 1.6, TAIL - 0.02]} s={[0.5, 0.1, 0.02]} c={K.white} />
      {[-1.05, -0.75].map((x) => (
        <Box key={x} p={[x, 2.0, TAIL - 0.05]} s={[0.03, 1.4, 0.04]} c={K.steel} />
      ))}
      {[1.4, 1.7, 2.0, 2.3, 2.6].map((y) => (
        <Box key={y} p={[-0.9, y, TAIL - 0.05]} s={[0.3, 0.03, 0.04]} c={K.steel} />
      ))}
      {/* Tail: bumper, spare wheel on the back wall */}
      <Box p={[0, 1.0, -3.2]} s={[2.3, 0.3, 0.2]} c={K.navy} />
      <mesh position={[0.3, 2.4, -3.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.3, 12]} />
        <meshStandardMaterial color={K.trim} flatShading />
      </mesh>
      <mesh position={[0.3, 2.4, -3.24]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 8]} />
        <meshStandardMaterial color={K.orange} flatShading />
      </mesh>
    </group>
  );
}
