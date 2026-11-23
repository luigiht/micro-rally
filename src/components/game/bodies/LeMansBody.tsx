'use client';

import { useEffect, useMemo, type Ref } from 'react';
import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, type Group } from 'three';
import type { CarSpec } from '@/game/vehicle/CarSpec';
import { box, merge, paint } from '@/render/scenery/HouseGeometry';
import {
  DIMENSIONS as D,
  LEMANS_CANOPY,
  LEMANS_CANOPY_LIVERY,
  LEMANS_COLORS as K,
  LEMANS_LIVERY,
  LEMANS_SHELL,
} from '@/render/car/LeMansShape';
import { Box, prismPositions } from '../CarParts';
import { CarHullMesh } from './CarHullMesh';

const SIDES = [1, -1] as const;
const C = {
  blue: new Color(K.blue),
  trim: new Color(K.trim),
  bay: new Color(K.bay),
  steel: new Color('#8a8d93'),
} as const;
const TAIL_RED = '#d9343a';
const AMBER = '#f4a21c';

/**
 * The twin fins over the rear fenders in (z, y): rising from the fender line ahead of the rear
 * axle to stand clear of the deck at the tail.
 */
const FIN: readonly (readonly [number, number])[] = [
  [-1.2, 0.82],
  [-2.09, 0.9],
  [-2.09, 1.03],
  [-1.55, 0.92],
];
const FIN_X = 0.9;
/** Bare a part to positions and colours, so all of them merge into one mesh. */
function bare(g: BufferGeometry): BufferGeometry {
  const flat = g.index ? g.toNonIndexed() : g;
  flat.deleteAttribute('uv');
  flat.deleteAttribute('normal');
  return flat;
}
const part = (g: BufferGeometry, c: Color) => bare(paint(g, c));
/**
 * Everything static besides the hulls, merged into one vertex-coloured mesh: the fins, the spoiler
 * lip, the tail panel, the frame under the tail, the engine and gearbox, the exhausts, the mirror and the toe-board inside the cockpit.
 */
function buildTail(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const side of SIDES) {
    const p = prismPositions(FIN, 0.04);
    for (let i = 0; i < p.length; i += 3) p[i] = p[i]! + FIN_X * side;
    const fin = new BufferGeometry();
    fin.setAttribute('position', new BufferAttribute(p, 3));
    parts.push(paint(fin, C.blue));
    // Frame diagonals under the overhang, and an exhaust each side of the gearbox.
    parts.push(part(box(0.025, 0.025, 0.62, 0.62 * side, 0.52, -1.8, C.trim), C.trim));
    parts.push(
      part(
        new CylinderGeometry(0.045, 0.045, 0.32, 8)
          .rotateX(Math.PI / 2)
          .translate(0.28 * side, 0.3, -2.0),
        C.steel,
      ),
    );
  }
  parts.push(
    // The spoiler lip across the tail between the fins, and the black tail panel under it.
    part(box(1.72, 0.03, 0.16, 0, D.lip - 0.01, -2.03, C.blue), C.blue),
    part(box(1.5, 0.22, 0.04, 0, 0.64, -2.04, C.trim), C.trim),
    // The engine and gearbox seen under the tail, closing the view through the open bay.
    part(box(1.3, 0.46, 0.5, 0, 0.5, -1.65, C.bay), C.bay),
    part(box(0.5, 0.28, 0.3, 0, 0.36, -1.95, C.steel), C.steel),
    // Dark toe-board at the screen's foot: hides the bonnet's rise past the cabin floor from the seat.
    part(box(0.8, 0.12, 0.19, 0, 0.56, 0.86, C.bay), C.bay),
  );
  const merged = merge(parts);
  merged.computeVertexNormals();
  return merged;
}

/** A mirror on each door top: a black stalk and a blue housing. */
function buildMirror(): BufferGeometry {
  const merged = merge(
    SIDES.flatMap((side) => [
      part(box(0.02, 0.07, 0.02, 0.55 * side, 0.71, 0.38, C.trim), C.trim),
      part(box(0.12, 0.06, 0.05, 0.6 * side, 0.76, 0.38, C.blue), C.blue),
    ]),
  );
  merged.computeVertexNormals();
  return merged;
}

function VertexParts({ geometry }: { geometry: BufferGeometry }) {
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial vertexColors flatShading />
    </mesh>
  );
}

/**
 * 1970 Le Mans short-tail coupé (`LeMansShape`, `LEMANS_LIVERY`). Coordinates in the root frame;
 * the shell stands on the ground plane. `cabinRef` holds the canopy and the mirror, hidden from
 * the driver's seat. Wheels are the car model's own, on the spec's axles.
 */
export function LeMansBody({ cabinRef }: { spec: CarSpec; cabinRef: Ref<Group> }) {
  const tail = useMemo(() => buildTail(), []);
  const mirror = useMemo(() => buildMirror(), []);
  return (
    <group>
      <CarHullMesh spec={LEMANS_SHELL} livery={LEMANS_LIVERY} />
      <group ref={cabinRef}>
        <CarHullMesh spec={LEMANS_CANOPY} livery={LEMANS_CANOPY_LIVERY} />
        <VertexParts geometry={mirror} />
      </group>
      <VertexParts geometry={tail} />
      {SIDES.map((side) => (
        <group key={side}>
          {/* Tail lamps on the black panel under the lip: red outboard, amber inboard */}
          <Box p={[0.62 * side, 0.64, -2.065]} s={[0.2, 0.08, 0.02]} c={TAIL_RED} glow={0.6} />
          <Box p={[0.45 * side, 0.64, -2.065]} s={[0.1, 0.08, 0.02]} c={AMBER} glow={0.5} />
        </group>
      ))}
    </group>
  );
}
