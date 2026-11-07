import { type BufferGeometry, Color } from 'three';
import { HOUSE_SLAB_TOP } from '@/game/stage/SceneryScatter';
import {
  casement,
  cornice,
  FRAME,
  GLASS_DARK,
  RAIL,
  STONE,
  strip,
  type Face,
} from './FacadeGeometry';
import { box } from './HouseGeometry';
import { parapet, pergola, roofGarden, stairBulkhead } from './RooftopGeometry';

/**
 * The city's arcaded mansion block: three storeys on a 10 × 10 footprint.
 * The ground floor stands back behind a stone colonnade of four arches with
 * shop windows and a door in the recess, two storeys of tall casements with
 * balconettes above under cornices, and a roof garden with a pergola behind
 * the parapet. Same conventions as HouseGeometry: origin at the footprint
 * centre, door to -z, pure white takes the instance tint.
 */
const FLOOR = HOUSE_SLAB_TOP;
const WHITE = new Color('#ffffff');
const DOOR = new Color('#4a3a2a');

/** Footprint 10 × 10, three storeys of 3.2 m; the colonnade is this deep. */
export const ARCADE = { w: 10, d: 10, storey: 3.2, storeys: 3, colonnade: 1.4 } as const;
const wallH = ARCADE.storey * ARCADE.storeys;
const top = FLOOR + wallH;

export function arcadeWallParts(): BufferGeometry[] {
  const { w, d, storey, storeys, colonnade } = ARCADE;
  const front: Face = { facing: 'z', sign: -1, wall: -d / 2 };
  const recess: Face = { facing: 'z', sign: -1, wall: -d / 2 + colonnade };
  const back: Face = { facing: 'z', sign: 1, wall: d / 2 };
  const left: Face = { facing: 'x', sign: -1, wall: -w / 2 };
  const right: Face = { facing: 'x', sign: 1, wall: w / 2 };
  const upper = wallH - storey;
  const parts: BufferGeometry[] = [
    // Upper storeys over the full footprint; the ground floor set back behind the colonnade.
    box(w, upper, d, 0, FLOOR + storey + upper / 2, 0, WHITE),
    box(w, storey, d - colonnade, 0, FLOOR + storey / 2, colonnade / 2, WHITE),
    // Stone beam the arches spring from, and the piers under it.
    box(
      w + 0.1,
      0.4,
      colonnade + 0.1,
      0,
      FLOOR + storey - 0.2,
      -d / 2 + colonnade / 2 - 0.02,
      STONE,
    ),
    ...cornice(w, d, FLOOR + storey + 0.25, 0.22, 0.3),
    ...cornice(w, d, top - 0.2, 0.3, 0.36),
    // Door and shop windows on the recessed wall.
    box(1.4, 2.6, 0.08, 1.2, FLOOR + 1.3, recess.wall - 0.02, FRAME),
    box(1.1, 2.4, 0.1, 1.2, FLOOR + 1.2, recess.wall - 0.04, DOOR),
    ...strip(recess, -2.6, FLOOR + 1.5, 2.6, 1.8, GLASS_DARK),
    ...strip(recess, 3.6, FLOOR + 1.5, 1.6, 1.8, GLASS_DARK),
  ];
  const pierX = [-4.75, -2.375, 0, 2.375, 4.75];
  for (const x of pierX)
    parts.push(
      box(
        0.5,
        storey - 0.4,
        colonnade,
        x,
        FLOOR + (storey - 0.4) / 2,
        -d / 2 + colonnade / 2,
        STONE,
      ),
    );
  // Stepped arch heads between the piers: two springers and a keystone, just under the beam.
  for (let i = 0; i + 1 < pierX.length; i++) {
    const u = (pierX[i]! + pierX[i + 1]!) / 2;
    const span = pierX[i + 1]! - pierX[i]! - 0.5;
    const y = FLOOR + storey - 0.55;
    parts.push(
      box(
        span / 2 - 0.1,
        0.2,
        colonnade - 0.1,
        u - span / 4 - 0.02,
        y,
        -d / 2 + colonnade / 2,
        STONE,
      ),
      box(
        span / 2 - 0.1,
        0.2,
        colonnade - 0.1,
        u + span / 4 + 0.02,
        y,
        -d / 2 + colonnade / 2,
        STONE,
      ),
      box(0.5, 0.34, colonnade - 0.05, u, y - 0.04, -d / 2 + colonnade / 2, STONE),
    );
  }
  // Flank arches are solid: a pilaster at each flank's front corner.
  for (const x of [-w / 2 + 0.25, w / 2 - 0.25])
    parts.push(box(0.5, storey - 0.4, 0.3, x, FLOOR + (storey - 0.4) / 2, -d / 2 + 0.15, STONE));
  for (let s = 1; s < storeys; s++) {
    const y = FLOOR + s * storey + 1.55;
    for (const u of [-3.2, 0, 3.2]) {
      parts.push(
        ...casement(front, u, y, 1.0, 2.0),
        box(1.7, 0.1, 0.4, u, y - 1.2, -d / 2 - 0.2, STONE),
        box(1.6, 0.9, 0.05, u, y - 0.7, -d / 2 - 0.38, RAIL),
        ...casement(back, u, y, 1.2, 1.5),
      );
    }
    for (const v of [-2.4, 2.4])
      parts.push(...casement(left, v, y, 1.2, 1.5), ...casement(right, v, y, 1.2, 1.5));
  }
  return parts;
}

export function arcadeRoofParts(): BufferGeometry[] {
  const { w, d } = ARCADE;
  return [
    ...parapet(w, d, top),
    ...roofGarden(0, 0, top, 6, 2),
    ...pergola(2.5, 3.0, top),
    ...stairBulkhead(-3, -2.8, top, 2.6, 2.0),
  ];
}
