'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from '@/render/car/CarHull';
import { ArchLip, Box, Lamp } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** World-rally blue with the yellow swoosh and star-cluster vinyls, gold wheels. */
const K = {
  body: '#1c3fa8',
  yellow: '#f2d43a',
  trim: '#2b2a33',
  glass: '#4d6f8c',
  head: '#fff6d0',
  tail: '#d9343a',
  rim: '#d9d4c7',
} as const;

/**
 * Proportions measured from the reference model (4.34 m, roof 1.2) and
 * narrowed by request to 1.76 m over the arches, with the cabin pushed forward by request: a short tall
 * bonnet (1.3 m) to a cowl at 0.92 well ahead of centre, a fast screen onto a
 * flat roof from 0.8 m behind centre to 0.25 m ahead, a fast
 * rear window onto a short boot deck at 0.9, and blistered arches over both
 * axles with a shouldered body between.
 */
const X_BODY = 0.8;
const X_BELT = 0.82;
const X_FLARE = 0.88;
const X_ROOF = 0.54;
const ROOF = 1.2;
const FLOOR = 0.34;
const SILL = 0.44;

function st(
  z: number,
  belt: number,
  roof: number,
  xBody: number,
  xRoof: number,
  extra: Partial<HullStation> = {},
): HullStation {
  return { z, floor: FLOOR, sill: SILL, belt, roof, xSill: xBody - 0.04, xBody, xRoof, ...extra };
}

const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.saloon),
  colors: { body: K.body, trim: K.trim, glass: K.glass },
  deck: [
    // Bonnet: dark scoop mouth at the cowl and two vent slots behind the lamp pod.
    { x0: -0.24, x1: 0.24, z0: 1.54, z1: 1.6, color: K.trim },
    { x0: 0.3, x1: 0.48, z0: 1.76, z1: 1.82, color: K.trim, mirror: true },
    // Boot: yellow swoosh sweeping across the deck toward the left.
    { x0: -0.7, x1: -0.3, z0: -1.9, z1: -1.84, color: K.yellow },
    { x0: -0.5, x1: 0.1, z0: -1.84, z1: -1.76, color: K.yellow },
    { x0: -0.2, x1: 0.5, z0: -1.76, z1: -1.7, color: K.yellow },
  ],
  stations: [
    // Tail and short boot deck.
    st(-2.17, 0.88, 0.88, 0.78, 0.78, { floor: 0.38 }),
    st(-1.97, 0.9, 0.9, X_FLARE, X_FLARE),
    // Rear glass from the deck up to the roof; the rear flare ends at the door.
    st(-1.6, 0.92, 0.95, X_FLARE, 0.68, { xBelt: 0.84, glass: true }),
    st(-0.8, 0.9, ROOF, X_FLARE, X_ROOF, { xBelt: X_BELT, glass: true }),
    st(-0.75, 0.9, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    // B-pillar, then the front door window to the A-pillar; the roof runs well forward.
    st(-0.2, 0.9, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT }),
    st(-0.12, 0.9, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    st(0.25, 0.9, ROOF - 0.01, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    // Screen down to a cowl far forward; a short, tall bonnet (1.3 m) to a 0.8 m nose face.
    st(0.85, 0.92, 0.92, X_FLARE, X_FLARE, { xBelt: X_BELT }),
    st(1.3, 0.88, 0.88, X_FLARE, X_FLARE, { xBelt: 0.84 }),
    st(1.7, 0.85, 0.85, X_FLARE, X_FLARE, { xBelt: 0.84 }),
    st(2.0, 0.83, 0.83, 0.85, 0.85, { xBelt: 0.83 }),
    st(2.17, 0.8, 0.8, 0.81, 0.81, { floor: 0.38, sill: 0.42, xBelt: 0.81 }),
  ],
};

/** Yellow swoosh along the doors: a stepped band rising from the front arch toward the C-pillar. */
const SWOOSH: readonly (readonly [number, number, number])[] = [
  // [z centre, y centre, length]
  [0.78, 0.56, 0.3],
  [0.52, 0.6, 0.3],
  [0.26, 0.66, 0.3],
  [0.0, 0.74, 0.3],
  [-0.26, 0.82, 0.3],
  [-0.55, 0.88, 0.32],
  [-0.85, 0.92, 0.3],
];
/** Six yellow stars on the rear door under the swoosh: two diagonal rows, [z, y] in the body frame. */
const STARS: readonly (readonly [number, number])[] = [
  [-0.46, 0.72],
  [-0.58, 0.69],
  [-0.7, 0.66],
  [-0.5, 0.6],
  [-0.62, 0.57],
  [-0.74, 0.54],
];

/** Six yellow stars on the tail panel between the brake lights, [x, y]. */
const TAIL_STARS: readonly (readonly [number, number])[] = [
  [-0.2, 0.8],
  [-0.08, 0.78],
  [0.04, 0.76],
  [-0.16, 0.68],
  [-0.04, 0.66],
  [0.08, 0.64],
];

/** Turbocharged all-wheel-drive saloon. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function SaloonBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  // The flank leans from xBody at the sill top to xBelt at the belt, so a vinyl's
  // x depends on its height; on the rear flare the lean runs from X_FLARE instead.
  const BELT_Y = 0.9;
  const flankAt = (y: number, z: number) => {
    const base = z < -0.78 ? X_FLARE : X_BODY;
    const t = Math.min(1, Math.max(0, (y - SILL) / (BELT_Y - SILL)));
    return base + (X_BELT - base) * t + 0.008;
  };
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.86 * side, 0.98, 0.62]} s={[0.1, 0.04, 0.04]} c={K.trim} />
            <Box p={[0.95 * side, 1.0, 0.62]} s={[0.14, 0.11, 0.09]} c={K.body} />
          </group>
        ))}
      </group>
      {/* Big bonnet scoop laid along the slope, roof vent, two antennas */}
      <Box p={[0, 0.95, 1.3]} s={[0.56, 0.12, 0.44]} c={K.body} r={[0.05, 0, 0]} shadow />
      <Box p={[0, 0.95, 1.52]} s={[0.48, 0.08, 0.03]} c={K.trim} r={[0.05, 0, 0]} />
      <Box p={[0.2, ROOF + 0.02, -0.3]} s={[0.3, 0.05, 0.26]} c={K.body} />
      <Box p={[-0.5, ROOF + 0.17, -0.7]} s={[0.02, 0.3, 0.02]} c={K.trim} r={[-0.3, 0, 0]} />
      <Box p={[0.5, ROOF + 0.17, -0.7]} s={[0.02, 0.3, 0.02]} c={K.trim} r={[-0.3, 0, 0]} />
      {/* Tall rear wing on two uprights with end plates, standing on the boot deck */}
      <Box p={[0.46, 1.07, -1.98]} s={[0.05, 0.36, 0.2]} c={K.body} />
      <Box p={[-0.46, 1.07, -1.98]} s={[0.05, 0.36, 0.2]} c={K.body} />
      <Box p={[0, 1.26, -2.0]} s={[1.4, 0.05, 0.34]} c={K.body} r={[-0.1, 0, 0]} shadow />
      <Box p={[0.7, 1.24, -2.0]} s={[0.03, 0.2, 0.4]} c={K.body} />
      <Box p={[-0.7, 1.24, -2.0]} s={[0.03, 0.2, 0.4]} c={K.body} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <ArchLip x={X_FLARE * side} z={front} radius={spec.wheelRadius} c={K.trim} />
          <ArchLip x={X_FLARE * side} z={rear} radius={spec.wheelRadius} c={K.trim} />
          {/* Yellow swoosh up the doors, the star cluster on the rear door, and a white door plate ahead of it */}
          {SWOOSH.map(([z, y, len], i) => (
            <Box key={i} p={[flankAt(y, z) * side, y, z]} s={[0.02, 0.08, len]} c={K.yellow} />
          ))}
          {STARS.map(([z, y], i) => (
            <Box key={i} p={[flankAt(y, z) * side, y, z]} s={[0.02, 0.07, 0.07]} c={K.yellow} />
          ))}
          <Box p={[flankAt(0.76, 0.34) * side, 0.76, 0.34]} s={[0.02, 0.26, 0.3]} c={K.head} />
          <Box
            p={[(flankAt(0.76, 0.34) + 0.006) * side, 0.76, 0.34]}
            s={[0.012, 0.18, 0.05]}
            c={K.trim}
          />
          {/* Headlamps, tail lamps */}
          <Box p={[0.54 * side, 0.68, 2.17]} s={[0.38, 0.14, 0.04]} c={K.head} glow={0.6} />
          <Box p={[0.55 * side, 0.74, -2.17]} s={[0.34, 0.14, 0.04]} c={K.tail} glow={0.5} />
        </group>
      ))}
      {/* Nose: four pod lamps on the bonnet lip above the grille, two round lamps in the bumper, yellow plate, splitter */}
      <group position={[0, 0.86, 1.98]} rotation={[0.05, 0, 0]}>
        <Box p={[0, 0, 0]} s={[0.94, 0.1, 0.16]} c={K.trim} />
        {[-0.34, -0.11, 0.11, 0.34].map((x) => (
          <Lamp key={x} p={[x, 0.02, 0.1]} radius={0.1} c={K.head} glow={0.55} />
        ))}
      </group>
      <Box p={[0, 0.68, 2.17]} s={[0.56, 0.1, 0.03]} c={K.trim} />
      <Box p={[0, 0.46, 2.2]} s={[1.64, 0.24, 0.18]} c={K.body} />
      <Box p={[0, 0.5, 2.29]} s={[0.44, 0.08, 0.02]} c={K.yellow} />
      {[-0.52, 0.52].map((x) => (
        <Lamp key={x} p={[x, 0.5, 2.31]} radius={0.09} c={K.head} glow={0.5} />
      ))}
      <Box p={[0, 0.32, 2.27]} s={[1.68, 0.04, 0.14]} c={K.trim} />
      {/* Tail: star cluster between the brake lights, bumper with a yellow plate, exhaust */}
      {TAIL_STARS.map(([x, y], i) => (
        <Box key={i} p={[x, y, -2.185]} s={[0.07, 0.07, 0.02]} c={K.yellow} />
      ))}
      <Box p={[0, 0.5, -2.19]} s={[1.58, 0.18, 0.18]} c={K.body} />
      <Box p={[0, 0.52, -2.285]} s={[0.44, 0.08, 0.02]} c={K.yellow} />
      <mesh position={[0.46, 0.38, -2.26]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.18, 8]} />
        <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
