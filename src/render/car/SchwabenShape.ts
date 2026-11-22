import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from './CarHull';
import { loft, type LoftKey } from './HullLoft';

/**
 * The Schwaben SC Rallye's hull: an early-1980s rear-engined rally coupé
 * after the photos in `context/rally-porsche` (references only), measured
 * from its 2.27 m wheelbase and set on our axles (front at z +1.33, rear at
 * −0.94; `y` up in hull metres, the axles at 0.32). Pure, free of three.js.
 *
 * Reading from the tail: a rounded tail panel under the engine lid (the
 * whale-tail spoiler stands on it, `SchwabenBody`); the roof falling in one
 * curve from the screen's top to the tail, the rear glass lying on it from
 * the lid (z −1.2) up to z −0.44; the rear quarter window tapering back
 * under it over the rear flare, a slim pillar, the door's glass; a raked
 * screen from z 0.28 down to the cowl at 0.76; and a long bonnet falling
 * gently between raised front wings that carry the round headlamps, then a
 * short, steep nose. Both arches are flared out to 0.89–0.91 m, the
 * doors between them 0.82 m; the flanks bow out and tuck under. Squared off for a
 * boxy, low-poly read: nearly flat flanks and roof, slab-sided upper
 * cabin, and a square nose and tail in plan. The panel
 * gaps are grooves in the body: down the flanks at the doors' edges, and
 * round the bonnet and the engine lid.
 */

export const SCHWABEN_COLORS = {
  body: '#f2f1ec',
  trim: '#1f1e24',
  glass: '#2f4a60',
} as const;

const keys: LoftKey[] = [
  // The tail panel, rounded in plan, the bumper's lower edge tucked under.
  {
    z: -1.98,
    floor: 0.3,
    sill: 0.34,
    belt: 0.62,
    roof: 0.64,
    crown: 0.01,
    xSill: 0.74,
    xBody: 0.8,
    xBelt: 0.76,
    xRoof: 0.56,
    bow: 0,
  },
  {
    z: -1.92,
    floor: 0.28,
    sill: 0.32,
    belt: 0.72,
    roof: 0.76,
    xSill: 0.8,
    xBody: 0.86,
    xBelt: 0.8,
    xRoof: 0.6,
  },
  // The engine lid curving down over the rear flare, widest over the axle.
  { z: -1.78, belt: 0.8, roof: 0.85, crown: 0.03, xBody: 0.88, xBelt: 0.8, xRoof: 0.6 },
  {
    z: -1.4,
    floor: 0.21,
    sill: 0.27,
    belt: 0.86,
    roof: 0.92,
    crown: 0.035,
    xSill: 0.82,
    xBody: 0.91,
    xBelt: 0.82,
    xRoof: 0.62,
    bow: 0.01,
  },
  // The rear glass on the fastback, one curve from the lid up to the screen's top.
  { z: -1.2, belt: 0.87, roof: 0.965 },
  { z: -0.94, xSill: 0.83, xBody: 0.91, xBelt: 0.82 },
  { z: -0.75, belt: 0.87, roof: 1.09, crown: 0.04 },
  { z: -0.44, belt: 0.87, roof: 1.2, crown: 0.03, xRoof: 0.66 },
  // The flare runs out into the door.
  { z: -0.3, xSill: 0.76, xBody: 0.83, xBelt: 0.79 },
  { z: -0.1, belt: 0.865, roof: 1.27, crown: 0.03 },
  { z: 0.28, belt: 0.865, roof: 1.29, crown: 0.03, xRoof: 0.67 },
  // The raked screen down to the cowl.
  { z: 0.5, roof: 1.11, crown: 0.025 },
  { z: 0.6, xSill: 0.76, xBody: 0.83, xBelt: 0.79 },
  { z: 0.76, belt: 0.865, roof: 0.885, crown: 0.005, xBelt: 0.79, xRoof: 0.66 },
  // The front flare over the axle; the wings holding their height out to the headlamps while the
  // bonnet between them falls away toward the nose.
  { z: 1.0, xSill: 0.79, xBody: 0.86, xBelt: 0.8 },
  {
    z: 1.33,
    belt: 0.845,
    roof: 0.855,
    crown: -0.05,
    xSill: 0.81,
    xBody: 0.88,
    xBelt: 0.8,
    xRoof: 0.6,
  },
  { z: 1.75, belt: 0.83, roof: 0.835, crown: -0.1, xBody: 0.87, xBelt: 0.79, xRoof: 0.57 },
  {
    z: 2.0,
    floor: 0.22,
    sill: 0.27,
    belt: 0.81,
    roof: 0.815,
    crown: -0.13,
    xSill: 0.76,
    xBody: 0.84,
    xBelt: 0.77,
    xRoof: 0.55,
  },
  // The short, steep nose: rounded in plan, the bumper's lower edge tucked under.
  {
    z: 2.1,
    floor: 0.24,
    sill: 0.28,
    belt: 0.68,
    roof: 0.69,
    crown: -0.06,
    xSill: 0.78,
    xBody: 0.84,
    xBelt: 0.78,
    xRoof: 0.56,
  },
  {
    z: 2.18,
    floor: 0.27,
    sill: 0.3,
    belt: 0.54,
    roof: 0.55,
    crown: 0,
    xSill: 0.74,
    xBody: 0.8,
    xBelt: 0.74,
    xRoof: 0.52,
    bow: 0,
  },
];

/** Where the glazing and the slim pillar start and stop along the car. */
const REAR_GLASS = [-1.2, -0.44] as const;
const QUARTER = [-0.92, -0.44] as const;
const PILLAR = [-0.44, -0.38] as const;
const SCREEN = [0.28, 0.76] as const;

/** Panel gaps cut into the body itself: this wide and this deep. */
const GAP = { width: 0.012, depth: 0.008 };
/** The doors' front and rear edges: grooves down the flanks from the sill to the window. */
const DOOR_EDGES = [-0.36, 0.78];
/** Across the top: the engine lid's back and front, the bonnet's back and front. */
const LID_ENDS = [-1.9, -1.24, 0.82, 2.06];
/** Along the top, where the engine lid and the bonnet meet the wings. */
const LID_SIDES = [
  [-1.9, -1.24],
  [0.82, 2.06],
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
  if (within(z, PILLAR)) return {};
  // The door's glass runs on beside the screen, up to a slim A-pillar (a strip over the corner:
  // `SCHWABEN_ROOF_LINE`).
  if (within(z, SCREEN)) return { screen: true, glass: true, sideGlass: true };
  if (z > PILLAR[1] && z < SCREEN[0]) return { glass: true };
  return {};
}

export const SCHWABEN_HULL: HullSpec = {
  wells: { ...wellsFor(CAR_SPECS.scrs), segments: 12 },
  colors: {
    body: SCHWABEN_COLORS.body,
    trim: SCHWABEN_COLORS.trim,
    glass: SCHWABEN_COLORS.glass,
  },
  rounding: {
    upper: 2,
    fullness: 0.2,
    top: 2,
    lower: 2,
    groove: { x: 0.5, depth: GAP.depth, width: GAP.width, spans: LID_SIDES },
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
 * The stations along the roof's edge from the cowl to the tail, for a slim body-coloured strip
 * over it (`PillarStrip`): down each A-pillar, along the roof and down the fastback past the rear
 * glass and the engine lid, one line framing the glasshouse.
 */
export const SCHWABEN_ROOF_LINE: readonly HullStation[] = SCHWABEN_HULL.stations.filter(
  (s) => s.z <= SCREEN[1] + 1e-6,
);
