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

/** Showroom turntable for the dealership: the car slowly spins (still under reduced motion). */
export function CarPreview({ spec }: { spec: CarSpec }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="aspect-video w-full bg-[#d9e4e8]" data-testid="car-preview">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [3.4, 1.5, 4.2], fov: 32, near: 0.1, far: 60 }}
        role="presentation"
      >
        <hemisphereLight args={['#fff6e0', '#7fa05f', 1.6]} />
        <directionalLight position={[4, 6, 3]} intensity={2.2} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
          <circleGeometry args={[3.2, 40]} />
          <meshStandardMaterial color="#b9c7a1" flatShading />
        </mesh>
        <Turntable key={spec.id} spec={spec} spin={!reduced} />
      </Canvas>
    </div>
  );
}
