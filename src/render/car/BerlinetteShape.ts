import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from './CarHull';
import { loft, type LoftKey } from './HullLoft';

/**
 * The Dieppe Berlinette's hull: a tiny rear-engined 1970s berlinette after
 * the side photo in `context/alpine-a110-rally` (references only), measured
 * on a grid scaled from its 2.1 m wheelbase and set on our axles (front at
 * z +1.22, rear at −0.88; `y` up in hull metres, the axles at 0.29). Plan
 * widths follow the front and rear photos and its 1.55 m. Pure, free of
 * three.js.
 *
 * Reading from the tail: a low tail panel under a short engine lid; the
 * rear glass lying on the fastback from the lid (z −1.16) up to the roof
 * (z −0.54); a small rear quarter window tapering back over the rear wheel,
 * a slim pillar, the door's glass; a narrow, nearly flat roof; a raked
 * screen from z 0.35 down to the cowl at 0.82; and a long bonnet falling to
 * a low nose that stays broad to its corners, where the headlamps sit, with
 * the wings standing a little proud of the bonnet between them. The flanks
 * bow out and tuck under. The panel gaps are grooves in the body: down the
 * flanks at the doors' edges, and round the bonnet and the engine lid.
 */

export const BERLINETTE_COLORS = {
  body: '#2b6cc4',
  trim: '#1f1e24',
  glass: '#2f4a60',
  chrome: '#cfd2d6',
} as const;

const keys: LoftKey[] = [
  // The tail panel, rounded in plan, under the end of the engine lid.
  {
    z: -1.78,
    floor: 0.34,
    sill: 0.38,
    belt: 0.6,
    roof: 0.62,
    crown: 0.02,
    xSill: 0.48,
    xBody: 0.56,
    xBelt: 0.5,
    xRoof: 0.36,
    bow: 0,
  },
  {
    z: -1.7,
    floor: 0.3,
    sill: 0.34,
    belt: 0.68,
    roof: 0.7,
    xSill: 0.6,
    xBody: 0.67,
    xBelt: 0.6,
    xRoof: 0.44,
  },
  {
    z: -1.55,
    belt: 0.75,
    roof: 0.77,
    crown: 0.03,
    xSill: 0.66,
    xBody: 0.74,
    xBelt: 0.68,
    xRoof: 0.48,
  },
  // The engine lid and the rear flare, then the rear glass climbing the fastback.
  {
    z: -1.16,
    floor: 0.22,
    sill: 0.27,
    belt: 0.79,
    roof: 0.8,
    crown: 0.03,
    xSill: 0.7,
    xBody: 0.79,
    xBelt: 0.71,
    xRoof: 0.5,
    bow: 0.03,
  },
  { z: -1.0, belt: 0.79, roof: 0.86, crown: 0.03 },
  { z: -0.8, belt: 0.785, roof: 0.945, crown: 0.035 },
  // The quarter window's tail, then the cabin under a narrow, nearly flat roof.
  { z: -0.54, belt: 0.78, roof: 1.05, crown: 0.045, xBody: 0.79, xSill: 0.7 },
  { z: -0.4, xBody: 0.76, xSill: 0.68, xBelt: 0.7 },
  { z: -0.29, belt: 0.78, roof: 1.11, crown: 0.045, xRoof: 0.5 },
  { z: 0.35, belt: 0.785, roof: 1.09, crown: 0.035, xRoof: 0.52 },
  // The raked screen down to the cowl.
  { z: 0.55, belt: 0.79, roof: 0.98, crown: 0.025 },
  { z: 0.7, xBody: 0.76, xSill: 0.68, xBelt: 0.7 },
  {
    z: 0.82,
    belt: 0.8,
    roof: 0.825,
    crown: 0.01,
    xBody: 0.78,
    xSill: 0.7,
    xBelt: 0.71,
    xRoof: 0.56,
  },
  // The bonnet falling to the nose, the wings a touch proud of it toward the lamps.
  { z: 1.34, belt: 0.74, roof: 0.76, crown: -0.01, xBelt: 0.71, xRoof: 0.58 },
  {
    z: 1.62,
    belt: 0.69,
    roof: 0.705,
    crown: -0.025,
    xBody: 0.77,
    xSill: 0.68,
    xBelt: 0.7,
    xRoof: 0.58,
  },
  {
    z: 1.8,
    belt: 0.62,
    roof: 0.64,
    crown: -0.02,
    xBody: 0.7,
    xSill: 0.62,
    xBelt: 0.64,
    xRoof: 0.52,
  },
  {
    z: 1.9,
    floor: 0.22,
    sill: 0.27,
    belt: 0.55,
    roof: 0.565,
    xBody: 0.6,
    xSill: 0.52,
    xBelt: 0.55,
    xRoof: 0.42,
  },
  {
    z: 1.975,
    floor: 0.24,
    sill: 0.28,
    belt: 0.43,
    roof: 0.44,
    crown: 0,
    xBody: 0.46,
    xSill: 0.38,
    xBelt: 0.42,
    xRoof: 0.3,
    bow: 0,
  },
];

/** Where the glazing and the slim pillar start and stop along the car. */
const REAR_GLASS = [-1.16, -0.54] as const;
const QUARTER = [-0.66, -0.31] as const;
const PILLAR = [-0.31, -0.26] as const;
const SCREEN = [0.35, 0.82] as const;

/** Panel gaps cut into the body itself: this wide and this deep. */
const GAP = { width: 0.012, depth: 0.008 };
/** The doors' front and rear edges: grooves down the flanks from the sill to the window. */
const DOOR_EDGES = [-0.25, 0.79];
/** Across the top: the engine lid's back and front, the bonnet's back and front. */
const LID_ENDS = [-1.68, -1.2, 0.9, 1.86];
/** Along the top, where the engine lid and the bonnet meet the wings. */
const LID_SIDES = [
  [-1.68, -1.2],
  [0.9, 1.86],
] as const;

const within = (z: number, [a, b]: readonly [number, number]) => z > a && z < b;
const at = (z: number, list: readonly number[]) => list.some((c) => Math.abs(z - c) < 1e-4);

/** Each gap's station sunk into the body: the flank stepped in at a door's edge, the top dropped at a lid's end. */
function cutGaps(stations: HullStation[]): HullStation[] {
  return stations.map((s) => {
    if (at(s.z, DOOR_EDGES)) {
      const d = GAP.depth;
      return { ...s, xSill: s.xSill - d, xBody: s.xBody - d, xBelt: (s.xBelt ?? s.xBody) - d };
    }
    if (at(s.z, LID_ENDS)) return { ...s, roof: s.roof - GAP.depth };
    return s;
  });
}
const gapBreaks = [...DOOR_EDGES, ...LID_ENDS].flatMap((z) => [
  z - GAP.width / 2,
  z,
  z + GAP.width / 2,
]);

function flags(z0: number, z1: number): Partial<HullStation> {
  const z = (z0 + z1) / 2;
  if (within(z, REAR_GLASS))
    return within(z, QUARTER) ? { screen: true, glass: true } : { screen: true };
  if (within(z, QUARTER)) return { glass: true };
  if (within(z, PILLAR)) return { sidePaint: BERLINETTE_COLORS.chrome };
  // The door's glass runs on beside the screen, up to a slim body-coloured A-pillar (a strip over
  // the corner: `BERLINETTE_A_PILLAR`).
  if (within(z, SCREEN)) return { screen: true, glass: true, sideGlass: true };
  if (z > PILLAR[1] && z < SCREEN[0]) return { glass: true };
  return {};
}

export const BERLINETTE_HULL: HullSpec = {
  wells: { ...wellsFor(CAR_SPECS.berlinette), segments: 12 },
  colors: {
    body: BERLINETTE_COLORS.body,
    trim: BERLINETTE_COLORS.trim,
    glass: BERLINETTE_COLORS.glass,
  },
  rounding: {
    upper: 2,
    fullness: 0.5,
    top: 2,
    lower: 3,
    groove: { x: 0.42, depth: GAP.depth, width: GAP.width, spans: LID_SIDES },
  },
  stations: cutGaps(
    loft(keys, {
      step: 0.08,
      breaks: [...REAR_GLASS, ...QUARTER, ...PILLAR, ...SCREEN, ...gapBreaks],
      flags,
    }),
  ),
};

/**
 * The stations along the A-pillar: the screen's span, from the roof's front edge down to the cowl
 * at the bonnet's edge. The body lays a slim body-coloured strip over the corner where the screen
 * meets the door's glass (`PillarStrip`), one straight even-width line from the bonnet to the roof
 * instead of a painted band tapering to a point at the cowl.
 */
export const BERLINETTE_A_PILLAR: readonly HullStation[] = BERLINETTE_HULL.stations.filter(
  (s) => s.z >= SCREEN[0] - 1e-6 && s.z <= SCREEN[1] + 1e-6,
);
