'use client';

import { Canvas } from '@react-three/fiber';
import { useMessages } from '@/i18n/useMessages';
import { DrivingScene } from './DrivingScene';

export function GameCanvas() {
  const m = useMessages();
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [0, 4, -70], fov: 60, near: 0.1, far: 500 }}
      aria-label={m.boot.canvasLabel}
      data-testid="game-canvas"
    >
      <DrivingScene />
    </Canvas>
  );
}
