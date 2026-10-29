'use client';

import { useImperativeHandle, useRef, type Ref } from 'react';
import type { Group } from 'three';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import type { CameraMode } from '@/lib/cameraMode';
import { CoupeBody } from './bodies/CoupeBody';
import { HatchbackBody } from './bodies/HatchbackBody';
import { CarInterior, type CarInteriorHandle } from './CarInterior';
import { Box, CAR_COLORS as C } from './CarParts';

export interface CarModelHandle {
  apply(pose: Readonly<VehiclePose>): void;
  /** Show the right parts for a camera: cab and interior views hide the roof and glass; interior shows the cabin fittings. */
  setView(mode: CameraMode): void;
}

interface WheelProps {
  x: number;
  z: number;
  radius: number;
  steerRef?: Ref<Group>;
  spinRef: Ref<Group>;
}

function Wheel({ x, z, radius, steerRef, spinRef }: WheelProps) {
  const out = x > 0 ? 1 : -1;
  return (
    <group position={[x, radius, z]} ref={steerRef}>
      <group ref={spinRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[radius, radius, 0.26, 12]} />
          <meshStandardMaterial color={C.tyre} flatShading />
        </mesh>
        <mesh position={[0.02 * out, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius * 0.6, radius * 0.6, 0.26, 8]} />
          <meshStandardMaterial color={C.rim} flatShading metalness={0.3} roughness={0.5} />
        </mesh>
        <Box p={[0.15 * out, 0, 0]} s={[0.02, radius * 1.1, 0.08]} c={C.trim} />
      </group>
    </group>
  );
}

/** Chassis, wheels, interior and the body for `spec.id`, all built from primitives. */
export function CarModel({ spec, ref }: { spec: CarSpec; ref: Ref<CarModelHandle> }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
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
      if (cabin.current) cabin.current.visible = mode !== 'cockpit' && mode !== 'interior';
      interior.current?.setVisible(mode === 'interior');
    },
  }));

  const half = spec.trackWidth / 2;
  const r = spec.wheelRadius;
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group ref={root}>
      <group ref={body} position={[0, 0.1, 0]}>
        <group position={[0, spec.cabinDrop, 0]}>
          <CarInterior ref={interior} redlineRpm={spec.redlineRpm} />
        </group>
        {spec.id === 'coupe' ? (
          <CoupeBody spec={spec} cabinRef={cabin} />
        ) : (
          <HatchbackBody spec={spec} cabinRef={cabin} />
        )}
      </group>
      {/* Mud flaps hang off the chassis, not the leaning body. */}
      <Box p={[half, 0.24, rear - 0.42]} s={[0.3, 0.26, 0.03]} c={C.trim} />
      <Box p={[-half, 0.24, rear - 0.42]} s={[0.3, 0.26, 0.03]} c={C.trim} />
      <Wheel x={half} z={front} radius={r} steerRef={steerFL} spinRef={spinFL} />
      <Wheel x={-half} z={front} radius={r} steerRef={steerFR} spinRef={spinFR} />
      <Wheel x={half} z={rear} radius={r} spinRef={spinRL} />
      <Wheel x={-half} z={rear} radius={r} spinRef={spinRR} />
    </group>
  );
}
