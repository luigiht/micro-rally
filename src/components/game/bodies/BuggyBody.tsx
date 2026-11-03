'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from '@/render/car/CarHull';
import { fenderPoint, type FenderSpec } from '@/render/car/FenderShell';
import { Box, Lamp, Prism, Tube } from '../CarParts';
import { BUGGY_COLORS as K, BuggyLivery } from './BuggyLivery';
import { CarHullMesh, FenderMesh } from './CarHullMesh';

const S = CAR_SPECS.buggy;
const FRONT = S.cgToFront;
const REAR = -S.cgToRear;
const R = S.wheelRadius;
/** Arch radius shared by the hull's rear wells and the fender shells. */
const ARCH = R + 0.08;
/**
 * Ride height: the whole body (hull, fenders, kit) stands this much higher
 * over the wheels than its heights say, on long-travel springs at full droop.
 * The spec's `cabinDrop` carries it too, so the cabin and the eye rise with it.
 */
export const BUGGY_LIFT = 0.1;

/** Half-widths: the door skin, the nose between the front fenders, the rear deck, the greenhouse and the fenders' outer walls. */
const X_DOOR = 0.86;
const X_NOSE = 0.6;
const X_REAR = 0.8;
const X_ROOF = 0.6;
const X_FLARE = 1.14;
const BELT = 1.16;
const ROOF = 1.78;
/** The engine deck behind the cabin stands above the door belt; the hull closes at TAIL and the spares stand in its wall. */
const DECK = 1.34;
const NOSE = 2.45;
const TAIL = -1.9;
/** Rear wing: a plate across the fender tops on wedge uprights; its underside and centre. */
const WING_Y = DECK + 0.3;
const WING_Z = -2.25;
/** Spare wheels: two tyres upright like the road wheels, side by side in the bay wall, up under the wing. */
const SPARE_X = 0.28;
const SPARE_Y = 1.05;
const SPARE_Z = -1.98;
const SPARE_W = 0.34;
const SIDES = [1, -1] as const;

const st = (
  z: number,
  belt: number,
  roof: number,
  xBody: number,
  xRoof: number,
  over: Partial<HullStation> = {},
): HullStation => ({
  z,
  floor: 0.42,
  sill: 0.52,
  belt,
  roof,
  xSill: xBody - 0.06,
  xBody,
  xRoof,
  ...over,
});

/** White letter blocks across the bonnet: a short word and a long one. */
const LETTERS: readonly (readonly [number, number])[] = [
  [-0.5, -0.4],
  [-0.37, -0.27],
  [-0.24, -0.14],
  [0.0, 0.1],
  [0.13, 0.23],
  [0.26, 0.36],
  [0.39, 0.49],
];

/**
 * Two-seat rally-raid tub: a tall door skin under a narrow greenhouse set
 * mid-car, a fast screen onto a low sloping bonnet that narrows between the
 * front fenders to a blunt nose, and behind the cabin a tall engine deck
 * (its sides rise over the door belt along the rear window, the haunch) that
 * closes over the rear arches in a dark bay wall the spares stand in.
 * Only the rear axle cuts wells: the nose sits inboard of the front tyres,
 * with the suspension in the gap. The stripe band carries no colour; it
 * shapes the nose panel so the lamp pods paint onto a band of the right height.
 */
const HULL: HullSpec = {
  wells: { ...wellsFor(S), zs: [REAR] },
  colors: { body: K.navy, trim: K.trim, glass: K.glass },
  stripeBand: [0.3, 0.1],
  deck: [
    { x0: -0.62, x1: 0.62, z0: -1.85, z1: -1.15, color: K.carbon },
    { x0: -0.07, x1: 0.07, z0: -1.85, z1: -1.15, color: K.navy },
    ...LETTERS.map(([x0, x1]) => ({ x0, x1, z0: 1.96, z1: 2.1, color: K.white })),
    { x0: 0.1, x1: 0.3, z0: 2.15, z1: 2.24, color: K.red, mirror: true },
    { x0: 0.3, x1: 0.37, z0: 2.13, z1: 2.19, color: K.red, mirror: true },
  ],
  capDecals: [
    { end: 'nose', x0: 0.14, x1: 0.5, y0: 0.56, y1: 0.8, color: K.carbon, mirror: true },
    { end: 'tail', x0: 0, x1: 1, y0: 0, y1: 2, color: K.carbon, mirror: true },
  ],
  stations: [
    st(TAIL, DECK, DECK, X_REAR, X_REAR, { floor: 0.6, sill: 0.66 }),
    st(-1.1, DECK, DECK, X_REAR, X_REAR, { floor: 0.5, sill: 0.56 }),
    st(-1.02, DECK, DECK, X_DOOR, X_DOOR, { glass: true }),
    st(-0.72, BELT, ROOF, X_DOOR, X_ROOF),
    st(-0.58, BELT, ROOF, X_DOOR, X_ROOF, { glass: true }),
    st(0.43, BELT, ROOF, X_DOOR, X_ROOF),
    st(0.5, BELT, ROOF, X_DOOR, X_ROOF, { glass: true }),
    st(0.92, BELT, BELT, X_DOOR, X_DOOR),
    st(1.04, 1.13, 1.13, X_NOSE, X_NOSE),
    st(2.1, 0.98, 0.98, X_NOSE, X_NOSE, { floor: 0.46, sill: 0.54 }),
    st(NOSE, 0.88, 0.88, 0.58, 0.58, { floor: 0.5, sill: 0.58 }),
  ],
};

/** Front mudguards: a tall dome peaking behind the axle, a flap down to the sill behind the tyre, a lip to hub height ahead of it. */
const FRONT_FENDER: FenderSpec = {
  z: FRONT,
  axleY: R,
  inner: ARCH,
  outline: [
    [-95, 0.66],
    [-72, 0.76],
    [-45, 0.82],
    [-15, 0.85],
    [15, 0.84],
    [45, 0.78],
    [72, 0.7],
    [92, 0.64],
  ],
  xIn: X_NOSE - 0.02,
  xOut: X_FLARE,
  bevel: 0.08,
  colors: { body: K.navy, trim: K.trim },
};

/** Rear quarters: the dome peaks over the axle level with the deck, runs back beside the spares and drops to the sill behind the door. */
const REAR_FENDER: FenderSpec = {
  z: REAR,
  axleY: R,
  inner: ARCH,
  outline: [
    [-70, 0.66],
    [-50, 0.76],
    [-25, 0.82],
    [0, 0.85],
    [30, 0.82],
    [58, 0.75],
    [80, 0.68],
    [95, 0.64],
  ],
  xIn: X_REAR - 0.02,
  xOut: X_FLARE,
  bevel: 0.08,
  colors: { body: K.navy, trim: K.trim },
};

/** A spare tyre standing like the road wheels, tread to the rear, with a grey rim either side. */
function Spare({ x }: { x: number }) {
  return (
    <group position={[x, SPARE_Y, SPARE_Z]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[R, R, SPARE_W, 12]} />
        <meshStandardMaterial color={K.tyre} flatShading />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.6 * R, 0.6 * R, SPARE_W + 0.02, 8]} />
        <meshStandardMaterial color={K.rim} flatShading metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** White work lights lie on the rear fenders' domes just above their rear lips, facing back and a little up. */
const REAR_LAMP = fenderPoint(REAR_FENDER, -62, 0.01);

/** Wedge upright of the rear wing, tall at the back, in the (z, y) plane. */
const UPRIGHT: readonly (readonly [number, number])[] = [
  [-1.62, DECK + 0.02],
  [WING_Z - 0.16, DECK + 0.02],
  [WING_Z - 0.16, WING_Y],
];
/**
 * Centre fin: its leading edge lies a centimetre inside the rear window from
 * the deck to the roof's rear corner, its top runs down to the wing's
 * underside and it closes on the deck line, standing in the slot between the spares.
 */
const FIN: readonly (readonly [number, number])[] = [
  [-1.0, DECK - 0.02],
  [-0.71, ROOF - 0.01],
  [WING_Z + 0.05, WING_Y - 0.02],
  [WING_Z + 0.05, DECK],
];

/** Rally-raid buggy. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function BuggyBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  const r = spec.wheelRadius;
  // The wheels stay on the ground while the body stands BUGGY_LIFT higher: the hubs sit that much lower in its frame.
  const hubY = r - BUGGY_LIFT;
  // Wishbones reach just inside the tyre's inner face.
  const hub = spec.trackWidth / 2 - 0.4 * r + 0.03;
  return (
    <group position={[0, BUGGY_LIFT - 0.1, 0]}>
      <CarHullMesh spec={HULL} />
      <FenderMesh spec={FRONT_FENDER} />
      <FenderMesh spec={REAR_FENDER} />
      <BuggyLivery flank={X_DOOR} front={FRONT_FENDER} rear={REAR_FENDER} />
      {/* Mirrors on stalks off the A-pillars */}
      <group ref={cabinRef}>
        {SIDES.map((side) => (
          <group key={side}>
            <Box p={[0.96 * side, 1.3, 0.62]} s={[0.2, 0.03, 0.03]} c={K.trim} />
            <Box p={[1.08 * side, 1.3, 0.62]} s={[0.1, 0.12, 0.08]} c={K.navy} />
            <Box p={[1.08 * side, 1.3, 0.575]} s={[0.08, 0.1, 0.01]} c={K.glass} />
          </group>
        ))}
      </group>
      {/* Roof: a wide intake box over the screen top with a sponsor bar, a snorkel behind, an aerial */}
      <Box p={[0, 1.84, 0.1]} s={[1.1, 0.12, 0.64]} c={K.navy} shadow />
      <Box p={[0, 1.84, 0.425]} s={[1.0, 0.07, 0.02]} c={K.carbon} />
      <Box p={[0, 1.905, 0.15]} s={[0.5, 0.012, 0.2]} c={K.white} />
      <Box p={[0, 1.86, -0.5]} s={[0.3, 0.18, 0.3]} c={K.navy} />
      <Box p={[0, 1.9, -0.34]} s={[0.24, 0.08, 0.02]} c={K.carbon} />
      <Tube a={[0.3, 1.78, -0.62]} b={[0.3, 2.0, -0.66]} r={0.012} c={K.trim} />
      {/* Nose: two round lamps in each painted pod, skid plate, number plate, red tow hooks */}
      {[-0.42, -0.24, 0.24, 0.42].map((x) => (
        <Lamp key={x} p={[x, 0.68, NOSE + 0.01]} radius={0.065} c={K.head} glow={0.5} />
      ))}
      <Box p={[0, 0.46, 2.3]} s={[1.16, 0.08, 0.5]} c={K.trim} />
      <Box p={[0, 0.62, NOSE + 0.005]} s={[0.26, 0.07, 0.01]} c={K.white} />
      {[-0.5, 0.5].map((x) => (
        <Box key={x} p={[x, 0.52, NOSE - 0.04]} s={[0.07, 0.07, 0.12]} c={K.red} />
      ))}
      {/* Front suspension in the gap between the nose and the tyres: wishbones to the hub, a coil-over up into the fender */}
      {SIDES.map((side) => (
        <group key={side}>
          <Tube
            a={[0.5 * side, 0.5, front + 0.22]}
            b={[hub * side, hubY, front + 0.02]}
            r={0.025}
            c={K.steel}
          />
          <Tube
            a={[0.5 * side, 0.5, front - 0.22]}
            b={[hub * side, hubY, front - 0.02]}
            r={0.025}
            c={K.steel}
          />
          <Tube
            a={[0.5 * side, 0.82, front]}
            b={[hub * side, hubY + 0.2, front]}
            r={0.022}
            c={K.steel}
          />
          <Tube
            a={[(hub - 0.04) * side, hubY + 0.05, front + 0.06]}
            b={[0.64 * side, 1.15, front - 0.1]}
            r={0.035}
            c={K.red}
          />
        </group>
      ))}
      {/* Rear: wedge uprights carry the wing over the spares, lamps on its trailing edge; white work lights low on the back of each rear fender; the centre fin against the rear window */}
      {SIDES.map((side) => (
        <Box
          key={side}
          p={[0.93 * side, REAR_LAMP.y, REAR_LAMP.z]}
          s={[0.22, 0.012, 0.1]}
          c={K.white}
          r={[REAR_LAMP.tilt, 0, 0]}
          glow={0.6}
        />
      ))}
      {SIDES.map((side) => (
        <group key={side}>
          <Prism x={0.74 * side} points={UPRIGHT} thickness={0.06} c={K.navy} />
          <Box
            p={[0.8 * side, WING_Y + 0.02, WING_Z - 0.19]}
            s={[0.34, 0.06, 0.02]}
            c={K.tail}
            glow={0.5}
          />
        </group>
      ))}
      <Box p={[0, WING_Y + 0.02, WING_Z]} s={[2.28, 0.04, 0.36]} c={K.navy} shadow />
      <Prism x={0} points={FIN} thickness={0.06} c={K.navy} />
      <Box p={[0, 1.6, -1.4]} s={[0.08, 0.1, 0.3]} c={K.white} />
      {/* Spares on a carrier tube with a post between them, the plate in the slot, twin exhausts below */}
      <Spare x={SPARE_X} />
      <Spare x={-SPARE_X} />
      <Tube
        a={[-1.0, SPARE_Y - R, SPARE_Z - 0.1]}
        b={[1.0, SPARE_Y - R, SPARE_Z - 0.1]}
        r={0.03}
        c={K.steel}
      />
      <Box p={[0, SPARE_Y - 0.1, SPARE_Z - 0.2]} s={[0.08, 0.7, 0.08]} c={K.carbon} />
      {/* Mud flaps bolted to the carrier tube, so they ride and lean with the body rather than staying with the wheels */}
      {SIDES.map((side) => (
        <Box
          key={side}
          p={[0.9 * side, SPARE_Y - R - 0.2, SPARE_Z - 0.1]}
          s={[0.42, 0.44, 0.03]}
          c={K.trim}
        />
      ))}
      <Box p={[0, 1.2, SPARE_Z - 0.3]} s={[0.2, 0.08, 0.01]} c={K.white} />
      {/* Exhausts run under the floor from the engine bay out past the carrier tube, tucked up under it in the slot between the spares */}
      {[-0.07, 0.07].map((x) => (
        <Tube key={x} a={[x, 0.52, -1.2]} b={[x, 0.52, SPARE_Z - 0.34]} r={0.04} c={K.steel} />
      ))}
      {/* Underside: belly pan under the bay, the differential on the rear axle with driveshafts to the hubs, trailing arms, a chassis cross tube */}
      <Box p={[0, 0.5, -1.45]} s={[1.3, 0.04, 0.9]} c={K.carbon} />
      <Box p={[0, hubY + 0.02, rear]} s={[0.28, 0.26, 0.3]} c={K.trim} />
      <Tube a={[-0.7, 0.46, rear - 0.32]} b={[0.7, 0.46, rear - 0.32]} r={0.025} c={K.steel} />
      {SIDES.map((side) => (
        <group key={side}>
          <Tube a={[0.14 * side, hubY, rear]} b={[hub * side, hubY, rear]} r={0.03} c={K.steel} />
          <Tube
            a={[0.42 * side, 0.5, rear + 0.5]}
            b={[(hub - 0.02) * side, hubY, rear + 0.04]}
            r={0.025}
            c={K.steel}
          />
        </group>
      ))}
    </group>
  );
}
