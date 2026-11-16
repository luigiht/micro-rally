import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from './CarHull';
import { loft, type LoftKey } from './HullLoft';

/**
 * The Satory WRC's hull: a mid-2000s three-door World Rally Car, its keys
 * measured off cross-sections of the 3D model in `context/citroen-xsara`
 * (scaled to its 2.555 m wheelbase, `z` forward from the wheelbase's middle,
 * `y` up in hull metres with the axles at 0.33; see `CREDITS.md`) and
 * lofted flat-shaded, a few broad facets to a section. Pure, free of
 * three.js.
 *
 * Drawn boxier than the reference, as a tall square hatch. Reading from the
 * tail: the bumper, then a near-upright tail panel up to the hatch lip at
 * 1.0 m; the hatch glass on one straight lean up to the roof's back edge at
 * z −1.25; a broad C-pillar; the rear quarter window and the long door's
 * glass either side of a black B-pillar, under a level window line at about
 * 0.9 m and on one flat plane each side; a flat roof at 1.31 m with crisp
 * front and back edges (short keys either side of each crease, so the
 * monotone loft turns them tightly); the screen standing steep and straight
 * from z 0.36 down to the cowl at 0.9, its black A-pillars straight in plan;
 * a bonnet falling between raised wings to a squared nose. The doors stand
 * 0.85 m out and tuck in to 0.8 at the sill; the box flares reach 0.89 over
 * both axles. The door's edges are grooves in the flank.
 */

export const SATORY_COLORS = {
  body: '#d8262a',
  trim: '#1f1e24',
  glass: '#2f4a60',
} as const;

// prettier-ignore
const keys: LoftKey[] = [
  // The bumper's back, then the tail panel standing almost upright to the hatch's lip; square in plan.
  { z: -2.03, floor: 0.34, sill: 0.38, belt: 0.62, roof: 0.64, crown: 0, xSill: 0.66, xBody: 0.76, xBelt: 0.74, xRoof: 0.56, bow: 0 },
  { z: -1.99, floor: 0.26, sill: 0.32, belt: 0.92, roof: 0.97, crown: 0.01, xSill: 0.76, xBody: 0.83, xBelt: 0.79, xRoof: 0.6 },
  { z: -1.9, floor: 0.22, sill: 0.27, belt: 0.92, roof: 1.0, crown: 0.02, xSill: 0.82, xBody: 0.87, xBelt: 0.8, xRoof: 0.6 },
  // The rear flare; the C-pillar standing square beside a hatch glass on one straight lean.
  { z: -1.6, belt: 0.92, roof: 1.13, crown: 0.025, xSill: 0.84, xBody: 0.88, xBelt: 0.8, xRoof: 0.62 },
  { z: -1.3, roof: 1.27, crown: 0.03 },
  // The roof's back edge: a short crease, then flat to the screen.
  { z: -1.25, roof: 1.3, crown: 0.035 },
  { z: -1.2, belt: 0.92, roof: 1.31, crown: 0.035, xBody: 0.89, xBelt: 0.8, xRoof: 0.63 },
  { z: -0.88, floor: 0.13, sill: 0.2, crown: 0.035, xSill: 0.84, xBody: 0.89, bow: 0.01 },
  // The doors' skin between the flares; the window line level and the glass on one flat plane.
  { z: -0.7, xSill: 0.8, xBody: 0.85, xBelt: 0.8 },
  { z: 0.0, belt: 0.91, roof: 1.31, crown: 0.035, xRoof: 0.63 },
  // The roof's front edge, crisp, then the screen on one steep straight lean to the cowl.
  { z: 0.36, belt: 0.9, roof: 1.31, crown: 0.035, xRoof: 0.63 },
  { z: 0.42, roof: 1.29, crown: 0.03 },
  { z: 0.48, roof: 1.235, crown: 0.028 },
  { z: 0.76, belt: 0.88, roof: 0.985, crown: 0.022, xSill: 0.8, xBody: 0.85, xBelt: 0.8, xRoof: 0.66 },
  { z: 0.84, roof: 0.915, crown: 0.02 },
  { z: 0.9, belt: 0.86, roof: 0.89, crown: 0.02, xSill: 0.84, xBody: 0.88, xBelt: 0.82, xRoof: 0.7 },
  // The bonnet between the wings, falling to a squared nose.
  { z: 1.1, belt: 0.82, roof: 0.86, crown: 0.025, xBelt: 0.84, xRoof: 0.66 },
  { z: 1.3, belt: 0.79, roof: 0.83, crown: 0.025, xBelt: 0.84, xRoof: 0.62 },
  { z: 1.5, belt: 0.75, roof: 0.79, crown: 0.02, xBody: 0.88, xBelt: 0.82, xRoof: 0.6 },
  { z: 1.7, floor: 0.17, sill: 0.22, belt: 0.71, roof: 0.75, crown: 0.02, xSill: 0.84, xBody: 0.87, xBelt: 0.79, xRoof: 0.56 },
  { z: 1.9, belt: 0.64, roof: 0.68, crown: 0.02, xSill: 0.8, xBody: 0.83, xBelt: 0.75, xRoof: 0.5 },
  { z: 2.0, belt: 0.55, roof: 0.6, crown: 0.015, xSill: 0.72, xBody: 0.78, xBelt: 0.68, xRoof: 0.44 },
  { z: 2.12, floor: 0.2, sill: 0.24, belt: 0.42, roof: 0.45, crown: 0.01, xSill: 0.58, xBody: 0.64, xBelt: 0.56, xRoof: 0.34, bow: 0 },
];

/** Where the glazing and pillars start and stop along the car. */
const HATCH = [-1.9, -1.25] as const;
const QUARTER = [-1.3, -0.45] as const;
const B_PILLAR = [-0.45, -0.36] as const;
const SCREEN = [0.36, 0.9] as const;

/** Panel gaps cut into the body: this wide and this deep. */
const GAP = { width: 0.012, depth: 0.008 };
/** The door's front and rear edges: grooves down the flank from the sill to the window. */
const DOOR_EDGES = [-0.42, 0.84];

const within = (z: number, [a, b]: readonly [number, number]) => z > a && z < b;

function flags(z0: number, z1: number): Partial<HullStation> {
  const z = (z0 + z1) / 2;
  if (within(z, HATCH))
    return within(z, QUARTER) ? { screen: true, glass: true } : { screen: true };
  if (within(z, QUARTER)) return { glass: true };
  if (within(z, B_PILLAR)) return { sidePaint: SATORY_COLORS.trim };
  // The door's glass runs on beside the screen, up to the A-pillar (a strip over the corner: `SATORY_A_PILLAR`).
  if (within(z, SCREEN)) return { screen: true, glass: true, sideGlass: true };
  if (z > B_PILLAR[1] && z < SCREEN[0]) return { glass: true };
  return {};
}

/** The door's edges sunk into the flank. */
function cutGaps(stations: HullStation[]): HullStation[] {
  return stations.map((s) => {
    if (!DOOR_EDGES.some((c) => Math.abs(s.z - c) < 1e-4)) return s;
    const d = GAP.depth;
    return { ...s, xSill: s.xSill - d, xBody: s.xBody - d, xBelt: (s.xBelt ?? s.xBody) - d };
  });
}

export const SATORY_HULL: HullSpec = {
  wells: { ...wellsFor(CAR_SPECS.satory), segments: 10 },
  colors: { body: SATORY_COLORS.body, trim: SATORY_COLORS.trim, glass: SATORY_COLORS.glass },
  rounding: { upper: 2, fullness: 0.08, top: 2, lower: 1 },
  stations: cutGaps(
    loft(keys, {
      step: 0.08,
      breaks: [
        ...HATCH,
        ...QUARTER,
        ...B_PILLAR,
        ...SCREEN,
        ...DOOR_EDGES.flatMap((z) => [z - GAP.width / 2, z, z + GAP.width / 2]),
      ],
      flags,
    }),
  ),
};

/**
 * The stations along the A-pillar: the screen's span, where the screen meets the door's glass at
 * the roof's edge, from the roof's front edge down to the cowl at the bonnet's edge. The body lays
 * a thin black strip over that corner each side (`PillarStrip`), so the pillar is one even-width
 * line flush with the body, not a painted band tapering to a point at the cowl.
 */
export const SATORY_A_PILLAR: readonly HullStation[] = SATORY_HULL.stations.filter(
  (s) => s.z >= SCREEN[0] - 1e-6 && s.z <= SCREEN[1] + 1e-6,
);
