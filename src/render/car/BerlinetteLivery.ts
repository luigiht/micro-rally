import type { LiveryShapes, ViewAxis } from './HullLivery';
import { BERLINETTE_COLORS } from './BerlinetteShape';
import { disc, poly, rect, ring, type Paint } from './LiveryStrips';

/**
 * The Dieppe Berlinette's livery, our own reading of the 1970s works cars in
 * `context/alpine-a110-rally` (photos, used as references only; no names,
 * logos or marks): the shell all one deep French blue. Over it, a layer of
 * details (the panel gaps are grooves in the body, `BerlinetteShape`): chrome
 * door handles, the black leather bonnet straps,
 * the chrome filler cap, the oval intake and orange indicators in the nose,
 * and the tail lamps, red and amber, with the plate recess between them.
 */

export const BERLINETTE_BLUE = BERLINETTE_COLORS.body;
const BLACK = '#17161c';
const CHROME = BERLINETTE_COLORS.chrome;
const AMBER = '#f0931f';
const TAIL = '#c1272d';

const SIDE_U: ViewAxis = [2, -2.0, 2.1];
const SIDE_V: ViewAxis = [1, 0, 1.4];
const ACROSS: ViewAxis = [0, -1, 1];

function flankDetails(): Paint[] {
  return [
    rect(-0.17, -0.07, 0.6, 0.618, CHROME),
    // The tail lamps' wrap round the corner.
    rect(-1.85, -1.7, 0.55, 0.6, TAIL),
  ];
}

function deckDetails(): Paint[] {
  const out: Paint[] = [
    // The filler cap on the bonnet, by the screen.
    ring(1.0, -0.26, 0.04, 0.05, CHROME, 16),
    disc(1.0, -0.26, 0.04, BLACK, 16),
  ];
  // Two black leather straps over the nose, buckled near the bonnet's front.
  for (const x of [0.2, -0.2]) {
    out.push(
      rect(1.55, 1.92, x - 0.022, x + 0.022, BLACK),
      rect(1.62, 1.66, x - 0.03, x + 0.03, CHROME),
    );
  }
  return out;
}

function noseDetails(): Paint[] {
  const out: Paint[] = [
    // The oval intake low in the nose.
    poly(
      [
        [-0.26, 0.36],
        [-0.18, 0.4],
        [0.18, 0.4],
        [0.26, 0.36],
        [0.18, 0.31],
        [-0.18, 0.31],
      ],
      BLACK,
    ),
  ];
  for (const s of [1, -1]) out.push(rect(0.36 * s - 0.04, 0.36 * s + 0.04, 0.44, 0.47, AMBER));
  return out;
}

function tailDetails(): Paint[] {
  const out: Paint[] = [rect(-0.2, 0.2, 0.42, 0.52, BLACK)];
  for (const s of [1, -1]) {
    // Out past the panel's corner, so the red runs on unbroken into the wrap on the flank.
    const [a, b] = s > 0 ? [0.3, 0.8] : [-0.8, -0.3];
    out.push(
      rect(a, b, 0.55, 0.6, TAIL),
      rect(s > 0 ? 0.22 : -0.3, s > 0 ? 0.3 : -0.22, 0.55, 0.6, AMBER),
    );
  }
  return out;
}

const FLANK_DETAILS = flankDetails();

export const BERLINETTE_LIVERY: LiveryShapes = {
  left: { u: SIDE_U, v: SIDE_V, paint: [] },
  right: { u: SIDE_U, v: SIDE_V, paint: [] },
  top: { u: SIDE_U, v: ACROSS, paint: [] },
  over: {
    left: { u: SIDE_U, v: SIDE_V, paint: FLANK_DETAILS },
    right: { u: SIDE_U, v: SIDE_V, paint: FLANK_DETAILS },
    top: { u: SIDE_U, v: ACROSS, paint: deckDetails() },
    front: { u: ACROSS, v: SIDE_V, paint: noseDetails() },
    back: { u: ACROSS, v: SIDE_V, paint: tailDetails() },
  },
};
