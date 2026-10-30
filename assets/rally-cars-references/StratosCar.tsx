'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Group, Mesh, MeshStandardMaterial } from 'three';

/**
 * Low-poly Lancia Stratos for Micro Rally.
 *
 * micro-rally-stratos.glb conventions (baked into the file):
 *   - metres: 3.71 m long, 1.83 m wide, 1.14 m tall, wheelbase 2.16 m
 *   - origin on the ground, under the centre of the car
 *   - nose points -Z, +X is the driver's right, +Y up
 *   - nodes: Body, WheelFrontLeft, WheelFrontRight, WheelRearLeft, WheelRearRight
 *     each wheel's geometry is centred on its own axle, so rotating the node
 *     about X spins it and about Y steers it
 *   - one material "StratosPaint" with a 1024² colour texture
 */

export const STRATOS_MODEL = '/models/micro-rally-stratos.glb';
export const STRATOS_WHEEL_RADIUS = 0.288;

type StratosCarProps = {
  /** Steering angle in radians; positive turns the front wheels left. */
  steer?: number;
  /** Forward speed in m/s; negative when reversing. Drives wheel spin. */
  speed?: number;
  /** Lowers the body on its wheels under braking/weight transfer (metres). */
  bodyPitch?: number;
  bodyRoll?: number;
  castShadow?: boolean;
};

export function StratosCar({
  steer = 0,
  speed = 0,
  bodyPitch = 0,
  bodyRoll = 0,
  castShadow = true,
}: StratosCarProps) {
  const { scene, nodes, materials } = useGLTF(STRATOS_MODEL) as unknown as {
    scene: Group;
    nodes: Record<string, Mesh | Group>;
    materials: Record<string, MeshStandardMaterial>;
  };

  const body = useRef<Group>(null);
  const fl = useRef<Mesh>(null);
  const fr = useRef<Mesh>(null);
  const rl = useRef<Mesh>(null);
  const rr = useRef<Mesh>(null);
  const spin = useRef(0);

  // Flat shading suits the faceted look; shadows per the quality tier.
  useEffect(() => {
    const paint = materials.StratosPaint;
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
  }, [scene, materials, castShadow]);

  useFrame((_, dt) => {
    spin.current += (speed / STRATOS_WHEEL_RADIUS) * dt;
    // Rolling: wheel axle is X; a positive forward speed (-Z) rolls the top
    // of the wheel towards -Z, which is a negative rotation about +X.
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

  // The wheel nodes already sit on their axles (translation baked into the
  // GLB) with geometry centred on the hub, so we rotate them directly.
  return (
    <group name="StratosCar">
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

useGLTF.preload(STRATOS_MODEL);

/*
Vanilla three.js equivalent:

  const { scene } = await new GLTFLoader().loadAsync('/models/micro-rally-stratos.glb');
  const wheels = ['WheelFrontLeft','WheelFrontRight','WheelRearLeft','WheelRearRight']
    .map((n) => scene.getObjectByName(n));
  // per frame:
  wheels.forEach((w) => (w.rotation.x -= (speed / 0.288) * dt));
  wheels[0].rotation.y = wheels[1].rotation.y = steer;
*/
