'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import type { DirectionalLight, PerspectiveCamera } from 'three';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { CarModel, type CarModelHandle } from './CarModel';
import { DrivingSession, type DriveWorld } from './DrivingSession';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const SHADOW_OFFSET = [8, 14, 6] as const;
const spec = CAR_SPECS.hatchback;

interface DriveRigProps {
  world: DriveWorld;
  sky: string;
  fog: string;
  /** Called every frame with the interpolated car pose (e.g. to stream chunks). */
  onPose?: (pose: Readonly<VehiclePose>) => void;
  children?: ReactNode;
}

/** Car, lights and the driving session for any world. */
export function DriveRig({ world, sky, fog, onPose, children }: DriveRigProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const reducedMotion = usePrefersReducedMotion();
  const reduced = useRef(reducedMotion);
  const poseCallback = useRef(onPose);
  const session = useRef<DrivingSession | null>(null);
  const car = useRef<CarModelHandle>(null);
  const sun = useRef<DirectionalLight>(null);

  useEffect(() => {
    reduced.current = reducedMotion;
    poseCallback.current = onPose;
  }, [reducedMotion, onPose]);

  useEffect(() => {
    const s = new DrivingSession(spec, world, camera);
    s.attach(window, gl.domElement);
    session.current = s;
    return () => {
      s.dispose(window);
      session.current = null;
    };
  }, [world, camera, gl]);

  useFrame((state, dt) => {
    const s = session.current;
    if (!s) return;
    s.tick(dt, reduced.current, state.gl.info.render);
    const pose = s.pose;
    car.current?.apply(pose);
    poseCallback.current?.(pose);
    const light = sun.current;
    if (light) {
      light.position.set(
        pose.x + SHADOW_OFFSET[0],
        pose.y + SHADOW_OFFSET[1],
        pose.z + SHADOW_OFFSET[2],
      );
      light.target.position.set(pose.x, pose.y, pose.z);
      light.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[fog, 70, 260]} />
      <hemisphereLight args={['#fff6e0', '#7fa05f', 1.9]} />
      <directionalLight
        ref={sun}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0005}
      />
      {children}
      <CarModel ref={car} spec={spec} />
    </>
  );
}
