'use client';

import { useImperativeHandle, useRef, type Ref } from 'react';
import type { Group, MeshStandardMaterial } from 'three';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import { Box, Disc, type V3 } from '../CarParts';
import { EYE, type DashStyle, type InteriorSpec } from './interiorSpecs';

export interface DashHandle {
  apply(pose: Readonly<VehiclePose>): void;
}

const SPEEDO_MAX_KMH = 240;
/** Needles sweep clockwise from about 7 o'clock to 5 o'clock. */
const NEEDLE_MIN = -2.36;
const NEEDLE_SWEEP = 4.72;
/** Rev fractions (of redline) at which the shift lights come on, green → amber → red. */
const SHIFT_STEPS = [0.55, 0.66, 0.77, 0.87, 0.94] as const;
const SHIFT_COLORS = ['#3fbf5a', '#3fbf5a', '#f2c230', '#f2c230', '#e02a2a'] as const;
const BAR_SEGMENTS = 10;
const LED_OFF = '#2a2a30';
/** Centre stack sits a little toward the co-driver so it clears the driver's binnacle. */
const STACK_X = -0.1;
const CHROME = '#d9d4c7';

type MatRef = (m: MeshStandardMaterial | null) => void;

function Led({ p, s, matRef }: { p: V3; s: V3; matRef: MatRef }) {
  return (
    <mesh position={p}>
      <boxGeometry args={s} />
      <meshStandardMaterial ref={matRef} color={LED_OFF} emissive={LED_OFF} emissiveIntensity={0} />
    </mesh>
  );
}

function setLed(m: MeshStandardMaterial | null, on: boolean, color: string): void {
  if (!m) return;
  m.color.set(on ? color : LED_OFF);
  m.emissive.set(on ? color : LED_OFF);
  m.emissiveIntensity = on ? 1.1 : 0;
}

/** Width of the binnacle hood for a dash style; the digital display needs room for its two small dials. */
export const hoodWidth = (dash: DashStyle): number => (dash === 'digital' ? 0.5 : 0.44);

/** Round dial with a chrome bezel, cream face, two ticks and a red needle. */
export function Dial({ p, radius, needleRef }: { p: V3; radius: number; needleRef?: Ref<Group> }) {
  return (
    <group position={p}>
      <Disc p={[0, 0, 0.004]} radius={radius + 0.008} depth={0.01} c={CHROME} />
      <Disc p={[0, 0, 0]} radius={radius} depth={0.012} c="#f4f1ea" />
      <Box p={[-radius * 0.7, -radius * 0.55, -0.007]} s={[0.012, 0.004, 0.002]} c="#2b2a33" />
      <Box p={[radius * 0.7, -radius * 0.55, -0.007]} s={[0.012, 0.004, 0.002]} c="#2b2a33" />
      <group ref={needleRef} position={[0, 0, -0.009]} rotation={[0, 0, NEEDLE_MIN]}>
        <Box p={[0, radius * 0.45, 0]} s={[0.006, radius * 0.9, 0.003]} c="#d9343a" />
      </group>
      <Disc p={[0, 0, -0.011]} radius={0.008} depth={0.005} c="#2b2a33" />
    </group>
  );
}

/** Row of toggle switches with a red kill switch. */
function SwitchPanel({ p, count, accent }: { p: V3; count: number; accent: string }) {
  const w = count * 0.034 + 0.06;
  return (
    <group position={p}>
      <Box p={[0, 0, 0]} s={[w, 0.07, 0.02]} c="#15141a" />
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i}
          p={[-w / 2 + 0.05 + i * 0.034, i % 3 === 0 ? 0.008 : -0.008, -0.014]}
          s={[0.008, 0.028, 0.012]}
          c={CHROME}
        />
      ))}
      <Disc p={[w / 2 - 0.028, 0.012, -0.012]} radius={0.014} depth={0.01} c="#d9343a" />
      <Box p={[w / 2 - 0.028, -0.022, -0.012]} s={[0.02, 0.006, 0.004]} c={accent} />
    </group>
  );
}

/**
 * Instrument cluster in front of the driver plus the centre stack, in one of
 * three styles: `period` (three chrome dials, one shift light), `analogue`
 * (two dials, a shift-light pod) or `digital` (a display with a ten-segment
 * rev bar, a shift-light pod and two small dials). All styles carry a turbo
 * lamp. `apply` drives needles, bar and lamps from the pose.
 */
export function DashCluster({
  ref,
  spec,
  redlineRpm,
}: {
  ref: Ref<DashHandle>;
  spec: InteriorSpec;
  redlineRpm: number;
}) {
  const {
    dash,
    dashTopY,
    cowlZ,
    clusterRise,
    clusterForward,
    dashDepth,
    raidKit,
    palette: p,
  } = spec;
  // Dash face the centre stack is set into.
  const face = cowlZ - dashDepth;
  const speedo = useRef<Group>(null);
  const tacho = useRef<Group>(null);
  const shift = useRef<(MeshStandardMaterial | null)[]>([]);
  const bar = useRef<(MeshStandardMaterial | null)[]>([]);
  const turbo = useRef<MeshStandardMaterial | null>(null);

  useImperativeHandle(ref, () => ({
    apply(pose) {
      const kmh = Math.min(1, (Math.abs(pose.speed) * 3.6) / SPEEDO_MAX_KMH);
      const revs = Math.min(1, pose.rpm / (redlineRpm * 1.05));
      if (speedo.current) speedo.current.rotation.z = NEEDLE_MIN + NEEDLE_SWEEP * kmh;
      if (tacho.current) tacho.current.rotation.z = NEEDLE_MIN + NEEDLE_SWEEP * revs;
      shift.current.forEach((m, i) => setLed(m, revs >= SHIFT_STEPS[i]!, SHIFT_COLORS[i]!));
      const lit = Math.round(revs * BAR_SEGMENTS);
      bar.current.forEach((m, i) =>
        setLed(m, i < lit, i < 6 ? '#3fbf5a' : i < 8 ? '#f2c230' : '#e02a2a'),
      );
      setLed(turbo.current, pose.turboActive, '#5aa0e0');
    },
  }));

  const x = EYE.x;
  // Binnacle depth from the cowl; the centre stack stays on the dash face.
  const bz = cowlZ + clusterForward;
  const faceZ = bz - 0.445;
  // Centre stack sits on the dash; the binnacle may ride higher on a taller hood.
  const yc = dashTopY - 0.01;
  const y = yc + clusterRise;
  const hoodW = hoodWidth(dash);
  const shiftCount = dash === 'period' ? 1 : SHIFT_STEPS.length;
  return (
    <group>
      {/* Binnacle hood */}
      <Box p={[x, (yc + y) / 2, bz - 0.36]} s={[hoodW, 0.12 + clusterRise, 0.16]} c={p.dash} />
      <Box p={[x, y + 0.065, bz - 0.34]} s={[hoodW + 0.02, 0.014, 0.2]} c={p.dash} />
      {dash === 'period' && (
        <>
          <Dial p={[x, y, faceZ]} radius={0.058} needleRef={tacho} />
          <Dial p={[x + 0.14, y - 0.01, faceZ]} radius={0.042} needleRef={speedo} />
          <Dial p={[x - 0.14, y - 0.01, faceZ]} radius={0.03} />
        </>
      )}
      {dash === 'analogue' && (
        <>
          <Dial p={[x + 0.075, y, faceZ]} radius={0.045} needleRef={speedo} />
          <Dial p={[x - 0.075, y, faceZ]} radius={0.045} needleRef={tacho} />
        </>
      )}
      {dash === 'digital' && (
        <>
          <Box p={[x, y - 0.005, faceZ + 0.004]} s={[0.32, 0.1, 0.012]} c="#15141a" />
          {Array.from({ length: BAR_SEGMENTS }, (_, i) => (
            <Led
              key={i}
              p={[x - 0.135 + i * 0.03, y + 0.028, faceZ - 0.004]}
              s={[0.022, 0.016, 0.004]}
              matRef={(m) => {
                bar.current[i] = m;
              }}
            />
          ))}
          <Box p={[x - 0.06, y - 0.014, faceZ - 0.004]} s={[0.1, 0.04, 0.004]} c={p.accent} />
          <Box p={[x + 0.06, y - 0.014, faceZ - 0.004]} s={[0.1, 0.04, 0.004]} c="#3a3944" />
          <Dial p={[x + 0.2, y - 0.01, faceZ]} radius={0.028} />
          <Dial p={[x - 0.2, y - 0.01, faceZ]} radius={0.028} />
        </>
      )}
      {/* Shift lights on the hood, with the blue turbo lamp at the end of the row */}
      {Array.from({ length: shiftCount }, (_, i) => (
        <Led
          key={i}
          p={[x + (i - (shiftCount - 1) / 2) * 0.05, y + 0.08, bz - 0.4]}
          s={[0.03, 0.016, 0.03]}
          matRef={(m) => {
            shift.current[dash === 'period' ? SHIFT_STEPS.length - 1 : i] = m;
          }}
        />
      ))}
      <Led
        p={[x + 0.17, y + 0.08, bz - 0.4]}
        s={[0.03, 0.016, 0.03]}
        matRef={(m) => {
          turbo.current = m;
        }}
      />
      {/* Centre stack set into the dash face: switch panel, knobs, a vent each side */}
      <SwitchPanel
        p={[STACK_X, yc - 0.04, face - 0.005]}
        count={dash === 'period' ? 4 : dash === 'analogue' ? 6 : 8}
        accent={p.accent}
      />
      {[-0.05, 0.05].map((dx) => (
        <Disc
          key={dx}
          p={[STACK_X + dx, yc - 0.1, face - 0.005]}
          radius={0.016}
          depth={0.014}
          c={CHROME}
        />
      ))}
      {/* The raid console takes the inboard vent's place */}
      {(raidKit ? [x + hoodW / 2 + 0.06] : [STACK_X - 0.22, x + hoodW / 2 + 0.06]).map((vx) => (
        <Box key={vx} p={[vx, yc + 0.02, face - 0.003]} s={[0.07, 0.03, 0.01]} c="#15141a" />
      ))}
    </group>
  );
}
