import type { LiveryShapes, LiveryView, ViewAxis } from './HullLivery';
import { poly, rect, strips, type Layer, type Paint } from './LiveryStrips';
import { SATORY_COLORS } from './SatoryShape';

/**
 * The Satory WRC's livery, our own interpretation of the mid-2000s works
 * livery after the 3D model and photos in `context/citroen-xsara` (its
 * colour regions read off the model's texture, redrawn as shapes; no names,
 * logos or marks), painted by `HullLivery.paintLivery` over the red shell:
 *
 * - **Rear quarter:** deep blue behind one diagonal edge climbing from the
 *   bottom of the car (about z −0.38), over the rear arch's top (z −0.9,
 *   0.62 m), to the quarter window's foot (z −1.28, 0.98 m) under a gold and
 *   a white line,
 *   as the side elevation draws it; the whole C-pillar blue up to the
 *   roof's edge, with no streak beside the hatch glass.
 * - **Roof:** white to its edges.
 * - **Bumpers:** blue under a gold line, the front at 0.46 m, the rear at
 *   0.64 m (red above it, between the tail lamps).
 * - **Details** (a layer over the paint, outlines traced off the model): the
 *   headlamps sweeping from the nose onto the wings, the bonnet's twin
 *   vents, the grille slot, the big lower intake and the fog lamps, the
 *   door handle; the tail lamps small square boxes at the tail's corners
 *   (red over a white reversing lamp) straight on the red tail panel.
 */

export const SATORY_RED = SATORY_COLORS.body;
export const SATORY_BLUE = '#1d3f94';
const GOLD = '#f2b81f';
const WHITE = '#f4f1ea';
const BLACK = '#17161c';
const LENS = '#e9eef2';
/** The tail lamps' lens: a bright red that stands out from the red tail panel round it. */
const TAIL = '#ff5a3c';
const REVERSE = '#f4f1ea';

/**
 * The blue's leading edge, after the side elevation: one diagonal from the quarter window's foot
 * (z −1.28, 0.98 m) down and forward over the rear arch's top (z −0.9, 0.62 m), on at the same
 * slope to the bottom of the car (past the floor by `z1`, so it reaches the sill everywhere).
 */
const DIAG = { z0: -1.28, y0: 0.98, z1: -0.18 };
const DIAG_SLOPE = (0.62 - DIAG.y0) / (-0.9 - DIAG.z0);
const LINE = 0.016;

/** The blue's top edge along the flank. */
function blueTop(z: number): number {
  if (z > 1.62) return 0.46;
  if (z > DIAG.z1) return 0;
  // The whole C-pillar, up to the roof's edge.
  if (z <= DIAG.z0) return 2;
  return DIAG.y0 + (z - DIAG.z0) * DIAG_SLOPE;
}

function flank(): LiveryView['paint'] {
  // A gold line over the blue wherever it has an edge (the bumper, the diagonal), a white one over
  // it along the diagonal.
  const diag = (z: number) => z > DIAG.z0 && z <= DIAG.z1;
  const gold = (z: number) => (z > 1.62 || diag(z) ? LINE : 0);
  const top1 = (z: number) => blueTop(z) + gold(z);
  const layers: Layer[] = [
    { color: SATORY_BLUE, bottom: () => 0, top: blueTop },
    { color: GOLD, bottom: blueTop, top: top1 },
    { color: WHITE, bottom: top1, top: (z) => top1(z) + (diag(z) ? LINE : 0) },
  ];
  return strips(-2.2, 2.25, layers);
}

/** Over the roof: white to its edges; blue behind it. */
function roof(): Paint[] {
  const out: Paint[] = [
    // To the roof's front edge, where the A-pillars start.
    rect(-1.3, 0.36, -0.75, 0.75, WHITE),
    // Blue behind the roof (the C-pillars' tops and the hatch's lip round the glass) and on the
    // front bumper's top.
    rect(-2.2, -1.3, -1, 1, SATORY_BLUE),
    rect(2.08, 2.2, -1, 1, SATORY_BLUE),
  ];
  return out;
}

const mirrorV = (pts: readonly (readonly [number, number])[]) =>
  pts.map(([u, v]) => [u, -v] as const);

/**
 * The headlamps, one solid each, so every lens is one connected shape across the nose, the
 * bonnet's edge and the wing it sweeps back onto. Fitted to our hull's nose (not the model's):
 * seen from the front a teardrop, low and narrow inboard, rising to the wing's corner; from the
 * side its foot slants up and back along the nose; from above it spans the whole corner.
 */
const HEAD = {
  front: [
    [0.4, 0.47],
    [0.66, 0.48],
    [0.8, 0.53],
    [0.86, 0.6],
    [0.84, 0.66],
    [0.7, 0.69],
    [0.5, 0.62],
    [0.43, 0.56],
  ],
  side: [
    [2.2, 0.4],
    [2.2, 0.75],
    [1.8, 0.75],
    [1.8, 0.64],
  ],
  top: [
    [1.8, 0.38],
    [2.2, 0.38],
    [2.2, 0.95],
    [1.8, 0.95],
  ],
} as const;
/**
 * The tail lamps: small square boxes at the tail's corners, each a red stop lamp over a white
 * reversing lamp, straight on the tail panel, wrapping round the corner onto the flank.
 */
const LAMP = { x0: 0.6, y0: 0.7, split: 0.75, y1: 0.88, zIn: -1.95 } as const;
const box = (u0: number, u1: number, v0: number, v1: number): [number, number][] => [
  [u0, v0],
  [u1, v0],
  [u1, v1],
  [u0, v1],
];
/** A lamp block between heights `y0` and `y1`: square in all three views. */
const lampBlock = (color: string, y0: number, y1: number) => ({
  color,
  side: box(-2.2, LAMP.zIn, y0, y1),
  front: box(LAMP.x0, 1, y0, y1),
  top: box(-2.2, LAMP.zIn, LAMP.x0, 1),
  mirror: true,
});
/** The bonnet's vent, top view (z, x). */
const VENT = [
  [1.592, 0.382],
  [1.652, 0.168],
  [1.778, 0.154],
  [1.79, 0.165],
  [1.745, 0.36],
  [1.6, 0.392],
] as const;

function flankDetails(): Paint[] {
  return [
    // Door handle near the door's rear edge.
    rect(-0.3, -0.18, 0.8, 0.82, BLACK),
  ];
}

function deckDetails(): Paint[] {
  return [poly(VENT, BLACK), poly(mirrorV(VENT), BLACK)];
}

function noseDetails(): Paint[] {
  const out: Paint[] = [
    // Grille slot between the lamps, over the gold line.
    poly(
      [
        [-0.38, 0.58],
        [0.38, 0.58],
        [0.34, 0.49],
        [-0.34, 0.49],
      ],
      BLACK,
    ),
    // The big intake low in the bumper.
    poly(
      [
        [-0.48, 0.42],
        [0.48, 0.42],
        [0.44, 0.23],
        [-0.44, 0.23],
      ],
      BLACK,
    ),
  ];
  for (const s of [1, -1]) {
    out.push(
      poly(
        [
          [0.52 * s, 0.37],
          [0.68 * s, 0.37],
          [0.66 * s, 0.27],
          [0.53 * s, 0.27],
        ],
        BLACK,
      ),
    );
  }
  return out;
}

function tailDetails(): Paint[] {
  return [rect(-0.26, 0.26, 0.44, 0.54, BLACK)];
}

const SIDE_U: ViewAxis = [2, -2.2, 2.25];
const SIDE_V: ViewAxis = [1, 0, 1.6];
const ACROSS: ViewAxis = [0, -1, 1];
const FLANK = flank();
const FLANK_DETAILS = flankDetails();

export const SATORY_LIVERY: LiveryShapes = {
  left: { u: SIDE_U, v: SIDE_V, paint: FLANK },
  right: { u: SIDE_U, v: SIDE_V, paint: FLANK },
  top: { u: SIDE_U, v: ACROSS, paint: roof() },
  back: {
    u: ACROSS,
    v: SIDE_V,
    // Blue under a gold line, red up the tail panel to the hatch glass's foot, blue again above
    // (the C-pillars' faces turned back beside the glass).
    paint: [
      rect(-1, 1, 0, 0.64, SATORY_BLUE),
      rect(-1, 1, 0.64, 0.656, GOLD),
      rect(-1, 1, 1.0, 1.6, SATORY_BLUE),
    ],
  },
  front: {
    u: ACROSS,
    v: SIDE_V,
    paint: [rect(-1, 1, 0, 0.46, SATORY_BLUE), rect(-1, 1, 0.46, 0.476, GOLD)],
  },
  // The lamps wrap round the car's corners as one shape each: inside all their outlines at once.
  solids: [
    { color: LENS, ...HEAD, mirror: true },
    lampBlock(TAIL, LAMP.split, LAMP.y1),
    lampBlock(REVERSE, LAMP.y0, LAMP.split),
  ],
  over: {
    left: { u: SIDE_U, v: SIDE_V, paint: FLANK_DETAILS },
    right: { u: SIDE_U, v: SIDE_V, paint: FLANK_DETAILS },
    top: { u: SIDE_U, v: ACROSS, paint: deckDetails() },
    front: { u: ACROSS, v: SIDE_V, paint: noseDetails() },
    back: { u: ACROSS, v: SIDE_V, paint: tailDetails() },
  },
};
