'use client';

import { useMemo, type Ref } from 'react';
import type { Group } from 'three';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import {
  NIGHTCITY_COLORS as K,
  nightcityFrame,
  nightcityHull,
  sideAt,
} from '@/render/car/NightcityHull';
import { ArchLip, Box, Lamp, Prism } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** How bright the hull's painted neon and the glow boxes are: HDR, for the bloom pass. */
const GLOW = 3;
/** Softer lights (intake edges, sensor) stay just over the threshold. */
const SOFT = 1.6;

/**
 * Nightcity's car over any spec, in the cyberpunk-game idiom: the flared
 * parametric hull with its painted neon, plus a segmented light bar with
 * angled fangs over a slatted grille and side intakes, a splitter with
 * canards, dark arch lips, side skirts with a lit underline, fender vents and
 * rear intakes, louvres over the rear glass, a sensor pod and antennas on the
 * roof, a spoiler on swept uprights with end plates and a shark fin, a strake
 * diffuser and quad hexagonal thrusters. Coordinates in the root frame;
 * `cabinRef` holds what the interior view hides (mirrors, roof kit).
 */
export function NightcityBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const hull = useMemo(() => nightcityHull(spec), [spec]);
  const f = useMemo(() => nightcityFrame(spec), [spec]);
  const r = f.wheelRadius;
  const xb = f.xBody;
  const parts = useMemo(() => {
    // Rear glass slope, for the louvres laid along it.
    const glassAngle = Math.atan2(f.roof - f.deck, f.peak - f.rearGlass);
    const louvres = [0.25, 0.42, 0.59, 0.76].map((t) => ({
      y: f.deck + (f.roof - f.deck) * t + 0.03,
      z: f.rearGlass + (f.peak - f.rearGlass) * t,
      w: 2 * ((f.flare - 0.16) * (1 - t) + f.xRoof * t) * 0.92,
    }));
    const upright = (dz: number) =>
      [
        [f.tail + 0.1 + dz, f.deck + 0.02],
        [f.tail + 0.6 + dz, f.deck + 0.02],
        [f.tail + 0.42 + dz, f.deck + 0.5],
        [f.tail + 0.2 + dz, f.deck + 0.5],
      ] as const;
    const plate = [
      [f.tail + 0.08, f.deck + 0.38],
      [f.tail + 0.5, f.deck + 0.38],
      [f.tail + 0.5, f.deck + 0.64],
      [f.tail + 0.02, f.deck + 0.64],
    ] as const;
    const fin = [
      [f.tail + 0.12, f.deck + 0.02],
      [f.tail + 0.95, f.deck + 0.02],
      [f.tail + 0.16, f.deck + 0.42],
    ] as const;
    const canard = [
      [f.nose - 0.05, f.floor + 0.02],
      [f.nose + 0.1, f.floor + 0.02],
      [f.nose - 0.05, f.floor + 0.14],
    ] as const;
    // Skirts run between the wheels, seated into the flares at each end.
    const skirtZ0 = f.rearAxle + r + 0.1;
    const skirtZ1 = f.frontAxle - r - 0.1;
    const skirt = { z: (skirtZ0 + skirtZ1) / 2, len: skirtZ1 - skirtZ0 };
    const ventZ = f.frontAxle - r - 0.12;
    const intakeZ = f.rearAxle + r + 0.2;
    return {
      glassAngle,
      louvres,
      upright,
      plate,
      fin,
      canard,
      skirt,
      ventZ,
      intakeZ,
      ventX: sideAt(f, ventZ),
      intakeX: sideAt(f, intakeZ),
    };
  }, [f, r]);
  const segments = [-2, -1, 0, 1, 2];
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={hull} glow={GLOW} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Box
              p={[(xb + 0.12) * side, f.belt + 0.12, f.canopyFront + 0.15]}
              s={[0.22, 0.03, 0.05]}
              c={K.trim}
            />
            <Box
              p={[(xb + 0.23) * side, f.belt + 0.12, f.canopyFront + 0.15]}
              s={[0.02, 0.05, 0.08]}
              c={K.tail}
              glow={GLOW}
            />
          </group>
        ))}
        {/* Sensor pod on the roof behind the peak, with a lit eye; two antennas */}
        <Box p={[0, f.roof + 0.03, f.peak - 0.12]} s={[0.24, 0.06, 0.26]} c={K.trim} />
        <Box p={[0, f.roof + 0.03, f.peak + 0.02]} s={[0.1, 0.02, 0.02]} c={K.nose} glow={SOFT} />
        <Box
          p={[-f.xRoof * 0.6, f.roof + 0.16, f.peak - 0.2]}
          s={[0.015, 0.34, 0.015]}
          c={K.trim}
        />
        <Box
          p={[f.xRoof * 0.45, f.roof + 0.1, f.peak - 0.24]}
          s={[0.015, 0.22, 0.015]}
          c={K.trim}
        />
      </group>
      {/* Louvres laid over the rear glass */}
      {parts.louvres.map((l) => (
        <Box
          key={l.z}
          p={[0, l.y, l.z]}
          s={[l.w, 0.02, 0.07]}
          c={K.trim}
          r={[-parts.glassAngle, 0, 0]}
        />
      ))}
      {([1, -1] as const).map((side) => (
        <group key={side}>
          {/* Dark arch lips on the flares */}
          <ArchLip x={f.flare * side} z={f.frontAxle} radius={r} c={K.trim} tube={0.05} />
          <ArchLip x={f.flare * side} z={f.rearAxle} radius={r} c={K.trim} tube={0.05} />
          {/* Side skirt with a lit underline */}
          <Box
            p={[(xb + 0.03) * side, f.sill + 0.05, parts.skirt.z]}
            s={[0.1, 0.1, parts.skirt.len]}
            c={K.trim}
          />
          <Box
            p={[(xb + 0.085) * side, f.sill + 0.02, parts.skirt.z]}
            s={[0.012, 0.025, parts.skirt.len - 0.1]}
            c={K.line}
            glow={GLOW}
          />
          {/* Fender vents behind the front wheel: three angled slats */}
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              p={[(parts.ventX + 0.005) * side, f.belt - 0.22, parts.ventZ - i * 0.07]}
              s={[0.02, 0.13, 0.03]}
              c={K.vent}
              r={[0.5, 0, 0]}
            />
          ))}
          {/* Rear intake ahead of the rear wheel with a lit top edge */}
          <Box
            p={[(parts.intakeX - 0.01) * side, f.belt - 0.3, parts.intakeZ]}
            s={[0.05, 0.14, 0.22]}
            c={K.vent}
          />
          <Box
            p={[(parts.intakeX + 0.02) * side, f.belt - 0.22, parts.intakeZ]}
            s={[0.012, 0.012, 0.22]}
            c={K.tail}
            glow={SOFT}
          />
          {/* Fangs: angled light blades from the bar ends down to the splitter corners */}
          <Box
            p={[xb * 0.62 * side, f.noseBelt - 0.16, f.nose - 0.02]}
            s={[0.03, 0.22, 0.04]}
            c={K.nose}
            glow={GLOW}
            r={[0, 0, 0.35 * side]}
          />
          {/* Hexagonal amber indicators at the nose corners */}
          <Lamp
            p={[xb * 0.6 * side, f.noseBelt - 0.08, f.nose + 0.01]}
            radius={0.035}
            c={K.indicator}
            glow={GLOW}
            sides={6}
          />
          {/* Side intakes at the bumper corners, lit along their inner edge */}
          <Box
            p={[xb * 0.5 * side, f.floor + 0.22, f.nose - 0.08]}
            s={[0.3, 0.14, 0.12]}
            c={K.vent}
          />
          <Box
            p={[xb * 0.34 * side, f.floor + 0.22, f.nose - 0.02]}
            s={[0.012, 0.14, 0.012]}
            c={K.nose}
            glow={SOFT}
          />
          {/* Canards on the splitter corners */}
          <Prism x={xb * 0.68 * side} points={parts.canard} thickness={0.02} c={K.steel} />
          {/* Spoiler uprights and end plates */}
          <Prism x={xb * 0.5 * side} points={parts.upright(0)} thickness={0.04} c={K.steel} />
          <Prism x={xb * 0.92 * side} points={parts.plate} thickness={0.02} c={K.trim} />
          {/* Quad hexagonal thrusters */}
          {[0.28, 0.5].map((dx) => (
            <group
              key={dx}
              position={[dx * xb * side, f.belt - 0.24, f.tail + 0.02]}
              rotation={[0, Math.PI, 0]}
            >
              <Lamp p={[0, 0, 0]} radius={0.07} c={K.nose} glow={GLOW} sides={6} />
            </group>
          ))}
          {/* Tail bar: outer magenta segments */}
          <Box
            p={[xb * 0.6 * side, f.belt - 0.1, f.tail + 0.01]}
            s={[xb * 0.5, 0.09, 0.05]}
            c={K.tail}
            glow={GLOW}
          />
        </group>
      ))}
      {/* Nose: segmented cyan light bar over a slatted grille */}
      {segments.map((i) => (
        <Box
          key={i}
          p={[i * xb * 0.26, f.noseBelt - 0.05, f.nose - 0.01]}
          s={[xb * 0.2, 0.08, 0.05]}
          c={K.nose}
          glow={GLOW}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          p={[0, f.floor + 0.3 - i * 0.06, f.nose - 0.03]}
          s={[xb * 0.6, 0.02, 0.06]}
          c={K.steel}
        />
      ))}
      <Box p={[0, f.floor + 0.21, f.nose - 0.06]} s={[xb * 0.62, 0.2, 0.08]} c={K.vent} />
      {/* Splitter under the nose, lit along its leading edge */}
      <Box p={[0, f.floor + 0.02, f.nose - 0.15]} s={[xb * 1.7, 0.04, 0.44]} c={K.trim} shadow />
      <Box
        p={[0, f.floor + 0.02, f.nose + 0.07]}
        s={[xb * 1.5, 0.02, 0.03]}
        c={K.line}
        glow={GLOW}
      />
      {/* Tail: centre plate panel in amber between the bar segments, the brow above is in the hull */}
      <Box
        p={[0, f.belt - 0.1, f.tail + 0.01]}
        s={[xb * 0.5, 0.06, 0.04]}
        c={K.accent}
        glow={SOFT}
      />
      {/* Spoiler blade across the uprights, lit along its trailing edge; shark fin on the cover */}
      <Box p={[0, f.deck + 0.5, f.tail + 0.3]} s={[xb * 1.9, 0.035, 0.36]} c={K.trim} shadow />
      <Box p={[0, f.deck + 0.5, f.tail + 0.11]} s={[xb * 1.8, 0.02, 0.03]} c={K.tail} glow={GLOW} />
      <Prism x={0} points={parts.fin} thickness={0.03} c={K.trim} />
      {/* Diffuser: a dark bar with five strakes and a lit line along its lip */}
      <Box p={[0, f.floor + 0.05, f.tail + 0.12]} s={[xb * 1.7, 0.06, 0.28]} c={K.trim} />
      {[-2, -1, 0, 1, 2].map((i) => (
        <Box
          key={i}
          p={[i * xb * 0.32, f.floor + 0.12, f.tail + 0.14]}
          s={[0.02, 0.14, 0.3]}
          c={K.steel}
        />
      ))}
      <Box
        p={[0, f.floor + 0.02, f.tail - 0.01]}
        s={[xb * 1.6, 0.015, 0.03]}
        c={K.tail}
        glow={GLOW}
      />
    </group>
  );
}
