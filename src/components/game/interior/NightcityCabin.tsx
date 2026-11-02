'use client';

import { DoubleSide } from 'three';
import { NEON } from '@/render/theme/WorldTheme';
import { Box } from '../CarParts';
import { EYE, type InteriorSpec } from './interiorSpecs';

/** Light lines are HDR so the bloom pass lifts them; `SOFT` stays just under the threshold. */
const GLOW = 2.4;
const SOFT = 1.5;
/** Under the bloom threshold: a wash, not a lamp. */
const WASH = 0.9;

/**
 * What Nightcity adds to the cabin over the recoloured kit: a cyan line along
 * the dash lip, magenta belt lines down both door cards, violet strips along
 * the roof edges and a header rule, a footwell wash under the dash, and a
 * translucent heads-up display floating over the binnacle at eye level with
 * a few lit data bars. Sized from the car's envelope, in the interior frame.
 */
export function NightcityCabin({ spec }: { spec: InteriorSpec }) {
  const { halfWidth: hw, roofY, floorY, dashTopY, cowlZ, dashDepth, screenTopZ, rearZ } = spec;
  const beltY = dashTopY - 0.06;
  const face = cowlZ - dashDepth;
  return (
    <group>
      <Box
        p={[0, dashTopY + 0.003, face + 0.012]}
        s={[hw * 2 - 0.08, 0.006, 0.01]}
        c={NEON.cyan}
        glow={GLOW}
      />
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Box
            p={[(hw - 0.012) * side, beltY + 0.012, (cowlZ + rearZ) / 2]}
            s={[0.008, 0.008, cowlZ - rearZ - 0.12]}
            c={NEON.magenta}
            glow={GLOW}
          />
          <Box
            p={[(hw - 0.07) * side, roofY - 0.008, (screenTopZ + rearZ) / 2]}
            s={[0.012, 0.006, screenTopZ - rearZ - 0.1]}
            c={NEON.violet}
            glow={SOFT}
          />
        </group>
      ))}
      <Box
        p={[0, roofY - 0.045, screenTopZ + 0.1]}
        s={[hw * 2 - 0.2, 0.006, 0.006]}
        c={NEON.cyan}
        glow={SOFT}
      />
      <Box
        p={[EYE.x, floorY + 0.012, face - 0.1]}
        s={[0.5, 0.006, 0.08]}
        c={NEON.magenta}
        glow={WASH}
      />
      {/* Heads-up display: a faint cyan pane with lit rules and data bars, tilted back toward the driver */}
      <group position={[EYE.x, EYE.y - 0.03, cowlZ - 0.06]} rotation={[-0.3, 0, 0]}>
        <mesh>
          <planeGeometry args={[0.36, 0.11]} />
          <meshBasicMaterial
            color={NEON.cyan}
            transparent
            opacity={0.1}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
        <Box p={[0, 0.055, 0]} s={[0.36, 0.004, 0.004]} c={NEON.cyan} glow={GLOW} />
        <Box p={[0, -0.055, 0]} s={[0.36, 0.004, 0.004]} c={NEON.cyan} glow={GLOW} />
        {[-0.12, -0.04, 0.04, 0.12].map((x, i) => (
          <Box
            key={x}
            p={[x, -0.02 + i * 0.012, 0.002]}
            s={[0.05, 0.006, 0.002]}
            c={i % 2 ? NEON.magenta : NEON.cyan}
            glow={SOFT}
          />
        ))}
      </group>
    </group>
  );
}
