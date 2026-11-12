import type { BuildingStyle } from './Town';

/**
 * What the town and city generators know about each building kit: its
 * footprint, where its door is, and the village's default mix. The render
 * kits in `src/render/scenery` must match these sizes.
 */

/** Footprint half extents per style: `hx` across the front, `hz` deep. */
export const BUILDING_SIZE: Readonly<Record<BuildingStyle, { hx: number; hz: number }>> = {
  townhouse: { hx: 4, hz: 3.5 },
  shop: { hx: 5, hz: 4 },
  tower: { hx: 3, hz: 3 },
  hall: { hx: 6, hz: 4.5 },
  block: { hx: 7, hz: 5.5 },
  office: { hx: 6, hz: 6 },
  tenement: { hx: 6, hz: 5 },
  arcade: { hx: 5, hz: 5 },
};

/** A city building may be drawn up to this much wider than its catalog front, to close a gap in its terrace. */
export const MAX_WIDEN = 1.5;

/** Each city style's eaves height above its floor (the render kits' storeys), for fitted buildings to match. */
export const CITY_EAVES: Readonly<Partial<Record<BuildingStyle, number>>> = {
  arcade: 9.6,
  tenement: 15,
  block: 15,
  office: 28.8,
};

/** Where each style's door stands along its front (local x), so street furniture keeps clear of it. */
export const DOOR_OFFSET: Readonly<Record<BuildingStyle, number>> = {
  townhouse: 1.8,
  shop: 3.4,
  tower: 0,
  hall: 0,
  block: 0,
  office: 0,
  tenement: 0,
  arcade: 0,
};

/** The village mix; a city sets its own on the `Site`. */
export const STYLE_WEIGHTS: readonly (readonly [BuildingStyle, number])[] = [
  ['townhouse', 5],
  ['shop', 3],
  ['tower', 2],
];

/** How many render variants (tints) a village and a city draw their buildings from. */
export const VILLAGE_VARIANTS = 2;
export const CITY_VARIANTS = 4;

/** A weighted style from `styles` (the village mix when unset) whose front fits in `room`, or null. */
export function pickStyle(
  rand: () => number,
  styles: readonly (readonly [BuildingStyle, number])[] | undefined,
  room: number,
): BuildingStyle | null {
  const fits = (styles ?? STYLE_WEIGHTS).filter(([style]) => 2 * BUILDING_SIZE[style].hx <= room);
  if (fits.length === 0) return null;
  let total = 0;
  for (const [, w] of fits) total += w;
  let r = rand() * total;
  for (const [style, w] of fits) {
    r -= w;
    if (r <= 0) return style;
  }
  return fits[fits.length - 1]![0];
}
