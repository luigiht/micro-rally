'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DirectionalLight, PerspectiveCamera } from 'three';
import { applyUpgrades } from '@/game/economy/upgrades';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import type { CameraMode } from '@/lib/cameraMode';
import { useGameStore } from '@/state/gameStore';
import { CarModel, type CarModelHandle } from './CarModel';
import { DrivingSession, type DriveWorld } from './DrivingSession';
import { followSun, SceneLights } from './SceneLights';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** The active car with its purchased upgrades, frozen for this run (garage changes apply on the next one). */
function resolveActiveSpec(): CarSpec {
  const { carId, upgrades } = useGameStore.getState();
  return applyUpgrades(CAR_SPECS[carId], upgrades);
}

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
  const [spec] = useState(resolveActiveSpec);
  const reducedMotion = usePrefersReducedMotion();
  const reduced = useRef(reducedMotion);
  const poseCallback = useRef(onPose);
  const session = useRef<DrivingSession | null>(null);
  const car = useRef<CarModelHandle>(null);
  const sun = useRef<DirectionalLight>(null);
  const view = useRef<CameraMode | null>(null);

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
  }, [spec, world, camera, gl]);

  useFrame((state, dt) => {
    const s = session.current;
    if (!s) return;
    s.tick(dt, reduced.current, state.gl.info.render);
    if (s.cameraMode !== view.current) {
      view.current = s.cameraMode;
      car.current?.setView(s.cameraMode);
    }
    const pose = s.pose;
    car.current?.apply(pose);
    poseCallback.current?.(pose);
    if (sun.current) followSun(sun.current, pose);
  });

  return (
    <>
      <SceneLights sky={sky} fog={fog} sunRef={sun} />
      {children}
      <CarModel ref={car} spec={spec} />
    </>
  );
}
