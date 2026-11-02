'use client';

import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Nightcity's one post-processing pass: bloom over everything brighter than
 * one (the neon, which is baked HDR) and the ACES tone mapping the renderer
 * applies by itself the rest of the time, since the composer turns that off
 * while it is mounted. Only mounted while the mode is on, so the daytime game
 * pays nothing; a quality tier can drop `bloom` later in one line.
 */
export function NightcityEffects({ bloom = true }: { bloom?: boolean }) {
  return (
    <EffectComposer multisampling={4}>
      {bloom ? (
        <Bloom
          mipmapBlur
          luminanceThreshold={1}
          luminanceSmoothing={0.05}
          intensity={1.1}
          radius={0.7}
          levels={6}
        />
      ) : (
        <></>
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
