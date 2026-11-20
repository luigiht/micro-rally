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
 * The rear wing's end plates, in (z, y): tall swept blades standing on the roof's rear corners,
 * running back flat along the top to the wing's trailing edge, then curving down; their lower
 * edge stays over the tail lamps in the pillars below.
 */
const WING_PLATE: readonly (readonly [number, number])[] = [
  [-1.5, 1.33],
  [-1.62, 1.48],
  [-2.22, 1.52],
  [-2.3, 1.42],
  [-2.26, 1.28],
];
/** The wing's black (carbon). */
const WING = '#141418';
/** The plates stand this far either side of the middle; the wing spans between them. */
const WING_X = 0.74;

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
            {/* White mirror shells on black arms at the front of the door glass */}
            <Box p={[0.9 * side, 1.04, 0.6]} s={[0.12, 0.03, 0.05]} c={K.trim} />
            <Box p={[0.98 * side, 1.07, 0.6]} s={[0.12, 0.11, 0.16]} c={WHITE} />
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
        plane from over the hatch's top back past the tail; under its trailing half a second
        element, two struts between them so the gap reads as three windows; every element held
        inside the swept end plates' outline, so each meets the plates.
      */}
      <Box p={[0, 1.33, -1.6]} s={[1.3, 0.04, 0.2]} c={WING} r={[0.15, 0, 0]} shadow />
      <Box p={[0, 1.48, -1.93]} s={[WING_X * 2, 0.04, 0.62]} c={WING} r={[-0.03, 0, 0]} shadow />
      <Box p={[0, 1.5, -2.22]} s={[WING_X * 2, 0.05, 0.03]} c={WING} />
      <Box p={[0, 1.34, -2.1]} s={[WING_X * 2, 0.05, 0.28]} c={WING} r={[0.15, 0, 0]} shadow />
      {[-0.25, 0.25].map((x) => (
        <Box key={x} p={[x, 1.41, -2.1]} s={[0.03, 0.13, 0.22]} c={WING} />
      ))}
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Prism x={WING_X * side} points={WING_PLATE} thickness={0.03} c={WING} shadow />
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
