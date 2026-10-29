'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import { useMessages } from '@/i18n/useMessages';

function SpinningCar() {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.6;
  });
  return (
    <mesh ref={ref} position={[0, 0.5, 0]} castShadow>
      <boxGeometry args={[1.6, 0.6, 3]} />
      <meshStandardMaterial color="#e8623a" flatShading />
    </mesh>
  );
}

export function GameCanvas() {
  const m = useMessages();
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [5, 4, 6], fov: 45 }}
      aria-label={m.boot.canvasLabel}
      data-testid="game-canvas"
    >
      <color attach="background" args={['#cfe3e8']} />
      <hemisphereLight args={['#fff6e0', '#5d8a4a', 0.8]} />
      <directionalLight position={[6, 10, 4]} intensity={1.6} castShadow />
      <SpinningCar />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#8fbf6a" />
      </mesh>
    </Canvas>
  );
}
