import type { LiverySolid, LiveryShapes, ViewAxis } from './HullLivery';
import { poly, rect, type Paint } from './LiveryStrips';
import { WOKING_COCKPIT, WOKING_COLORS } from './WokingShape';

/**
 * The Woking V6 Turbo's livery, our own reading of the late-1980s works car
 * in `context/mclaren-mp44` (photos, used as references only; no names,
 * logos, numbers or marks): white, with fluorescent red in two blocks.
 *
 * - **Nose:** red over the top of the nose from the cockpit's front edge,
 *   ending in two points at its sides with a white triangle cut into it
 *   from the front, and down the nose's sides to its floor.
 * - **Sidepods and the engine cover:** red behind a diagonal edge that leans
 *   back as it climbs, white ahead of it, up the cover's flanks and over its
 *   top, the two sides meeting there; the sidepods' tops red behind the
 *   same edge.
 * - **Tails:** the engine cover's open end dark grey, as the engine bay
 *   behind it; the sidepods' tails red.
 * - **Cockpit:** its opening a black panel in the tub's top (the helmet
 *   stands in it, `WokingBody`).
 *
 * All coordinates are the hull's (`WokingBody`): z forward, y up, x to the
 * car's left.
 */

const RED = WOKING_COLORS.red;
const BLACK = '#17161c';
/** The engine bay's dark grey. */
const BAY = '#3a3a40';

const SIDE_U: ViewAxis = [2, -1.6, 2.7];
const SIDE_V: ViewAxis = [1, 0, 1.1];
const ACROSS: ViewAxis = [0, -0.8, 0.8];

/** The diagonal edge of the rear red block: at the floor and at the top of the engine cover's flank. */
const DIAGONAL: readonly [readonly [number, number], readonly [number, number]] = [
  [-0.1, 0],
  [-0.5, 0.62],
];
/** Where the diagonal crosses height `y`. */
const diagonalAt = (y: number) =>
  DIAGONAL[0][0] +
  ((y - DIAGONAL[0][1]) / (DIAGONAL[1][1] - DIAGONAL[0][1])) * (DIAGONAL[1][0] - DIAGONAL[0][0]);

/**
 * The rear red block as a solid (`LiverySolid`): everything behind the diagonal, cut straight
 * through the car, so its edge is one straight line across every face it meets (the sidepods'
 * flanks and tops, the engine cover's flanks, shoulders and top), whichever way each faces, and
 * the two sides meet over the cover. From `from` back (the cover's open end stays the bay's grey).
 */
const rearSolid = (from: number): LiverySolid => ({
  color: RED,
  side: [
    [from, 0],
    [DIAGONAL[0][0], 0],
    [diagonalAt(1.2), 1.2],
    [from, 1.2],
  ],
  front: [
    [-1, 0],
    [1, 0],
    [1, 1.2],
    [-1, 1.2],
  ],
  top: [
    [from, -1],
    [0.5, -1],
    [0.5, 1],
    [from, 1],
  ],
});

/** Where the nose's red ends at its sides, the nose's half-width there, and the point of the white triangle cut into it. */
/** The nose's red starts at the cockpit's front edge, so the scuttle over the instruments is red. */
const NOSE_FROM = WOKING_COCKPIT.to;
const NOSE_RED = 1.55;
const NOSE_EDGE = 0.16;
const NOTCH = 1.28;

/**
 * The nose's red as a solid each side (`mirror`), so its edges run on unbroken from the top
 * round onto the sides: over the top from the cockpit forward, a white triangle cut into it from
 * the front to a point at `NOTCH` on the centre line, its sides reaching `NOSE_RED` at the nose's
 * edge; from there down the nose's side, the front edge slanting back to the floor.
 */
const noseSolid: LiverySolid = {
  color: RED,
  mirror: true,
  side: [
    [NOSE_FROM, 0],
    [1.25, 0],
    [NOSE_RED, 0.5],
    [NOSE_RED, 1],
    [NOSE_FROM, 1],
  ],
  front: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
  top: [
    [NOSE_FROM, 0],
    [NOTCH, 0],
    [NOSE_RED, NOSE_EDGE],
    [NOSE_RED, 1],
    [NOSE_FROM, 1],
  ],
};

/** The cockpit's opening in the tub's top, rounded at its front. */
const COCKPIT: Paint = poly(
  [
    [WOKING_COCKPIT.from, -WOKING_COCKPIT.halfWidth],
    [WOKING_COCKPIT.to - 0.08, -WOKING_COCKPIT.halfWidth],
    [WOKING_COCKPIT.to, -WOKING_COCKPIT.halfWidth + 0.08],
    [WOKING_COCKPIT.to, WOKING_COCKPIT.halfWidth - 0.08],
    [WOKING_COCKPIT.to - 0.08, WOKING_COCKPIT.halfWidth],
    [WOKING_COCKPIT.from, WOKING_COCKPIT.halfWidth],
  ],
  BLACK,
);

export const WOKING_TUB_LIVERY: LiveryShapes = {
  left: { u: SIDE_U, v: SIDE_V, paint: [] },
  right: { u: SIDE_U, v: SIDE_V, paint: [] },
  top: { u: SIDE_U, v: ACROSS, paint: [] },
  // The engine cover's open end over the rear axle, round the engine: dark grey, as the engine
  // bay behind it.
  back: { u: ACROSS, v: SIDE_V, paint: [rect(-0.8, 0.8, 0, 1.1, BAY)] },
  over: {
    left: { u: SIDE_U, v: SIDE_V, paint: [] },
    right: { u: SIDE_U, v: SIDE_V, paint: [] },
    top: { u: SIDE_U, v: ACROSS, paint: [COCKPIT] },
  },
  // From a hair behind the cover's open end (z −1.3), so no white shows between the two.
  solids: [noseSolid, rearSolid(-1.2995)],
};

/** The sidepods: the rear red block, their tails beside the gearbox included. */
export const WOKING_SIDEPOD_LIVERY: LiveryShapes = {
  left: { u: SIDE_U, v: SIDE_V, paint: [] },
  right: { u: SIDE_U, v: SIDE_V, paint: [] },
  top: { u: SIDE_U, v: ACROSS, paint: [] },
  solids: [rearSolid(-1.6)],
};
