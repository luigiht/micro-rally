import type { HullSpec } from './CarHull';
import type { LiverySolid, LiveryShapes, ViewAxis } from './HullLivery';
import { loft, type LoftKey } from './HullLoft';
import { rect } from './LiveryStrips';

/**
 * The Woking V6 Turbo driver's helmet, after a modern full-face racing
 * helmet: lofted like a car's hull (`CarHull`) in its own frame (metres,
 * origin at the head's centre, z forward, y up), so it is a shell, not a
 * ball, its proportions measured from a reference model in
 * `context/f1-helmet` (CC BY, sliced every 1.5 cm; nothing from it ships):
 * an egg 29 cm long, 26 cm tall and 23 cm wide on a flat bottom, widest a
 * little ahead of the middle; the forehead falling steeply to the visor's
 * face; under it the chin bar jutting forward low down; the back rounding
 * off over the neck. Its paint
 * (`WOKING_HELMET_LIVERY`) is laid on as solids, so every band wraps the
 * shell's curves: a red shell, white below a line round its middle with a
 * red pinstripe through it, a dark-gold visor wrapping round to the sides
 * under a white strip, and two white stripes over the crown. Pure, free of
 * three.js.
 */

export const HELMET_COLORS = {
  red: '#e2382c',
  white: '#f4f3ef',
  visor: '#6b4a12',
  trim: '#1d1d22',
} as const;

const keys: LoftKey[] = [
  // The back, rounding off over the neck.
  {
    z: -0.15,
    floor: -0.09,
    sill: -0.08,
    belt: 0.0,
    roof: 0.05,
    crown: 0.005,
    xSill: 0.03,
    xBody: 0.05,
    xBelt: 0.045,
    xRoof: 0.03,
    bow: 0,
  },
  {
    z: -0.135,
    floor: -0.115,
    sill: -0.105,
    belt: 0.02,
    roof: 0.07,
    crown: 0.008,
    xSill: 0.05,
    xBody: 0.073,
    xBelt: 0.07,
    xRoof: 0.05,
  },
  {
    z: -0.12,
    floor: -0.13,
    sill: -0.12,
    belt: 0.03,
    roof: 0.09,
    crown: 0.01,
    xSill: 0.06,
    xBody: 0.088,
    xBelt: 0.087,
    xRoof: 0.06,
  },
  {
    z: -0.09,
    floor: -0.131,
    sill: -0.12,
    belt: 0.04,
    roof: 0.105,
    crown: 0.012,
    xSill: 0.085,
    xBody: 0.108,
    xBelt: 0.104,
    xRoof: 0.07,
    bow: 0.012,
  },
  // The crown, widest and highest a little ahead of the middle.
  {
    z: -0.045,
    floor: -0.131,
    sill: -0.12,
    belt: 0.04,
    roof: 0.118,
    crown: 0.012,
    xSill: 0.108,
    xBody: 0.117,
    xBelt: 0.115,
    xRoof: 0.08,
    bow: 0.012,
  },
  {
    z: 0.0,
    floor: -0.132,
    sill: -0.12,
    belt: 0.04,
    roof: 0.12,
    crown: 0.011,
    xSill: 0.112,
    xBody: 0.117,
    xBelt: 0.116,
    xRoof: 0.08,
  },
  {
    z: 0.045,
    floor: -0.132,
    sill: -0.12,
    belt: 0.035,
    roof: 0.112,
    crown: 0.011,
    xSill: 0.11,
    xBody: 0.115,
    xBelt: 0.107,
    xRoof: 0.075,
    bow: 0.012,
  },
  // The forehead falling steeply to the visor's face.
  {
    z: 0.075,
    floor: -0.132,
    sill: -0.122,
    belt: 0.03,
    roof: 0.1,
    crown: 0.01,
    xSill: 0.105,
    xBody: 0.106,
    xBelt: 0.098,
    xRoof: 0.06,
    bow: 0.012,
  },
  {
    z: 0.105,
    floor: -0.132,
    sill: -0.12,
    belt: 0.02,
    roof: 0.07,
    crown: 0.008,
    xSill: 0.086,
    xBody: 0.09,
    xBelt: 0.075,
    xRoof: 0.05,
  },
  {
    z: 0.12,
    floor: -0.132,
    sill: -0.12,
    belt: -0.01,
    roof: 0.045,
    crown: 0.006,
    xSill: 0.074,
    xBody: 0.076,
    xBelt: 0.058,
    xRoof: 0.035,
  },
  // The chin bar, jutting forward low down under the visor.
  {
    z: 0.135,
    floor: -0.131,
    sill: -0.12,
    belt: -0.07,
    roof: -0.055,
    crown: 0.003,
    xSill: 0.051,
    xBody: 0.053,
    xBelt: 0.045,
    xRoof: 0.03,
  },
  {
    z: 0.146,
    floor: -0.12,
    sill: -0.115,
    belt: -0.085,
    roof: -0.075,
    crown: 0,
    xSill: 0.035,
    xBody: 0.04,
    xBelt: 0.035,
    xRoof: 0.02,
    bow: 0,
  },
];

export const WOKING_HELMET: HullSpec = {
  // Its rim underneath white, as the lower shell, so the back's rounding never shows a dark patch.
  colors: { body: HELMET_COLORS.red, trim: HELMET_COLORS.white, glass: HELMET_COLORS.visor },
  rounding: { upper: 2, fullness: 0.85, top: 2, lower: 2 },
  stations: loft(keys, { step: 0.015 }),
};

/** A band of the helmet between heights `y0` and `y1` (from z `z0` forward), right round it. */
const band = (color: string, y0: number, y1: number, z0 = -0.2): LiverySolid => ({
  color,
  side: [
    [z0, y0],
    [0.2, y0],
    [0.2, y1],
    [z0, y1],
  ],
  front: [
    [-0.2, y0],
    [0.2, y0],
    [0.2, y1],
    [-0.2, y1],
  ],
  top: [
    [z0, -0.2],
    [0.2, -0.2],
    [0.2, 0.2],
    [z0, 0.2],
  ],
});

/** The visor wraps from the front round to the sides as far back as this. */
const VISOR_BACK = 0.05;
const VISOR = [-0.03, 0.055] as const;
/** The white strip over the visor. */
const BROW = [0.055, 0.07] as const;

const SIDE_U: ViewAxis = [2, -0.2, 0.2];
const SIDE_V: ViewAxis = [1, -0.2, 0.2];
const ACROSS: ViewAxis = [0, -0.2, 0.2];
/** The two white stripes over the crown, this far either side of the middle and this wide. */
const STRIPE_X = 0.035;
const STRIPE_W = 0.008;

export const WOKING_HELMET_LIVERY: LiveryShapes = {
  left: { u: SIDE_U, v: SIDE_V, paint: [] },
  right: { u: SIDE_U, v: SIDE_V, paint: [] },
  top: { u: SIDE_U, v: ACROSS, paint: [] },
  over: {
    left: { u: SIDE_U, v: SIDE_V, paint: [] },
    right: { u: SIDE_U, v: SIDE_V, paint: [] },
    // Two white stripes from the brow over the crown to the back.
    top: {
      u: SIDE_U,
      v: ACROSS,
      paint: [
        rect(-0.15, 0.1, STRIPE_X - STRIPE_W / 2, STRIPE_X + STRIPE_W / 2, HELMET_COLORS.white),
        rect(-0.15, 0.1, -STRIPE_X - STRIPE_W / 2, -STRIPE_X + STRIPE_W / 2, HELMET_COLORS.white),
      ],
    },
  },
  solids: [
    // White below the middle, with the shell's red showing through as a pinstripe.
    band(HELMET_COLORS.white, -0.2, -0.078),
    band(HELMET_COLORS.white, -0.068, -0.04),
    band(HELMET_COLORS.visor, VISOR[0], VISOR[1], VISOR_BACK),
    band(HELMET_COLORS.white, BROW[0], BROW[1], VISOR_BACK - 0.01),
  ],
};
