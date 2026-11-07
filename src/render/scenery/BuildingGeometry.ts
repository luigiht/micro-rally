import { BoxGeometry, type BufferGeometry, Color } from 'three';
import { HOUSE_SLAB_TOP } from '@/game/stage/SceneryScatter';
import type { BuildingStyle } from '@/game/stage/Town';
import {
  HALL,
  hallRoofParts,
  hallWallParts,
  TOWER,
  towerRoofParts,
  towerWallParts,
} from './CivicGeometry';
import { box, gableGeometry, merge, paint, window } from './HouseGeometry';
import { ARCADE, arcadeRoofParts, arcadeWallParts } from './ArcadeGeometry';
import { TENEMENT, tenementRoofParts, tenementWallParts } from './TenementGeometry';
import {
  BLOCK,
  blockRoofParts,
  blockWallParts,
  OFFICE,
  OFFICE_LEDGE,
  officeRoofParts,
  officeWallParts,
} from './UrbanGeometry';

/**
 * Town building kits, one walls and one roof geometry per `BuildingStyle`,
 * instanced exactly like the cottage in HouseGeometry: vertex-coloured, with
 * pure white taking the per-instance tint (walls pair / roof pair) and every
 * other colour fixed. The origin is the footprint centre at ground level, x
 * runs along the street front, the door faces -z. Towns sit on hilly ground
 * and each building is placed at its highest ground corner, so every walls
 * kit carries a slab-coloured foundation down to `FOUNDATION_BOTTOM`.
 * Townhouse and shop live here; tower and hall are in CivicGeometry, the
 * city's block and office in UrbanGeometry, its tenement and arcade in
 * their own files.
 */
const FLOOR = HOUSE_SLAB_TOP;
const FOUNDATION_BOTTOM = -1.6;
/** The roof soffit sits this far below the wall top so roof and wall overlap. */
const ROOF_SEAT = 0.12;
const EAVE = 0.22;

const WHITE = new Color('#ffffff');
const SLAB = new Color('#8c8a86');
const DOOR = new Color('#5a3a22');
const WINDOW = new Color('#7fa3bd');
const FRAME = new Color('#f7f3ea');
const BRICK = new Color('#8d5a4a');
const CAP = new Color('#4a4744');
const AWNING_RED = new Color('#d9343a');
const AWNING_PALE = new Color('#f4f1ea');
const SIGN = new Color('#8a2a2a');

/** Full footprints (width across the street front × depth); must match BUILDING_SIZE in TownGenerator. */
const FOOTPRINT: Readonly<Record<BuildingStyle, { w: number; d: number }>> = {
  townhouse: { w: 8, d: 7 },
  shop: { w: 10, d: 8 },
  tower: { w: 6, d: 6 },
  hall: { w: 12, d: 9 },
  block: { w: BLOCK.w, d: BLOCK.d },
  office: { w: OFFICE.w, d: OFFICE.d },
  tenement: { w: TENEMENT.w, d: TENEMENT.d },
  arcade: { w: ARCADE.w, d: ARCADE.d },
};

/** Foundation under the whole footprint plus a 0.3 m lip, from the plinth top down to FOUNDATION_BOTTOM. */
function foundation(style: BuildingStyle): BufferGeometry {
  const { w, d } = FOOTPRINT[style];
  const h = FLOOR - FOUNDATION_BOTTOM;
  return box(w + 0.6, h, d + 0.6, 0, FLOOR - h / 2, 0, SLAB);
}

/** Box tilted about x by `angle` (negative drops the -z end), for awnings and skylights. */
function tilted(
  w: number,
  t: number,
  d: number,
  angle: number,
  x: number,
  y: number,
  z: number,
  c: Color,
) {
  return paint(new BoxGeometry(w, t, d).rotateX(angle).translate(x, y, z), c);
}

/* ------------------------------------------------------------- townhouse */

/** Footprint 8 × 7, two storeys of 2.7 m under a gable with the ridge along the street. */
const TOWNHOUSE = { w: 8, d: 7, wall: 5.4, roof: 2.4, overhang: 0.4 } as const;
const townhouseTop = FLOOR + TOWNHOUSE.wall;
/** Eave line (bottom of the slopes). */
const townhouseEave = townhouseTop - ROOF_SEAT + EAVE;
/** Dormer on the front slope: its base sits just under the slope at its front face. */
const DORMER = { w: 1.5, h: 1.2, d: 1.6, x: 0.2, z: -2.2, y: townhouseEave + 0.45 } as const;

function townhouseWallParts(): BufferGeometry[] {
  const { w, d, wall } = TOWNHOUSE;
  const front = -d / 2;
  const dormerFront = DORMER.z - DORMER.d / 2;
  return [
    box(w, wall, d, 0, FLOOR + wall / 2, 0, WHITE),
    // Door right of centre on a step, under a flat canopy on two posts.
    box(1.2, 2.3, 0.08, 1.8, FLOOR + 1.35, front - 0.02, FRAME),
    box(1.0, 2.1, 0.1, 1.8, FLOOR + 1.25, front - 0.04, DOOR),
    box(1.8, 0.2, 0.3, 1.8, FLOOR + 0.1, front - 0.15, SLAB),
    box(1.8, 0.1, 0.45, 1.8, FLOOR + 2.6, front - 0.225, FRAME),
    box(0.1, 2.4, 0.1, 1.0, FLOOR + 1.4, front - 0.25, FRAME),
    box(0.1, 2.4, 0.1, 2.6, FLOOR + 1.4, front - 0.25, FRAME),
    // Front: one lower window, two upper. Sides: one per storey. Back: three.
    ...window(-1.4, FLOOR + 1.6, front, 'z', -1),
    ...window(-1.4, FLOOR + 4.3, front, 'z', -1),
    ...window(1.8, FLOOR + 4.3, front, 'z', -1),
    ...window(-w / 2, FLOOR + 1.6, 0.6, 'x', -1),
    ...window(-w / 2, FLOOR + 4.3, 0.6, 'x', -1),
    ...window(w / 2, FLOOR + 1.6, 0.6, 'x', 1),
    ...window(w / 2, FLOOR + 4.3, 0.6, 'x', 1),
    ...window(-1.8, FLOOR + 4.3, d / 2, 'z', 1),
    ...window(1.8, FLOOR + 4.3, d / 2, 'z', 1),
    ...window(1.4, FLOOR + 1.6, d / 2, 'z', 1),
    // Dormer box with its window.
    box(DORMER.w, DORMER.h, DORMER.d, DORMER.x, DORMER.y + DORMER.h / 2, DORMER.z, WHITE),
    box(0.8, 0.7, 0.08, DORMER.x, DORMER.y + 0.65, dormerFront - 0.02, FRAME),
    box(0.6, 0.5, 0.1, DORMER.x, DORMER.y + 0.65, dormerFront - 0.04, WINDOW),
    // Chimney through the back slope, clearing the ridge.
    box(0.7, 2.0, 0.7, 2.6, townhouseEave + 1.7, 1.2, BRICK),
    box(0.84, 0.12, 0.84, 2.6, townhouseEave + 2.7, 1.2, CAP),
  ];
}

function townhouseRoofParts(): BufferGeometry[] {
  const { w, d, roof, overhang } = TOWNHOUSE;
  const y0 = townhouseTop - ROOF_SEAT;
  const run = d / 2 + overhang;
  const pitch = Math.atan(roof / run);
  // Skylight on the back slope: the slope surface at z = 1.6 and its unit normal.
  const sz = 1.6;
  const sy = y0 + EAVE + roof * (1 - sz / run);
  const ny = Math.cos(pitch);
  const nz = Math.sin(pitch);
  return [
    gableGeometry(w + overhang * 2, d + overhang * 2, roof + EAVE, EAVE, y0, WHITE),
    box(w + overhang * 2 + 0.1, 0.12, 0.3, 0, y0 + roof + EAVE, 0, WHITE),
    tilted(1.0, 0.12, 1.2, pitch, -2.0, sy + 0.04 * ny, sz + 0.04 * nz, FRAME),
    tilted(0.8, 0.12, 1.0, pitch, -2.0, sy + 0.07 * ny, sz + 0.07 * nz, WINDOW),
    gableGeometry(
      DORMER.w + 0.3,
      DORMER.d + 0.2,
      0.7,
      0.1,
      DORMER.y + DORMER.h - 0.05,
      WHITE,
      DORMER.x,
      DORMER.z,
    ),
  ];
}

/* ------------------------------------------------------------------ shop */

/** Footprint 10 × 8: a 3.4 m shop floor, a 2.7 m storey, a flat roof behind a 0.6 m parapet. */
const SHOP = { w: 10, d: 8, wall: 6.1 } as const;
const shopTop = FLOOR + SHOP.wall;
/** Awning pitch and the stripe count across the 6.6 m shop window. */
const AWNING_TILT = -0.5;
const AWNING_STRIPES = 11;

function awning(front: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < AWNING_STRIPES; i++) {
    const red = i % 2 === 0;
    const x = -4.3 + 0.3 + 0.6 * i;
    // Red stripes are a little thicker so no two stripes share a vertex.
    const t = red ? 0.12 : 0.08;
    const c = red ? AWNING_RED : AWNING_PALE;
    parts.push(tilted(0.6, t, 0.52, AWNING_TILT, x, FLOOR + 2.68, front - 0.198, c));
  }
  return parts;
}

function shopWallParts(): BufferGeometry[] {
  const { w, d, wall } = SHOP;
  const front = -d / 2;
  const top = shopTop;
  return [
    box(w, wall, d, 0, FLOOR + wall / 2, 0, WHITE),
    // Shop window band on a dark stall riser, with three mullions.
    box(6.6, 0.5, 0.12, -1, FLOOR + 0.25, front - 0.03, CAP),
    box(6.6, 2.1, 0.08, -1, FLOOR + 1.55, front - 0.02, FRAME),
    box(6.3, 1.85, 0.1, -1, FLOOR + 1.55, front - 0.04, WINDOW),
    box(0.12, 1.85, 0.12, -2.65, FLOOR + 1.55, front - 0.07, FRAME),
    box(0.12, 1.85, 0.12, -1.0, FLOOR + 1.55, front - 0.07, FRAME),
    box(0.12, 1.85, 0.12, 0.65, FLOOR + 1.55, front - 0.07, FRAME),
    // Glazed door: frame, kick panel, glass.
    box(1.4, 2.7, 0.08, 3.4, FLOOR + 1.35, front - 0.02, FRAME),
    box(1.1, 0.8, 0.1, 3.4, FLOOR + 0.5, front - 0.04, DOOR),
    box(1.1, 1.6, 0.1, 3.4, FLOOR + 1.75, front - 0.04, WINDOW),
    ...awning(front),
    // Sign board across the whole front, above the awning.
    box(8.8, 0.7, 0.12, 0, FLOOR + 3.3, front - 0.04, SIGN),
    // Upper storey: three front windows, two per side plus a lower one, two at the back.
    ...window(-2.6, FLOOR + 4.9, front, 'z', -1),
    ...window(0, FLOOR + 4.9, front, 'z', -1),
    ...window(2.6, FLOOR + 4.9, front, 'z', -1),
    ...window(-w / 2, FLOOR + 4.9, -1.5, 'x', -1),
    ...window(-w / 2, FLOOR + 4.9, 1.5, 'x', -1),
    ...window(-w / 2, FLOOR + 1.6, 1.5, 'x', -1),
    ...window(w / 2, FLOOR + 4.9, -1.5, 'x', 1),
    ...window(w / 2, FLOOR + 4.9, 1.5, 'x', 1),
    ...window(w / 2, FLOOR + 1.6, 1.5, 'x', 1),
    ...window(-2, FLOOR + 4.9, d / 2, 'z', 1),
    ...window(2, FLOOR + 4.9, d / 2, 'z', 1),
    // Parapet ring, slightly proud of the walls; the sides tuck into the front and back.
    box(w + 0.1, 0.6, 0.35, 0, top + 0.3, -(d / 2) - 0.125, WHITE),
    box(w + 0.1, 0.6, 0.35, 0, top + 0.3, d / 2 + 0.125, WHITE),
    box(0.35, 0.58, d - 0.2, -(w / 2) - 0.125, top + 0.29, 0, WHITE),
    box(0.35, 0.58, d - 0.2, w / 2 + 0.125, top + 0.29, 0, WHITE),
  ];
}

function shopRoofParts(): BufferGeometry[] {
  const { w, d } = SHOP;
  const top = shopTop;
  return [
    // Roof deck inside the parapet, coping on top of it, plant room and a vent.
    box(w - 0.4, 0.3, d - 0.4, 0, top + 0.05, 0, WHITE),
    box(w + 0.2, 0.12, 0.5, 0, top + 0.6, -(d / 2) - 0.1, WHITE),
    box(w + 0.2, 0.12, 0.5, 0, top + 0.6, d / 2 + 0.1, WHITE),
    box(0.5, 0.1, d - 0.7, -(w / 2) - 0.1, top + 0.6, 0, WHITE),
    box(0.5, 0.1, d - 0.7, w / 2 + 0.1, top + 0.6, 0, WHITE),
    box(2.6, 1.3, 2.2, 2.2, top + 0.85, 1.0, WHITE),
    box(0.8, 1.0, 0.08, 2.2, top + 0.7, -0.14, CAP),
    box(0.4, 0.9, 0.4, -2.6, top + 0.65, 1.6, CAP),
  ];
}

/** Where each style's walls end: footprint, wall-top height and the footprint's z offset, for trims laid on the outside. */
export const BUILDING_OUTLINE: Readonly<
  Record<BuildingStyle, { w: number; d: number; top: number; z: number }>
> = {
  townhouse: { w: TOWNHOUSE.w, d: TOWNHOUSE.d, top: FLOOR + TOWNHOUSE.wall, z: 0 },
  shop: { w: SHOP.w, d: SHOP.d, top: FLOOR + SHOP.wall, z: 0 },
  tower: { w: TOWER.w, d: TOWER.d, top: FLOOR + TOWER.wall, z: 0 },
  hall: { w: HALL.w, d: HALL.d, top: FLOOR + HALL.wall, z: HALL.z },
  block: { w: BLOCK.w, d: BLOCK.d, top: FLOOR + BLOCK.storey * BLOCK.storeys, z: 0 },
  office: { w: OFFICE.w, d: OFFICE.d, top: OFFICE_LEDGE, z: 0 },
  tenement: { w: TENEMENT.w, d: TENEMENT.d, top: FLOOR + TENEMENT.storey * TENEMENT.storeys, z: 0 },
  arcade: { w: ARCADE.w, d: ARCADE.d, top: FLOOR + ARCADE.storey * ARCADE.storeys, z: 0 },
};

/* ------------------------------------------------------------------- API */

export function buildingWallsGeometry(style: BuildingStyle): BufferGeometry {
  const parts = {
    townhouse: townhouseWallParts,
    shop: shopWallParts,
    tower: towerWallParts,
    hall: hallWallParts,
    block: blockWallParts,
    office: officeWallParts,
    tenement: tenementWallParts,
    arcade: arcadeWallParts,
  }[style]();
  return merge([foundation(style), ...parts]);
}

export function buildingRoofGeometry(style: BuildingStyle): BufferGeometry {
  const parts = {
    townhouse: townhouseRoofParts,
    shop: shopRoofParts,
    tower: towerRoofParts,
    hall: hallRoofParts,
    block: blockRoofParts,
    office: officeRoofParts,
    tenement: tenementRoofParts,
    arcade: arcadeRoofParts,
  }[style]();
  return merge(parts);
}
