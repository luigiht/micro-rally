'use client';

import type { Ref } from 'react';
import { Euler, Matrix4, Vector3, type Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec } from '@/render/car/CarHull';
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

/** Half-width of the body between the arches, and of the box flares over them. */
const X_BODY = 0.88;
const X_FLARE = 0.97;

/**
 * Mid-2000s three-door World Rally hatch: a sloping nose rising to a high
 * scuttle, a fast windscreen, a tall roof over a long door and a quarter
 * window, a steep hatch glass falling straight to a flat, vertical tail (no
 * boot deck), and box flares over both axles. The flank band is lime over
 * the lower doors with a blue sill and wraps around the tail; the roof is
 * blue and carries the wing on its trailing edge, and the bonnet has a blue
 * centre band with a white oval.
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
  deck: [
    { x0: -0.3, x1: 0.3, z0: 1.1, z1: 2.05, color: K.blue },
    { x0: -0.16, x1: 0.16, z0: 1.42, z1: 1.72, color: K.body },
    { x0: -0.08, x1: 0.08, z0: 1.5, z1: 1.64, color: K.blue },
    { x0: 0.38, x1: 0.56, z0: 1.3, z1: 1.36, color: K.trim, mirror: true },
    { x0: 0.38, x1: 0.56, z0: 1.42, z1: 1.48, color: K.trim, mirror: true },
  ],
  stations: [
    {
      z: -2.0,
      floor: 0.4,
      sill: 0.46,
      belt: 0.98,
      roof: 0.98,
      xSill: 0.84,
      xBody: 0.92,
      xRoof: 0.7,
      glass: true,
    },
    {
      z: -1.55,
      floor: 0.34,
      sill: 0.44,
      belt: 0.98,
      roof: 1.4,
      xSill: 0.86,
      xBody: X_FLARE,
      xRoof: 0.64,
      glass: true,
    },
    {
      z: -0.95,
      floor: 0.34,
      sill: 0.44,
      belt: 0.97,
      roof: 1.42,
      xSill: 0.86,
      xBody: X_FLARE,
      xRoof: 0.66,
      glass: true,
    },
    {
      z: -0.8,
      floor: 0.34,
      sill: 0.44,
      belt: 0.97,
      roof: 1.42,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.66,
      glass: true,
    },
    {
      z: -0.6,
      floor: 0.34,
      sill: 0.44,
      belt: 0.97,
      roof: 1.43,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.66,
    },
    {
      z: -0.5,
      floor: 0.34,
      sill: 0.44,
      belt: 0.97,
      roof: 1.43,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.66,
      glass: true,
    },
    {
      z: 0.55,
      floor: 0.34,
      sill: 0.44,
      belt: 0.95,
      roof: 1.38,
      xSill: 0.8,
      xBody: X_BODY,
      xRoof: 0.66,
      glass: true,
    },
    {
      z: 1.05,
      floor: 0.34,
      sill: 0.44,
      belt: 0.9,
      roof: 0.9,
      xSill: 0.86,
      xBody: X_FLARE,
      xRoof: X_FLARE,
    },
    {
      z: 1.55,
      floor: 0.34,
      sill: 0.42,
      belt: 0.8,
      roof: 0.8,
      xSill: 0.86,
      xBody: X_FLARE,
      xRoof: X_FLARE,
    },
    {
      z: 1.75,
      floor: 0.34,
      sill: 0.42,
      belt: 0.76,
      roof: 0.76,
      xSill: 0.82,
      xBody: 0.9,
      xRoof: 0.9,
    },
    {
      z: 2.2,
      floor: 0.38,
      sill: 0.44,
      belt: 0.66,
      roof: 0.66,
      xSill: 0.78,
      xBody: 0.86,
      xRoof: 0.86,
    },
  ],
};

/** Bonnet slope between the scuttle and the nose, radians (positive tips the +z end down). */
const BONNET_TILT = 0.21;
/**
 * Tail lamp: a lens lying on the C-pillar surface beside the rear glass, from
 * the tail's top edge to the roof. The pillar leans inward (body edge 0.92 →
 * roof edge 0.64) and rises less steeply than the glass centre, so the lamp
 * is oriented from the surface's own axis and outward normal rather than
 * the glass slope.
 */
const LAMP_FROM = new Vector3(0.84, 0.98, -2.0);
const LAMP_TO = new Vector3(0.7, 1.4, -1.55);
/** Across the pillar surface at mid-height: from the body edge inward and up. */
const LAMP_ACROSS = new Vector3(-0.275, 0.21, 0);
const LAMP_THICKNESS = 0.06;
const lampAxis = new Vector3().subVectors(LAMP_TO, LAMP_FROM);
const LAMP_LENGTH = lampAxis.length();
const lampY = lampAxis.clone().normalize();
const lampNormal = new Vector3().crossVectors(LAMP_ACROSS, lampY).normalize();
const lampX = new Vector3().crossVectors(lampY, lampNormal).normalize();
const lampEuler = new Euler().setFromRotationMatrix(
  new Matrix4().makeBasis(lampX, lampY, lampNormal),
  'XYZ',
);
/** Centre sits a hair proud of the surface so the inner face is buried. */
const LAMP_CENTRE = new Vector3()
  .addVectors(LAMP_FROM, LAMP_TO)
  .multiplyScalar(0.5)
  .addScaledVector(lampNormal, LAMP_THICKNESS / 2 - 0.01);

/** Mid-2000s World Rally hatch. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function FocusHatchBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.93 * side, 1.06, 0.5]} s={[0.1, 0.04, 0.04]} c={K.trim} />
            <Box p={[1.02 * side, 1.08, 0.5]} s={[0.14, 0.11, 0.09]} c={K.blue} />
          </group>
        ))}
      </group>
      {/* Four-lamp pod right at the bonnet's leading edge, lamps hanging over the nose; roof vent; two antennae */}
      <Box p={[0, 0.72, 2.12]} s={[1.14, 0.1, 0.28]} c={K.blue} r={[BONNET_TILT, 0, 0]} shadow />
      {[-0.42, -0.14, 0.14, 0.42].map((x) => (
        <Lamp key={x} p={[x, 0.82, 2.26]} radius={0.12} c={K.head} glow={0.55} />
      ))}
      <Box p={[0, 1.45, 0.3]} s={[0.36, 0.06, 0.3]} c={K.trim} />
      <Box p={[-0.5, 1.59, -0.7]} s={[0.02, 0.3, 0.02]} c={K.trim} r={[-0.3, 0, 0]} />
      <Box p={[0.45, 1.52, 0.5]} s={[0.02, 0.22, 0.02]} c={K.trim} r={[-0.2, 0, 0]} />
      {/* Black wing: short uprights from the base of the rear glass at the tail's top edge; blade about roof height */}
      <Box p={[0.48, 1.17, -1.96]} s={[0.05, 0.4, 0.14]} c={K.trim} />
      <Box p={[-0.48, 1.17, -1.96]} s={[0.05, 0.4, 0.14]} c={K.trim} />
      <Box p={[0, 1.39, -1.94]} s={[1.5, 0.04, 0.34]} c={K.trim} r={[-0.1, 0, 0]} shadow />
      <Box p={[0, 1.29, -2.02]} s={[1.4, 0.03, 0.16]} c={K.trim} r={[-0.06, 0, 0]} />
      <Box p={[0.77, 1.33, -1.95]} s={[0.04, 0.24, 0.4]} c={K.trim} />
      <Box p={[-0.77, 1.33, -1.95]} s={[0.04, 0.24, 0.4]} c={K.trim} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <ArchLip x={X_FLARE * side} z={front} radius={spec.wheelRadius} c={K.blue} tube={0.05} />
          <ArchLip x={X_FLARE * side} z={rear} radius={spec.wheelRadius} c={K.blue} tube={0.05} />
          {/* Door number plate: white square with a blue header */}
          <Box p={[(X_BODY + 0.005) * side, 0.86, 0.55]} s={[0.012, 0.26, 0.3]} c={K.body} />
          <Box p={[(X_BODY + 0.012) * side, 0.96, 0.55]} s={[0.012, 0.06, 0.3]} c={K.blue} />
          <Box p={[(X_BODY + 0.012) * side, 0.84, 0.55]} s={[0.012, 0.16, 0.05]} c={K.trim} />
          {/* Swept headlamps with a dark bezel line beneath */}
          <Box
            p={[0.56 * side, 0.6, 2.19]}
            s={[0.44, 0.11, 0.04]}
            c={K.head}
            glow={0.6}
            r={[0, 0, 0.3 * side]}
          />
          <Box
            p={[0.56 * side, 0.53, 2.2]}
            s={[0.44, 0.03, 0.03]}
            c={K.trim}
            r={[0, 0, 0.3 * side]}
          />
          {/* Blue bumper corner over the lime */}
          <Box p={[0.72 * side, 0.46, 2.23]} s={[0.3, 0.2, 0.17]} c={K.blue} />
          {/* Tail lamp hugging the C-pillar for the full height of the rear glass (mirrored Euler: x, −y, −z) */}
          <Box
            p={[LAMP_CENTRE.x * side, LAMP_CENTRE.y, LAMP_CENTRE.z]}
            s={[0.16, LAMP_LENGTH, LAMP_THICKNESS]}
            c={K.tail}
            glow={0.5}
            r={[lampEuler.x, lampEuler.y * side, lampEuler.z * side]}
          />
        </group>
      ))}
      {/* Nose: slim grille, lime bumper with a white band and twin lime lamps, blue splitter */}
      <Box p={[0, 0.66, 2.2]} s={[0.5, 0.06, 0.03]} c={K.trim} />
      <Box p={[0, 0.48, 2.22]} s={[1.72, 0.2, 0.16]} c={K.lime} />
      <Box p={[0, 0.49, 2.3]} s={[0.9, 0.06, 0.02]} c={K.body} />
      <Box p={[0, 0.56, 2.3]} s={[0.7, 0.04, 0.02]} c={K.trim} />
      <Box p={[0.45, 0.42, 2.31]} s={[0.08, 0.05, 0.03]} c={K.red} />
      <Box p={[0, 0.37, 2.29]} s={[1.74, 0.05, 0.12]} c={K.blue} />
      {[-0.6, 0.6].map((x) => (
        <Lamp key={x} p={[x, 0.5, 2.32]} radius={0.07} c={K.lime} glow={0.3} />
      ))}
      {/* Tail: blue bumper, exhaust */}
      <Box p={[0, 0.46, -2.03]} s={[1.76, 0.16, 0.14]} c={K.blue} />
      <mesh position={[-0.5, 0.38, -2.11]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.18, 8]} />
        <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
