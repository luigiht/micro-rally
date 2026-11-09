'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from '@/render/car/CarHull';
import { ArchLip, Box, Lamp } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** White shell, royal-blue roof, bonnet band and hatch, lime lower flanks over a blue sill, white wheels. */
const K = {
  body: '#f4f1ea',
  blue: '#1f3f9f',
  lime: '#8dc63f',
  red: '#d7262c',
  trim: '#2b2a33',
  glass: '#4d6f8c',
  head: '#fff6d0',
  tail: '#d9343a',
  rim: '#d9d4c7',
} as const;

/** Half-widths measured off the reference: the flank, the shoulder at the belt and the roof. */
const X_BODY = 0.92;
const X_BELT = 0.84;
const X_ROOF = 0.6;
const X_SILL = 0.88;

/** A station on the flat-floored main body; `glass` marks the segment it starts as glazed. */
function st(z: number, belt: number, roof: number, more: Partial<HullStation> = {}): HullStation {
  return {
    z,
    floor: 0.34,
    sill: 0.42,
    belt,
    roof,
    xSill: X_SILL,
    xBody: X_BODY,
    xBelt: X_BELT,
    xRoof: X_ROOF,
    ...more,
  };
}

/**
 * First-generation "New Edge" Focus hatch, lofted from a low-poly reference
 * measured in side, top, front and rear views (lengths at the real wheelbase,
 * heights squashed by 12 % so it sits with the other cars). Reading from
 * the tail: a rounded bumper under a short hatch lip; the hatch glass
 * leaning back about 50° from the lip to the roof, with a tall triangular
 * tail lamp filling each C-pillar beside it; a long high roof with strong
 * tumblehome (0.92 at the hips to 0.60 at the roof) over a thick C-pillar,
 * two door windows either side of a B-pillar, and a fast windscreen that
 * runs 0.76 m forward to a low cowl; then a sloping bonnet to a short,
 * rounded nose with triangular headlamps wrapping from the nose onto the
 * wing tops. The rally dressing is the works livery, the four-lamp pod on
 * the bonnet's leading edge and the black wing on the hatch.
 */
const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.focus),
  colors: {
    body: K.body,
    trim: K.trim,
    glass: K.glass,
    roof: K.blue,
    stripe: [K.lime, K.lime, K.lime, K.blue],
  },
  stripeBand: [0.56, 0.14],
  wrapStripes: true,
  // Each tail lamp is the whole C-pillar band between the hatch lip and the roof, the lens the
  // reference carries beside its rear glass: the only lamps at the back.
  sideDecals: [{ z0: -1.92, z1: -1.57, u0: 0, u1: 1, color: K.tail, glow: true }],
  capDecals: [
    // Nose: slim grille slot between the lamps, white band and dark air dam low down.
    { end: 'nose', x0: 0, x1: 0.36, y0: 0.63, y1: 0.69, color: K.trim, mirror: true },
    { end: 'nose', x0: 0, x1: 0.45, y0: 0.53, y1: 0.57, color: K.body, mirror: true },
    { end: 'nose', x0: 0, x1: 0.66, y0: 0.42, y1: 0.52, color: K.trim, mirror: true },
  ],
  deck: [
    // Blue bonnet band with the white oval, vent slots, and the triangular headlamps on the
    // sloping nose, wider at the back, which the front view shows at |x| 0.40–0.77.
    { x0: -0.3, x1: 0.3, z0: 1.15, z1: 2.1, color: K.blue },
    { x0: -0.16, x1: 0.16, z0: 1.5, z1: 1.8, color: K.body },
    { x0: -0.08, x1: 0.08, z0: 1.58, z1: 1.72, color: K.blue },
    { x0: 0.38, x1: 0.56, z0: 1.3, z1: 1.36, color: K.trim, mirror: true },
    { x0: 0.38, x1: 0.56, z0: 1.42, z1: 1.48, color: K.trim, mirror: true },
    { x0: 0.42, x1: 0.8, z0: 1.78, z1: 1.92, color: K.head, glow: true, mirror: true },
    { x0: 0.5, x1: 0.8, z0: 1.92, z1: 2.1, color: K.head, glow: true, mirror: true },
  ],
  stations: [
    // Tail face and hatch lip: narrow, rounded in plan, bumper bottom at 0.42.
    st(-2.0, 0.96, 0.96, { floor: 0.42, sill: 0.48, xSill: 0.7, xBody: 0.78, xBelt: 0.78 }),
    st(-1.92, 0.98, 0.98, {
      floor: 0.42,
      sill: 0.48,
      xSill: 0.8,
      xBody: 0.86,
      xBelt: 0.85,
      xRoof: 0.62,
      glass: true,
    }),
    // Top of the hatch glass; the roof climbs on to its crown behind the rear axle.
    st(-1.57, 1.07, 1.35, { xRoof: 0.62 }),
    st(-1.46, 1.07, 1.42),
    // Rear door glass from the thick C-pillar to the B-pillar, then the front door glass.
    st(-1.11, 1.07, 1.45, { xRoof: 0.59, glass: true }),
    st(-0.3, 1.05, 1.47, { xRoof: 0.58 }),
    st(-0.18, 1.05, 1.47, { xRoof: 0.58, glass: true }),
    st(0.28, 1.04, 1.46),
    // Windscreen: fast, from the roof's front edge down to the cowl, widening to the scuttle.
    st(0.39, 1.04, 1.4, { glass: true }),
    st(1.15, 1.035, 1.035, { xBelt: 0.9, xRoof: 0.78 }),
    // Bonnet falling to the nose; the nose rounds off in plan over the last 30 cm.
    st(1.67, 0.95, 0.95, { xBody: 0.9, xBelt: 0.9, xRoof: 0.9 }),
    st(1.79, 0.9, 0.9, { xBody: 0.86, xBelt: 0.86, xRoof: 0.86 }),
    st(1.9, 0.87, 0.87, { xSill: 0.78, xBody: 0.8, xBelt: 0.8, xRoof: 0.8 }),
    st(2.02, 0.78, 0.78, { floor: 0.36, xSill: 0.7, xBody: 0.72, xBelt: 0.72, xRoof: 0.72 }),
    st(2.09, 0.72, 0.72, {
      floor: 0.42,
      sill: 0.46,
      xSill: 0.6,
      xBody: 0.64,
      xBelt: 0.64,
      xRoof: 0.64,
    }),
  ],
};

/** Slope of the nose where the lamp pod sits, radians (positive tips the +z end down). */
const NOSE_TILT = 0.5;

/** First-generation Focus hatch in works rally trim. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function FocusHatchBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.93 * side, 1.1, 0.3]} s={[0.1, 0.04, 0.04]} c={K.trim} />
            <Box p={[1.02 * side, 1.12, 0.3]} s={[0.14, 0.11, 0.09]} c={K.blue} />
          </group>
        ))}
      </group>
      {/* Four-lamp pod on the nose slope, lamps hanging over the bumper; roof vent; two antennae */}
      <Box p={[0, 0.9, 1.97]} s={[1.14, 0.1, 0.28]} c={K.blue} r={[NOSE_TILT, 0, 0]} shadow />
      {[-0.42, -0.14, 0.14, 0.42].map((x) => (
        <Lamp key={x} p={[x, 0.9, 2.12]} radius={0.12} c={K.head} glow={0.55} />
      ))}
      <Box p={[0, 1.49, 0.05]} s={[0.36, 0.06, 0.3]} c={K.trim} />
      <Box p={[-0.5, 1.62, -0.9]} s={[0.02, 0.3, 0.02]} c={K.trim} r={[-0.3, 0, 0]} />
      <Box p={[0.45, 1.57, 0.3]} s={[0.02, 0.22, 0.02]} c={K.trim} r={[-0.2, 0, 0]} />
      {/* Black wing on the hatch glass: uprights from the glass up past the roof, two blades, end plates */}
      <Box p={[0.48, 1.3, -1.78]} s={[0.05, 0.4, 0.14]} c={K.trim} />
      <Box p={[-0.48, 1.3, -1.78]} s={[0.05, 0.4, 0.14]} c={K.trim} />
      <Box p={[0, 1.52, -1.76]} s={[1.5, 0.04, 0.34]} c={K.trim} r={[-0.1, 0, 0]} shadow />
      <Box p={[0, 1.42, -1.84]} s={[1.4, 0.03, 0.16]} c={K.trim} r={[-0.06, 0, 0]} />
      <Box p={[0.77, 1.47, -1.77]} s={[0.04, 0.24, 0.4]} c={K.trim} />
      <Box p={[-0.77, 1.47, -1.77]} s={[0.04, 0.24, 0.4]} c={K.trim} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <ArchLip
            x={(X_BODY + 0.01) * side}
            z={front}
            radius={spec.wheelRadius}
            c={K.blue}
            tube={0.05}
          />
          <ArchLip
            x={(X_BODY + 0.01) * side}
            z={rear}
            radius={spec.wheelRadius}
            c={K.blue}
            tube={0.05}
          />
          {/* Door number plate: white square with a blue header */}
          <Box p={[(X_BODY + 0.005) * side, 0.8, 0.3]} s={[0.012, 0.26, 0.3]} c={K.body} />
          <Box p={[(X_BODY + 0.012) * side, 0.9, 0.3]} s={[0.012, 0.06, 0.3]} c={K.blue} />
          <Box p={[(X_BODY + 0.012) * side, 0.78, 0.3]} s={[0.012, 0.16, 0.05]} c={K.trim} />
          {/* Red tow strap and a lime fog lamp at each bumper corner */}
          <Box p={[0.45 * side, 0.46, 2.13]} s={[0.08, 0.05, 0.03]} c={K.red} />
          <Lamp p={[0.5 * side, 0.6, 2.12]} radius={0.06} c={K.lime} glow={0.3} />
        </group>
      ))}
      {/* Blue splitter under the nose; dark diffuser and exhaust under the tail */}
      <Box p={[0, 0.4, 2.08]} s={[1.5, 0.05, 0.16]} c={K.blue} />
      <Box p={[0, 0.38, -1.98]} s={[1.4, 0.08, 0.14]} c={K.trim} />
      <mesh position={[-0.5, 0.44, -2.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.18, 8]} />
        <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
