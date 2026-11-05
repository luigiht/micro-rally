'use client';

import { useMemo, type Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from '@/render/car/CarHull';
import { ellipseOnHull } from '@/render/car/HullSurface';
import { ArchLip, Box, Prism, Tube } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

const S = CAR_SPECS.lemans;

/** Powder blue over an orange band and centre stripe, white roundels, dark glass, dark bay and frame. */
const K = {
  blue: '#7fb5dc',
  orange: '#ef7a2c',
  white: '#f4f1ea',
  trim: '#2b2a33',
  bay: '#1c1c22',
  steel: '#8a8d93',
  glass: '#2f5a80',
  screen: '#1f3b52',
  head: '#fff6d0',
  tail: '#d9343a',
  amber: '#f4a21c',
} as const;

const SIDES = [1, -1] as const;
const NOSE = 2.1;
const TAIL = -2.05;

/**
 * A shell station read off a 10 cm cross-section of the reference: the
 * skirt's bottom edge, the belt where the flank is widest, the shoulder
 * where it starts to roll over, and the deck edge. The orange band is the
 * stripe band under the belt.
 */
function st(
  z: number,
  belt: number,
  xBelt: number,
  shoulder: number,
  xShoulder: number,
  roof: number,
  xRoof: number,
  more: Partial<HullStation> = {},
): HullStation {
  const xBody = more.xBody ?? Math.min(xBelt, 0.97);
  return {
    z,
    floor: 0.18,
    sill: 0.2,
    belt,
    roof,
    xSill: xBody - 0.04,
    xBody,
    xBelt,
    shoulder,
    xShoulder,
    xRoof,
    ...more,
  };
}

/**
 * 1970 Le Mans coupé lofted from 10 cm cross-sections of a reference model:
 * 4.2 m long, 2.1 m wide and under a metre tall. The shell is a wide, flat
 * wedge whose flank stands near vertical from a 0.18 m skirt to a shoulder
 * at 0.6–0.75 m and rolls over it to the deck: a thin nose lip, fender
 * tops at 0.68 m over the front wheels with the cowl dipping between them,
 * door tops at 0.56 m (9 cm under the measured, for the cabin's sake), the deck climbing to 0.9 m over the rear fenders and
 * ending in a Kamm lip, the underside sweeping up behind the rear axle so
 * the engine and frame show under the overhang. The cockpit bubble is a
 * second loft standing on the deck: a long, shallow windscreen (its top
 * faces are the hull's roof colour, dark glass, with the actual roof painted
 * blue back over it by a deck decal) rising to a 1.03 m dome over two door
 * windows and a fastback fairing. Arches hug the tyres under rounded body-colour lips, twenty facets each. Orange sill band, orange nose by cap and deck
 * decals, the centre stripe over both lofts, dark teardrop headlamp covers.
 */
const SHELL: HullSpec = {
  // Arches: tight to the tyre (4 cm all round), centred on the axle and cut in twenty facets so the
  // body follows the tyre's circumference; the skirt's edge sits at 0.18 m so the drop from the arch
  // ends to the sill is short.
  wells: { ...wellsFor(S), radius: S.wheelRadius + 0.07, segments: 20 },
  colors: { body: K.blue, trim: K.trim, glass: K.glass, stripe: K.orange },
  // The band's bottom offset overshoots the sill on purpose: the orange always starts at the skirt's edge
  // and its top is the belt, which the rear stations hold at door height for a level stripe.
  stripeBand: [0.6, 0],
  capDecals: [{ end: 'nose', x0: 0, x1: 1, y0: 0, y1: 0.4, color: K.orange, mirror: true }],
  deck: [
    // Orange chin over the whole nose top, climbing the fender fronts outboard toward the lamps.
    // Orange over the centre of the nose ahead of the lamps' middle; the fender crowns in front of the
    // lamps are orange through their stations' side paint.
    { x0: -1.1, x1: 1.1, z0: 1.9, z1: NOSE, color: K.orange },
    { x0: -0.13, x1: 0.13, z0: TAIL, z1: NOSE, color: K.orange },
    // Louvres behind each wheel; fan housing. (The headlamp covers are oval discs, see the parts.)
    { x0: 0.62, x1: 0.85, z0: 0.94, z1: 1.04, color: K.trim, mirror: true },
    { x0: 0.7, x1: 0.9, z0: -1.0, z1: -0.86, color: K.trim, mirror: true },
    { x0: -0.3, x1: 0.3, z0: -1.35, z1: -0.85, color: K.bay },
  ],
  stations: [
    // Nose, measured on a 5 cm grid from the reference: ahead of the front wells each fender carries a
    // crown (the shoulder, at x 0.68) about 10 cm above the bonnet centre, fading into a flat lip; the
    // roof edge at x 0.42 bounds the centre plateau, and the belt is the outer edge. The lamp covers lie
    // on the crowns (see the parts); the lip and the crowns ahead of the lamps are orange.
    st(NOSE, 0.2, 0.3, 0.23, 0.28, 0.25, 0.2, {
      floor: 0.14,
      sill: 0.15,
      xBody: 0.27,
      sidePaint: K.orange,
    }),
    st(2.08, 0.21, 0.62, 0.25, 0.56, 0.25, 0.36, {
      floor: 0.11,
      sill: 0.12,
      xBody: 0.58,
      sidePaint: K.orange,
    }),
    st(2.05, 0.22, 0.8, 0.28, 0.66, 0.28, 0.4, {
      floor: 0.1,
      sill: 0.11,
      xBody: 0.76,
      sidePaint: K.orange,
    }),
    st(2.0, 0.24, 0.86, 0.31, 0.68, 0.3, 0.42, {
      floor: 0.1,
      sill: 0.11,
      xBody: 0.82,
      sidePaint: K.orange,
    }),
    st(1.95, 0.26, 0.88, 0.35, 0.68, 0.32, 0.42, {
      floor: 0.1,
      sill: 0.11,
      xBody: 0.84,
      sidePaint: K.orange,
    }),
    st(1.9, 0.28, 0.89, 0.38, 0.68, 0.345, 0.42, { floor: 0.1, sill: 0.11, xBody: 0.85 }),
    st(1.85, 0.3, 0.9, 0.41, 0.68, 0.365, 0.42, { floor: 0.1, sill: 0.11, xBody: 0.86 }),
    st(1.8, 0.32, 0.91, 0.44, 0.68, 0.385, 0.42, { floor: 0.1, sill: 0.11, xBody: 0.87 }),
    st(1.75, 0.34, 0.92, 0.47, 0.68, 0.4, 0.42, { floor: 0.11, sill: 0.12, xBody: 0.88 }),
    st(1.7, 0.36, 0.93, 0.5, 0.68, 0.43, 0.42, { floor: 0.11, sill: 0.12, xBody: 0.89 }),
    st(1.65, 0.38, 0.935, 0.53, 0.68, 0.45, 0.42, { floor: 0.12, sill: 0.13, xBody: 0.9 }),
    st(1.6, 0.4, 0.945, 0.56, 0.69, 0.47, 0.42, { floor: 0.13, sill: 0.14, xBody: 0.91 }),
    st(1.55, 0.42, 0.95, 0.59, 0.7, 0.49, 0.42, { floor: 0.14, sill: 0.15, xBody: 0.92 }),
    // Over the front wheels the fender tops run at 0.7 m, clear of the arch; a dark toe-board inside the
    // canopy hides them from the footwell (see the parts).
    st(1.48, 0.44, 0.965, 0.62, 0.72, 0.54, 0.62, { xBody: 0.93 }),
    st(1.3, 0.45, 0.97, 0.63, 0.93, 0.7, 0.86, { xBody: 0.93 }),
    st(1.1, 0.45, 0.97, 0.64, 0.94, 0.7, 0.85, { xBody: 0.93 }),
    st(0.95, 0.4, 0.97, 0.62, 0.94, 0.66, 0.8, { xBody: 0.93 }),
    // Doors: widest low down, a long roll-over to the top the canopy stands on. The deck is held at 0.56 m
    // under the seats, 9 cm under the measured 0.65 m door tops, so the cabin fittings clear it from the
    // driver's seat (decision 114); ahead of them it climbs over the toe-board to the cowl.
    st(0.8, 0.4, 0.97, 0.58, 0.93, 0.62, 0.86, { xBody: 0.94 }),
    st(0.6, 0.4, 0.97, 0.55, 0.91, 0.6, 0.84, { xBody: 0.94 }),
    st(0.4, 0.35, 0.98, 0.5, 0.93, 0.56, 0.9, { xBody: 0.94 }),
    st(0.2, 0.35, 0.98, 0.5, 0.92, 0.56, 0.88, { xBody: 0.95 }),
    st(0.0, 0.35, 0.99, 0.51, 0.92, 0.56, 0.86, { xBody: 0.96 }),
    // Held under the 0.62 m cabin floor back to the seats' bulkhead (z -0.3), then climbing to the tail.
    st(-0.2, 0.35, 1.0, 0.54, 0.93, 0.59, 0.85, { xBody: 0.97 }),
    st(-0.32, 0.35, 1.005, 0.55, 0.94, 0.6, 0.86, { xBody: 0.975 }),
    st(-0.4, 0.35, 1.01, 0.61, 0.95, 0.68, 0.88, { xBody: 0.98 }),
    st(-0.6, 0.35, 1.03, 0.65, 0.96, 0.72, 0.86, { xBody: 0.99 }),
    // Rear fenders and the tail deck, rising to 0.9 m; the floor lifts over the open bay.
    st(-0.8, 0.38, 1.04, 0.68, 0.98, 0.78, 0.88, { xBody: 1.0 }),
    st(-1.0, 0.38, 1.05, 0.7, 1.02, 0.8, 0.95, { xBody: 1.0 }),
    st(-1.2, 0.38, 1.06, 0.73, 1.03, 0.84, 0.98, { xBody: 1.0 }),
    st(-1.4, 0.4, 1.06, 0.76, 1.04, 0.88, 0.98, { xBody: 1.0 }),
    st(-1.6, 0.42, 1.06, 0.78, 1.02, 0.86, 0.98, {
      floor: 0.3,
      sill: 0.4,
      xSill: 0.7,
      xBody: 0.85,
    }),
    st(-1.8, 0.52, 1.02, 0.78, 1.03, 0.9, 0.98, {
      floor: 0.42,
      sill: 0.5,
      xSill: 0.75,
      xBody: 0.85,
    }),
    st(-1.95, 0.62, 1.03, 0.8, 1.03, 0.9, 0.99, {
      floor: 0.56,
      sill: 0.6,
      xSill: 0.72,
      xBody: 0.9,
    }),
    st(TAIL, 0.86, 1.02, 0.9, 1.01, 0.94, 0.98, {
      floor: 0.8,
      sill: 0.82,
      xSill: 0.85,
      xBody: 0.9,
    }),
  ],
};

/** A canopy station: its floor sits just under the shell's deck so the bubble grows out of it. */
function cs(
  z: number,
  base: number,
  xBase: number,
  shoulder: number,
  xShoulder: number,
  roof: number,
  xRoof: number,
  glass?: boolean,
): HullStation {
  return {
    z,
    floor: base - 0.02,
    sill: base - 0.01,
    belt: base,
    roof,
    xSill: xBase - 0.02,
    xBody: xBase,
    shoulder,
    xShoulder,
    xRoof,
    glass,
  };
}

const CANOPY: HullSpec = {
  // The roof colour is dark glass so the windscreen can span several stations; the real roof is
  // painted back in blue (with the orange stripe) by deck decals from the screen top rearward.
  colors: { body: K.blue, trim: K.trim, glass: K.glass, screen: K.screen, roof: K.screen },
  deck: [
    { x0: -1, x1: 1, z0: -0.75, z1: 0.3, color: K.blue },
    { x0: -0.13, x1: 0.13, z0: -0.75, z1: 0.3, color: K.orange },
  ],
  stations: [
    // The base is the door-sill width (0.62 m) so the cabin walls stand inside it.
    cs(1.1, 0.56, 0.5, 0.56, 0.5, 0.56, 0.5, true),
    cs(0.9, 0.57, 0.56, 0.63, 0.47, 0.72, 0.4, true),
    cs(0.7, 0.56, 0.6, 0.72, 0.46, 0.84, 0.38, true),
    cs(0.5, 0.54, 0.62, 0.78, 0.46, 0.94, 0.36, true),
    cs(0.3, 0.54, 0.62, 0.82, 0.44, 1.01, 0.3, true),
    cs(0.0, 0.56, 0.62, 0.84, 0.43, 1.03, 0.27, true),
    cs(-0.2, 0.6, 0.62, 0.84, 0.4, 1.01, 0.25),
    cs(-0.32, 0.61, 0.61, 0.83, 0.42, 0.97, 0.27),
    cs(-0.45, 0.69, 0.58, 0.8, 0.45, 0.92, 0.3),
    cs(-0.75, 0.75, 0.5, 0.75, 0.5, 0.75, 0.5),
  ],
};

/** Lamp covers (dark ovals on the fender crowns) and the bonnet roundel, laid onto the shell's surface. */
const LAMP_COVER = { cx: 0.73, cz: 1.765, rx: 0.15, rz: 0.265, lift: 0.008 };
const BONNET_ROUNDEL = { cx: 0, cz: 1.62, rx: 0.17, rz: 0.17, lift: 0.008 };
/** The cooling-fan disc, centred on the dark engine cover behind the cockpit and laid onto the deck. */
const FAN = { cx: 0, cz: -1.1, rx: 0.2, rz: 0.2, lift: 0.008 };

/** A flat-coloured triangle soup lying on the shell, drawn a hair in front of it. */
function OnHull({ positions, c }: { positions: Float32Array; c: string }) {
  return (
    <mesh>
      <bufferGeometry onUpdate={(g) => g.computeVertexNormals()}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <meshStandardMaterial
        color={c}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

/** Tail fin: a wedge standing on the deck edge, rising to the Kamm lip. */
const FIN: readonly (readonly [number, number])[] = [
  [-1.45, 0.885],
  [-2.06, 0.93],
  [-2.06, 1.03],
  [-1.6, 0.9],
];

/**
 * Plain white roundel on a flank, facing outward along x. Placed by a parent
 * group at the flank's width; `lean` tips its top inward with the panel so it
 * neither stands proud above nor sinks in below.
 */
function SideRoundel({
  side,
  y,
  z,
  r,
  lean,
}: {
  side: 1 | -1;
  y: number;
  z: number;
  r: number;
  lean: number;
}) {
  return (
    <group position={[0, y, z]} rotation={[0, 0, lean * side]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[r, r, 0.012, 20]} />
        <meshStandardMaterial color={K.white} flatShading />
      </mesh>
    </group>
  );
}

/** White roundel lying on a deck, tilted with it about x. */
function DeckRoundel({
  p,
  r,
  tilt = 0,
}: {
  p: [number, number, number];
  r: number;
  tilt?: number;
}) {
  return (
    <mesh position={p} rotation={[tilt, 0, 0]}>
      <cylinderGeometry args={[r, r, 0.012, 20]} />
      <meshStandardMaterial color={K.white} flatShading />
    </mesh>
  );
}

/** 1970 Le Mans coupé. Coordinates in the root frame; the shell stands on the ground plane. `cabinRef` holds the canopy and mirrors. */
export function LeMansBody({ cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const [lampL, lampR, roundel, fan] = useMemo(
    () => [
      ellipseOnHull(SHELL.stations, LAMP_COVER),
      ellipseOnHull(SHELL.stations, { ...LAMP_COVER, cx: -LAMP_COVER.cx }),
      ellipseOnHull(SHELL.stations, BONNET_ROUNDEL),
      ellipseOnHull(SHELL.stations, FAN),
    ],
    [],
  );
  return (
    <group>
      <CarHullMesh spec={SHELL} />
      {/* The canopy rides in the cabin group, which the interior view hides: from the seat its glass is
          culled anyway, and its lower wall, leaning inboard of the door cards, showed as a sliver. */}
      <group ref={cabinRef}>
        <CarHullMesh spec={CANOPY} />
        {SIDES.map((side) => (
          <group key={side}>
            <Box p={[0.7 * side, 0.7, 0.98]} s={[0.03, 0.08, 0.03]} c={K.trim} />
            <Box p={[0.72 * side, 0.76, 0.98]} s={[0.12, 0.07, 0.06]} c={K.blue} />
          </group>
        ))}
      </group>
      {/* Tail: fins on the deck edges, trimmed flaps between them, lamps in housings under the lip */}
      {SIDES.map((side) => (
        <group key={side}>
          <Prism x={0.985 * side} points={FIN} thickness={0.03} c={K.blue} shadow />
          <Box p={[0.64 * side, 0.97, -1.99]} s={[0.62, 0.025, 0.22]} c={K.blue} r={[0.3, 0, 0]} />
          <Box p={[0.6 * side, 0.7, -1.97]} s={[0.4, 0.16, 0.06]} c={K.trim} />
          <Box p={[0.66 * side, 0.7, -2.005]} s={[0.22, 0.1, 0.02]} c={K.tail} glow={0.6} />
          <Box p={[0.47 * side, 0.7, -2.005]} s={[0.1, 0.1, 0.02]} c={K.amber} glow={0.5} />
          {/* Frame diagonals and springs seen under the overhang */}
          <Tube a={[0.92 * side, 0.78, -1.98]} b={[0.4 * side, 0.3, -1.68]} r={0.012} c={K.trim} />
          <Tube a={[0.92 * side, 0.3, -1.98]} b={[0.45 * side, 0.76, -1.68]} r={0.012} c={K.trim} />
          <mesh position={[0.3 * side, 0.3, -2.02]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.3, 8]} />
            <meshStandardMaterial color={K.steel} metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Door roundel mid-door toward the rear wheel, within the flank's height; fuel cap on the deck */}
          {/* Mid-door roundel seated on the upper flank plane, which leans 0.2 rad in from the 1.0 m belt */}
          <group position={[0.99 * side, 0, 0]}>
            <SideRoundel side={side} y={0.42} z={-0.05} r={0.17} lean={0.03} />
          </group>
          {/* Rounded arch lips in the body colour around both wheels, as on the saloon */}
          <ArchLip x={0.95 * side} z={S.cgToFront} radius={S.wheelRadius} c={K.blue} tube={0.05} />
          <ArchLip x={1.02 * side} z={-S.cgToRear} radius={S.wheelRadius} c={K.blue} tube={0.05} />
          {/* Headlamp cover: a dark oval laid onto the fender crown, following its curve */}
          <OnHull positions={side === 1 ? lampL : lampR} c={K.trim} />
          <mesh position={[0.75 * side, 0.845, -1.2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.012, 10]} />
            <meshStandardMaterial color={K.trim} flatShading />
          </mesh>
        </group>
      ))}
      <Box p={[0, 0.93, -2.0]} s={[0.66, 0.025, 0.18]} c={K.blue} r={[0.2, 0, 0]} />
      {/* Dark toe-board at the foot of the screen, where the bonnet climbs past the cabin floor toward the
          cowl: it hides that rise from the driver's seat and is itself inside the canopy's shoulder line */}
      <Box p={[0, 0.57, 0.845]} s={[0.88, 0.14, 0.19]} c={K.bay} />
      {/* Open engine bay under the deck: dark wall, the gearbox lump, the cooling fan on top */}
      <Box p={[0, 0.56, -1.7]} s={[1.84, 0.64, 0.3]} c={K.bay} />
      <Box p={[0, 0.4, -1.92]} s={[0.56, 0.3, 0.26]} c={K.steel} />
      <OnHull positions={fan} c={K.steel} />
      {/* Bonnet roundel laid onto the nose; rear-deck roundel tilted with the deck's climb toward the tail */}
      <OnHull positions={roundel} c={K.white} />
      <DeckRoundel p={[0.62, 0.74, -0.65]} r={0.2} tilt={0.25} />
    </group>
  );
}
