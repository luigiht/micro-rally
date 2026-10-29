'use client';

import { useImperativeHandle, useRef, type Ref } from 'react';
import type { Group } from 'three';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import type { CarSpec } from '@/game/vehicle/CarSpec';

export interface CarModelHandle {
  apply(pose: Readonly<VehiclePose>): void;
}

interface WheelProps {
  x: number;
  z: number;
  radius: number;
  steerRef?: Ref<Group>;
  spinRef: Ref<Group>;
}

function Wheel({ x, z, radius, steerRef, spinRef }: WheelProps) {
  return (
    <group position={[x, radius, z]} ref={steerRef}>
      <group ref={spinRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[radius, radius, 0.26, 10]} />
          <meshStandardMaterial color="#2b2a33" flatShading />
        </mesh>
        <mesh position={[x > 0 ? 0.14 : -0.14, 0, 0]}>
          <boxGeometry args={[0.03, radius * 0.9, radius * 0.35]} />
          <meshStandardMaterial color="#d9d4c7" flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** Placeholder chunky hatchback; replaced by procedural per-car models in milestone 5. */
export function CarModel({ spec, ref }: { spec: CarSpec; ref: Ref<CarModelHandle> }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
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
    },
  }));

  const half = spec.trackWidth / 2;
  const r = spec.wheelRadius;
  return (
    <group ref={root}>
      <group ref={body} position={[0, 0.1, 0]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[1.7, 0.55, 3.7]} />
          <meshStandardMaterial color="#e8623a" flatShading />
        </mesh>
        <mesh position={[0, 1.05, -0.25]} castShadow>
          <boxGeometry args={[1.45, 0.5, 1.9]} />
          <meshStandardMaterial color="#f4ecd8" flatShading />
        </mesh>
        <mesh position={[0, 1.05, 0.72]}>
          <boxGeometry args={[1.3, 0.4, 0.05]} />
          <meshStandardMaterial color="#5a7d9a" flatShading roughness={0.2} />
        </mesh>
        {[-0.55, 0.55].map((x) => (
          <mesh key={x} position={[x, 0.6, 1.86]}>
            <boxGeometry args={[0.3, 0.16, 0.04]} />
            <meshStandardMaterial color="#fff6d0" emissive="#fff2b0" emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>
      <Wheel x={half} z={spec.cgToFront} radius={r} steerRef={steerFL} spinRef={spinFL} />
      <Wheel x={-half} z={spec.cgToFront} radius={r} steerRef={steerFR} spinRef={spinFR} />
      <Wheel x={half} z={-spec.cgToRear} radius={r} spinRef={spinRL} />
      <Wheel x={-half} z={-spec.cgToRear} radius={r} spinRef={spinRR} />
    </group>
  );
}
