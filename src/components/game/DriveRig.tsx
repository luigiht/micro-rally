'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { DirectionalLight, PerspectiveCamera } from 'three';
import { applyUpgrades } from '@/game/economy/upgrades';
import { CAR_SPECS, type CarSpec } from '@/game/vehicle/CarSpec';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { createWheelContacts, wheelContacts } from '@/game/vehicle/wheelContacts';
import type { CameraMode } from '@/lib/cameraMode';
import { SkidMarks } from '@/render/effects/SkidMarks';
import { useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { CarModel, type CarModelHandle } from './CarModel';
import { DrivingSession, type DriveWorld } from './DrivingSession';
import { followSun, SceneLights } from './SceneLights';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** The active car with its purchased upgrades, as the store has it right now. */
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
  const scene = useThree((s) => s.scene);
  const carId = useGameStore((s) => s.carId);
  const skidMarks = useSettingsStore((s) => s.skidMarks);
  const upgrades = useGameStore((s) => s.upgrades);
  const spec = useMemo(() => applyUpgrades(CAR_SPECS[carId], upgrades), [carId, upgrades]);
  const reducedMotion = usePrefersReducedMotion();
  const reduced = useRef(reducedMotion);
  const poseCallback = useRef(onPose);
  const session = useRef<DrivingSession | null>(null);
  const car = useRef<CarModelHandle>(null);
  const sun = useRef<DirectionalLight>(null);
  const view = useRef<CameraMode | null>(null);
  const marks = useRef<SkidMarks | null>(null);
  const contacts = useMemo(() => createWheelContacts(), []);

  useEffect(() => {
    reduced.current = reducedMotion;
    poseCallback.current = onPose;
  }, [reducedMotion, onPose]);

  useEffect(() => {
    const s = new DrivingSession(resolveActiveSpec(), world, camera);
    s.attach(window, gl.domElement);
    session.current = s;
    return () => {
      s.dispose(window);
      session.current = null;
    };
  }, [world, camera, gl]);

  // Tyre marks are a toggleable extra; the mesh lives in the scene, not the React tree.
  useEffect(() => {
    if (!skidMarks) return;
    const m = new SkidMarks();
    scene.add(m.mesh);
    marks.current = m;
    return () => {
      m.dispose();
      marks.current = null;
    };
  }, [skidMarks, scene, world]);

  // Garage changes land immediately: retune the live sim and, if the cabin height
  // differs, rebuild the first-person rig around the new eye.
  useEffect(() => {
    session.current?.setSpec(spec);
  }, [spec]);

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
    const m = marks.current;
    if (m) {
      wheelContacts(contacts, pose, s.sim.state, s.sim.spec, world.terrain);
      m.update(contacts, s.sim.state.surface, s.time, dt);
    }
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
