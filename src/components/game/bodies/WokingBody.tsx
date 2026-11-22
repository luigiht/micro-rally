'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import { HELMET_COLORS, WOKING_HELMET, WOKING_HELMET_LIVERY } from '@/render/car/WokingHelmet';
import { WOKING_SIDEPOD_LIVERY, WOKING_TUB_LIVERY } from '@/render/car/WokingLivery';
import { WOKING_COLORS, WOKING_SIDEPODS, WOKING_TUB } from '@/render/car/WokingShape';
import { Box, Prism, Tube } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';
import { WokingEngineBay } from './WokingEngineBay';

const K = {
  body: WOKING_COLORS.body,
  red: WOKING_COLORS.red,
  trim: WOKING_COLORS.trim,
  glass: WOKING_COLORS.glass,
  carbon: '#26262b',
  steel: '#3a3a40',
} as const;

/**
 * The driver's helmet: a lofted shell (`WokingHelmet`) with its paint, the visor's pivots and
 * tear-off tabs, two vents on the crown, a small spoiler across the back, a slotted chin vent and
 * a dark neck collar.
 */
/** The helmet's centre: the driver sits low, the helmet's lower half inside the cockpit's rim. */
const HELMET_Y = 0.76;
function Helmet() {
  return (
    <group position={[0, HELMET_Y, 0.46]}>
      <CarHullMesh spec={WOKING_HELMET} livery={WOKING_HELMET_LIVERY} />
      {SIDES.map((side) => (
        <group key={side}>
          <Box p={[0.116 * side, 0.025, 0.06]} s={[0.012, 0.026, 0.026]} c={K.trim} />
          <Box p={[0.03 * side, 0.128, 0.03]} s={[0.022, 0.012, 0.05]} c={K.trim} />
        </group>
      ))}
      <Box p={[0.075, 0.06, 0.1]} s={[0.03, 0.012, 0.012]} c={HELMET_COLORS.white} />
      <Box p={[0, 0.07, -0.135]} s={[0.1, 0.012, 0.045]} c={HELMET_COLORS.red} r={[0.6, 0, 0]} />
      <Box p={[0, -0.1, 0.142]} s={[0.06, 0.03, 0.012]} c={K.trim} />
      {[-0.016, 0, 0.016].map((x) => (
        <Box key={x} p={[x, -0.1, 0.149]} s={[0.006, 0.026, 0.006]} c={HELMET_COLORS.white} />
      ))}
      <mesh position={[0, -0.145, -0.01]}>
        <cylinderGeometry args={[0.09, 0.1, 0.03, 14]} />
        <meshStandardMaterial color={K.trim} flatShading />
      </mesh>
    </group>
  );
}

const SIDES = [1, -1] as const;
/** The cockpit's side panels (hull frame): from the tub's dropped top up to its rim, flush with its flanks. */
const COCKPIT_SIDE = { x: 0.25, w: 0.06, y: 0.55, h: 0.17, z: 0.53, len: 0.5 } as const;

/**
 * The front wing's endplates in (z, y): tall at the back, sweeping down to the wing's leading
 * edge. The whole wing stands ahead of z 2.05, clear of the front tyres (whose fronts reach
 * z 1.97, 2.0 at full lock) however they steer.
 */
const FRONT_PLATE: readonly (readonly [number, number])[] = [
  [2.05, 0.04],
  [2.53, 0.04],
  [2.53, 0.17],
  [2.13, 0.3],
  [2.05, 0.3],
];
/** The rear wing's tall endplates, red, from the diffuser up past the top element. */
const REAR_PLATE: readonly (readonly [number, number])[] = [
  [-1.38, 0.42],
  [-1.36, 1.0],
  [-1.86, 1.0],
  [-1.86, 0.42],
];
/** The roll hoop behind the driver's head, standing on the engine cover's peak. */
const HOOP: readonly (readonly [number, number])[] = [
  [0.08, 0.8],
  [0.3, 0.8],
  [0.28, 0.98],
  [0.16, 0.98],
];

/** Front and rear hubs' inner points, where the wishbones meet the uprights (inside the tyres). */
const HUB_Y = 0.33;

/**
 * Late-1980s turbo Formula One car (`WokingShape`, `WokingLivery`). Coordinates
 * in the root frame (ground at 0, the axles at the wheel radius). `cabinRef` holds the driver's helmet and the
 * mirrors, hidden from the driver's seat. The wishbones are drawn in the body,
 * so they lean with it; the stiff springs keep them on the hubs.
 */
export function WokingBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  const half = spec.trackWidth / 2;
  // Each arm runs on into its wheel, 4 cm short of the tyre's centre, so it still meets the wheel
  // when the fronts steer (0.3 m fronts, 0.44 m rears, `CarModel`).
  const hubF = half - 0.04;
  const hubR = half - 0.04;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={WOKING_TUB} livery={WOKING_TUB_LIVERY} />
      <CarHullMesh spec={WOKING_SIDEPODS} livery={WOKING_SIDEPOD_LIVERY} />
      <group ref={cabinRef}>
        <Helmet />
        {/* Red mirrors on stalks off the cockpit's sides, wide and slim, glass facing back */}
        {SIDES.map((side) => (
          <group key={side}>
            <Tube a={[0.2 * side, 0.6, 1.02]} b={[0.38 * side, 0.7, 1.02]} r={0.012} c={K.carbon} />
            <Box p={[0.43 * side, 0.71, 1.02]} s={[0.14, 0.065, 0.04]} c={K.red} />
            <Box p={[0.43 * side, 0.71, 0.997]} s={[0.12, 0.05, 0.01]} c={K.glass} />
          </group>
        ))}
      </group>
      {/* The cockpit's sides: the tub's top drops through the opening (so the driver sees the
          wheel whole), and these white panels stand in its place at the rim's height, so from
          outside the flanks run on unbroken */}
      {SIDES.map((side) => (
        <Box
          key={side}
          p={[COCKPIT_SIDE.x * side, COCKPIT_SIDE.y, COCKPIT_SIDE.z]}
          s={[COCKPIT_SIDE.w, COCKPIT_SIDE.h, COCKPIT_SIDE.len]}
          c={K.body}
        />
      ))}
      {/* A low, clear tinted screen on the scuttle's crest (the nose shows through it from the seat),
          the roll hoop behind the helmet */}
      <mesh position={[0, 0.765, 0.86]} rotation={[-0.45, 0, 0]}>
        <boxGeometry args={[0.34, 0.09, 0.01]} />
        <meshStandardMaterial color={K.glass} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <Prism x={0} points={HOOP} thickness={0.12} c={K.body} shadow />
      {/* Radiator inlets in the sidepods' faces */}
      {SIDES.map((side) => (
        <Box key={side} p={[0.46 * side, 0.26, 0.525]} s={[0.36, 0.3, 0.01]} c={K.trim} />
      ))}
      {/* The flat floor and the diffuser under the gearbox */}
      <Box p={[0, 0.06, -0.25]} s={[1.3, 0.025, 1.5]} c={K.carbon} />
      <Box p={[0, 0.1, -1.4]} s={[0.9, 0.02, 0.5]} c={K.carbon} r={[-0.15, 0, 0]} />
      {/* Front wing: a white main plane and a flap behind it, white endplates */}
      <Box p={[0, 0.08, 2.35]} s={[1.46, 0.025, 0.34]} c={K.body} shadow />
      <Box p={[0, 0.15, 2.13]} s={[1.3, 0.02, 0.15]} c={K.body} r={[0.35, 0, 0]} />
      {SIDES.map((side) => (
        <Prism key={side} x={0.73 * side} points={FRONT_PLATE} thickness={0.02} c={K.body} />
      ))}
      {/* Rear wing between tall red endplates: a low element over the diffuser, a top plane and flap */}
      {SIDES.map((side) => (
        <Prism key={side} x={0.49 * side} points={REAR_PLATE} thickness={0.025} c={K.red} shadow />
      ))}
      <Box p={[0, 0.5, -1.62]} s={[0.96, 0.02, 0.22]} c={K.body} />
      <Box p={[0, 0.93, -1.55]} s={[0.96, 0.025, 0.3]} c={K.body} r={[-0.12, 0, 0]} shadow />
      <Box p={[0, 0.98, -1.78]} s={[0.96, 0.02, 0.15]} c={K.body} r={[-0.45, 0, 0]} />
      <Box p={[0, 0.7, -1.62]} s={[0.03, 0.42, 0.08]} c={K.carbon} />
      {/* Bare behind the engine cover's open end: the engine, turbos, gearbox and exhausts */}
      <WokingEngineBay />
      {/* Wishbones, pushrods, track rods and driveshafts out to the hubs */}
      {SIDES.map((side) => (
        <group key={side}>
          <Tube
            a={[0.22 * side, 0.46, front - 0.2]}
            b={[hubF * side, HUB_Y + 0.09, front]}
            r={0.013}
            c={K.steel}
          />
          <Tube
            a={[0.18 * side, 0.4, front + 0.2]}
            b={[hubF * side, HUB_Y + 0.09, front]}
            r={0.013}
            c={K.steel}
          />
          <Tube
            a={[0.22 * side, 0.18, front - 0.2]}
            b={[hubF * side, HUB_Y - 0.09, front]}
            r={0.013}
            c={K.steel}
          />
          <Tube
            a={[0.16 * side, 0.2, front + 0.22]}
            b={[hubF * side, HUB_Y - 0.09, front]}
            r={0.013}
            c={K.steel}
          />
          <Tube
            a={[hubF * side, HUB_Y - 0.09, front]}
            b={[0.24 * side, 0.52, front - 0.05]}
            r={0.012}
            c={K.steel}
          />
          <Tube
            a={[0.18 * side, 0.3, front + 0.08]}
            b={[hubF * side, HUB_Y, front + 0.08]}
            r={0.01}
            c={K.steel}
          />
          <Tube
            a={[0.2 * side, 0.46, rear + 0.25]}
            b={[hubR * side, HUB_Y + 0.09, rear]}
            r={0.014}
            c={K.steel}
          />
          <Tube
            a={[0.18 * side, 0.44, rear - 0.2]}
            b={[hubR * side, HUB_Y + 0.09, rear]}
            r={0.014}
            c={K.steel}
          />
          <Tube
            a={[0.25 * side, 0.15, rear + 0.25]}
            b={[hubR * side, HUB_Y - 0.09, rear]}
            r={0.014}
            c={K.steel}
          />
          <Tube
            a={[0.2 * side, 0.15, rear - 0.2]}
            b={[hubR * side, HUB_Y - 0.09, rear]}
            r={0.014}
            c={K.steel}
          />
          <Tube
            a={[0.18 * side, 0.3, rear]}
            b={[hubR * side, HUB_Y, rear]}
            r={0.022}
            c={K.carbon}
          />
        </group>
      ))}
    </group>
  );
}
