'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from '@/render/car/CarHull';
import { ArchLip, Box, Lamp, Prism } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** White over yellow: yellow lower half with white and red pinstripes, red/black/grey bonnet wedges, white wheels. */
const K = {
  body: '#f4f1ea',
  yellow: '#f2c230',
  red: '#d7262c',
  grey: '#8a8d93',
  trim: '#2b2a33',
  glass: '#4d6f8c',
  head: '#fff6d0',
  tail: '#d9343a',
  rim: '#d9d4c7',
  smoke: '#4a4a52',
  amber: '#f0931f',
} as const;

/**
 * Dimensions measured from the reference model (silhouette per 10 cm height
 * band at 20 cm stations): body 0.81 half-wide between the arches, flares
 * 0.91, roof 1.33 over a 0.55 half-wide roof panel, belt 0.9, deck 1.2.
 */
const X_BODY = 0.81;
const X_BELT = 0.8;
const X_FLARE = 0.91;
const X_ROOF = 0.55;
const ROOF = 1.33;
const DECK = 1.17;
const FLOOR = 0.32;
const SILL = 0.44;

/** A station with the common floor/sill filled in. */
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

/**
 * Sport-Quattro-shaped Group B coupé: a wide upright nose, long flat bonnet
 * to a fast screen, a flat roof over door and quarter windows with a thin
 * B-pillar, a steep rear window into a raised ducktail deck, a tail panel
 * inclined ~25° down to the lamp bar, and box flares stepping straight out
 * over both axles. The flank band is eight equal sub-bands from the belt
 * down (yellow pinstripe, white, red pinstripe, white, solid yellow) and
 * wraps nose and tail.
 */
const HULL: HullSpec = {
  wells: wellsFor(CAR_SPECS.s1),
  colors: {
    body: K.body,
    trim: K.trim,
    glass: K.glass,
    stripe: [K.yellow, K.body, K.red, K.body, K.yellow, K.yellow, K.yellow, K.yellow],
  },
  stripeBand: [0.56, 0.04],
  wrapStripes: true,
  // Rear window as a decal between the C-pillars; bonnet: offset red / black / grey wedges and two louvre banks.
  deck: [
    { x0: -0.5, x1: 0.5, z0: -1.6, z1: -1.1, color: K.glass },
    { x0: -0.06, x1: 0.14, z0: 0.9, z1: 1.85, color: K.red },
    { x0: 0.14, x1: 0.3, z0: 0.9, z1: 1.7, color: K.trim },
    { x0: 0.3, x1: 0.4, z0: 0.9, z1: 1.55, color: K.grey },
    { x0: -0.52, x1: -0.24, z0: 1.05, z1: 1.11, color: K.trim },
    { x0: -0.52, x1: -0.24, z0: 1.2, z1: 1.26, color: K.trim },
    { x0: -0.52, x1: -0.24, z0: 1.35, z1: 1.41, color: K.trim },
    { x0: 0.46, x1: 0.66, z0: 1.05, z1: 1.11, color: K.trim },
    { x0: 0.46, x1: 0.66, z0: 1.2, z1: 1.26, color: K.trim },
  ],
  stations: [
    // Tail: vertical lamp panel to 0.86 (belt stays level so the stripes run
    // straight to the back), then the panel inclines up to the ducktail deck
    // with tumblehome quarters; the deck runs forward to the rear window,
    // which is painted as a glass decal between the C-pillars.
    st(-2.02, 0.86, 0.86, 0.86, 0.86, { floor: 0.4, sill: 0.46 }),
    st(-1.72, 0.9, DECK, 0.9, 0.68, { xBelt: 0.84 }),
    st(-1.6, 0.9, 1.15, X_FLARE, 0.62, { xBelt: X_BELT }),
    st(-1.1, 0.9, ROOF, X_FLARE, X_ROOF, { xBelt: X_BELT, glass: true }),
    // Rear flare ends; quarter window continues to the B-pillar.
    st(-0.62, 0.9, ROOF, X_FLARE, X_ROOF, { xBelt: X_BELT, glass: true }),
    st(-0.58, 0.9, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    st(-0.45, 0.9, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT }),
    st(-0.37, 0.9, ROOF, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    // Door window to the A-pillar, then the screen down to the cowl.
    st(0.15, 0.9, ROOF - 0.02, X_BODY, X_ROOF, { xBelt: X_BELT, glass: true }),
    st(0.62, 0.94, 0.94, X_BODY, X_BODY, { xBelt: X_BELT }),
    // Front flares and the bonnet sloping to the nose.
    st(0.66, 0.93, 0.93, X_FLARE, X_FLARE, { xBelt: X_BELT }),
    st(1.1, 0.86, 0.86, 0.92, 0.92, { xBelt: X_BELT }),
    st(1.5, 0.82, 0.82, 0.92, 0.92, { xBelt: 0.78 }),
    // Wide, upright nose: the flares run to the front and the bonnet edge sits over a full-width lamp panel.
    st(1.72, 0.8, 0.8, 0.9, 0.9, { xBelt: 0.8 }),
    st(1.98, 0.78, 0.78, 0.88, 0.88, { xBelt: 0.8, floor: 0.36, sill: 0.42 }),
    st(2.08, 0.76, 0.76, 0.86, 0.86, { xBelt: 0.8, floor: 0.4, sill: 0.46 }),
  ],
};

/**
 * Wing after the projections GLB, pulled low and close to the body: a 1.56 m
 * blade, 0.52 m deep, overhanging the tail by 0.1 m and upswept toward the
 * trailing edge; side plates near the body edge, tall at the back and
 * tapering forward onto the rear glass.
 * Profiles are in the (z, y) plane and extruded along x with `Prism`.
 */
const WING_X = 0.78;
const PLATE_X = 0.74;
const WING_Z0 = -1.6;
const WING_Z1 = -2.12;
/** Blade just above the deck, 5 cm thick, upswept 6 cm toward the trailing edge. */
const BLADE: readonly (readonly [number, number])[] = [
  [WING_Z0, 1.22],
  [WING_Z1, 1.28],
  [WING_Z1, 1.33],
  [WING_Z0, 1.27],
];
/** Plates taper forward onto the glass and run down the tail incline at the back, so they hug the body. */
const WING_PLATE: readonly (readonly [number, number])[] = [
  [-1.35, 1.24],
  [WING_Z1, 0.9],
  [WING_Z1, 1.3],
  [-1.35, 1.27],
];

/** Short-wheelbase Group B coupé. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function S1CoupeBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box p={[0.86 * side, 1.0, 0.4]} s={[0.1, 0.04, 0.04]} c={K.trim} />
            <Box p={[0.95 * side, 1.02, 0.4]} s={[0.14, 0.11, 0.09]} c={K.body} />
          </group>
        ))}
      </group>
      {/* Scuttle vent, roof vent, antenna */}
      <Box p={[0, 0.95, 0.72]} s={[0.7, 0.05, 0.26]} c={K.body} />
      <Box p={[0, 0.96, 0.85]} s={[0.6, 0.04, 0.02]} c={K.trim} />
      <Box p={[0.2, ROOF + 0.02, -0.2]} s={[0.22, 0.05, 0.2]} c={K.trim} />
      <Box p={[0.5, ROOF + 0.19, 0.0]} s={[0.02, 0.34, 0.02]} c={K.trim} r={[-0.2, 0, 0]} />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          {/* Flank: black sill blade with a yellow edge between the arches; door plate with numeral; arch lips */}
          <Box p={[0.88 * side, 0.26, 0.02]} s={[0.1, 0.12, 1.3]} c={K.trim} />
          <Box p={[0.88 * side, 0.326, 0.02]} s={[0.1, 0.012, 1.3]} c={K.yellow} />
          <Box p={[(X_BELT - 0.004) * side, 0.72, -0.05]} s={[0.012, 0.3, 0.32]} c={K.body} />
          <Box p={[(X_BELT + 0.003) * side, 0.72, -0.05]} s={[0.012, 0.22, 0.05]} c={K.trim} />
          <ArchLip x={X_FLARE * side} z={front} radius={spec.wheelRadius} c={K.trim} tube={0.06} />
          <ArchLip x={X_FLARE * side} z={rear} radius={spec.wheelRadius} c={K.trim} tube={0.06} />
          {/* Intake on the rear flare's leading face */}
          <Box p={[0.86 * side, 0.56, -0.61]} s={[0.1, 0.4, 0.05]} c={K.trim} />
          <Box p={[0.86 * side, 0.56, -0.62]} s={[0.08, 0.3, 0.05]} c={K.grey} />
          {/* Nose panel: rectangular headlamp at the outer end, big round lamp on the grille, amber indicator on the bumper */}
          <Box p={[0.66 * side, 0.6, 2.11]} s={[0.24, 0.14, 0.03]} c={K.head} glow={0.6} />
          <Lamp p={[0.36 * side, 0.62, 2.13]} radius={0.11} c={K.head} glow={0.5} />
          <Box p={[0.78 * side, 0.4, 2.2]} s={[0.12, 0.07, 0.03]} c={K.amber} glow={0.3} />
          {/* Wing side plate and the small end plate standing up from the blade tip */}
          <Prism x={PLATE_X * side} points={WING_PLATE} thickness={0.04} c={K.body} shadow />
          <Box
            p={[(WING_X - 0.015) * side, 1.33, (WING_Z0 + WING_Z1) / 2]}
            s={[0.03, 0.1, WING_Z0 - WING_Z1]}
            c={K.body}
          />
          {/* Tail: black band with a mesh vent each side of a white divider; smoked corner lamp with a red strip */}
          <Box p={[0.34 * side, 0.7, -2.04]} s={[0.5, 0.22, 0.02]} c={K.grey} />
          <Box p={[0.78 * side, 0.7, -2.04]} s={[0.14, 0.26, 0.02]} c={K.smoke} />
          <Box p={[0.78 * side, 0.6, -2.045]} s={[0.14, 0.05, 0.02]} c={K.tail} glow={0.5} />
        </group>
      ))}
      {/* Nose: full-width black lamp panel with a grille, white bumper with a yellow top edge and mesh slot, four round lamps, deep splitter */}
      <Box p={[0, 0.6, 2.1]} s={[1.6, 0.28, 0.04]} c={K.trim} />
      <Box p={[0, 0.6, 2.125]} s={[0.36, 0.14, 0.02]} c={K.grey} />
      <Box p={[0, 0.41, 2.14]} s={[1.76, 0.14, 0.2]} c={K.body} />
      <Box p={[0, 0.486, 2.14]} s={[1.76, 0.012, 0.2]} c={K.yellow} />
      <Box p={[0, 0.39, 2.245]} s={[0.5, 0.06, 0.02]} c={K.grey} />
      {[-0.57, -0.33, 0.33, 0.57].map((x) => (
        <Lamp key={x} p={[x, 0.42, 2.28]} radius={0.1} c={K.head} glow={0.5} />
      ))}
      <Box p={[0, 0.3, 2.22]} s={[1.9, 0.08, 0.34]} c={K.body} />
      <Box p={[0, 0.266, 2.3]} s={[1.9, 0.012, 0.2]} c={K.yellow} />
      <Box p={[0.95, 0.38, 2.2]} s={[0.04, 0.24, 0.36]} c={K.body} />
      <Box p={[-0.95, 0.38, 2.2]} s={[0.04, 0.24, 0.36]} c={K.body} />
      {/* Tail: upswept wing blade with a yellow leading edge and red trailing lip; black vent band with a white divider, white mesh bumper, yellow lip, exhaust */}
      <Prism x={0} points={BLADE} thickness={WING_X * 2} c={K.body} shadow />
      <Box
        p={[0, 1.278, WING_Z0 - 0.04]}
        s={[WING_X * 2, 0.012, 0.08]}
        c={K.yellow}
        r={[-0.115, 0, 0]}
      />
      <Box p={[0, 1.305, WING_Z1 - 0.01]} s={[WING_X * 2, 0.05, 0.02]} c={K.red} />
      <Box p={[0, 0.7, -2.03]} s={[1.72, 0.3, 0.03]} c={K.trim} />
      <Box p={[0, 0.7, -2.045]} s={[0.1, 0.3, 0.02]} c={K.body} />
      <Box p={[0, 0.45, -2.07]} s={[1.76, 0.2, 0.14]} c={K.body} />
      <Box p={[0, 0.36, -2.08]} s={[1.76, 0.03, 0.16]} c={K.yellow} />
      {[0.3].map((x) => (
        <mesh key={x} position={[x, 0.3, -2.16]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.18, 8]} />
          <meshStandardMaterial color={K.rim} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
