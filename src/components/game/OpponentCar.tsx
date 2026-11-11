'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { Group } from 'three';
import type { CatalogCarId } from '@/game/economy/cars';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { createVehiclePose, type VehiclePose } from '@/game/vehicle/interpolatePose';
import { OpponentDecor, TAG_FONT } from '@/render/car/OpponentDecor';
import { getLiveRelay } from '@/state/opponentStore';
import { useUiStore } from '@/state/uiStore';
import { CarModel, type CarModelHandle } from './CarModel';

/** The name tag floats this far above the car's body. */
const TAG_LIFT = 2.2;
/** Closer than FADE_FAR metres to this driver's car or the camera, the other car fades, down to MIN_OPACITY at FADE_NEAR. */
const FADE_NEAR = 2;
const FADE_FAR = 7;
const MIN_OPACITY = 0.3;

interface OpponentCarProps {
  carId: CatalogCarId;
  name: string;
  /** This driver's car, to fade the other one out of the way when they overlap. */
  self: RefObject<Readonly<VehiclePose> | null>;
}

/**
 * The other driver's car, played back from the live relay's ghost track a
 * moment behind real time, with their name floating above it. It passes
 * through this driver's car (the two never collide) and fades when close,
 * so it never blocks the view. Hidden while the other driver isn't on this
 * stage and during this driver's replay. No lamps: their spotlights would
 * recompile every material each time the car appeared or left.
 */
export function OpponentCar({ carId, name, self }: OpponentCarProps) {
  const spec = CAR_SPECS[carId];
  const scene = useThree((s) => s.scene);
  const root = useRef<Group>(null);
  const car = useRef<CarModelHandle>(null);
  const decor = useRef<OpponentDecor | null>(null);
  const pose = useMemo(() => createVehiclePose(), []);

  useEffect(() => {
    const d = new OpponentDecor();
    scene.add(d.tag);
    decor.current = d;
    return () => {
      d.dispose();
      decor.current = null;
    };
  }, [scene]);

  // Paint now, and again once the pixel font has loaded if it hadn't yet.
  useEffect(() => {
    let live = true;
    decor.current?.paint(name);
    document.fonts
      .load(`24px ${TAG_FONT}`)
      .then(() => {
        if (live) decor.current?.paint(name);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [name, scene]);

  useEffect(() => {
    if (root.current) decor.current?.adopt(root.current);
    car.current?.setView('chase');
  }, [spec, scene]);

  useFrame((state, dt) => {
    const group = root.current;
    const d = decor.current;
    if (!group || !d) return;
    const relay = getLiveRelay();
    relay.ghost.advance(dt);
    const shown =
      relay.present &&
      !useUiStore.getState().replay &&
      relay.ghost.sample(pose, dt, spec.wheelRadius);
    group.visible = shown;
    d.place(shown, pose.x, pose.y + TAG_LIFT, pose.z);
    if (!shown) return;

    car.current?.apply(pose);
    const cam = state.camera.position;
    let near = Math.hypot(cam.x - pose.x, cam.y - pose.y, cam.z - pose.z);
    const me = self.current;
    if (me) near = Math.min(near, Math.hypot(me.x - pose.x, me.z - pose.z));
    const k = Math.min(1, Math.max(0, (near - FADE_NEAR) / (FADE_FAR - FADE_NEAR)));
    d.fade(MIN_OPACITY + (1 - MIN_OPACITY) * k);
  });

  return (
    <group ref={root} visible={false}>
      <CarModel ref={car} spec={spec} />
    </group>
  );
}
