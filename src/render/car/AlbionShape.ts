import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from './CarHull';
import { loft, type LoftKey } from './HullLoft';

/**
 * The Albion RS Hatch's body: a mid-2000s works rally hatch lofted from the
 * reference profiles in `context/ford-focus-rework/build2.mjs` (the belt,
 * roof edge and crown heights and the half-widths along the car, sampled and
 * moved 4 cm forward so its axles sit on ours). The keys are eased along the
 * car on monotone cubics and laid every 8 cm (`loft`), and every section is
 * rounded: the upper sides roll in over two facets, the roof and bonnet
 * crown over two more, and the flank bows out under the belt over three.
 * The lower flank swells over both axles into flared arches (0.94 at the
 * front, 0.93 at the rear, the belt 0.86 between). A three-door: one long
 * door each side, a fixed quarter window behind its B-pillar. Panel gaps
 * are grooves cut into the flank. Pure, free of three.js.
 */

export const ALBION_TRIM = '#1d1d22';
export const ALBION_BLUE = '#1b3d9c';
/**
 * The shell under the livery: a dark grey just apart from the trim's. The livery paints every
 * face of it, white included; where a sliver shows past the livery's edge (by the glass), it reads
 * as a dark window seal rather than a white line.
 */
const SHELL = '#26282e';
/** The Edelweiss S1's glass. */
const GLASS = '#4d6f8c';

/** Keys from the tail to the nose: z, belt, roof edge, crown, flank, belt and roof half-widths. */
const ROWS: readonly (readonly [number, number, number, number, number, number, number])[] = [
  [-2.15, 0.6, 0.6, 0, 0.76, 0.7, 0.56],
  [-2.12, 0.758, 0.795, 0.01, 0.81, 0.744, 0.593],
  [-2.08, 0.921, 0.961, 0.02, 0.858, 0.79, 0.633],
  // The hatch glass a little wider than the reference's, out to the tail lamps' inner edge.
  [-2.01, 1.005, 1.052, 0.03, 0.884, 0.816, 0.69],
  [-1.91, 1.024, 1.11, 0.033, 0.9, 0.828, 0.68],
  [-1.71, 1.03, 1.22, 0.04, 0.915, 0.838, 0.655],
  [-1.56, 1.028, 1.303, 0.045, 0.927, 0.843, 0.609],
  [-1.41, 1.024, 1.375, 0.05, 0.933, 0.846, 0.597],
  [-1.32, 1.022, 1.401, 0.05, 0.933, 0.847, 0.593],
  [-1.16, 1.018, 1.419, 0.05, 0.922, 0.848, 0.59],
  [-0.86, 1.01, 1.423, 0.052, 0.891, 0.851, 0.59],
  [-0.41, 0.997, 1.425, 0.055, 0.876, 0.856, 0.593],
  [-0.01, 0.988, 1.385, 0.055, 0.875, 0.859, 0.6],
  [0.1, 0.986, 1.342, 0.05, 0.875, 0.86, 0.611],
  [0.34, 0.978, 1.22, 0.045, 0.875, 0.861, 0.66],
  [0.66, 0.95, 1.028, 0.04, 0.881, 0.862, 0.728],
  [0.74, 0.937, 0.99, 0.037, 0.885, 0.862, 0.738],
  [0.99, 0.904, 0.942, 0.035, 0.911, 0.862, 0.74],
  [1.3, 0.869, 0.909, 0.034, 0.942, 0.862, 0.74],
  [1.49, 0.851, 0.891, 0.032, 0.934, 0.862, 0.733],
  [1.74, 0.825, 0.865, 0.03, 0.903, 0.857, 0.717],
  [1.94, 0.801, 0.841, 0.028, 0.884, 0.845, 0.7],
  [2.09, 0.77, 0.81, 0.02, 0.875, 0.833, 0.683],
  [2.16, 0.749, 0.789, 0.015, 0.855, 0.811, 0.654],
  [2.2, 0.7, 0.74, 0.01, 0.816, 0.77, 0.604],
  [2.23, 0.58, 0.6, 0, 0.7, 0.64, 0.52],
];

/** The underside and the sill's crease: low skirts along the car, tucked up into each bumper. */
const FLOOR: readonly (readonly [number, number, number])[] = [
  [-2.15, 0.28, 0.34],
  [-2.12, 0.23, 0.3],
  [-2.08, 0.18, 0.26],
  [-2.01, 0.16, 0.26],
  [2.09, 0.14, 0.26],
  [2.16, 0.2, 0.28],
  [2.2, 0.24, 0.3],
  [2.23, 0.3, 0.34],
];

/** The flank bows out this much halfway down, between the arches; nothing at the bumpers. */
const BOW: readonly (readonly [number, number])[] = [
  [-2.15, 0],
  [-1.9, 0.012],
  [-0.4, 0.018],
  [1.8, 0.012],
  [2.23, 0],
];

const keys: LoftKey[] = [
  ...ROWS.map(([z, belt, roof, crown, xBody, xBelt, xRoof]) => ({
    z,
    belt,
    roof,
    crown,
    xBody,
    xBelt,
    xRoof,
    xSill: xBody - 0.07,
  })),
  ...FLOOR.map(([z, floor, sill]) => ({ z, floor, sill })),
  ...BOW.map(([z, bow]) => ({ z, bow })),
].sort((a, b) => a.z - b.z);

/**
 * Glass and pillars along the car: a three-door, so one long door, its window from the A-pillar
 * back to a black B-pillar over the door's trailing edge, then a fixed quarter window.
 */
const HATCH = [-2.01, -1.56] as const;
const C_PILLAR = [-1.56, -1.32] as const;
const QUARTER = [-1.32, -0.86] as const;
const B_PILLAR = [-0.86, -0.76] as const;
const DOOR = [-0.76, -0.01] as const;
const A_ROOT = [-0.01, 0.04] as const;
/** The sun strip across the windscreen's top: painted body (the livery's white band), the glass below. */
const SUNSTRIP = [0.04, 0.16] as const;
const SCREEN = [0.16, 0.74] as const;

/** Panel gaps cut into the flank: this wide and this deep. */
const GAP = { width: 0.016, depth: 0.012 };
/**
 * The front bumper's seam with the wing, the door's leading edge, its trailing edge under the
 * B-pillar, the rear bumper's seam.
 */
const GAPS = [1.76, 0.69, -0.8, -1.83];

const within = (z: number, [a, b]: readonly [number, number]) => z > a && z < b;

function flags(z0: number, z1: number): Partial<HullStation> {
  const z = (z0 + z1) / 2;
  // The hatch's sides and the C-pillars are body colour, so the livery paints them in the same
  // blue as the panels round them, one layer, with no seam.
  if (within(z, HATCH)) return { screen: true };
  if (within(z, C_PILLAR)) return {};
  // The quarter window is the livery's black shape (it ends in a point toward the tail), so its
  // segment is body colour; the door's window is glass.
  if (within(z, DOOR)) return { glass: true };
  if (within(z, B_PILLAR)) return { sidePaint: ALBION_TRIM };
  // The door's glass runs on forward past the screen's top, then beside the screen as a triangle
  // narrowing down to the mirror at the cowl, meeting the screen with no pillar between.
  if (within(z, A_ROOT) || within(z, SUNSTRIP)) return { glass: true };
  if (within(z, SCREEN)) return { screen: true, glass: true, sideGlass: true };
  return {};
}

/** Each gap's station pressed into the flank. */
function cutGaps(stations: HullStation[]): HullStation[] {
  return stations.map((s) => {
    if (!GAPS.some((g) => Math.abs(s.z - g) < 1e-4)) return s;
    const d = GAP.depth;
    return { ...s, xSill: s.xSill - d, xBody: s.xBody - d };
  });
}

export const ALBION_HULL: HullSpec = {
  wells: { ...wellsFor(CAR_SPECS.focus), segments: 12 },
  colors: { body: SHELL, trim: ALBION_TRIM, glass: GLASS },
  rounding: { upper: 2, fullness: 0.55, top: 2, lower: 3 },
  stations: cutGaps(
    loft(keys, {
      step: 0.08,
      breaks: [
        ...HATCH,
        ...C_PILLAR,
        ...QUARTER,
        ...B_PILLAR,
        ...DOOR,
        ...A_ROOT,
        ...SUNSTRIP,
        ...SCREEN,
        ...GAPS.flatMap((z) => [z - GAP.width / 2, z, z + GAP.width / 2]),
      ],
      flags,
    }),
  ),
};
