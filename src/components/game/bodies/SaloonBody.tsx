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
 * Proportions measured off the reference views (length L = 4.34 m, height
 * H = 1.22 m): the door belt at 0.7 H, the glass above it to the roof; the cowl 0.63 L from the tail at 0.71 H; the roof flat from 0.51 L
 * to 0.29 L; the rear screen down to a boot deck at 0.13 L, 0.72 H high;
 * the bonnet nearly level to a nose face 0.63 H high; flares 1.77 m over the arches with the body 1.6 m
 * between, and the roof 1.2 m wide under a strong tumblehome.
 */
const X_BODY = 0.8;
const X_BELT = 0.84;
const X_FLARE = 0.885;
const X_ROOF = 0.6;
const ROOF = 1.22;
const BELT = 0.86;
const FLOOR = 0.3;
const SILL = 0.36;
const SHOULDER_Y = 0.98;
const X_SHOULDER = 0.76;

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

/** A cabin station: the shoulder crease rounds the glasshouse between the belt and the roof edge. */
function cabin(
  z: number,
  roof: number,
  xBody: number,
  extra: Partial<HullStation> = {},
): HullStation {
  return st(z, BELT, roof, xBody, X_ROOF, {
    xBelt: X_BELT,
    shoulder: SHOULDER_Y,
    xShoulder: X_SHOULDER,
    ...extra,
  });
}

export const SALOON_HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.saloon),
  colors: { body: K.body, trim: K.trim, glass: K.glass },
  deck: [
    // Bonnet: dark scoop mouth at the cowl and two vent slots behind the lamp pod.
    { x0: -0.24, x1: 0.24, z0: 1.3, z1: 1.36, color: K.trim },
    { x0: 0.3, x1: 0.5, z0: 1.56, z1: 1.64, color: K.trim, mirror: true },
    // Boot: yellow swoosh sweeping across the deck toward the left.
    { x0: -0.7, x1: -0.3, z0: -1.95, z1: -1.89, color: K.yellow },
    { x0: -0.5, x1: 0.1, z0: -1.89, z1: -1.81, color: K.yellow },
    { x0: -0.2, x1: 0.5, z0: -1.81, z1: -1.75, color: K.yellow },
  ],
  stations: [
    // Tail: the boot deck, low, rising a little forward over the rear flare.
    st(-2.17, 0.86, 0.86, 0.78, 0.78, { floor: 0.34 }),
    st(-2.0, 0.88, 0.88, X_FLARE, X_FLARE),
    st(-1.66, 0.88, 0.88, X_FLARE, X_FLARE, { xBelt: 0.86 }),
    // Rear screen from the deck up to the roof; the rear flare ends at the door.
    st(-1.6, 0.87, 0.9, X_FLARE, 0.72, { xBelt: 0.86, glass: true }),
    cabin(-0.92, ROOF, X_FLARE, { glass: true }),
    cabin(-0.86, ROOF, X_BODY, { glass: true }),
    // B-pillar, then the long door window to the A-pillar.
    cabin(-0.46, ROOF, X_BODY),
    cabin(-0.38, ROOF, X_BODY, { glass: true }),
    cabin(0.04, ROOF, X_BODY, { glass: true }),
    // Screen down to the cowl; a long low bonnet falling to the nose face.
    st(0.56, 0.88, 0.88, X_FLARE, X_FLARE, { xBelt: X_BELT }),
    st(1.1, 0.86, 0.86, X_FLARE, X_FLARE, { xBelt: 0.86 }),
    st(1.6, 0.83, 0.83, X_FLARE, X_FLARE, { xBelt: 0.86 }),
    st(1.95, 0.8, 0.8, 0.86, 0.86, { xBelt: 0.85 }),
    st(2.17, 0.77, 0.77, 0.8, 0.8, { floor: 0.34, sill: 0.38, xBelt: 0.8 }),
  ],
};

/** Yellow swoosh along the doors: a stepped band rising from the front arch toward the C-pillar. */
const SWOOSH: readonly (readonly [number, number, number])[] = [
  // [z centre, y centre, length]
  [0.5, 0.48, 0.3],
  [0.24, 0.52, 0.3],
  [-0.02, 0.58, 0.3],
  [-0.28, 0.64, 0.3],
  [-0.54, 0.7, 0.3],
  [-0.8, 0.75, 0.26],
];
/** Six yellow stars on the rear door under the swoosh: two diagonal rows, [z, y] in the body frame. */
const STARS: readonly (readonly [number, number])[] = [
  [-0.5, 0.64],
  [-0.62, 0.61],
  [-0.74, 0.58],
  [-0.54, 0.52],
  [-0.66, 0.49],
  [-0.78, 0.46],
];

/** Six yellow stars on the tail panel between the brake lights, [x, y]. */
const TAIL_STARS: readonly (readonly [number, number])[] = [
  [-0.2, 0.78],
  [-0.08, 0.76],
  [0.04, 0.74],
  [-0.16, 0.66],
  [-0.04, 0.64],
  [0.08, 0.62],
];

/** Turbocharged all-wheel-drive saloon. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function SaloonBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  const r = spec.wheelRadius;
  // The flank leans from xBody at the sill top to xBelt at the belt, so a vinyl's
  // x depends on its height; on the rear flare the lean runs from X_FLARE instead.
  const BELT_Y = BELT;
  const flankAt = (y: number, z: number) => {
    const base = z < -0.78 || z > 0.6 ? X_FLARE : X_BODY;
    const t = Math.min(1, Math.max(0, (y - SILL) / (BELT_Y - SILL)));
    return base + (X_BELT - base) * t + 0.008;
  };
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={SALOON_HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            {/* Door mirrors on short arms at the A-pillar's base */}
            <Box p={[0.9 * side, 0.9, 0.4]} s={[0.12, 0.04, 0.04]} c={K.trim} />
            <Box p={[1.0 * side, 0.92, 0.4]} s={[0.16, 0.11, 0.1]} c={K.body} />
            <Box p={[1.02 * side, 0.92, 0.45]} s={[0.1, 0.08, 0.01]} c={K.glass} />
          </group>
        ))}
      </group>
      {/* Bonnet scoop laid along the slope with its dark mouth, two bonnet pins, roof vent, two antennas */}
      <Box p={[0, 0.9, 1.1]} s={[0.56, 0.12, 0.5]} c={K.body} r={[0.05, 0, 0]} shadow />
      <Box p={[0, 0.91, 1.35]} s={[0.46, 0.08, 0.03]} c={K.trim} r={[0.05, 0, 0]} />
      <Box p={[0.5, 0.82, 1.95]} s={[0.05, 0.02, 0.05]} c={K.trim} />
      <Box p={[-0.5, 0.82, 1.95]} s={[0.05, 0.02, 0.05]} c={K.trim} />
      {/* Yellow sun strip across the top of the windscreen */}
      <Box p={[0, ROOF - 0.04, 0.1]} s={[1.1, 0.07, 0.03]} c={K.yellow} r={[-0.55, 0, 0]} />
      <Box p={[0.2, ROOF + 0.02, -0.35]} s={[0.3, 0.05, 0.26]} c={K.body} />
      <Box p={[-0.5, ROOF + 0.17, -0.7]} s={[0.02, 0.3, 0.02]} c={K.trim} r={[-0.3, 0, 0]} />
      <Box p={[0.5, ROOF + 0.17, -0.7]} s={[0.02, 0.3, 0.02]} c={K.trim} r={[-0.3, 0, 0]} />
      {/* Boot lid lip, and the tall rear wing: two swept uprights, a cambered blade, end plates, a gurney */}
      <Box p={[0, 0.9, -1.68]} s={[1.5, 0.04, 0.1]} c={K.body} />
      <Box p={[0.5, 1.04, -2.0]} s={[0.05, 0.36, 0.24]} c={K.body} r={[0.15, 0, 0]} />
      <Box p={[-0.5, 1.04, -2.0]} s={[0.05, 0.36, 0.24]} c={K.body} r={[0.15, 0, 0]} />
      <Box p={[0, 1.22, -2.06]} s={[1.5, 0.05, 0.4]} c={K.body} r={[-0.12, 0, 0]} shadow />
      <Box p={[0, 1.26, -2.24]} s={[1.5, 0.05, 0.03]} c={K.trim} />
      <Box p={[0.76, 1.2, -2.06]} s={[0.03, 0.26, 0.46]} c={K.body} />
      <Box p={[-0.76, 1.2, -2.06]} s={[0.03, 0.26, 0.46]} c={K.body} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <ArchLip x={X_FLARE * side} z={front} radius={r} c={K.trim} />
          <ArchLip x={X_FLARE * side} z={rear} radius={r} c={K.trim} />
          {/* Side skirt along the sill between the arches, red mud flaps behind each wheel */}
          <Box p={[(X_BODY - 0.02) * side, 0.33, 0]} s={[0.06, 0.1, 1.5]} c={K.trim} />
          <Box p={[(X_BODY - 0.01) * side, 0.4, 0]} s={[0.02, 0.03, 1.5]} c={K.yellow} />
          {/* Sponsor blocks: yellow on the bumper corners and the rear quarter */}
          <Box p={[flankAt(0.5, 1.9) * side, 0.5, 1.9]} s={[0.02, 0.06, 0.24]} c={K.yellow} />
          <Box p={[flankAt(0.5, -1.9) * side, 0.5, -1.9]} s={[0.02, 0.06, 0.24]} c={K.yellow} />
          <Box p={[flankAt(0.62, -1.84) * side, 0.62, -1.84]} s={[0.02, 0.08, 0.22]} c={K.yellow} />
          {[front, rear].map((axle) => (
            <group key={axle}>
              <Box
                p={[(X_FLARE - 0.17) * side, SILL - 0.02, axle - 1.32 * r]}
                s={[0.24, 0.06, 0.08]}
                c={K.trim}
              />
              <Box
                p={[(X_FLARE - 0.17) * side, SILL - 0.15, axle - 1.35 * r]}
                s={[0.22, 0.26, 0.03]}
                c={K.tail}
              />
            </group>
          ))}
          {/* Yellow swoosh up the doors, the star cluster on the rear door, door handle, and the white door plate */}
          {SWOOSH.map(([z, y, len], i) => (
            <Box key={i} p={[flankAt(y, z) * side, y, z]} s={[0.02, 0.08, len]} c={K.yellow} />
          ))}
          {STARS.map(([z, y], i) => (
            <Box key={i} p={[flankAt(y, z) * side, y, z]} s={[0.02, 0.07, 0.07]} c={K.yellow} />
          ))}
          <Box p={[flankAt(0.84, -0.3) * side, 0.84, -0.3]} s={[0.02, 0.03, 0.14]} c={K.trim} />
          <Box p={[flankAt(0.73, 0.36) * side, 0.73, 0.36]} s={[0.02, 0.26, 0.3]} c={K.head} />
          <Box
            p={[(flankAt(0.73, 0.36) + 0.006) * side, 0.73, 0.36]}
            s={[0.012, 0.18, 0.05]}
            c={K.trim}
          />
          {/* Headlamps wrapping the nose corners with amber indicators inboard; wide wrap-round tail lamps */}
          <Box p={[0.52 * side, 0.66, 2.16]} s={[0.4, 0.14, 0.06]} c={K.head} glow={0.6} />
          <Box p={[0.78 * side, 0.66, 2.08]} s={[0.06, 0.12, 0.2]} c={K.head} glow={0.4} />
          <Box p={[0.3 * side, 0.66, 2.165]} s={[0.06, 0.1, 0.05]} c={K.yellow} />
          <Box p={[0.5 * side, 0.74, -2.16]} s={[0.44, 0.16, 0.05]} c={K.tail} glow={0.5} />
          <Box p={[0.77 * side, 0.74, -2.07]} s={[0.05, 0.14, 0.22]} c={K.tail} glow={0.3} />
          <Box p={[0.34 * side, 0.74, -2.165]} s={[0.08, 0.1, 0.05]} c={K.head} />
        </group>
      ))}
      {/* Four pod lamps on a dark bar across the bonnet's leading edge */}
      <group position={[0, 0.84, 1.96]} rotation={[0.04, 0, 0]}>
        <Box p={[0, 0, 0]} s={[0.96, 0.1, 0.16]} c={K.trim} />
        {[-0.35, -0.12, 0.12, 0.35].map((x) => (
          <Lamp key={x} p={[x, 0.02, 0.1]} radius={0.1} c={K.head} glow={0.55} />
        ))}
      </group>
      {/* Nose: grille slot with a trim bar, the bumper with its wide intake and two round lamps, yellow plate, splitter */}
      <Box p={[0, 0.68, 2.17]} s={[0.26, 0.1, 0.03]} c={K.trim} />
      <Box p={[0, 0.735, 2.18]} s={[0.6, 0.02, 0.02]} c={K.yellow} />
      <Box p={[0, 0.44, 2.2]} s={[1.66, 0.32, 0.2]} c={K.body} />
      <Box p={[0, 0.36, 2.31]} s={[0.7, 0.12, 0.02]} c={K.trim} />
      <Box p={[0, 0.46, 2.3]} s={[0.44, 0.08, 0.02]} c={K.yellow} />
      {[-0.52, 0.52].map((x) => (
        <Lamp key={x} p={[x, 0.5, 2.31]} radius={0.09} c={K.head} glow={0.5} />
      ))}
      <Box p={[0, 0.27, 2.29]} s={[1.7, 0.04, 0.16]} c={K.trim} />
      {/* Tail: star cluster between the brake lights, a third brake light under the wing, bumper with a yellow plate, exhaust */}
      {TAIL_STARS.map(([x, y], i) => (
        <Box key={i} p={[x, y, -2.185]} s={[0.07, 0.07, 0.02]} c={K.yellow} />
      ))}
      <Box p={[0, 0.885, -2.05]} s={[0.3, 0.04, 0.06]} c={K.tail} glow={0.4} />
      <Box p={[0, 0.46, -2.2]} s={[1.6, 0.26, 0.2]} c={K.body} />
      <Box p={[0, 0.5, -2.305]} s={[0.44, 0.08, 0.02]} c={K.yellow} />
      <Box p={[0.6, 0.5, -2.3]} s={[0.26, 0.06, 0.02]} c={K.yellow} />
      <Box p={[-0.6, 0.5, -2.3]} s={[0.26, 0.06, 0.02]} c={K.yellow} />
      <Box p={[0, 0.28, -2.28]} s={[1.2, 0.06, 0.1]} c={K.trim} />
      <mesh position={[0.46, 0.3, -2.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.18, 8]} />
        <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
