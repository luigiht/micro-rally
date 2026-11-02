import { type BufferGeometry, Color } from 'three';
import { HOUSE_SLAB_TOP } from '@/game/stage/SceneryScatter';
import type { BuildingStyle } from '@/game/stage/Town';
import { BUILDING_OUTLINE } from '../BuildingGeometry';
import { box, merge } from '../HouseGeometry';
import { lampPostGeometry } from '../StreetFurnitureGeometry';

/**
 * Nightcity's street-level kits: cargo pods where the rocks were, a mid-rise
 * block on every farmhouse pad, lit lamp heads on the town's lamp posts and a
 * neon trim along every town building's roofline. Glow parts are baked white
 * and tinted per instance; they stand 1-3 cm proud of the body they light.
 */
const BODY = new Color('#1e2230');
const DARK = new Color('#161925');
const WHITE = new Color('#ffffff');

/* ---------------------------------------------------------------- pods */

export function podBodyGeometry(): BufferGeometry {
  return merge([
    box(1.8, 1.0, 1.2, 0, 0.45, 0, BODY),
    box(1.5, 0.16, 0.9, 0, 1.0, 0, DARK),
    box(0.3, 0.5, 1.24, -0.6, 0.45, 0, DARK),
  ]);
}

export function podGlowGeometry(): BufferGeometry {
  return merge([
    box(1.2, 0.06, 0.03, 0.15, 0.62, 0.615, WHITE),
    box(1.2, 0.06, 0.03, 0.15, 0.62, -0.615, WHITE),
  ]);
}

/* -------------------------------------------------------------- blocks */

/** Footprint of the farmhouse it replaces (6 × 4.5), three storeys, foundation down the slope like the house slab. */
const BLOCK = { w: 6, d: 4.5, h: 9.2, floor: HOUSE_SLAB_TOP } as const;

export function blockBodyGeometry(): BufferGeometry {
  const { w, d, h, floor } = BLOCK;
  return merge([
    box(w + 0.4, 1.4 + floor, d + 0.4, 0, floor - (1.4 + floor) / 2 + 0.01, 0, DARK),
    box(w, h, d, 0, floor + h / 2, 0, BODY),
    box(w * 0.5, 0.5, d * 0.5, w * 0.1, floor + h + 0.25, 0, DARK),
    // Door recess on the -z face.
    box(1.2, 2.4, 0.1, 1.2, floor + 1.2, -d / 2 - 0.04, DARK),
  ]);
}

export function blockGlowGeometry(): BufferGeometry {
  const { w, d, h, floor } = BLOCK;
  const parts: BufferGeometry[] = [];
  for (let y = floor + 1.8; y < floor + h - 0.8; y += 2.9) {
    parts.push(box(w - 1.2, 0.5, 0.02, 0, y, d / 2 + 0.02, WHITE));
    parts.push(box(w - 1.2, 0.5, 0.02, 0, y, -d / 2 - 0.02, WHITE));
    parts.push(box(0.02, 0.5, d - 1.2, w / 2 + 0.02, y, 0, WHITE));
    parts.push(box(0.02, 0.5, d - 1.2, -w / 2 - 0.02, y, 0, WHITE));
  }
  // Door light.
  parts.push(box(1.4, 0.08, 0.03, 1.2, floor + 2.5, -d / 2 - 0.1, WHITE));
  return merge(parts);
}

/* --------------------------------------------------------------- lamps */

/** The day lamp post, whose dark grey post already suits the night; the head is relit by the glow kit. */
export function nightLampBodyGeometry(): BufferGeometry {
  return lampPostGeometry();
}

/** Encloses the day head (0.4 × 0.22 × 0.3 at (-0.8, 3.96)) by a centimetre, so it hides it. */
export function lampHeadGlowGeometry(): BufferGeometry {
  return merge([box(0.42, 0.24, 0.32, -0.8, 4.2 - 0.24, 0, WHITE)]);
}

/* --------------------------------------------------------- town trims */

/** Neon rule just under each building's eaves on all four faces, plus a sign plate over the shop front. */
export function buildingTrimGeometry(style: BuildingStyle): BufferGeometry {
  const { w, d, top, z } = BUILDING_OUTLINE[style];
  const y = top - 0.35;
  const parts = [
    box(w + 0.1, 0.08, 0.06, 0, y, z - d / 2 - 0.04, WHITE),
    box(w + 0.1, 0.08, 0.06, 0, y, z + d / 2 + 0.04, WHITE),
    box(0.06, 0.08, d + 0.1, w / 2 + 0.04, y, z, WHITE),
    box(0.06, 0.08, d + 0.1, -w / 2 - 0.04, y, z, WHITE),
  ];
  if (style === 'shop') parts.push(box(3.2, 0.7, 0.05, 0, top - 2.2, -d / 2 - 0.1, WHITE));
  if (style === 'tower') parts.push(box(0.5, 0.5, 0.5, 0, top + 2.9, 0, WHITE));
  return merge(parts);
}
