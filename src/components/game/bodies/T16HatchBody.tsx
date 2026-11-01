'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from '@/render/car/CarHull';
import { ArchLip, Box, Lamp, Prism } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** White shell with red / yellow / blue bands low on the doors and across the bonnet corner; blue lower rear, red flaps. */
const K = {
  body: '#f4f1ea',
  blue: '#1e5fb4',
  yellow: '#f2c230',
  red: '#d7262c',
  trim: '#2b2a33',
  glass: '#4d6f8c',
  head: '#fff6d0',
  tail: '#d9343a',
  amber: '#f0931f',
  rim: '#d9d4c7',
} as const;

/**
 * Proportions from the reference model (3.82 m, 1.7 m over the arches, roof
 * 1.33): a short three-door cabin pushed forward, a long engine deck behind
 * it sloping down to the tail, box flares over both axles and a roof-mounted
 * wing.
 */
const X_BODY = 0.78;
const X_BELT = 0.8;
const X_FLARE_F = 0.86;
const X_FLARE_R = 0.88;
const X_ROOF = 0.62;
const ROOF = 1.33;
const FLOOR = 0.32;
const SILL = 0.44;

function st(
  z: number,
  belt: number,
  roof: number,
  xBody: number,
  xRoof: number,
  extra: Partial<HullStation> = {},
): HullStation {
  return { z, floor: FLOOR, sill: SILL, belt, roof, xSill: xBody - 0.03, xBody, xRoof, ...extra };
}

/** Roof-mounted wing: black blade from the roof's trailing edge back over the deck, rising toward the rear. */
const WING_X = 0.76;
const WING_Z0 = -0.72;
const WING_Z1 = -1.3;
/** The tail face: the rear window's base lands straight on the lamp bar here. */
const TAIL = -1.62;
const BLADE: readonly (readonly [number, number])[] = [
  [WING_Z0, ROOF + 0.02],
  [WING_Z1, ROOF + 0.14],
  [WING_Z1, ROOF + 0.19],
  [WING_Z0, ROOF + 0.07],
];
/** The red / yellow / blue stripe set, 7 cm each, listed top to bottom. */
const BANDS = [K.red, K.yellow, K.blue] as const;

const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.t16),
  colors: { body: K.body, trim: K.trim, glass: K.glass, stripe: BANDS },
  // Low on the doors: 0.55–0.76 under a 0.95 belt.
  stripeBand: [0.4, 0.19],
  deck: [
    // Bonnet vent grid at the cowl.
    { x0: -0.32, x1: 0.32, z0: 0.86, z1: 0.96, color: K.trim },
    // The stripe set climbs the left bonnet corner in three steps, blue outermost.
    { x0: -0.36, x1: -0.26, z0: 1.0, z1: 1.26, color: K.blue },
    { x0: -0.26, x1: -0.16, z0: 1.0, z1: 1.26, color: K.yellow },
    { x0: -0.16, x1: -0.06, z0: 1.0, z1: 1.26, color: K.red },
    { x0: -0.52, x1: -0.42, z0: 1.26, z1: 1.52, color: K.blue },
    { x0: -0.42, x1: -0.32, z0: 1.26, z1: 1.52, color: K.yellow },
    { x0: -0.32, x1: -0.22, z0: 1.26, z1: 1.52, color: K.red },
    { x0: -0.68, x1: -0.58, z0: 1.52, z1: 1.78, color: K.blue },
    { x0: -0.58, x1: -0.48, z0: 1.52, z1: 1.78, color: K.yellow },
    { x0: -0.48, x1: -0.38, z0: 1.52, z1: 1.78, color: K.red },
  ],
  stations: [
    // Tail face, then the rear window straight from its top edge up to the roof: no deck.
    st(TAIL, 0.84, 0.84, 0.84, 0.84, { floor: 0.38, sill: 0.46 }),
    st(TAIL + 0.1, 0.9, 0.9, X_FLARE_R, 0.76, { xBelt: 0.82, glass: true }),
    // Quarter window to the B-pillar; rear flare ends.
    st(-0.75, 0.95, ROOF, X_FLARE_R, X_ROOF, { xBelt: X_BELT, glass: true }),
    st(-0.6, 0.95, ROOF, X_FLARE_R, X_ROOF, { xBelt: X_BELT, glass: true }),
    st(-0.56, 0.95, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    st(-0.35, 0.95, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT }),
    st(-0.27, 0.95, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    // Door window to the A-pillar, then the screen down to the cowl.
    st(0.35, 0.96, ROOF - 0.01, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    st(0.8, 0.98, 0.98, X_BODY, X_BODY, { xBelt: X_BELT }),
    // Front flares and the low bonnet to a flat nose.
    st(0.84, 0.97, 0.97, X_FLARE_F, X_FLARE_F, { xBelt: X_BELT }),
    st(1.3, 0.9, 0.9, X_FLARE_F, X_FLARE_F, { xBelt: X_BELT }),
    st(1.7, 0.78, 0.78, X_FLARE_F, X_FLARE_F, { xBelt: 0.78 }),
    st(1.91, 0.7, 0.7, 0.82, 0.82, { floor: 0.4, sill: 0.46, xBelt: 0.78 }),
  ],
};

/** White end plates hanging from the blade tips, deeper at the back. */
const END_PLATE: readonly (readonly [number, number])[] = [
  [WING_Z0 - 0.05, ROOF + 0.02],
  [WING_Z1, ROOF - 0.08],
  [WING_Z1, ROOF + 0.22],
  [WING_Z0 - 0.05, ROOF + 0.1],
];

/** Mid-engined Group B hatch. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function T16HatchBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.86 * side, 1.04, 0.42]} s={[0.1, 0.04, 0.04]} c={K.trim} />
            <Box p={[0.95 * side, 1.06, 0.42]} s={[0.14, 0.1, 0.08]} c={K.trim} />
          </group>
        ))}
      </group>
      {/* Roof wing on two struts, roof vent, antenna */}
      <Prism x={0} points={BLADE} thickness={WING_X * 2} c={K.trim} shadow />
      <Box p={[0.45, ROOF + 0.03, -0.78]} s={[0.05, 0.08, 0.14]} c={K.trim} />
      <Box p={[-0.45, ROOF + 0.03, -0.78]} s={[0.05, 0.08, 0.14]} c={K.trim} />
      <Box p={[0.15, ROOF + 0.02, 0.0]} s={[0.24, 0.05, 0.2]} c={K.trim} />
      {/* Antenna foot stays above the roof skin so it can't poke into the cabin view */}
      <Box p={[0.5, ROOF + 0.19, 0.25]} s={[0.02, 0.34, 0.02]} c={K.trim} r={[-0.2, 0, 0]} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Prism x={WING_X * side} points={END_PLATE} thickness={0.03} c={K.body} />
          <ArchLip
            x={X_FLARE_F * side}
            z={front}
            radius={spec.wheelRadius}
            c={K.trim}
            tube={0.05}
          />
          <ArchLip x={X_FLARE_R * side} z={rear} radius={spec.wheelRadius} c={K.trim} tube={0.05} />
          {/* Blue sill skirt; door number plate */}
          <Box p={[0.8 * side, 0.42, 0.12]} s={[0.1, 0.1, 1.3]} c={K.blue} />
          <Box p={[(X_BELT - 0.004) * side, 0.86, 0.0]} s={[0.012, 0.24, 0.28]} c={K.body} />
          <Box p={[(X_BELT + 0.003) * side, 0.86, 0.0]} s={[0.012, 0.18, 0.04]} c={K.trim} />
          {/* Rectangular headlamps either side of the grille; amber indicators below; rear lamp pairs */}
          <Box p={[0.5 * side, 0.58, 1.92]} s={[0.36, 0.14, 0.04]} c={K.head} glow={0.6} />
          <Box p={[0.56 * side, 0.46, 1.93]} s={[0.2, 0.06, 0.03]} c={K.amber} glow={0.3} />
          <Box p={[0.62 * side, 0.7, TAIL - 0.01]} s={[0.24, 0.1, 0.03]} c={K.tail} glow={0.5} />
          <Box p={[0.36 * side, 0.7, TAIL - 0.01]} s={[0.2, 0.1, 0.03]} c={K.amber} glow={0.3} />
          {/* Red mud flaps behind the rear wheels */}
          <Box p={[0.76 * side, 0.28, rear - 0.5]} s={[0.26, 0.3, 0.03]} c={K.red} />
        </group>
      ))}
      {/* Nose: black grille between the lamps, white bumper with a black slot, two fog lamps, white chin spoiler */}
      <Box p={[0, 0.58, 1.92]} s={[0.28, 0.14, 0.04]} c={K.trim} />
      <Box p={[0, 0.42, 1.94]} s={[1.6, 0.14, 0.1]} c={K.body} />
      <Box p={[0, 0.42, 2.0]} s={[1.0, 0.07, 0.02]} c={K.trim} />
      {[-0.62, 0.62].map((x) => (
        <Lamp key={x} p={[x, 0.42, 2.0]} radius={0.06} c={K.head} glow={0.5} />
      ))}
      <Box p={[0, 0.33, 2.02]} s={[1.7, 0.05, 0.26]} c={K.body} />
      {/* Tail: black panel with a striped centre grille, blue lower bumper, twin exhausts */}
      <Box p={[0, 0.7, TAIL - 0.005]} s={[1.6, 0.16, 0.02]} c={K.trim} />
      <Box p={[-0.1, 0.7, TAIL - 0.015]} s={[0.06, 0.12, 0.02]} c={K.blue} />
      <Box p={[0, 0.7, TAIL - 0.015]} s={[0.06, 0.12, 0.02]} c={K.yellow} />
      <Box p={[0.1, 0.7, TAIL - 0.015]} s={[0.06, 0.12, 0.02]} c={K.red} />
      <Box p={[0, 0.44, TAIL - 0.02]} s={[1.64, 0.14, 0.12]} c={K.blue} />
      {[-0.3, -0.16].map((x) => (
        <mesh key={x} position={[x, 0.36, TAIL - 0.09]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.16, 8]} />
          <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
