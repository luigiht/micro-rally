'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from '@/render/car/CarHull';
import { ArchLip, Box, Disc, Lamp, Prism } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** Airline-style livery: white shell, green / white / red bands, a red-and-green bonnet, red roof. */
const K = {
  body: '#f4f1ea',
  green: '#157f4a',
  white: '#ffffff',
  red: '#d9343a',
  trim: '#2b2a33',
  glass: '#3f5c76',
  head: '#fff6d0',
  rally: '#ffd76a',
  tail: '#d9343a',
  rim: '#d9d4c7',
} as const;

/**
 * Stratos-shaped Group 4 wedge (3.71 m, 1.75 m wide, 1.11 m tall): a wide
 * low nose dipping to the splitter, a wraparound screen pushed far forward,
 * a short narrow roof over a two-seat cabin, a long rear clamshell with
 * louvres falling to a flat tail (no rear glass: a solid engine cover behind
 * the roof), and high haunches over the rear wheels.
 */
const X_BODY = 0.78;
const X_BELT = 0.82;
const X_HAUNCH = 0.88;
const X_ROOF = 0.5;
const ROOF = 1.11;
const FLOOR = 0.3;
const SILL = 0.4;

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

const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.coupe),
  colors: {
    body: K.body,
    trim: K.trim,
    glass: K.glass,
    roof: K.green,
    stripe: [K.green, K.white, K.red, K.body, K.body],
  },
  // Three 4 cm bands just under the belt crease over the doors, body colour below.
  stripeBand: [0.2, 0.0],
  deck: [
    // Bonnet: red centre band meeting green flanks, no pinstripes between (they read as two white bars from above).
    { x0: -0.14, x1: 0.14, z0: 0.62, z1: 1.9, color: K.red },
    { x0: 0.14, x1: 0.46, z0: 0.62, z1: 1.9, color: K.green, mirror: true },
    // Rear engine cover: same band set, then horizontal louvre slats across it.
    { x0: -0.14, x1: 0.14, z0: -1.72, z1: -0.56, color: K.red },
    { x0: 0.14, x1: 0.18, z0: -1.72, z1: -0.56, color: K.white, mirror: true },
    { x0: 0.18, x1: 0.5, z0: -1.72, z1: -0.56, color: K.green, mirror: true },
    { x0: -0.6, x1: 0.6, z0: -1.62, z1: -1.57, color: K.trim },
    { x0: -0.6, x1: 0.6, z0: -1.5, z1: -1.45, color: K.trim },
    { x0: -0.6, x1: 0.6, z0: -1.38, z1: -1.33, color: K.trim },
    { x0: -0.6, x1: 0.6, z0: -1.26, z1: -1.21, color: K.trim },
    { x0: -0.6, x1: 0.6, z0: -1.14, z1: -1.09, color: K.trim },
    { x0: -0.6, x1: 0.6, z0: -1.02, z1: -0.97, color: K.trim },
    { x0: -0.6, x1: 0.6, z0: -0.9, z1: -0.85, color: K.trim },
    { x0: -0.6, x1: 0.6, z0: -0.78, z1: -0.73, color: K.trim },
    { x0: -0.6, x1: 0.6, z0: -0.66, z1: -0.61, color: K.trim },
  ],
  stations: [
    // Flat tail, then the clamshell rising over the haunches to the roof's trailing edge.
    st(-1.85, 0.74, 0.74, 0.8, 0.8, { floor: 0.34, sill: 0.42 }),
    st(-1.7, 0.82, 0.82, X_HAUNCH, X_HAUNCH, { xBelt: X_HAUNCH }),
    st(-1.05, 0.9, 0.9, X_HAUNCH, X_HAUNCH, { xBelt: X_HAUNCH }),
    st(-0.72, 0.92, 0.98, X_HAUNCH, 0.7, { xBelt: 0.86 }),
    // Narrow roof over the cabin; the rear flare ends just behind the door.
    st(-0.55, 0.92, ROOF, X_HAUNCH, X_ROOF, { xBelt: 0.86, glass: true }),
    st(-0.5, 0.9, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    st(-0.1, 0.9, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT }),
    st(-0.03, 0.9, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    // Wraparound screen falling steeply to a low cowl far forward.
    st(0.2, 0.9, ROOF - 0.02, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    st(0.62, 0.84, 0.84, X_BODY, X_BODY, { xBelt: X_BELT }),
    // Wide low nose over the front arches, dipping to the lip.
    st(0.68, 0.82, 0.82, X_HAUNCH, X_HAUNCH, { xBelt: X_HAUNCH }),
    st(1.1, 0.74, 0.74, X_HAUNCH, X_HAUNCH, { xBelt: X_HAUNCH }),
    st(1.5, 0.62, 0.62, X_HAUNCH, X_HAUNCH, { xBelt: X_HAUNCH }),
    st(1.86, 0.52, 0.52, 0.84, 0.84, { floor: 0.32, sill: 0.38, xBelt: 0.84 }),
  ],
};

/** Rear spoiler: three dark hoops over the clamshell carrying a slim blade, as on the works cars. */
const SPOILER_Z = -0.9;
const HOOP_TOP = ROOF + 0.1;
const HOOP: readonly (readonly [number, number])[] = [
  [SPOILER_Z + 0.04, 0.92],
  [SPOILER_Z - 0.04, 0.92],
  [SPOILER_Z - 0.04, HOOP_TOP],
  [SPOILER_Z + 0.04, HOOP_TOP],
];

/** Mid-engined Group 4 coupé. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function CoupeBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.8 * side, 0.94, 0.42]} s={[0.08, 0.03, 0.03]} c={K.trim} />
            <Box p={[0.88 * side, 0.96, 0.42]} s={[0.1, 0.08, 0.07]} c={K.body} />
          </group>
        ))}
      </group>
      {/* Roof: integrated spoiler lip on the trailing edge, white stripe down the red roof, antenna */}
      <Box p={[0, ROOF + 0.03, -0.5]} s={[1.02, 0.05, 0.12]} c={K.green} />
      <Box p={[0, ROOF + 0.006, -0.18]} s={[0.28, 0.012, 0.5]} c={K.red} />
      <Box p={[0.16, ROOF + 0.008, -0.18]} s={[0.04, 0.012, 0.5]} c={K.white} />
      <Box p={[-0.16, ROOF + 0.008, -0.18]} s={[0.04, 0.012, 0.5]} c={K.white} />
      <Box p={[0.3, ROOF + 0.19, -0.2]} s={[0.02, 0.36, 0.02]} c={K.trim} r={[-0.15, 0, 0]} />
      {/* Rear spoiler: three hoops and the blade; red / green panels between the hoops */}
      {[-0.62, 0, 0.62].map((x) => (
        <Prism key={x} x={x} points={HOOP} thickness={0.06} c={K.trim} />
      ))}
      {/* Vertical rib strips down the engine cover behind the roof */}
      {[-0.31, 0.31].map((x) => (
        <Box key={x} p={[x, 0.95, -0.95]} s={[0.04, 0.03, 0.7]} c={K.trim} r={[-0.12, 0, 0]} />
      ))}
      <Box
        p={[0, HOOP_TOP, SPOILER_Z - 0.04]}
        s={[1.64, 0.04, 0.2]}
        c={K.trim}
        r={[0.1, 0, 0]}
        shadow
      />
      <Box
        p={[0.31, HOOP_TOP + 0.024, SPOILER_Z - 0.03]}
        s={[0.56, 0.012, 0.16]}
        c={K.red}
        r={[0.1, 0, 0]}
      />
      <Box
        p={[-0.31, HOOP_TOP + 0.024, SPOILER_Z - 0.03]}
        s={[0.56, 0.012, 0.16]}
        c={K.green}
        r={[0.1, 0, 0]}
      />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <ArchLip x={X_HAUNCH * side} z={front} radius={spec.wheelRadius} c={K.trim} />
          <ArchLip x={X_HAUNCH * side} z={rear} radius={spec.wheelRadius} c={K.trim} tube={0.055} />
          {/* Door number plate; sill rubbing strip */}
          <Box p={[(X_BELT - 0.004) * side, 0.66, 0.1]} s={[0.012, 0.3, 0.3]} c={K.white} />
          <Box p={[(X_BELT + 0.003) * side, 0.66, 0.1]} s={[0.012, 0.22, 0.05]} c={K.trim} />
          <Box p={[0.8 * side, 0.4, 0.1]} s={[0.04, 0.05, 1.2]} c={K.trim} />
          {/* Round tail lamps; exhaust (the nose carries only the lamp pod) */}
          <Disc p={[0.58 * side, 0.6, -1.86]} radius={0.1} depth={0.03} c={K.trim} />
          <Disc p={[0.58 * side, 0.6, -1.87]} radius={0.08} depth={0.03} c={K.tail} />
          <Box p={[0.3 * side, 0.48, -1.86]} s={[0.14, 0.05, 0.02]} c={K.body} />
          <mesh position={[0.34 * side, 0.3, -1.9]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.16, 8]} />
            <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Nose: four-lamp pod on the lip, black grille slot, deep splitter */}
      <group position={[0, 0.5, 1.84]} rotation={[0.14, 0, 0]}>
        <Box p={[0, 0, 0]} s={[1.44, 0.1, 0.2]} c={K.trim} />
        {[-0.3, -0.1, 0.1, 0.3].map((x) => (
          <Lamp key={x} p={[x, 0.01, 0.15]} radius={0.085} c={K.rally} glow={0.5} />
        ))}
        {[-0.58, 0.58].map((x) => (
          <Lamp key={x} p={[x, 0.02, 0.15]} radius={0.115} c={K.head} glow={0.5} />
        ))}
      </group>
      <Box p={[0, 0.4, 1.88]} s={[1.3, 0.05, 0.03]} c={K.trim} />
      <Box p={[0, 0.32, 1.92]} s={[1.76, 0.04, 0.18]} c={K.body} />
      <Box p={[0, 0.36, -1.86]} s={[1.6, 0.12, 0.1]} c={K.trim} />
      {/* Small white ducktail on the tail's top edge, striped green / white / red across its top */}
      <Box p={[0, 0.8, -1.86]} s={[1.6, 0.05, 0.22]} c={K.body} r={[0.18, 0, 0]} shadow />
      <Box p={[0, 0.83, -1.885]} s={[1.6, 0.012, 0.05]} c={K.green} r={[0.18, 0, 0]} />
      <Box p={[0, 0.822, -1.84]} s={[1.6, 0.012, 0.04]} c={K.white} r={[0.18, 0, 0]} />
      <Box p={[0, 0.814, -1.8]} s={[1.6, 0.012, 0.04]} c={K.red} r={[0.18, 0, 0]} />
    </group>
  );
}
