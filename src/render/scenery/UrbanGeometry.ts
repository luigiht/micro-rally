import { type BufferGeometry, Color } from 'three';
import { HOUSE_SLAB_TOP } from '@/game/stage/SceneryScatter';
import {
  AWNING_GREEN,
  awning,
  CAP,
  casement,
  cornice,
  FRAME,
  GLASS,
  GLASS_DARK,
  RAIL,
  STONE,
  strip,
  type Face,
} from './FacadeGeometry';
import { box } from './HouseGeometry';
import { acUnits, antenna, parapet, stairBulkhead, waterTower } from './RooftopGeometry';

/**
 * Two city kits, as part lists that BuildingGeometry merges (and puts a
 * foundation under): a five-storey apartment block with casements, a band
 * of balconies, cornices and an entrance awning under a roof with a water
 * tower, plant and a garden; and a nine-storey office tower in glass bands
 * between stone piers with a cantilevered canopy, a set-back crown, AC plant and a mast.
 * Same conventions as HouseGeometry: the origin is the footprint centre at
 * ground level, the door faces -z, pure white takes the instance tint (walls
 * or roof) and every other colour is fixed. Footprints must match
 * `BUILDING_SIZE`.
 */
const FLOOR = HOUSE_SLAB_TOP;

const WHITE = new Color('#ffffff');
const SLAB = new Color('#8c8a86');
const DOOR = new Color('#3a4650');

/* ----------------------------------------------------------------- block */

/** Footprint 14 × 11, five storeys of 3 m. */
export const BLOCK = { w: 14, d: 11, storey: 3, storeys: 5 } as const;
const blockWall = BLOCK.storey * BLOCK.storeys;
const blockTop = FLOOR + blockWall;

export function blockWallParts(): BufferGeometry[] {
  const { w, d, storey, storeys } = BLOCK;
  const front: Face = { facing: 'z', sign: -1, wall: -d / 2 };
  const back: Face = { facing: 'z', sign: 1, wall: d / 2 };
  const left: Face = { facing: 'x', sign: -1, wall: -w / 2 };
  const right: Face = { facing: 'x', sign: 1, wall: w / 2 };
  const parts: BufferGeometry[] = [box(w, blockWall, d, 0, FLOOR + blockWall / 2, 0, WHITE)];
  // Entrance: double door under a green awning, flanked by lobby windows; a stone plinth course.
  parts.push(
    box(w + 0.06, 0.6, d + 0.06, 0, FLOOR + 0.3, 0, STONE),
    box(2.4, 2.6, 0.08, 0, FLOOR + 1.3, front.wall - 0.02, FRAME),
    box(2.2, 2.4, 0.1, 0, FLOOR + 1.2, front.wall - 0.04, DOOR),
    ...awning(front, 0, FLOOR + 2.85, 3.0, AWNING_GREEN),
    ...strip(front, -4.5, FLOOR + 1.6, 2.6, 1.6, GLASS),
    ...strip(front, 4.5, FLOOR + 1.6, 2.6, 1.6, GLASS),
    ...cornice(w, d, FLOOR + storey + 0.1, 0.2, 0.26),
    ...cornice(w, d, blockTop - 0.2, 0.3, 0.34),
  );
  for (let s = 1; s < storeys; s++) {
    const y = FLOOR + s * storey + 1.5;
    // Front: a balcony per flat (slab and rail) with a casement behind; back and flanks: casements.
    for (const u of [-4.2, 0, 4.2]) {
      parts.push(
        ...casement(front, u, y + 0.1, 2.2, 1.6),
        box(3.0, 0.12, 0.5, u, y - 1.0, front.wall - 0.25, SLAB),
        box(3.0, 0.9, 0.06, u, y - 0.5, front.wall - 0.47, RAIL),
        ...casement(back, u, y, 2.0, 1.4),
      );
    }
    for (const v of [-3.2, 0, 3.2])
      parts.push(...casement(left, v, y, 1.6, 1.4), ...casement(right, v, y, 1.6, 1.4));
  }
  return parts;
}

export function blockRoofParts(): BufferGeometry[] {
  const { w, d } = BLOCK;
  const top = blockTop;
  return [
    ...parapet(w, d, top),
    ...stairBulkhead(3.5, 1.5, top, 3.2, 2.4),
    ...waterTower(-3.5, -2, top),
    ...acUnits(-1.6, 3.4, top, 2),
  ];
}

/* ---------------------------------------------------------------- office */

/** Footprint 12 × 12, eight storeys of 3.2 m and a set-back ninth as a crown. */
export const OFFICE = { w: 12, d: 12, storey: 3.2, storeys: 9, setback: 1.2 } as const;
const officeMain = OFFICE.storey * (OFFICE.storeys - 1);
/** The ledge the crown stands back from. */
export const OFFICE_LEDGE = FLOOR + officeMain;
const officeTop = FLOOR + OFFICE.storey * OFFICE.storeys;

export function officeWallParts(): BufferGeometry[] {
  const { w, d, storey, storeys, setback } = OFFICE;
  const front = -d / 2;
  const cw = w - 2 * setback;
  const cd = d - 2 * setback;
  const faces: Face[] = [
    { facing: 'z', sign: -1, wall: -d / 2 },
    { facing: 'z', sign: 1, wall: d / 2 },
    { facing: 'x', sign: -1, wall: -w / 2 },
    { facing: 'x', sign: 1, wall: w / 2 },
  ];
  const parts: BufferGeometry[] = [
    box(w, officeMain, d, 0, FLOOR + officeMain / 2, 0, WHITE),
    box(cw, storey, cd, 0, OFFICE_LEDGE + storey / 2, 0, WHITE),
  ];
  // Ground floor: a glazed lobby across the front with a revolving-door bay under a stone canopy on brackets.
  parts.push(
    box(w - 1.0, 3.0, 0.08, 0, FLOOR + 1.55, front - 0.02, FRAME),
    box(w - 1.2, 2.8, 0.1, 0, FLOOR + 1.55, front - 0.04, GLASS_DARK),
    box(2.2, 2.6, 0.12, 0, FLOOR + 1.3, front - 0.08, DOOR),
    box(6.0, 0.22, 0.56, 0, FLOOR + 3.35, front - 0.22, STONE),
    box(0.12, 0.5, 0.4, -2.7, FLOOR + 3.5, front - 0.2, CAP),
    box(0.12, 0.5, 0.4, 2.7, FLOOR + 3.5, front - 0.2, CAP),
    box(w + 0.4, 0.5, 0.3, 0, FLOOR + 3.5, front - 0.1, CAP),
    // Railing round the ledge, and the crown's own band.
    box(cw + 0.3, 0.05, 0.05, 0, OFFICE_LEDGE + 1.0, -(cd / 2) - 0.4, RAIL),
    box(cw + 0.3, 0.05, 0.05, 0, OFFICE_LEDGE + 1.0, cd / 2 + 0.4, RAIL),
    box(0.05, 0.05, cd + 0.3, -(cw / 2) - 0.4, OFFICE_LEDGE + 1.0, 0, RAIL),
    box(0.05, 0.05, cd + 0.3, cw / 2 + 0.4, OFFICE_LEDGE + 1.0, 0, RAIL),
  );
  for (const [sx, sz] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const)
    parts.push(
      box(0.06, 1.0, 0.06, sx * (cw / 2 + 0.4), OFFICE_LEDGE + 0.5, sz * (cd / 2 + 0.4), RAIL),
    );
  for (let s = 1; s < storeys - 1; s++) {
    const y = FLOOR + s * storey + 1.6;
    // A glass band right round each storey, in two tones so the facets read, under a dark spandrel,
    // broken by stone piers a third of the way along each face.
    const glass = s % 2 === 0 ? GLASS : GLASS_DARK;
    for (const f of faces) {
      const len = f.facing === 'z' ? w : d;
      parts.push(
        ...strip(f, 0, y, len - 0.8, 2.0, glass),
        box(
          f.facing === 'z' ? len + 0.1 : 0.08,
          0.3,
          f.facing === 'z' ? 0.08 : len + 0.1,
          f.facing === 'z' ? 0 : f.wall + f.sign * 0.03,
          y + 1.3,
          f.facing === 'z' ? f.wall + f.sign * 0.03 : 0,
          CAP,
        ),
      );
      for (const u of [-len / 6, len / 6])
        parts.push(
          f.facing === 'z'
            ? box(0.4, 2.3, 0.14, u, y, f.wall + f.sign * 0.07, STONE)
            : box(0.14, 2.3, 0.4, f.wall + f.sign * 0.07, y, u, STONE),
        );
    }
  }
  // The crown's glazing.
  const y = OFFICE_LEDGE + 1.6;
  parts.push(
    ...strip({ facing: 'z', sign: -1, wall: -cd / 2 }, 0, y, cw - 1.2, 1.8, GLASS_DARK),
    ...strip({ facing: 'z', sign: 1, wall: cd / 2 }, 0, y, cw - 1.2, 1.8, GLASS_DARK),
    ...strip({ facing: 'x', sign: -1, wall: -cw / 2 }, 0, y, cd - 1.2, 1.8, GLASS_DARK),
    ...strip({ facing: 'x', sign: 1, wall: cw / 2 }, 0, y, cd - 1.2, 1.8, GLASS_DARK),
  );
  return parts;
}

export function officeRoofParts(): BufferGeometry[] {
  const { w, d, setback } = OFFICE;
  const cw = w - 2 * setback;
  const cd = d - 2 * setback;
  return [
    ...parapet(cw, cd, officeTop, 0.9, 0.35),
    ...acUnits(-2.6, 1.6, officeTop, 3, 1.4),
    ...antenna(2.6, -2.2, officeTop, 4.0),
    box(1.6, 0.9, 1.6, 2.6, officeTop + 0.45, 1.8, WHITE),
  ];
}
