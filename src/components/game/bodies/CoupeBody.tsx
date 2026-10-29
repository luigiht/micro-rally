'use client';

import { useMemo, type Ref } from 'react';
import { ExtrudeGeometry, Shape, type Group } from 'three';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import { Box, Lamp } from '../CarParts';

/** Off-white body with a green / white / red stripe set; dark trim. */
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

/** Side profile (z forward, y up) of the upper body; extruded across the car. */
const PROFILE: readonly (readonly [number, number])[] = [
  [1.85, 0.3],
  [1.85, 0.58],
  [1.2, 0.68],
  [0.5, 0.78],
  [0.1, 1.12],
  [-0.55, 1.15],
  [-1.0, 0.95],
  [-1.85, 0.86],
  [-1.85, 0.3],
];
const BODY_WIDTH = 1.62;

function useWedge(): ExtrudeGeometry {
  return useMemo(() => {
    const shape = new Shape();
    PROFILE.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
    shape.closePath();
    return new ExtrudeGeometry(shape, { depth: BODY_WIDTH, bevelEnabled: false });
  }, []);
}

/**
 * A low 1970s wedge coupé in the same blocky style as the hatchback, with a
 * true wedge profile, wraparound glass, roof scoop, rear wing and a tricolour
 * stripe set. `cabinRef` groups the glass and mirrors the first-person views hide.
 */
export function CoupeBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const wedge = useWedge();
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <>
      {/* Lower tub and the extruded wedge (shape x → car z, extrusion → car x) */}
      <Box p={[0, 0.42, 0]} s={[1.76, 0.26, 3.6]} c={K.body} shadow />
      <mesh
        geometry={wedge}
        rotation={[0, -Math.PI / 2, 0]}
        position={[BODY_WIDTH / 2, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color={K.body} flatShading />
      </mesh>
      {/* Glass and mirrors: hidden from the driver's seat */}
      <group ref={cabinRef}>
        <Box p={[0, 0.961, 0.31]} s={[1.46, 0.52, 0.03]} c={K.glass} r={[-0.87, 0, 0]} />
        <Box p={[0, 1.064, -0.78]} s={[1.3, 0.48, 0.03]} c={K.glass} r={[1.15, 0, 0]} />
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.805 * side, 0.96, -0.1]} s={[0.02, 0.26, 0.95]} c={K.glass} />
            <Box p={[0.86 * side, 0.9, 0.42]} s={[0.1, 0.03, 0.03]} c={K.trim} />
            <Box p={[0.93 * side, 0.92, 0.42]} s={[0.1, 0.1, 0.07]} c={K.body} />
          </group>
        ))}
      </group>
      {/* Tricolour: roof bands and flank stripes */}
      {(
        [
          [-0.2, K.green],
          [0, K.white],
          [0.2, K.red],
        ] as const
      ).map(([x, c]) => (
        <Box key={x} p={[x, 1.161, -0.22]} s={[0.18, 0.02, 0.62]} c={c} />
      ))}
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Box p={[0.885 * side, 0.6, 0.1]} s={[0.02, 0.06, 3.2]} c={K.green} />
          <Box p={[0.885 * side, 0.53, 0.1]} s={[0.02, 0.06, 3.2]} c={K.white} />
          <Box p={[0.885 * side, 0.46, 0.1]} s={[0.02, 0.06, 3.2]} c={K.red} />
          {/* Arch flares, sill */}
          <Box p={[0.9 * side, 0.42, front]} s={[0.1, 0.22, 0.95]} c={K.trim} />
          <Box p={[0.9 * side, 0.42, rear]} s={[0.1, 0.22, 0.95]} c={K.trim} />
          <Box p={[0.88 * side, 0.31, 0]} s={[0.06, 0.06, 1.6]} c={K.trim} />
          {/* Pop-up lamp lids, tail lights, exhausts */}
          <Box p={[0.55 * side, 0.665, 1.5]} s={[0.34, 0.03, 0.26]} c={K.trim} />
          <Box p={[0.6 * side, 0.62, -1.86]} s={[0.36, 0.12, 0.04]} c={K.tail} glow={0.5} />
          <mesh position={[0.35 * side, 0.3, -1.96]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.16, 8]} />
            <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Nose: splitter, grille slot, lamp pod with four rally lamps */}
      <Box p={[0, 0.3, 1.86]} s={[1.8, 0.1, 0.14]} c={K.trim} />
      <Box p={[0, 0.5, 1.86]} s={[0.9, 0.08, 0.03]} c={K.trim} />
      <Box p={[0, 0.72, 1.68]} s={[1.1, 0.05, 0.06]} c={K.trim} />
      {[-0.42, -0.14, 0.14, 0.42].map((x) => (
        <Lamp key={x} p={[x, 0.74, 1.74]} radius={0.095} c={K.rally} glow={0.5} />
      ))}
      <Box p={[0.5, 0.64, 1.86]} s={[0.3, 0.1, 0.03]} c={K.head} glow={0.4} />
      <Box p={[-0.5, 0.64, 1.86]} s={[0.3, 0.1, 0.03]} c={K.head} glow={0.4} />
      {/* Roof scoop and rear wing */}
      <Box p={[0, 1.19, -0.58]} s={[0.56, 0.07, 0.3]} c={K.trim} />
      <Box p={[0, 1.02, -1.74]} s={[1.56, 0.05, 0.32]} c={K.body} r={[-0.1, 0, 0]} shadow />
      <Box p={[0.55, 0.94, -1.7]} s={[0.05, 0.12, 0.2]} c={K.trim} />
      <Box p={[-0.55, 0.94, -1.7]} s={[0.05, 0.12, 0.2]} c={K.trim} />
    </>
  );
}
