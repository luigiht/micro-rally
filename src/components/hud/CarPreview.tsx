'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { CarModel, type CarModelHandle } from '@/components/game/CarModel';
import { usePrefersReducedMotion } from '@/components/game/usePrefersReducedMotion';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import { createVehiclePose } from '@/game/vehicle/interpolatePose';

/** The car at rest at the origin. */
const REST = createVehiclePose();
const SPIN_RATE = 0.55;
/** Aim at the car's mid-height so it sits in the vertical centre of the frame, not on the bottom edge. */
const LOOK_AT_HEIGHT = 0.7;

function Turntable({ spec, spin }: { spec: CarSpec; spin: boolean }) {
  const group = useRef<Group>(null);
  const car = useRef<CarModelHandle>(null);
  useFrame((_, dt) => {
    car.current?.apply(REST);
    if (spin && group.current) group.current.rotation.y += Math.min(dt, 0.05) * SPIN_RATE;
  });
  return (
    <group ref={group} rotation={[0, 0.7, 0]}>
      <CarModel ref={car} spec={spec} />
    </group>
  );
}

/**
 * Showroom turntable for the dealership: the car slowly spins (still under
 * reduced motion). The camera stands back in proportion to the vehicle's
 * `bodyScale`, so the truck is framed like the cars; the canvas is keyed by
 * car because the camera is set at creation.
 */
export function CarPreview({ spec }: { spec: CarSpec }) {
  const reduced = usePrefersReducedMotion();
  const s = spec.bodyScale;
  return (
    <div className="aspect-video w-full bg-[#d9e4e8]" data-testid="car-preview">
      <Canvas
        key={spec.id}
        dpr={[1, 1.5]}
        camera={{ position: [3.8 * s, 1.8 * s, 4.75 * s], fov: 32, near: 0.1, far: 60 * s }}
        onCreated={({ camera }) => camera.lookAt(0, LOOK_AT_HEIGHT * s, 0)}
        role="presentation"
      >
        <hemisphereLight args={['#fff6e0', '#7fa05f', 1.6]} />
        <directionalLight position={[4, 6, 3]} intensity={2.2} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
          <circleGeometry args={[3.2 * s, 40]} />
          <meshStandardMaterial color="#b9c7a1" flatShading />
        </mesh>
        <Turntable key={spec.id} spec={spec} spin={!reduced} />
      </Canvas>
    </div>
  );
}
