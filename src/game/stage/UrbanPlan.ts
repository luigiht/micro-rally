import { CONTROL_STEP } from './Centreline';
import { planCity } from './city/CityRoute';
import type { UrbanDef } from './regions';
import type { TownPlan } from './TownPlan';

/**
 * The route through a city, as a town plan that covers the whole stage: a
 * walk along the streets of the city's map (`city/CityGrid`,
 * `city/CityRoute`), so every corner is a crossroads of a connected grid of
 * blocks. See `UrbanGenerator` for what is built along it.
 */

/** The legs begin at the first control step; everything before it is the run-in before the start line. */
export const URBAN_ENTRY = CONTROL_STEP;
/** Corners at or above this are junctions with side streets; below it the route just kinks. */
export const MIN_JUNCTION_TURN = Math.PI / 4;

/** The city's route: legs from the first control step to past the run-out, so the open-road walk never resumes; and its map. */
export function planUrban(seed: number, total: number, loop: number, def: UrbanDef): TownPlan {
  const span = total + 4 * CONTROL_STEP - URBAN_ENTRY;
  const { legs, city } = planCity(seed, span, loop, def);
  return { entryAt: URBAN_ENTRY, legs, city };
}
