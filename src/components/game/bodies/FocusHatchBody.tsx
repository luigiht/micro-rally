'use client';

import { useEffect, useMemo, type Ref } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide, type Group } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import { ALBION_LIVERY, HEADLAMP, NAVY, TAIL_LAMP_PARTS, WHITE } from '@/render/car/AlbionLivery';
import type { LiverySolid } from '@/render/car/HullLivery';
import { ALBION_HULL } from '@/render/car/AlbionShape';
import { buildCarHull } from '@/render/car/CarHull';
import { lampShell } from '@/render/car/LampShell';
import { Box, Lamp, Prism } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

/** White shell under the livery (`AlbionLivery`, which paints the roof navy), black trim and glass. */
const K = {
  body: WHITE,
  trim: '#1d1d22',
  carbon: '#26262b',
  glass: '#0f1720',
  head: '#fffdf4',
  red: '#d8261c',
  chrome: '#c9cdd1',
} as const;

/** The lamps stand this proud of the body: the livery's lenses (`HEADLAMP`, `TAIL_LAMP_PARTS`) lifted into shells. */
const LAMP_DEPTH = 0.025;
/** The tail lamps sit nearly flush, following the pillar and the glass's edge. */
const TAIL_LAMP_DEPTH = 0.01;

/** A livery lamp (`LiverySolid`) raised into a shell of its own colour, built once from the hull. */
function LampShellMesh({
  solid,
  color,
  glow,
  depth = LAMP_DEPTH,
  unlit = false,
}: {
  solid: LiverySolid;
  color: string;
  glow: number;
  depth?: number;
  /** Drawn flat in its own colour, untouched by the scene's lights: no hotspot from the brake beams. */
  unlit?: boolean;
}) {
  // One mesh per side (the solid is mirrored), so the brake lamps' beams find each side's lamp
  // where it is rather than at their shared middle. Welded and smooth-shaded, so each lamp reads
  // as one rounded body rather than its facets.
  const geometries = useMemo(() => {
    const all = lampShell(buildCarHull(ALBION_HULL), solid, depth);
    return ([1, -1] as const).map((side) => {
      const picked: number[] = [];
      for (let i = 0; i + 8 < all.length; i += 9) {
        const cx = (all[i]! + all[i + 3]! + all[i + 6]!) / 3;
        if (cx * side > 0) for (let k = 0; k < 9; k++) picked.push(all[i + k]!);
      }
      const raw = new BufferGeometry();
      raw.setAttribute('position', new BufferAttribute(Float32Array.from(picked), 3));
      const welded = mergeVertices(raw, 1e-4);
      raw.dispose();
      welded.computeVertexNormals();
      return welded;
    });
  }, [solid, depth]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  return (
    <>
      {geometries.map((geometry, i) => (
        <mesh key={i} castShadow geometry={geometry}>
          {unlit ? (
            <meshBasicMaterial color={color} side={DoubleSide} />
          ) : (
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={glow}
              side={DoubleSide}
            />
          )}
        </mesh>
      ))}
    </>
  );
}

/**
 * The rear wing's end plates, in (z, y): tall swept blades standing on the hatch glass by its
 * edges, from the roof's rear corner down to the glass's foot at the tail lamps' amber-to-red
 * line (1.0 m), rising along the top to the wing's trailing edge, then sweeping down and forward
 * to that foot. Their lower edge is a chord under the glass's curve, so it hides in the hatch.
 */
const WING_PLATE: readonly (readonly [number, number])[] = [
  [-1.5, 1.31],
  [-1.64, 1.54],
  [-2.22, 1.64],
  [-2.33, 1.51],
  [-2.04, 1.0],
];
/** The wing's black (carbon). */
const WING = '#141418';
/**
 * The plates stand this far either side of the middle, on the hatch glass just inside its edges
 * (inboard of the tail lamps, so they never cover them from behind); the wing spans between them.
 */
const WING_X = 0.55;
/** The plates' thickness: broad supports. */
const WING_PLATE_THICK = 0.06;

/** The four-lamp pod's lamps across the nose, and the pod's plate. */
const POD_LAMPS = [-0.345, -0.115, 0.115, 0.345] as const;

/** Mid-2000s works rally hatch. Coordinates in the root frame. `cabinRef` holds the mirrors. */
export function FocusHatchBody({ cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={ALBION_HULL} livery={ALBION_LIVERY} />
      <group ref={cabinRef}>
        {([1, -1] as const).map((side) => (
          <group key={side}>
            {/* Slim white mirror shells on short black stalks off the door, its glass facing back */}
            <Box p={[0.865 * side, 1.0, 0.42]} s={[0.07, 0.03, 0.04]} c={K.trim} />
            <Box p={[0.96 * side, 1.03, 0.42]} s={[0.14, 0.1, 0.045]} c={WHITE} />
            <Box p={[0.965 * side, 1.03, 0.394]} s={[0.12, 0.08, 0.01]} c={K.glass} />
          </group>
        ))}
      </group>
      <LampShellMesh solid={HEADLAMP} color="#ffffff" glow={0.55} />
      {TAIL_LAMP_PARTS.map((part) => (
        <LampShellMesh
          key={part.color}
          solid={part}
          color={part.color}
          glow={0.5}
          depth={TAIL_LAMP_DEPTH}
          unlit
        />
      ))}
      {/* Four-lamp pod on the nose: a navy plate standing on the bumper, the lamps in front */}
      <Box p={[0, 0.8, 2.15]} s={[1.06, 0.18, 0.05]} c={NAVY} shadow />
      <Box p={[0, 0.71, 2.13]} s={[0.88, 0.03, 0.14]} c={K.trim} />
      {POD_LAMPS.map((x) => (
        <Lamp key={x} p={[x, 0.81, 2.2]} radius={0.1} c={K.head} glow={0.55} sides={14} />
      ))}
      {/* Bonnet pins near the nose */}
      {[0.5, -0.5].map((x) => (
        <Box key={x} p={[x, 0.86, 2.02]} s={[0.036, 0.012, 0.036]} c={K.chrome} />
      ))}
      {/* Navy roof scoop over the windscreen's top, and the antenna */}
      <Box p={[0, 1.47, -0.16]} s={[0.2, 0.06, 0.28]} c={NAVY} r={[0.12, 0, 0]} />
      <Box p={[-0.1, 1.62, -0.98]} s={[0.012, 0.42, 0.012]} c={K.trim} r={[-0.35, 0, 0]} />
      {/*
        Rear wing after the works car's, all black: a lip along the roof's rear edge; a broad top
        plane standing tall over the hatch, rising toward its trailing edge, open beneath; under its trailing half a second
        element, two struts between them so the gap reads as three windows; every element held
        inside the swept end plates' outline, so each meets the plates.
      */}
      <Box p={[0, 1.33, -1.6]} s={[WING_X * 2, 0.04, 0.2]} c={WING} r={[0.15, 0, 0]} shadow />
      <Box p={[0, 1.55, -1.93]} s={[WING_X * 2, 0.04, 0.62]} c={WING} r={[0.13, 0, 0]} shadow />
      <Box p={[0, 1.61, -2.22]} s={[WING_X * 2, 0.05, 0.03]} c={WING} />
      <Box p={[0, 1.4, -2.1]} s={[WING_X * 2, 0.05, 0.28]} c={WING} r={[0.15, 0, 0]} shadow />
      {[-0.25, 0.25].map((x) => (
        <Box key={x} p={[x, 1.49, -2.1]} s={[0.03, 0.16, 0.22]} c={WING} />
      ))}
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Prism
            x={WING_X * side}
            points={WING_PLATE}
            thickness={WING_PLATE_THICK}
            c={WING}
            shadow
          />
          {/* Red tow straps front and rear */}
          <Box p={[0.62 * side, 0.3, 2.24]} s={[0.05, 0.12, 0.03]} c={K.red} />
        </group>
      ))}
      <Box p={[-0.55, 0.36, -2.18]} s={[0.05, 0.1, 0.03]} c={K.red} />
      {/* Carbon splitter under the nose; diffuser fins and an exhaust under the tail */}
      <Box p={[0, 0.14, 2.17]} s={[1.48, 0.022, 0.16]} c={K.carbon} />
      <Box p={[0, 0.14, -2.1]} s={[1.0, 0.015, 0.3]} c={K.carbon} />
      {[-0.36, -0.18, 0, 0.18, 0.36].map((x) => (
        <Box key={x} p={[x, 0.19, -2.1]} s={[0.012, 0.1, 0.28]} c={K.carbon} />
      ))}
      <mesh position={[0.42, 0.23, -2.13]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.058, 0.058, 0.18, 10]} />
        <meshStandardMaterial color={K.chrome} metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}
