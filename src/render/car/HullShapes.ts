import type { HullStation } from './CarHull';

/**
 * The lofted shapes of the cars whose hulls other things reuse: the drivable
 * bodies in `components/game/bodies` paint their liveries over these
 * stations, and the city's parked cars (`CityVehicleGeometry`) take the same
 * shapes in plain paint. Coordinates in the car's root frame, the nose at
 * +z, metres.
 */

/**
 * Boxy late-80s five-door rally hatch (the Riviera WRC), after the Group A
 * hatch in `context/lancia-delta-integrale` (references only): a blunt,
 * upright nose under a flat bonnet that climbs a little to the scuttle, a
 * fairly upright windscreen, a long flat roof, a steep rear screen over a
 * short tailgate, and slab sides with square box flares that step out
 * over both axles from the sill to the belt. A black B-pillar between the
 * doors' glass; a broad C-pillar behind the rear door. 4.0 m long, 1.9 m
 * over the flares, 1.35 m tall.
 */
const WRC_FLOOR = 0.34;
const WRC_SILL = 0.44;
/** Half-widths: door skin, belt, the flares at their foot, the roof. */
const WRC_BODY = 0.87;
const WRC_BELT = 0.85;
const WRC_FLARE = 0.95;
const WRC_ROOF = 0.64;
/** Roof over the cabin: a little lower at its back. */
const WRC_ROOF_F = 1.45;
const WRC_ROOF_R = 1.43;
const WRC_PILLAR = '#2b2a33';

function wrc(
  z: number,
  belt: number,
  roof: number,
  xBody: number,
  xRoof: number,
  extra: Partial<HullStation> = {},
): HullStation {
  // Over a flare the flank leans in from its foot to the door skin's belt.
  const xBelt = xBody > WRC_BODY ? WRC_BELT + 0.01 : WRC_BELT;
  return {
    z,
    floor: WRC_FLOOR,
    sill: WRC_SILL,
    belt,
    roof,
    xSill: xBody - 0.03,
    xBody,
    xBelt,
    xRoof,
    ...extra,
  };
}

export const WRC_STATIONS: readonly HullStation[] = [
  // Tail: the tailgate's top edge, then the flare steps out and the rear screen climbs to the roof.
  wrc(-1.97, 1.0, 1.0, 0.84, 0.8, { floor: 0.4, sill: 0.47, xBelt: 0.82 }),
  wrc(-1.88, 1.05, 1.05, WRC_BODY, 0.82),
  wrc(-1.84, 1.07, 1.07, WRC_FLARE, 0.8, { glass: true }),
  // The roof's end; the broad C-pillar to the rear door's window.
  wrc(-1.5, 1.07, WRC_ROOF_R, WRC_FLARE, WRC_ROOF),
  wrc(-1.1, 1.06, WRC_ROOF_R, WRC_FLARE, WRC_ROOF, { glass: true }),
  // Rear door window over the end of the rear flare, then the black B-pillar.
  wrc(-0.8, 1.05, WRC_ROOF_R + 0.005, WRC_FLARE, WRC_ROOF, { glass: true }),
  wrc(-0.76, 1.05, WRC_ROOF_R + 0.005, WRC_BODY, WRC_ROOF, { glass: true }),
  wrc(-0.44, 1.045, WRC_ROOF_F - 0.01, WRC_BODY, WRC_ROOF, { sidePaint: WRC_PILLAR }),
  // Front door window to the A-pillar.
  wrc(-0.36, 1.04, WRC_ROOF_F - 0.01, WRC_BODY, WRC_ROOF, { glass: true }),
  // The windscreen down to the scuttle, the front door's glass running on beside it to a point.
  wrc(0.08, 1.03, WRC_ROOF_F, WRC_BODY, 0.62, { glass: true, sideGlass: true }),
  // The flat bonnet meets the flanks square, the front flare stepping out under its edge, and
  // runs on to a blunt, upright nose as wide as the flares.
  wrc(0.62, 1.02, 1.02, WRC_BODY, WRC_BODY, { xBelt: WRC_BODY }),
  wrc(0.72, 1.01, 1.01, WRC_BODY, WRC_BODY, { xBelt: WRC_BODY }),
  wrc(0.76, 1.0, 1.0, WRC_FLARE, WRC_FLARE, { xBelt: WRC_FLARE }),
  wrc(1.3, 0.97, 0.97, WRC_FLARE, WRC_FLARE, { xBelt: WRC_FLARE }),
  wrc(1.9, 0.93, 0.93, WRC_FLARE, WRC_FLARE, { xBelt: WRC_FLARE }),
  wrc(2.0, 0.9, 0.9, WRC_FLARE, WRC_FLARE, { floor: 0.42, sill: 0.5, xBelt: WRC_FLARE }),
];

/**
 * Boxy mid-engined hatch (the Tempesta Group B): tall flat bonnet, upright
 * greenhouse with pillars, and a straight engine deck at the belt line from
 * the cabin to the tail, so the side stripes run level past the rear wheel.
 * The last 12 cm round the tail off: the corners pull in and the deck's
 * edge eases down a few centimetres, rather than ending in a square box.
 */
export const GROUPB_STATIONS: readonly HullStation[] = [
  {
    z: -2.0,
    floor: 0.36,
    sill: 0.44,
    belt: 0.9,
    roof: 0.9,
    xSill: 0.72,
    xBody: 0.78,
    xRoof: 0.78,
  },
  {
    z: -1.96,
    floor: 0.34,
    sill: 0.43,
    belt: 0.925,
    roof: 0.925,
    xSill: 0.76,
    xBody: 0.835,
    xRoof: 0.835,
  },
  {
    z: -1.88,
    floor: 0.32,
    sill: 0.42,
    belt: 0.94,
    roof: 0.94,
    xSill: 0.78,
    xBody: 0.86,
    xRoof: 0.86,
  },
  {
    z: -1.3,
    floor: 0.32,
    sill: 0.42,
    belt: 0.94,
    roof: 0.94,
    xSill: 0.78,
    xBody: 0.86,
    xRoof: 0.86,
    glass: true,
  },
  {
    z: -1.05,
    floor: 0.32,
    sill: 0.42,
    belt: 0.94,
    roof: 1.36,
    xSill: 0.78,
    xBody: 0.86,
    xRoof: 0.6,
  },
  {
    z: -0.95,
    floor: 0.32,
    sill: 0.42,
    belt: 0.94,
    roof: 1.38,
    xSill: 0.78,
    xBody: 0.86,
    xRoof: 0.6,
    glass: true,
  },
  {
    z: -0.2,
    floor: 0.32,
    sill: 0.42,
    belt: 0.94,
    roof: 1.39,
    xSill: 0.78,
    xBody: 0.86,
    xRoof: 0.6,
  },
  {
    z: -0.12,
    floor: 0.32,
    sill: 0.42,
    belt: 0.94,
    roof: 1.39,
    xSill: 0.78,
    xBody: 0.86,
    xRoof: 0.6,
    glass: true,
  },
  {
    z: 0.55,
    floor: 0.32,
    sill: 0.42,
    belt: 0.94,
    roof: 1.36,
    xSill: 0.78,
    xBody: 0.86,
    xRoof: 0.58,
    glass: true,
  },
  {
    z: 0.95,
    floor: 0.32,
    sill: 0.42,
    belt: 0.92,
    roof: 0.92,
    xSill: 0.78,
    xBody: 0.86,
    xRoof: 0.86,
  },
  { z: 1.5, floor: 0.32, sill: 0.4, belt: 0.9, roof: 0.9, xSill: 0.78, xBody: 0.86, xRoof: 0.86 },
  {
    z: 2.0,
    floor: 0.34,
    sill: 0.4,
    belt: 0.82,
    roof: 0.82,
    xSill: 0.74,
    xBody: 0.82,
    xRoof: 0.82,
  },
];
