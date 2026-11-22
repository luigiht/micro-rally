'use client';

import type { Ref } from 'react';
import type { Group } from 'three';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import { pillarStrip } from '@/render/car/PillarStrip';
import { SCHWABEN_BLUE, SCHWABEN_LIVERY, SCHWABEN_RED } from '@/render/car/SchwabenLivery';
import { SCHWABEN_COLORS, SCHWABEN_HULL, SCHWABEN_ROOF_LINE } from '@/render/car/SchwabenShape';
import { ArchLip, Box, Disc, Lamp, Prism, Tube } from '../CarParts';
import { CarHullMesh, PillarMesh } from './CarHullMesh';

const K = {
  body: SCHWABEN_COLORS.body,
  trim: SCHWABEN_COLORS.trim,
  glass: SCHWABEN_COLORS.glass,
  blue: SCHWABEN_BLUE,
  red: SCHWABEN_RED,
  head: '#fff6d0',
  amber: '#f2901c',
  tail: '#d8231b',
  reverse: '#f4f1ea',
  chrome: '#cfd2d6',
  steel: '#55555c',
} as const;

const SIDES = [1, -1] as const;

/**
 * A slim body-coloured strip folded over the roof's edge each side, flush with the glass: the
 * A-pillar, then on along the roof and down the fastback to the tail, framing the glasshouse.
 */
const ROOF_LINES = pillarStrip(SCHWABEN_ROOF_LINE, SCHWABEN_HULL.rounding ?? {}, 0.03, 0.006);

/**
 * The whale-tail spoiler in (z, y): a broad plateau standing on the engine lid from the rear
 * glass's foot back past the tail, its underside following the lid down so it sits on it. (Its
 * turned-up rubber lip is a strip of its own: `Prism` points each face away from the outline's
 * centre, which a thin lip on so long an outline would turn inside out.)
 */
const WHALE_TAIL: readonly (readonly [number, number])[] = [
  [-1.3, 0.94],
  [-1.36, 0.99],
  [-1.98, 1.0],
  [-2.03, 0.97],
  [-2.0, 0.88],
  [-1.9, 0.86],
];
const WHALE_TAIL_WIDTH = 1.36;
/** The louvres let into the spoiler's top, across the engine's intake. */
const LOUVRES = [-1.46, -1.54, -1.62, -1.7, -1.78, -1.86];
/**
 * How far the headlamps lean back from upright, radians (31°): the front wings' faces where the
 * lamps sit fall back 0.6 m in z per metre up (`SchwabenShape`), so the lamps lie flush on them.
 */
const HEADLAMP_LEAN = 0.54;
/** The tail's lamp bar (after the reference): its height and the tail face it stands on. */
const TAIL_Y = 0.51;
const TAIL_Z = -1.995;
/** The lenses stand just proud of the bar's black face. */
const LENS_Z = TAIL_Z - 0.01;
/** The four long-range lamps across the pod on the bonnet's front. */
const POD_LAMPS = [-0.31, -0.105, 0.105, 0.31] as const;

/**
 * Early-1980s rear-engined rally coupé (`SchwabenShape`, `SchwabenLivery`).
 * Coordinates in the root frame. `cabinRef` holds the mirrors.
 */
export function SchwabenBody({ spec, cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const front = spec.cgToFront;
  const rear = -spec.cgToRear;
  return (
    <group position={[0, -0.1, 0]}>
      <CarHullMesh spec={SCHWABEN_HULL} livery={SCHWABEN_LIVERY} />
      <PillarMesh positions={ROOF_LINES} color={K.body} />
      <group ref={cabinRef}>
        {SIDES.map((side) => (
          <group key={side}>
            {/* Red door mirrors on short stalks at the front of the door glass, wide and slim, glass facing back */}
            <Box p={[0.75 * side, 0.92, 0.61]} s={[0.15, 0.03, 0.04]} c={K.trim} />
            <Box p={[0.9 * side, 0.95, 0.62]} s={[0.17, 0.09, 0.045]} c={K.red} />
            <Box p={[0.905 * side, 0.95, 0.594]} s={[0.145, 0.07, 0.01]} c={K.glass} />
          </group>
        ))}
      </group>
      {/* Wipers parked at the screen's foot */}
      <Box p={[0.2, 0.9, 0.74]} s={[0.4, 0.012, 0.015]} c={K.trim} r={[0, 0.08, 0]} />
      <Box p={[-0.22, 0.9, 0.74]} s={[0.4, 0.012, 0.015]} c={K.trim} r={[0, -0.06, 0]} />
      {/* The lamp pod on the bonnet's front edge, between the headlamps and level with them: four
          long-range lamps in a white housing standing out over the nose */}
      <Box p={[0, 0.75, 2.02]} s={[0.86, 0.13, 0.2]} c={K.body} shadow />
      <Box p={[0, 0.685, 2.02]} s={[0.88, 0.02, 0.22]} c={K.trim} />
      {POD_LAMPS.map((x) => (
        <Lamp key={x} p={[x, 0.76, 2.12]} radius={0.07} c={K.head} glow={0.55} sides={14} />
      ))}
      {SIDES.map((side) => (
        <group key={side}>
          <ArchLip x={0.86 * side} z={front} radius={spec.wheelRadius} c={K.blue} tube={0.03} />
          <ArchLip x={0.89 * side} z={rear} radius={spec.wheelRadius} c={K.blue} tube={0.03} />
          {/* Round headlamps in the front wings, chrome rings round them, laid flush on the wings'
              sloping front faces so they look a little up the road */}
          <group position={[0.635 * side, 0.705, 2.085]} rotation={[-HEADLAMP_LEAN, 0, 0]}>
            <Disc p={[0, 0, 0]} radius={0.11} depth={0.05} c={K.chrome} />
            {/* Its dark rim stands 1 cm proud of the chrome ring's face, so the two never fight */}
            <Lamp p={[0, 0, 0.03]} radius={0.095} c={K.head} glow={0.6} sides={16} />
          </group>
          {/* Amber indicators at the bumper's corners */}
          <Box p={[0.64 * side, 0.46, 2.15]} s={[0.12, 0.05, 0.04]} c={K.amber} glow={0.3} />
          {/* The tail lamp at each end of the lamp bar: amber outboard, a white reversing lamp,
              red inboard, then the red end of the centre band, each a thin black line apart */}
          <Box p={[0.72 * side, TAIL_Y, LENS_Z]} s={[0.12, 0.1, 0.02]} c={K.amber} glow={0.35} />
          <Box p={[0.645 * side, TAIL_Y, LENS_Z]} s={[0.02, 0.1, 0.02]} c={K.reverse} />
          <Box p={[0.5775 * side, TAIL_Y, LENS_Z]} s={[0.095, 0.1, 0.02]} c={K.tail} glow={0.45} />
          <Box p={[0.455 * side, TAIL_Y, LENS_Z]} s={[0.12, 0.1, 0.02]} c={K.tail} glow={0.45} />
          {/* Black overriders on the bumper, twin exhausts under its corners */}
          <Box p={[0.34 * side, 0.4, -1.995]} s={[0.05, 0.1, 0.03]} c={K.trim} />
          <Tube
            a={[0.42 * side, 0.27, -1.75]}
            b={[0.42 * side, 0.27, -2.05]}
            r={0.035}
            c={K.steel}
          />
        </group>
      ))}
      {/* One black bar across the tail holding the lamps and, between them, the red centre band */}
      <Box p={[0, TAIL_Y, TAIL_Z]} s={[1.6, 0.13, 0.03]} c={K.trim} />
      <Box p={[0, TAIL_Y, LENS_Z]} s={[0.77, 0.1, 0.02]} c={K.tail} glow={0.45} />
      {/* Black bumper lips front and rear, and the plate in the rear bumper */}
      <Box p={[0, 0.28, 2.15]} s={[1.3, 0.04, 0.1]} c={K.trim} />
      <Box p={[0, 0.3, -1.97]} s={[1.3, 0.04, 0.08]} c={K.trim} />
      <Box p={[0, 0.38, -1.995]} s={[0.36, 0.11, 0.01]} c={K.trim} />
      {/* The whale-tail spoiler on the engine lid: louvres across its top, a black rubber lip */}
      <Prism x={0} points={WHALE_TAIL} thickness={WHALE_TAIL_WIDTH} c={K.body} shadow />
      <Box p={[0, 1.015, -2.0]} s={[WHALE_TAIL_WIDTH + 0.01, 0.04, 0.03]} c={K.trim} />
      {LOUVRES.map((z) => (
        <Box key={z} p={[0, 1.0, z]} s={[0.9, 0.006, 0.035]} c={K.trim} />
      ))}
    </group>
  );
}
