'use client';

import { useImperativeHandle, useRef, type Ref } from 'react';
import type { Group, MeshStandardMaterial } from 'three';
import { Box, Disc } from '../CarParts';
import type { DashHandle } from './InteriorDash';
import { EYE, type InteriorSpec } from './interiorSpecs';

const SUEDE = '#1c1b20';
const CARBON = '#2a2a30';
const PLATE = '#121216';
const LED_OFF = '#2a2a30';
/** The rev arc's segments, and the share of redline at which each lights. */
const ARC_SEGMENTS = 12;
/** The warning lamps across the display's foot: oil, fuel, then a green and a red. */
const LAMPS = ['#d9343a', '#f2c230', '#3fbf5a', '#d9343a'] as const;
/** The buttons on the wheel's plate: [x, y, colour]. */
const BUTTONS: readonly (readonly [number, number, string])[] = [
  [-0.045, 0.012, '#d9343a'],
  [0.045, 0.012, '#2fae8a'],
  [-0.045, -0.018, '#2fae8a'],
  [0.045, -0.018, '#d9343a'],
  [-0.015, -0.04, '#3a8fd9'],
  [0.015, -0.04, '#c9c4b8'],
];

function setLed(m: MeshStandardMaterial | null, on: boolean, color: string): void {
  if (!m) return;
  m.color.set(on ? color : LED_OFF);
  m.emissive.set(on ? color : LED_OFF);
  m.emissiveIntensity = on ? 1.1 : 0;
}

/**
 * A late-1980s Formula One cockpit, seen over the tub's rim (everything lower is hidden by the
 * body): a small three-spoke wheel in black suede with a black button plate on its spokes, and
 * behind it, set under the scuttle's lip, a curved digital display, its rev arc lighting from
 * green through amber to red and a row of warning lamps under it, under a carbon hood.
 * Replaces the dash cluster and wheel for a single-seater (`InteriorSpec.singleSeat`); the
 * interior frame, so the driver sits at `EYE.x`.
 */
export function FormulaCockpit({
  ref,
  spec,
  redlineRpm,
  rimRef,
}: {
  ref: Ref<DashHandle>;
  spec: InteriorSpec;
  redlineRpm: number;
  rimRef: Ref<Group>;
}) {
  const arc = useRef<(MeshStandardMaterial | null)[]>([]);
  useImperativeHandle(ref, () => ({
    apply(pose) {
      const revs = Math.min(1, pose.rpm / (redlineRpm * 1.02));
      const lit = Math.round(revs * ARC_SEGMENTS);
      arc.current.forEach((m, i) =>
        setLed(m, i < lit, i < 7 ? '#3fbf5a' : i < 10 ? '#f2c230' : '#e02a2a'),
      );
    },
  }));
  const { wheelRadius: r, wheelRake, wheelY, wheelZ } = spec;
  const x = EYE.x;
  // The display stands at the scuttle's foot just behind the wheel's rim, over its hub and clear of
  // the cockpit's rim under it (the hull's top hides anything lower).
  const dz = wheelZ + 0.06;
  const dy = wheelY + 0.05;
  return (
    <group>
      {/* The display: a curved face of five panels, the rev arc over a row of warning lamps */}
      <group position={[x, dy, dz]} rotation={[wheelRake * 0.6, 0, 0]}>
        {[-2, -1, 0, 1, 2].map((k) => (
          <Box
            key={k}
            p={[k * 0.052, -Math.abs(k) * 0.006, Math.abs(k) * 0.012]}
            s={[0.054, 0.075, 0.012]}
            c={PLATE}
            r={[0, -k * 0.18, 0]}
          />
        ))}
        {Array.from({ length: ARC_SEGMENTS }, (_, i) => {
          const t = i / (ARC_SEGMENTS - 1);
          const a = Math.PI * (0.85 - 0.7 * t);
          return (
            <mesh key={i} position={[Math.cos(a) * 0.11, Math.sin(a) * 0.05 - 0.02, -0.008]}>
              <boxGeometry args={[0.014, 0.01, 0.004]} />
              <meshStandardMaterial
                ref={(m) => {
                  arc.current[i] = m;
                }}
                color={LED_OFF}
                emissive={LED_OFF}
                emissiveIntensity={0}
              />
            </mesh>
          );
        })}
        {LAMPS.map((c, i) => (
          <Box
            key={i}
            p={[(i - 1.5) * 0.034, -0.022, -0.008]}
            s={[0.026, 0.012, 0.004]}
            c={c}
            glow={0.35}
          />
        ))}
        {/* The carbon hood over it */}
        <Box p={[0, 0.048, 0.02]} s={[0.3, 0.014, 0.07]} c={CARBON} r={[-0.25, 0, 0]} />
      </group>
      {/* The wheel: suede rim, a spoke left, right and down, and the button plate where they meet */}
      <group position={[x, wheelY, wheelZ]} rotation={[wheelRake, 0, 0]}>
        <group ref={rimRef}>
          <mesh>
            <torusGeometry args={[r, 0.019, 8, 24]} />
            <meshStandardMaterial color={SUEDE} flatShading roughness={1} />
          </mesh>
          <Box p={[-r * 0.55, 0.005, 0]} s={[r * 0.9, 0.05, 0.018]} c={SUEDE} />
          <Box p={[r * 0.55, 0.005, 0]} s={[r * 0.9, 0.05, 0.018]} c={SUEDE} />
          <Box p={[0, -r * 0.55, 0]} s={[0.04, r * 0.9, 0.018]} c={SUEDE} />
          <Box p={[0, -0.012, -0.012]} s={[0.13, 0.075, 0.006]} c={PLATE} />
          {BUTTONS.map(([bx, by, c]) => (
            <Disc key={`${bx},${by}`} p={[bx, by, -0.018]} radius={0.008} depth={0.01} c={c} />
          ))}
        </group>
        {/* The column into the scuttle */}
        <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.16, 8]} />
          <meshStandardMaterial color={PLATE} flatShading />
        </mesh>
      </group>
    </group>
  );
}
