'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DirectionalLight, Group, PerspectiveCamera } from 'three';
import { CATALOG_IDS } from '@/game/economy/cars';
import { REGIONS } from '@/game/stage/regions';
import { RoadFollower } from '@/game/stage/RoadFollower';
import { createStageWorld } from '@/game/stage/StageWorld';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { StageRenderer } from '@/render/stage/StageRenderer';
import { dayTheme } from '@/render/theme/WorldTheme';
import type { CameraRigFrame } from './cameras/CameraRig';
import { ChaseCameraRig } from './cameras/ChaseCameraRig';
import { CarModel, type CarModelHandle } from './CarModel';
import { followSun, SceneLights } from './SceneLights';

/** Cap the step so a background tab coming back doesn't teleport the car. */
const MAX_STEP = 0.05;
/** On wide screens the view slides right so the car drives beside the centred card, not under it. */
const WIDE_ASPECT = 1.3;
const VIEW_SHIFT = 0.3;

function randomSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]!;
}

/** A fresh stage and a car from the dealership, drawn together for each lap. */
interface Draw {
  seed: number;
  carId: (typeof CATALOG_IDS)[number];
}

function randomDraw(): Draw {
  return { seed: randomSeed(), carId: CATALOG_IDS[randomSeed() % CATALOG_IDS.length]! };
}

/** Everything mutable that lives for one generated world. */
interface Lap {
  follower: RoadFollower;
  rig: ChaseCameraRig;
  renderer: StageRenderer;
  frame: CameraRigFrame;
  snapped: boolean;
}

/**
 * Attract-mode drive behind the splash: a fresh stage and a random dealership
 * car, following the road by itself under the chase camera. Each lap draws
 * both again. `paused` (reduced motion) parks the car and holds the camera still.
 */
export function DemoDrive({ paused }: { paused: boolean }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const [draw, setDraw] = useState(randomDraw);
  const spec = CAR_SPECS[draw.carId];
  const world = useMemo(() => createStageWorld(draw.seed, 0), [draw.seed]);
  const group = useRef<Group>(null);
  const car = useRef<CarModelHandle>(null);
  const sun = useRef<DirectionalLight>(null);
  const lap = useRef<Lap | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const { width, height } = size;
    if (width / height >= WIDE_ASPECT) {
      camera.setViewOffset(width, height, width * VIEW_SHIFT, 0, width, height);
    } else {
      camera.clearViewOffset();
    }
    return () => camera.clearViewOffset();
  }, [camera, size]);

  useEffect(() => {
    const follower = new RoadFollower(world.stage, world.field, spec);
    const renderer = new StageRenderer(world);
    group.current?.add(renderer.group);
    lap.current = {
      follower,
      rig: new ChaseCameraRig(world.field, spec.bodyScale),
      renderer,
      frame: { camera, target: follower.pose, dt: 0, reducedMotion: false },
      snapped: false,
    };
    return () => {
      renderer.dispose();
      lap.current = null;
    };
  }, [world, camera, spec]);

  useFrame((_, dt) => {
    const l = lap.current;
    if (!l) return;
    const step = Math.min(dt, MAX_STEP);
    if (!pausedRef.current && l.follower.advance(step)) {
      setDraw(randomDraw());
      return;
    }
    const pose = l.follower.pose;
    car.current?.apply(pose);
    l.renderer.update(pose.x, pose.z);
    if (sun.current) followSun(sun.current, pose, camera);
    l.frame.dt = step;
    l.frame.reducedMotion = pausedRef.current;
    if (l.snapped) {
      l.rig.update(l.frame);
    } else {
      l.rig.snap(l.frame);
      l.snapped = true;
    }
  });

  return (
    <>
      <SceneLights lighting={dayTheme(REGIONS[world.stage.region]).lighting} sunRef={sun} />
      <group ref={group} />
      <CarModel key={spec.id} ref={car} spec={spec} />
    </>
  );
}
