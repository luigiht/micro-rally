'use client';

import { Box, Disc, type V3 } from '../CarParts';
import { Dial, hoodWidth } from './InteriorDash';
import { EYE, type InteriorSpec } from './interiorSpecs';

const CHROME = '#d9d4c7';
const PANEL = '#15141a';
/** Unlit red warning-lamp lens. */
const RED_LENS = '#8a2a2a';

/** Chrome toggle switches standing on a dark strip, facing the driver (−z). */
function ToggleRow({ p, count, pitch = 0.06 }: { p: V3; count: number; pitch?: number }) {
  return (
    <group position={p}>
      <Box p={[0, 0, 0]} s={[(count - 1) * pitch + 0.1, 0.04, 0.008]} c={PANEL} />
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i}
          p={[(i - (count - 1) / 2) * pitch, i % 2 ? 0.006 : -0.006, -0.01]}
          s={[0.01, 0.028, 0.014]}
          c={CHROME}
        />
      ))}
    </group>
  );
}

/** Centre console inboard of the binnacle: three rows of controls on its face, a GPS repeater, knobs and the round gauge pod on top. */
function CentreConsole({ spec }: { spec: InteriorSpec }) {
  const { dash, dashTopY: d, cowlZ, palette: p } = spec;
  const cx = EYE.x - hoodWidth(dash) / 2 - 0.29;
  const rear = cowlZ - 0.23;
  const mid = (rear + cowlZ) / 2;
  const top = d + 0.11;
  const podX = cx + 0.12;
  return (
    <group>
      <Box p={[cx, (d + top) / 2, mid]} s={[0.45, top - d, cowlZ - rear]} c={p.dash} />
      <ToggleRow p={[cx, top - 0.025, rear - 0.004]} count={6} />
      {/* Push buttons and a rotary knob */}
      <Box p={[cx, top - 0.062, rear - 0.004]} s={[0.4, 0.03, 0.008]} c={PANEL} />
      {['#d9343a', CHROME, p.accent, CHROME, '#3fbf5a'].map((c, i) => (
        <Box
          key={i}
          p={[cx - 0.14 + i * 0.05, top - 0.062, rear - 0.012]}
          s={[0.026, 0.02, 0.01]}
          c={c}
        />
      ))}
      <Disc p={[cx + 0.16, top - 0.062, rear - 0.012]} radius={0.014} depth={0.012} c={CHROME} />
      {/* Two small gauges, a rocker pair and a lamp along the bottom, all clear of the dash top */}
      <Dial p={[cx - 0.12, top - 0.092, rear - 0.002]} radius={0.016} />
      <Dial p={[cx - 0.06, top - 0.092, rear - 0.002]} radius={0.016} />
      {[0.03, 0.08].map((dx) => (
        <Box
          key={dx}
          p={[cx + dx, top - 0.092, rear - 0.008]}
          s={[0.03, 0.016, 0.012]}
          c={CHROME}
        />
      ))}
      <Box p={[cx + 0.15, top - 0.092, rear - 0.008]} s={[0.02, 0.014, 0.012]} c={RED_LENS} />
      {/* Top: GPS repeater, two knobs, gauge pod on a stalk */}
      <Box p={[cx - 0.06, top + 0.006, mid]} s={[0.2, 0.012, 0.14]} c={PANEL} />
      <Box
        p={[cx - 0.06, top + 0.013, mid + 0.01]}
        s={[0.17, 0.002, 0.09]}
        c="#4d6f8c"
        glow={0.5}
      />
      {[-0.19, 0.2].map((dx) => (
        <Box key={dx} p={[cx + dx, top + 0.012, mid]} s={[0.03, 0.024, 0.03]} c={CHROME} />
      ))}
      <Box p={[podX, top + 0.02, rear + 0.05]} s={[0.03, 0.05, 0.03]} c={p.dash} />
      <Disc p={[podX, top + 0.07, rear + 0.05]} radius={0.045} depth={0.09} c={PANEL} />
      <Dial p={[podX, top + 0.07, rear + 0.008]} radius={0.034} />
    </group>
  );
}

/** Outboard of the binnacle: tyre-pressure block with two gauges and three toggles, and a radio handset in its cradle. */
function SideBlock({ spec }: { spec: InteriorSpec }) {
  const { dash, dashTopY: d, cowlZ, palette: p } = spec;
  const x = EYE.x + hoodWidth(dash) / 2 + 0.21;
  const rear = cowlZ - 0.15;
  const top = d + 0.05;
  return (
    <group>
      <Box
        p={[x, (d - 0.01 + top) / 2, (rear + cowlZ) / 2]}
        s={[0.32, top - d + 0.01, cowlZ - rear]}
        c={p.dash}
      />
      <Dial p={[x - 0.07, top - 0.03, rear - 0.002]} radius={0.018} />
      <Dial p={[x + 0.07, top - 0.03, rear - 0.002]} radius={0.018} />
      {[-0.08, 0, 0.08].map((dx) => (
        <Box
          key={dx}
          p={[x + dx, top + 0.014, (rear + cowlZ) / 2]}
          s={[0.01, 0.028, 0.014]}
          c={CHROME}
        />
      ))}
      <Box p={[x - 0.1, d + 0.02, rear - 0.14]} s={[0.05, 0.04, 0.12]} c={PANEL} />
      <Box p={[x - 0.1, d + 0.042, rear - 0.16]} s={[0.03, 0.004, 0.05]} c={CHROME} />
    </group>
  );
}

/**
 * Rally-raid cockpit kit (the truck): the centre console with its gauge pod,
 * the outboard tyre-pressure block and radio, and a demister slot along the
 * cowl, so the deep dark dash reads as a working dash rather than a slab.
 * The dash directly ahead of the wheel stays clear.
 */
export function RaidKit({ spec }: { spec: InteriorSpec }) {
  const { dashTopY: d, cowlZ, halfWidth } = spec;
  return (
    <group>
      <CentreConsole spec={spec} />
      <SideBlock spec={spec} />
      <Box p={[0, d + 0.003, cowlZ - 0.03]} s={[halfWidth * 2 - 0.3, 0.006, 0.05]} c={PANEL} />
    </group>
  );
}
