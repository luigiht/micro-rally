'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Group, Mesh, MeshStandardMaterial } from 'three';

/**
 * Micro Rally car models. All three GLBs share the same baked conventions:
 *   - metres, origin on the ground under the centre of the car
 *   - nose points -Z, +X is the driver's right, +Y up
 *   - nodes: Body, WheelFrontLeft, WheelFrontRight, WheelRearLeft, WheelRearRight
 *     wheel geometry is centred on its hub and the node sits on the axle, so
 *     rotation.x spins the wheel and rotation.y steers it
 *   - one material per car with a 1024² colour texture
 */
export const CARS = {
  stratos: {
    name: 'Lancia Stratos HF Gr.4',
    model: '/models/micro-rally-stratos.glb',
    material: 'StratosPaint',
    wheelRadius: 0.288,
    wheelbase: 2.16,
    track: 1.5,
    length: 3.71,
    /** Driver's eye for the cockpit camera (left-hand drive). */
    eye: [-0.35, 0.95, -0.25] as const,
  },
  deltaS4: {
    name: 'Lancia Delta S4',
    model: '/models/micro-rally-delta-s4.glb',
    material: 'DeltaPaint',
    wheelRadius: 0.319,
    wheelbase: 2.58,
    track: 1.41,
    length: 4.0,
    eye: [-0.35, 1.05, -0.2] as const,
  },
  imprezaWrc: {
    name: 'Subaru Impreza WRC',
    model: '/models/micro-rally-impreza-wrc.glb',
    material: 'ImprezaPaint',
    wheelRadius: 0.339,
    wheelbase: 2.5,
    track: 1.5,
    length: 4.34,
    eye: [-0.37, 1.0, -0.15] as const,
  },
} as const;

export type CarId = keyof typeof CARS;

type RallyCarProps = {
  car: CarId;
  /** Steering angle in radians; positive turns the front wheels left. */
  steer?: number;
  /** Forward speed in m/s; negative when reversing. Drives wheel spin. */
  speed?: number;
  /** Body lean in radians (weight transfer); applied to the shell only. */
  bodyPitch?: number;
  bodyRoll?: number;
  castShadow?: boolean;
};

export function RallyCar({
  car,
  steer = 0,
  speed = 0,
  bodyPitch = 0,
  bodyRoll = 0,
  castShadow = true,
}: RallyCarProps) {
  const spec = CARS[car];
  const { scene, nodes, materials } = useGLTF(spec.model) as unknown as {
    scene: Group;
    nodes: Record<string, Mesh>;
    materials: Record<string, MeshStandardMaterial>;
  };

  const body = useRef<Group>(null);
  const fl = useRef<Mesh>(null);
  const fr = useRef<Mesh>(null);
  const rl = useRef<Mesh>(null);
  const rr = useRef<Mesh>(null);
  const spin = useRef(0);

  useEffect(() => {
    const paint = materials[spec.material];
    if (paint) {
      paint.flatShading = true;
      paint.needsUpdate = true;
    }
    scene.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = castShadow;
        m.receiveShadow = false;
      }
    });
  }, [scene, materials, spec.material, castShadow]);

  useFrame((_, dt) => {
    spin.current += (speed / spec.wheelRadius) * dt;
    // Forward (-Z) travel rolls the top of the wheel towards -Z: negative X rotation.
    for (const w of [rl, rr]) if (w.current) w.current.rotation.x = -spin.current;
    for (const w of [fl, fr]) {
      if (!w.current) continue;
      w.current.rotation.set(0, steer, 0);
      w.current.rotateX(-spin.current);
    }
    if (body.current) {
      body.current.rotation.x = bodyPitch;
      body.current.rotation.z = bodyRoll;
    }
  });

  return (
    <group name={`RallyCar:${car}`}>
      <group ref={body}>
        <primitive object={nodes.Body} />
      </group>
      <primitive ref={fl} object={nodes.WheelFrontLeft} />
      <primitive ref={fr} object={nodes.WheelFrontRight} />
      <primitive ref={rl} object={nodes.WheelRearLeft} />
      <primitive ref={rr} object={nodes.WheelRearRight} />
    </group>
  );
}

for (const c of Object.values(CARS)) useGLTF.preload(c.model);

/*
Vanilla three.js equivalent:

  const { scene } = await new GLTFLoader().loadAsync(CARS.imprezaWrc.model);
  const wheels = ['WheelFrontLeft','WheelFrontRight','WheelRearLeft','WheelRearRight']
    .map((n) => scene.getObjectByName(n));
  // per frame:
  wheels.forEach((w) => (w.rotation.x -= (speed / CARS.imprezaWrc.wheelRadius) * dt));
  wheels[0].rotation.y = wheels[1].rotation.y = steer;

Note: useGLTF caches the parsed scene, so <primitive> here mutates the shared
nodes. For several instances of the same car on screen at once (ghost car,
service park line-up) clone the scene with SkeletonUtils.clone / scene.clone()
instead of using the cached nodes directly.
*/
