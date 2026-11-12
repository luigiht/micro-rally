import { type BufferGeometry, Color } from 'three';
import { HOUSE_SLAB_TOP } from '@/game/stage/SceneryScatter';
import {
  archBay,
  BRICK,
  casement,
  cornice,
  fireEscape,
  FRAME,
  quoins,
  type Face,
} from './FacadeGeometry';
import { box } from './HouseGeometry';
import { acUnits, parapet, stairBulkhead, waterTower } from './RooftopGeometry';

/**
 * The city's brick tenement: a five-storey walk-up on a 12 × 10 footprint.
 * A brick ground floor with three arched bays and a door under a cornice,
 * four storeys of casements with lintels and sills, quoins up every corner,
 * a fire escape zig-zagging down the +x flank, and a roof with a parapet,
 * stair bulkhead, water tower, AC units and a planter garden. Same
 * conventions as HouseGeometry: origin at the footprint centre, door to -z,
 * pure white takes the instance tint.
 */
const FLOOR = HOUSE_SLAB_TOP;
const WHITE = new Color('#ffffff');
const DOOR = new Color('#3a4650');

/** Footprint 12 × 10, five storeys of 3 m. */
export const TENEMENT = { w: 12, d: 10, storey: 3, storeys: 5 } as const;
const wallH = TENEMENT.storey * TENEMENT.storeys;
const top = FLOOR + wallH;

export function tenementWallParts(): BufferGeometry[] {
  const { w, d, storey, storeys } = TENEMENT;
  const front: Face = { facing: 'z', sign: -1, wall: -d / 2 };
  const back: Face = { facing: 'z', sign: 1, wall: d / 2 };
  const left: Face = { facing: 'x', sign: -1, wall: -w / 2 };
  const right: Face = { facing: 'x', sign: 1, wall: w / 2 };
  const parts: BufferGeometry[] = [
    box(w, wallH, d, 0, FLOOR + wallH / 2, 0, WHITE),
    // Brick ground floor right round, with a stone cornice over it.
    box(w + 0.06, storey - 0.1, d + 0.06, 0, FLOOR + (storey - 0.1) / 2, 0, BRICK),
    ...cornice(w, d, FLOOR + storey + 0.05, 0.2, 0.3),
    ...cornice(w, d, top - 0.2, 0.3, 0.36),
    ...quoins(w, d, FLOOR + storey + 0.4, top - 0.5),
    // Door with a stone surround, between two arched bays.
    box(1.6, 2.7, 0.08, 0, FLOOR + 1.35, -d / 2 - 0.06, FRAME),
    box(1.3, 2.5, 0.1, 0, FLOOR + 1.25, -d / 2 - 0.08, DOOR),
    box(2.0, 0.2, 0.4, 0, FLOOR + 0.1, -d / 2 - 0.2, FRAME),
    ...archBay(front, -3.8, FLOOR + 1.45, 2.0, 2.3),
    ...archBay(front, 3.8, FLOOR + 1.45, 2.0, 2.3),
    ...archBay(back, -3.0, FLOOR + 1.45, 1.6, 2.3),
    ...archBay(back, 3.0, FLOOR + 1.45, 1.6, 2.3),
    ...fireEscape(right, 0, storey, storeys, FLOOR),
  ];
  for (let s = 1; s < storeys; s++) {
    const y = FLOOR + s * storey + 1.6;
    for (const u of [-3.8, 0, 3.8]) {
      parts.push(...casement(front, u, y), ...casement(back, u, y));
    }
    for (const v of [-2.4, 2.4]) parts.push(...casement(left, v, y));
    for (const v of [-3.3, 3.3]) parts.push(...casement(right, v, y, 1.0, 1.4));
  }
  return parts;
}

export function tenementRoofParts(): BufferGeometry[] {
  const { w, d } = TENEMENT;
  return [
    ...parapet(w, d, top),
    ...stairBulkhead(-3, 2, top, 2.8, 2.2),
    ...waterTower(3.5, -2, top),
    ...acUnits(-4.6, -3.2, top, 2),
  ];
}
