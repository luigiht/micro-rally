'use client';

import { useImperativeHandle, useRef, type Ref } from 'react';
import type { Group } from 'three';
import { Box, Tube, type V3 } from '../CarParts';
import type { InteriorPalette, InteriorSpec, LeverStyle } from './interiorSpecs';

export { Tube };
/** Where the main hoop stands (just behind the seats, at the B-pillar). */
export const HOOP_Z = -0.78;

/**
 * Welded-in roll cage: A-pillar bars, roof rails, a main hoop behind the
 * seats and a front bar; full cages add crossed door bars, a roof diagonal
 * and rear stays where the cabin runs far enough back.
 */
export function RollCage({ spec }: { spec: InteriorSpec }) {
  const { halfWidth, roofY, floorY, dashTopY, cowlZ, screenTopZ, rearZ, fullCage, palette } = spec;
  const x = halfWidth - 0.07;
  const top = roofY - 0.05;
  const frontZ = screenTopZ + 0.02;
  const bars: [V3, V3][] = [];
  for (const s of [1, -1] as const) {
    bars.push([
      [x * s, dashTopY - 0.1, cowlZ - 0.08],
      [x * s, top, frontZ],
    ]);
    bars.push([
      [x * s, floorY, HOOP_Z],
      [x * s, top, HOOP_Z],
    ]);
    bars.push([
      [x * s, top, frontZ],
      [x * s, top, HOOP_Z],
    ]);
    if (fullCage) {
      bars.push([
        [x * s, floorY + 0.12, cowlZ - 0.3],
        [x * s, dashTopY + 0.1, HOOP_Z + 0.06],
      ]);
      bars.push([
        [x * s, dashTopY + 0.08, cowlZ - 0.3],
        [x * s, floorY + 0.14, HOOP_Z + 0.06],
      ]);
      if (rearZ < HOOP_Z - 0.35)
        bars.push([
          [x * s, top, HOOP_Z],
          [(x - 0.12) * s, floorY + 0.3, rearZ + 0.05],
        ]);
    }
  }
  bars.push([
    [-x, top, frontZ],
    [x, top, frontZ],
  ]);
  bars.push([
    [-x, top, HOOP_Z],
    [x, top, HOOP_Z],
  ]);
  if (fullCage)
    bars.push([
      [-x, top, frontZ],
      [x, top, HOOP_Z],
    ]);
  return (
    <group>
      {bars.map(([a, b], i) => (
        <Tube key={i} a={a} b={b} r={0.022} c={palette.cage} glow={palette.glow} />
      ))}
    </group>
  );
}

/** Bucket seat: deep bolsters, winged backrest with shoulder slots, six-point harness in the team colour. */
/** Underside of the seat cushion; cabins with a lower floor put a pedestal under it. */
export const SEAT_BASE = 0.81;

export function BucketSeat({ x, p }: { x: number; p: InteriorPalette }) {
  const slot = '#15141a';
  return (
    <group position={[x, 0, 0]}>
      <Box p={[0, 0.86, -0.4]} s={[0.46, 0.1, 0.48]} c={p.seat} />
      <Box p={[0.2, 0.93, -0.42]} s={[0.08, 0.1, 0.44]} c={p.seat} />
      <Box p={[-0.2, 0.93, -0.42]} s={[0.08, 0.1, 0.44]} c={p.seat} />
      <group position={[0, 1.08, -0.62]} rotation={[-0.14, 0, 0]}>
        <Box p={[0, 0, 0]} s={[0.46, 0.46, 0.09]} c={p.seat} />
        <Box p={[0.21, 0, 0.04]} s={[0.06, 0.4, 0.14]} c={p.seat} />
        <Box p={[-0.21, 0, 0.04]} s={[0.06, 0.4, 0.14]} c={p.seat} />
        <Box p={[0, 0, 0.047]} s={[0.1, 0.42, 0.004]} c={p.seatAccent} glow={p.glow} />
        <Box p={[0.09, 0.13, 0.049]} s={[0.05, 0.05, 0.004]} c={slot} />
        <Box p={[-0.09, 0.13, 0.049]} s={[0.05, 0.05, 0.004]} c={slot} />
        <Box p={[0.08, -0.03, 0.052]} s={[0.05, 0.3, 0.006]} c={p.harness} glow={p.glow} />
        <Box p={[-0.08, -0.03, 0.052]} s={[0.05, 0.3, 0.006]} c={p.harness} glow={p.glow} />
        <Box p={[0, 0.3, 0.02]} s={[0.26, 0.14, 0.1]} c={p.seat} />
        <Box p={[0.15, 0.3, 0.07]} s={[0.05, 0.14, 0.16]} c={p.seat} />
        <Box p={[-0.15, 0.3, 0.07]} s={[0.05, 0.14, 0.16]} c={p.seat} />
      </group>
      <Box p={[0.12, 0.915, -0.3]} s={[0.05, 0.006, 0.2]} c={p.harness} glow={p.glow} />
      <Box p={[-0.12, 0.915, -0.3]} s={[0.05, 0.006, 0.2]} c={p.harness} glow={p.glow} />
      <Box p={[0, 0.915, -0.26]} s={[0.05, 0.006, 0.12]} c={p.harness} glow={p.glow} />
      <Box p={[0, 0.922, -0.28]} s={[0.07, 0.012, 0.07]} c="#9a9690" />
    </group>
  );
}

/** Steering wheel on its column; `rimRef` is the group the session turns. */
export function SteeringWheel({ spec, rimRef }: { spec: InteriorSpec; rimRef: Ref<Group> }) {
  const { wheelRadius: r, wheelRake, palette: p, wheelY, wheelZ, cowlZ, dashDepth } = spec;
  // Column runs from the hub into the dash face along the wheel's axis.
  const column = (cowlZ - dashDepth - wheelZ) / Math.cos(wheelRake) + 0.06;
  return (
    <group position={[0.34, wheelY, wheelZ]} rotation={[wheelRake, 0, 0]}>
      <group ref={rimRef}>
        {/* Rim thickness and hub scale with the rim so a truck wheel reads heavier */}
        <mesh>
          <torusGeometry args={[r, r * 0.1, 8, 24]} />
          <meshStandardMaterial color={p.wheel} flatShading />
        </mesh>
        <Box p={[0, -0.01, 0]} s={[r * 1.8, 0.03, 0.02]} c="#2b2a33" />
        <Box p={[0, -r * 0.5, 0]} s={[0.03, r * 0.9, 0.02]} c="#2b2a33" />
        <Box p={[0, 0, 0]} s={[r * 0.55, r * 0.55, 0.03]} c="#2b2a33" />
        <Box p={[0, r - 0.01, -0.015]} s={[0.05, 0.03, 0.006]} c={p.accent} glow={p.glow} />
      </group>
      <mesh position={[0, 0, column / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.18, r * 0.18, column, 10]} />
        <meshStandardMaterial color="#2b2a33" flatShading />
      </mesh>
    </group>
  );
}

export interface GearLeverHandle {
  setGear(gear: number): void;
}

/** Gear lever on the tunnel: an H-pattern lever that moves to the gate slot of the current gear, or a tall sequential stick. */
export function GearLever({
  ref,
  style,
  p,
  position,
}: {
  ref: Ref<GearLeverHandle>;
  style: LeverStyle;
  p: InteriorPalette;
  position: V3;
}) {
  const lever = useRef<Group>(null);
  useImperativeHandle(ref, () => ({
    setGear(gear) {
      if (!lever.current) return;
      if (style === 'sequential') {
        lever.current.rotation.x = 0.12;
        return;
      }
      // Reverse sits left and back; forward gears pair up across three gates.
      const column = gear < 0 || gear <= 2 ? -1 : gear <= 4 ? 0 : 1;
      const forward = gear > 0 && gear % 2 === 1 ? 1 : -1;
      lever.current.rotation.z = -column * 0.2;
      lever.current.rotation.x = forward * 0.22;
    },
  }));
  const tall = style === 'sequential';
  const height = tall ? 0.24 : 0.16;
  return (
    <group position={position}>
      {tall ? (
        <Box p={[0, 0.02, 0]} s={[0.1, 0.04, 0.14]} c="#15141a" />
      ) : (
        <>
          <Box p={[0, 0.005, 0]} s={[0.14, 0.01, 0.12]} c="#9a9690" />
          {[-0.04, 0, 0.04].map((x) => (
            <Box key={x} p={[x, 0.011, 0]} s={[0.012, 0.004, 0.09]} c="#15141a" />
          ))}
        </>
      )}
      <group ref={lever}>
        <mesh position={[0, height / 2, 0]}>
          <cylinderGeometry args={[0.011, 0.014, height, 8]} />
          <meshStandardMaterial color="#9a9690" flatShading metalness={0.4} roughness={0.5} />
        </mesh>
        <Box
          p={[0, height + 0.02, 0]}
          s={[0.05, 0.05, 0.05]}
          c={tall ? p.accent : '#15141a'}
          glow={tall ? p.glow : undefined}
        />
      </group>
    </group>
  );
}

/** Upright hydraulic handbrake beside the gear lever. */
export function Handbrake({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <Box p={[0, 0.02, 0]} s={[0.05, 0.04, 0.1]} c="#15141a" />
      <mesh position={[0, 0.16, 0]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.011, 0.013, 0.28, 8]} />
        <meshStandardMaterial color="#9a9690" flatShading metalness={0.4} roughness={0.5} />
      </mesh>
      <Box p={[0, 0.31, -0.015]} s={[0.034, 0.1, 0.034]} c="#15141a" />
    </group>
  );
}

/** Co-driver's kit: open pace-note book on the lap, trip meter on the dash, intercom amp on the tunnel, footrest bar. */
export function CoDriverKit({ spec, x }: { spec: InteriorSpec; x: number }) {
  const { dashTopY, cowlZ, floorY, palette: p, tripMeter } = spec;
  return (
    <group>
      <group position={[x, 0.99, -0.18]} rotation={[-0.55, 0, 0]}>
        <Box p={[0.095, 0, 0]} s={[0.17, 0.008, 0.22]} c="#f4f1ea" />
        <Box p={[-0.095, 0, 0]} s={[0.17, 0.008, 0.22]} c="#f4f1ea" />
        <Box p={[0, 0.001, 0]} s={[0.012, 0.01, 0.22]} c="#15141a" />
        {[-0.07, -0.03, 0.01, 0.05].map((zz) => (
          <Box key={zz} p={[0.095, 0.005, zz]} s={[0.12, 0.002, 0.008]} c="#5a5a63" />
        ))}
        {[-0.06, -0.02, 0.02, 0.06].map((zz) => (
          <Box
            key={zz}
            p={[-0.095, 0.005, zz]}
            s={[0.12, 0.002, 0.008]}
            c={p.accent}
            glow={p.glow}
          />
        ))}
      </group>
      {tripMeter && (
        <group position={[x, dashTopY + 0.045, cowlZ - 0.42]} rotation={[0.25, 0, 0]}>
          <Box p={[0, 0, 0]} s={[0.22, 0.08, 0.1]} c="#15141a" />
          <Box p={[-0.05, 0.012, -0.051]} s={[0.08, 0.03, 0.004]} c="#f2d43a" />
          <Box p={[0.05, 0.012, -0.051]} s={[0.08, 0.03, 0.004]} c="#f2d43a" />
          {[-0.06, -0.02, 0.02, 0.06].map((xx) => (
            <Box key={xx} p={[xx, -0.022, -0.051]} s={[0.02, 0.014, 0.004]} c="#9a9690" />
          ))}
        </group>
      )}
      <Box p={[-0.1, 0.93, -0.3]} s={[0.1, 0.05, 0.16]} c="#15141a" />
      <Box p={[-0.1, 0.956, -0.36]} s={[0.012, 0.004, 0.012]} c="#d9343a" />
      <Box p={[x, floorY + 0.05, cowlZ - 0.5]} s={[0.3, 0.03, 0.03]} c="#9a9690" r={[0.6, 0, 0]} />
    </group>
  );
}

/** Fire extinguisher strapped flat in the co-driver's footwell. */
export function Extinguisher({ x, floorY, z }: { x: number; floorY: number; z: number }) {
  return (
    <group position={[x, floorY + 0.06, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.055, 0.055, 0.34, 10]} />
        <meshStandardMaterial color="#d9343a" flatShading />
      </mesh>
      <Box p={[0, 0.08, 0]} s={[0.12, 0.03, 0.12]} c="#15141a" />
      <Box p={[0, -0.1, 0]} s={[0.12, 0.03, 0.12]} c="#15141a" />
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.06, 8]} />
        <meshStandardMaterial color="#9a9690" flatShading />
      </mesh>
    </group>
  );
}
