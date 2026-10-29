'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { DirectionalLight, PerspectiveCamera } from 'three';
import { TEST_TRACK, testTrackTerrain } from '@/game/stage/TestTrack';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { CarModel, type CarModelHandle } from './CarModel';
import { DrivingSession } from './DrivingSession';
import { TestTrackView } from './TestTrackView';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const SHADOW_OFFSET = [8, 14, 6] as const;
const spec = CAR_SPECS.hatchback;

export function DrivingScene() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const reducedMotion = usePrefersReducedMotion();
  const reduced = useRef(reducedMotion);
  const session = useRef<DrivingSession | null>(null);
  const car = useRef<CarModelHandle>(null);
  const sun = useRef<DirectionalLight>(null);

  useEffect(() => {
    reduced.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    const s = new DrivingSession(spec, testTrackTerrain, TEST_TRACK.spawn, camera);
    s.attach(window, gl.domElement);
    session.current = s;
    return () => {
      s.dispose(window);
      session.current = null;
    };
  }, [camera, gl]);

  useFrame((state, dt) => {
    const s = session.current;
    if (!s) return;
    s.tick(dt, reduced.current, state.gl.info.render);
    const pose = s.pose;
    car.current?.apply(pose);
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
      <color attach="background" args={['#cfe3e8']} />
      <fog attach="fog" args={['#cfe3e8', 70, 220]} />
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
      <TestTrackView />
      <CarModel ref={car} spec={spec} />
    </>
  );
}
