'use client';

import { useImperativeHandle, useRef, type Ref } from 'react';
import type { Group } from 'three';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { Box, CAR_COLORS as C, Disc } from './CarParts';

export interface CarInteriorHandle {
  apply(pose: Readonly<VehiclePose>): void;
  setVisible(visible: boolean): void;
}

/** Steering wheel turn per radian of road-wheel angle (≈160° at full lock). */
const WHEEL_RATIO = 4.5;
const SPEEDO_MAX_KMH = 240;
/** Needles sweep clockwise from about 7 o'clock to 5 o'clock. */
const NEEDLE_MIN = -2.36;
const NEEDLE_SWEEP = 4.72;
const SEAT_X = 0.34;

function Gauge({ x, needleRef }: { x: number; needleRef: Ref<Group> }) {
  return (
    <group position={[x, 0.98, 0.175]}>
      <Disc p={[0, 0, 0]} radius={0.045} depth={0.01} c={C.livery} />
      <group ref={needleRef} position={[0, 0, -0.008]}>
        <Box p={[0, 0.02, 0]} s={[0.006, 0.04, 0.004]} c={C.tail} />
      </group>
      <Disc p={[0, 0, -0.009]} radius={0.008} depth={0.006} c={C.trim} />
    </group>
  );
}

function Seat({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <Box p={[0, 0.86, -0.4]} s={[0.5, 0.12, 0.5]} c={C.seat} />
      <Box p={[0, 1.06, -0.6]} s={[0.5, 0.36, 0.1]} c={C.seat} r={[-0.12, 0, 0]} />
      <Box p={[0, 1.06, -0.545]} s={[0.12, 0.3, 0.006]} c={C.paint} r={[-0.12, 0, 0]} />
      <Box p={[0, 1.23, -0.64]} s={[0.22, 0.1, 0.08]} c={C.seat} />
    </group>
  );
}

/**
 * Cabin interior seen from the driver's seat: dash with working speedo and
 * tacho, steering wheel that turns with the input, seats, pillars and roof.
 * Lives inside the leaning body group; shown only in the interior view.
 */
export function CarInterior({
  ref,
  redlineRpm,
}: {
  ref: Ref<CarInteriorHandle>;
  redlineRpm: number;
}) {
  const root = useRef<Group>(null);
  const wheel = useRef<Group>(null);
  const speedo = useRef<Group>(null);
  const tacho = useRef<Group>(null);

  useImperativeHandle(ref, () => ({
    apply(pose) {
      if (!root.current?.visible) return;
      // A right turn is a negative road-wheel angle; the rim turns clockwise for the driver.
      if (wheel.current) wheel.current.rotation.z = -pose.steerAngle * WHEEL_RATIO;
      const kmh = Math.min(1, (Math.abs(pose.speed) * 3.6) / SPEEDO_MAX_KMH);
      if (speedo.current) speedo.current.rotation.z = NEEDLE_MIN + NEEDLE_SWEEP * kmh;
      const revs = Math.min(1, pose.rpm / (redlineRpm * 1.05));
      if (tacho.current) tacho.current.rotation.z = NEEDLE_MIN + NEEDLE_SWEEP * revs;
    },
    setVisible(visible) {
      if (root.current) root.current.visible = visible;
    },
  }));

  return (
    <group ref={root} visible={false}>
      {/* Floor, roof lining (a touch higher than the outside roof: nobody can compare),
          windscreen header and rear-view mirror. The lining self-lights a little so the
          green hemisphere ground light doesn't tint it olive. */}
      <Box p={[0, 0.805, -0.25]} s={[1.46, 0.01, 1.8]} c={C.trim} />
      <Box p={[0, 1.38, -0.25]} s={[1.46, 0.02, 1.7]} c={C.lining} glow={0.45} />
      <Box p={[0, 1.36, 0.57]} s={[1.46, 0.045, 0.14]} c={C.lining} glow={0.2} />
      <Box p={[0, 1.31, 0.53]} s={[0.02, 0.06, 0.02]} c={C.trim} />
      <Box p={[0, 1.26, 0.5]} s={[0.26, 0.07, 0.02]} c={C.glass} />
      {/* Pillars and door cards, both sides */}
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Box
            p={[0.71 * side, 1.08, 0.675]}
            s={[0.07, 0.6, 0.07]}
            c={C.lining}
            r={[-0.35, 0, 0]}
          />
          <Box p={[0.725 * side, 1.21, -0.45]} s={[0.04, 0.36, 0.07]} c={C.lining} />
          <Box p={[0.725 * side, 0.92, -0.25]} s={[0.03, 0.24, 1.75]} c={C.seat} />
          <Box p={[0.7 * side, 1.0, -0.25]} s={[0.06, 0.04, 0.5]} c={C.trim} />
        </group>
      ))}
      {/* Dash, binnacle and gauges */}
      <Box p={[0, 0.9, 0.42]} s={[1.46, 0.18, 0.4]} c={C.trim} />
      <Box p={[SEAT_X, 0.98, 0.26]} s={[0.4, 0.12, 0.16]} c={C.trim} />
      <Gauge x={SEAT_X + 0.075} needleRef={speedo} />
      <Gauge x={SEAT_X - 0.075} needleRef={tacho} />
      {/* Centre knobs, pace-note pad, console and gear lever */}
      {[-0.07, 0, 0.07].map((x, i) => (
        <Disc
          key={x}
          p={[x, 0.92, 0.215]}
          radius={0.018}
          depth={0.012}
          c={i === 1 ? C.paint : C.livery}
        />
      ))}
      <Box p={[-SEAT_X, 1.0, 0.3]} s={[0.22, 0.03, 0.15]} c={C.livery} />
      <Box p={[-SEAT_X, 1.016, 0.32]} s={[0.14, 0.004, 0.012]} c={C.trim} />
      <Box p={[-SEAT_X - 0.02, 1.016, 0.285]} s={[0.1, 0.004, 0.012]} c={C.trim} />
      <Box p={[0, 0.86, -0.05]} s={[0.26, 0.12, 0.5]} c={C.trim} />
      <mesh position={[0, 0.99, -0.02]}>
        <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
        <meshStandardMaterial color={C.trim} flatShading />
      </mesh>
      <Box p={[0, 1.07, -0.02]} s={[0.04, 0.04, 0.04]} c={C.livery} />
      {/* Steering wheel on its raked column */}
      <group position={[SEAT_X, 0.9, 0.08]} rotation={[0.35, 0, 0]}>
        <group ref={wheel}>
          <mesh>
            <torusGeometry args={[0.17, 0.016, 8, 24]} />
            <meshStandardMaterial color={C.tyre} flatShading />
          </mesh>
          <Box p={[0, -0.01, 0]} s={[0.31, 0.028, 0.02]} c={C.trim} />
          <Box p={[0, -0.0875, 0]} s={[0.028, 0.155, 0.02]} c={C.trim} />
          <Disc p={[0, 0, 0]} radius={0.045} depth={0.03} c={C.trim} />
          <Box p={[0, 0, -0.017]} s={[0.03, 0.03, 0.004]} c={C.paint} />
        </group>
        <mesh position={[0, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.22, 10]} />
          <meshStandardMaterial color={C.trim} flatShading />
        </mesh>
      </group>
      <Seat x={SEAT_X} />
      <Seat x={-SEAT_X} />
    </group>
  );
}
