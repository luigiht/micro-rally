'use client';

import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { Color, type Group } from 'three';
import type { CarId, CarSpec } from '@/game/vehicle/CarSpec';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import type { CameraMode } from '@/lib/cameraMode';
import { BuggyBody } from './bodies/BuggyBody';
import { CoupeBody } from './bodies/CoupeBody';
import { DakarTruckBody } from './bodies/DakarTruckBody';
import { FocusHatchBody } from './bodies/FocusHatchBody';
import { GroupBBody } from './bodies/GroupBBody';
import { HatchbackBody } from './bodies/HatchbackBody';
import { LeMansBody } from './bodies/LeMansBody';
import { NightcityBody } from './bodies/NightcityBody';
import { S1CoupeBody } from './bodies/S1CoupeBody';
import { SaloonBody } from './bodies/SaloonBody';
import { T16HatchBody } from './bodies/T16HatchBody';
import { Underglow } from './bodies/Underglow';
import { WrcHatchBody } from './bodies/WrcHatchBody';
import { NIGHTCITY_COLORS } from '@/render/car/NightcityHull';
import { CarInterior, type CarInteriorHandle } from './CarInterior';
import { Box, CAR_COLORS as C } from './CarParts';

export interface CarModelHandle {
  apply(pose: Readonly<VehiclePose>): void;
  /** Show the right parts for a camera: the interior view hides the roof and glass and shows the cabin fittings. */
  setView(mode: CameraMode): void;
}

/** Wheels can rise this far into their wells before the body bottoms out (matches the sim). */
const MAX_WHEEL_LIFT = 0.35;

/** Bodies that hang their own mud flaps (the buggy's hang from its spare carrier, inside the leaning body). */
const OWN_FLAPS: ReadonlySet<CarId> = new Set<CarId>(['buggy']);

/** Wheel rim colour per car; cream by default. */
const RIM: Partial<Record<CarId, string>> = {
  t16: '#f4f1ea',
  saloon: '#e9b949',
  wrc: '#f4f1ea',
  s1: '#f4f1ea',
  focus: '#f4f1ea',
  dakar: '#f0741f',
  lemans: '#4a4a52',
  buggy: '#b7b4ac',
};

interface WheelProps {
  x: number;
  z: number;
  radius: number;
  rim: string;
  /** A lit ring on the rim's outer face (Nightcity), HDR so it blooms. */
  ring?: Color;
  steerRef?: Ref<Group>;
  spinRef: Ref<Group>;
}

function Wheel({ x, z, radius, rim, ring, steerRef, spinRef }: WheelProps) {
  const out = x > 0 ? 1 : -1;
  // Tyre width scales with the wheel, so truck tyres are as fat as they are tall.
  const width = radius * 0.8;
  return (
    <group position={[x, radius, z]} ref={steerRef}>
      <group ref={spinRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[radius, radius, width, 12]} />
          <meshStandardMaterial color={C.tyre} flatShading />
        </mesh>
        <mesh position={[0.02 * out, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius * 0.6, radius * 0.6, width, 8]} />
          <meshStandardMaterial color={rim} flatShading metalness={0.3} roughness={0.5} />
        </mesh>
        <Box p={[0.15 * out, 0, 0]} s={[0.02, radius * 1.1, 0.08]} c={C.trim} />
        {ring && (
          <mesh position={[(width / 2 + 0.005) * out, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[radius * 0.62, 0.025, 6, 16]} />
            <meshBasicMaterial color={ring} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function BodyFor({
  spec,
  cabinRef,
  nightcity,
}: {
  spec: CarSpec;
  cabinRef: Ref<Group>;
  nightcity: boolean;
}) {
  if (nightcity) return <NightcityBody spec={spec} cabinRef={cabinRef} />;
  switch (spec.id) {
    case 'coupe':
      return <CoupeBody spec={spec} cabinRef={cabinRef} />;
    case 't16':
      return <T16HatchBody spec={spec} cabinRef={cabinRef} />;
    case 'saloon':
      return <SaloonBody spec={spec} cabinRef={cabinRef} />;
    case 'wrc':
      return <WrcHatchBody spec={spec} cabinRef={cabinRef} />;
    case 'groupb':
      return <GroupBBody spec={spec} cabinRef={cabinRef} />;
    case 's1':
      return <S1CoupeBody spec={spec} cabinRef={cabinRef} />;
    case 'focus':
      return <FocusHatchBody spec={spec} cabinRef={cabinRef} />;
    case 'dakar':
      return <DakarTruckBody spec={spec} cabinRef={cabinRef} />;
    case 'lemans':
      return <LeMansBody spec={spec} cabinRef={cabinRef} />;
    case 'buggy':
      return <BuggyBody spec={spec} cabinRef={cabinRef} />;
    default:
      return <HatchbackBody spec={spec} cabinRef={cabinRef} />;
  }
}

/**
 * Chassis, wheels, interior and the lofted body for `spec.id`. The body rides
 * on the springs; the wheels ride on the ground. `nightcity` draws the
 * cyberpunk body over the same chassis, with dark rims, lit rings and underglow.
 */
export function CarModel({
  spec,
  ref,
  nightcity = false,
}: {
  spec: CarSpec;
  ref: Ref<CarModelHandle>;
  nightcity?: boolean;
}) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const wheels = useRef<Group>(null);
  const cabin = useRef<Group>(null);
  const interior = useRef<CarInteriorHandle>(null);
  const steerFL = useRef<Group>(null);
  const steerFR = useRef<Group>(null);
  const spinFL = useRef<Group>(null);
  const spinFR = useRef<Group>(null);
  const spinRL = useRef<Group>(null);
  const spinRR = useRef<Group>(null);

  useImperativeHandle(ref, () => ({
    apply(pose) {
      const r = root.current;
      if (!r) return;
      r.position.set(pose.x, pose.y, pose.z);
      r.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
      if (body.current)
        body.current.rotation.z = Math.max(-0.07, Math.min(0.07, pose.latAccel * 0.008));
      // The root is the sprung body; the wheels stay on the ground as the springs compress.
      if (wheels.current)
        wheels.current.position.y = Math.max(
          0,
          Math.min(MAX_WHEEL_LIFT, pose.groundHeight - pose.y),
        );
      if (steerFL.current) steerFL.current.rotation.y = pose.steerAngle;
      if (steerFR.current) steerFR.current.rotation.y = pose.steerAngle;
      const spin = pose.wheelAngle;
      if (spinFL.current) spinFL.current.rotation.x = spin;
      if (spinFR.current) spinFR.current.rotation.x = spin;
      if (spinRL.current) spinRL.current.rotation.x = spin;
      if (spinRR.current) spinRR.current.rotation.x = spin;
      interior.current?.apply(pose);
    },
    setView(mode) {
      if (cabin.current) cabin.current.visible = mode !== 'interior';
      interior.current?.setVisible(mode === 'interior');
    },
  }));

  const half = spec.trackWidth / 2;
  const r = spec.wheelRadius;
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  const rim = nightcity ? NIGHTCITY_COLORS.rim : (RIM[spec.id] ?? C.rim);
  const ring = useMemo(
    () => (nightcity ? new Color(NIGHTCITY_COLORS.nose).multiplyScalar(2.5) : undefined),
    [nightcity],
  );
  return (
    <group ref={root}>
      <group ref={body} position={[0, 0.1, 0]}>
        <group position={[0, spec.cabinDrop, spec.cabinForward]}>
          <CarInterior ref={interior} spec={spec} nightcity={nightcity} />
        </group>
        <BodyFor spec={spec} cabinRef={cabin} nightcity={nightcity} />
      </group>
      {/* Mud flaps hang off the chassis, not the leaning body; sized to the wheel. Some day bodies hang their own. */}
      {(nightcity || !OWN_FLAPS.has(spec.id)) && (
        <>
          <Box p={[half, 0.75 * r, rear - 1.3 * r]} s={[0.9 * r, 0.8 * r, 0.03]} c={C.trim} />
          <Box p={[-half, 0.75 * r, rear - 1.3 * r]} s={[0.9 * r, 0.8 * r, 0.03]} c={C.trim} />
        </>
      )}
      <group ref={wheels}>
        <Wheel
          x={half}
          z={front}
          radius={r}
          rim={rim}
          ring={ring}
          steerRef={steerFL}
          spinRef={spinFL}
        />
        <Wheel
          x={-half}
          z={front}
          radius={r}
          rim={rim}
          ring={ring}
          steerRef={steerFR}
          spinRef={spinFR}
        />
        <Wheel x={half} z={rear} radius={r} rim={rim} ring={ring} spinRef={spinRL} />
        <Wheel x={-half} z={rear} radius={r} rim={rim} ring={ring} spinRef={spinRR} />
        {nightcity && <Underglow spec={spec} color={NIGHTCITY_COLORS.tail} />}
      </group>
    </group>
  );
}
