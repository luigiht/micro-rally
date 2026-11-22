import type { HullSpec } from './CarHull';
import { loft, type LoftKey } from './HullLoft';

/**
 * The Woking V6 Turbo's bodywork: a late-1980s turbo Formula One car after
 * the photos in `context/mclaren-mp44` and proportions measured from a
 * reference model of its successor there (sliced every 10 cm along the car,
 * scaled to a 2.875 m wheelbase; references only, nothing from them ships).
 * Set on our axles (front at z +1.64, rear at −1.235; `y` up in hull metres,
 * the axles at 0.33). No wheel wells: the wheels stand clear of the body,
 * on wishbones (`WokingBody`). Two hulls, both white (the livery paints the
 * red, `WokingLivery`):
 *
 * - **The tub** (`WOKING_TUB`): a needle nose from z 2.58 widening to the
 *   monocoque round the driver's legs; the open cockpit from z 0.28 to 0.74
 *   (its top at 0.62 painted black, the driver's helmet above it); then the
 *   engine cover, at its highest (0.86) just behind the helmet and falling
 *   low and flat to its end over the rear axle (z −1.3), the engine's tail,
 *   gearbox and exhausts bare behind it.
 * - **The sidepods** (`WOKING_SIDEPODS`): low (0.47 m) and wide (±0.67)
 *   from the radiator inlets at z 0.52, pinching in to a narrow waist round
 *   the gearbox.
 *
 * Pure, free of three.js.
 */

export const WOKING_COLORS = {
  body: '#f4f3ef',
  trim: '#1d1d22',
  glass: '#2a3a48',
  red: '#f0442a',
} as const;

const tubKeys: LoftKey[] = [
  // The engine cover's open end over the rear axle: behind it the engine's tail, the gearbox and
  // the exhausts stand bare under the rear wing (`WokingBody`).
  {
    z: -1.3,
    floor: 0.14,
    sill: 0.16,
    belt: 0.44,
    roof: 0.5,
    crown: 0.02,
    xSill: 0.22,
    xBody: 0.26,
    xBelt: 0.24,
    xRoof: 0.15,
    bow: 0,
  },
  // The engine cover, rising to its peak behind the helmet.
  {
    z: -1.1,
    floor: 0.1,
    sill: 0.12,
    belt: 0.5,
    roof: 0.6,
    crown: 0.02,
    xSill: 0.26,
    xBody: 0.3,
    xBelt: 0.28,
    xRoof: 0.17,
  },
  { z: -0.8, belt: 0.54, roof: 0.68, crown: 0.03, xBelt: 0.27, xRoof: 0.16 },
  { z: -0.3, belt: 0.58, roof: 0.82, crown: 0.03, xRoof: 0.14 },
  { z: 0.15, belt: 0.6, roof: 0.84, crown: 0.02, xRoof: 0.13 },
  // The cockpit: the tub's top at the shoulders, open (painted black) from here to the scuttle.
  { z: 0.3, belt: 0.58, roof: 0.62, crown: 0.01, xBelt: 0.28, xRoof: 0.22 },
  { z: 0.95, belt: 0.58, roof: 0.63, crown: 0.01, xBody: 0.3, xBelt: 0.28, xRoof: 0.22 },
  // The nose narrowing and falling to its tip over the front wing.
  {
    z: 1.1,
    floor: 0.1,
    sill: 0.14,
    belt: 0.55,
    roof: 0.6,
    crown: 0.02,
    xSill: 0.25,
    xBody: 0.28,
    xBelt: 0.27,
    xRoof: 0.2,
  },
  {
    z: 1.5,
    floor: 0.16,
    sill: 0.2,
    belt: 0.46,
    roof: 0.52,
    crown: 0.03,
    xSill: 0.2,
    xBody: 0.23,
    xBelt: 0.22,
    xRoof: 0.15,
  },
  {
    z: 1.9,
    floor: 0.17,
    sill: 0.2,
    belt: 0.34,
    roof: 0.4,
    crown: 0.03,
    xSill: 0.17,
    xBody: 0.19,
    xBelt: 0.18,
    xRoof: 0.12,
  },
  {
    z: 2.3,
    floor: 0.12,
    sill: 0.14,
    belt: 0.22,
    roof: 0.26,
    crown: 0.02,
    xSill: 0.11,
    xBody: 0.13,
    xBelt: 0.12,
    xRoof: 0.08,
  },
  {
    z: 2.58,
    floor: 0.1,
    sill: 0.11,
    belt: 0.14,
    roof: 0.15,
    crown: 0,
    xSill: 0.04,
    xBody: 0.05,
    xBelt: 0.045,
    xRoof: 0.03,
    bow: 0,
  },
];

const podKeys: LoftKey[] = [
  // Pinched in round the gearbox, the coke-bottle waist.
  {
    z: -1.0,
    floor: 0.06,
    sill: 0.08,
    belt: 0.26,
    roof: 0.3,
    crown: 0,
    xSill: 0.3,
    xBody: 0.33,
    xBelt: 0.31,
    xRoof: 0.28,
  },
  { z: -0.7, belt: 0.36, roof: 0.4, xSill: 0.45, xBody: 0.48, xBelt: 0.47, xRoof: 0.4 },
  { z: -0.4, belt: 0.42, roof: 0.46, xSill: 0.58, xBody: 0.6, xBelt: 0.59, xRoof: 0.52 },
  { z: 0.0, belt: 0.44, roof: 0.48, xSill: 0.62, xBody: 0.64, xBelt: 0.63, xRoof: 0.56 },
  { z: 0.4, belt: 0.44, roof: 0.47, xSill: 0.65, xBody: 0.67, xBelt: 0.66, xRoof: 0.6 },
  // The radiator inlets' faces.
  {
    z: 0.52,
    floor: 0.06,
    sill: 0.08,
    belt: 0.43,
    roof: 0.45,
    crown: 0,
    xSill: 0.64,
    xBody: 0.66,
    xBelt: 0.65,
    xRoof: 0.6,
  },
];

const colors = { body: WOKING_COLORS.body, trim: WOKING_COLORS.trim, glass: WOKING_COLORS.glass };

export const WOKING_TUB: HullSpec = {
  colors,
  rounding: { upper: 2, fullness: 0.7, top: 2, lower: 2 },
  stations: loft(tubKeys, { step: 0.08 }),
};

export const WOKING_SIDEPODS: HullSpec = {
  colors,
  rounding: { upper: 2, fullness: 0.6, top: 2, lower: 2 },
  stations: loft(podKeys, { step: 0.1 }),
};

/** The cockpit's opening along the tub's top, z, and its half-width. */
export const WOKING_COCKPIT = { from: 0.28, to: 0.74, halfWidth: 0.19 } as const;
