'use client';

import { Canvas } from '@react-three/fiber';
import { DemoDrive } from '@/components/game/DemoDrive';
import { usePrefersReducedMotion } from '@/components/game/usePrefersReducedMotion';

/** Decorative attract-mode drive behind the splash card. Parked under reduced motion. */
export function SplashScene() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="absolute inset-0" aria-hidden="true" data-testid="splash-scene">
      <Canvas
        shadows="percentage"
        dpr={[1, 1.5]}
        camera={{ position: [0, 4, -70], fov: 60, near: 0.1, far: 500 }}
        role="presentation"
      >
        <DemoDrive paused={reduced} />
      </Canvas>
    </div>
  );
}
