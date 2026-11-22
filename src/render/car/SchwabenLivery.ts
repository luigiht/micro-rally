import type { LiveryShapes, LiveryView, ViewAxis } from './HullLivery';
import { curve, mergePaint, rect, strips, type Paint } from './LiveryStrips';

/**
 * The Schwaben SC Rallye's livery, our own reading of the early-1980s works
 * rally coupé in `context/rally-porsche` (photos, used as references only;
 * no names, logos, numbers or marks): a white shell, deep metallic blue up
 * the flanks to a line just under the windows, and over the blue's edge a
 * gold band, a white pinstripe and a red stripe. Along the doors the line
 * runs level; over the front wing it sweeps down ahead of the arch to the
 * bumper, and toward the tail it eases down to run across the tail panel
 * above the lamps. The nose's bumper is blue with the same bands over it,
 * a white panel in its middle.
 *
 * All coordinates are the hull's (`SchwabenBody`): z forward, y up, x to
 * the car's left.
 */

export const SCHWABEN_BLUE = '#1d3f9a';
export const SCHWABEN_GOLD = '#b8913f';
export const SCHWABEN_RED = '#d8321f';
const WHITE = '#f2f1ec';
const CHROME = '#cfd2d6';

/** The gold band, the white pinstripe between it and the red, and the red stripe, m. */
const GOLD = 0.05;
const PIN = 0.012;
const RED = 0.025;

/** The blue's top along the flank: level along the doors, sweeping down over the front wing and easing down to the tail. */
const blueTop = curve([
  [-2.0, 0.66],
  [-1.3, 0.765],
  [0.95, 0.765],
  [1.95, 0.44],
  [2.3, 0.44],
]);

/** Blue, then gold, then (past the white pinstripe) red, over the blue's edge `top`. */
function bands(u0: number, u1: number, top: (u: number) => number): LiveryView['paint'] {
  return strips(u0, u1, [
    { color: SCHWABEN_BLUE, bottom: () => -1, top },
    { color: SCHWABEN_GOLD, bottom: top, top: (u) => top(u) + GOLD },
    {
      color: SCHWABEN_RED,
      bottom: (u) => top(u) + GOLD + PIN,
      top: (u) => top(u) + GOLD + PIN + RED,
    },
  ]);
}

const SIDE_U: ViewAxis = [2, -2.1, 2.3];
const SIDE_V: ViewAxis = [1, 0, 1.5];
const ACROSS: ViewAxis = [0, -1.1, 1.1];

const FLANK = bands(-2.1, 2.3, blueTop);
/** The door's handle. */
const FLANK_DETAILS: Paint[] = [rect(-0.3, -0.2, 0.79, 0.805, CHROME)];

export const SCHWABEN_LIVERY: LiveryShapes = {
  left: { u: SIDE_U, v: SIDE_V, paint: FLANK },
  right: { u: SIDE_U, v: SIDE_V, paint: FLANK },
  top: { u: SIDE_U, v: ACROSS, paint: [] },
  front: { u: ACROSS, v: SIDE_V, paint: bands(-1.1, 1.1, () => 0.44) },
  back: { u: ACROSS, v: SIDE_V, paint: bands(-1.1, 1.1, () => 0.64) },
  over: {
    left: { u: SIDE_U, v: SIDE_V, paint: FLANK_DETAILS },
    right: { u: SIDE_U, v: SIDE_V, paint: FLANK_DETAILS },
    top: { u: SIDE_U, v: ACROSS, paint: [] },
    // The white panel in the middle of the nose's bumper.
    front: { u: ACROSS, v: SIDE_V, paint: mergePaint([rect(-0.3, 0.3, 0.3, 0.42, WHITE)]) },
    back: { u: ACROSS, v: SIDE_V, paint: [] },
  },
};
