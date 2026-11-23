import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { wellsFor, type HullSpec, type HullStation } from './CarHull';
import type { LiverySolid, LiveryShapes, ViewAxis } from './HullLivery';
import { loft, type LoftKey } from './HullLoft';
import { poly, rect } from './LiveryStrips';

/**
 * The Mulsanne LM Prototype's body: a 1970 Le Mans short-tail coupé after the
 * photos and the CC BY reference model in `context/porsche-lemans`, measured
 * by slicing it every 10 cm (`917k-model-notes.md`; nothing from it ships).
 * Boxy and faceted on the real proportions. Metres, nose toward +z, y up from
 * the ground, the origin between the axles. Pure, free of three.js.
 *
 * - **The shell** (`LEMANS_SHELL`): a blunt, low nose wedge; front fenders
 *   peaking over the wheels with the bonnet dipping 14 cm between them; a
 *   near-vertical flank with a waist at the doors; rear fenders widening to
 *   the car's full width and climbing to the tail, the deck between them
 *   lower and concave; the underside rising behind the rear axle so the
 *   engine and frame show under the tail. Arches cut round both wheels.
 * - **The canopy** (`LEMANS_CANOPY`): a narrow bubble standing well forward
 *   between the fenders, its long wraparound windscreen running from the
 *   bonnet's valley to the roof, door windows each side, and a fastback
 *   fairing running the roof back down into the engine cover.
 * - **The livery** (`LEMANS_LIVERY`): powder blue, an orange skirt all round
 *   and over the nose's lower half, an orange centre stripe nose to tail,
 *   white roundels on the bonnet and doors, the black-bordered headlamps,
 *   intakes and vents. The orange is the base layer; the details are solids
 *   over it, so their edges run unbroken across the faces they cross.
 */

/** Key sizes from the reference sheet; the wheelbase and track are the spec's. */
export const DIMENSIONS = {
  length: 4.2,
  width: 2.12,
  height: 0.95,
  nose: 2.1,
  tail: -2.1,
  /** Front fenders' peak over the axle, and the bonnet's valley between them. */
  fenderPeak: 0.74,
  bonnet: 0.6,
  /** The canopy's roof, its widest half width, and its windscreen's foot (z, y). */
  roof: 0.95,
  canopyHalf: 0.52,
  screenFoot: [1.35, 0.6],
  /** The engine deck between the rear fenders, and the tail lip. */
  deck: 0.78,
  lip: 0.94,
  /** Half widths: the nose, the front fenders, the waist at the doors, the rear fenders. */
  xNose: 0.83,
  xFront: 0.97,
  xWaist: 0.88,
  xRear: 1.06,
} as const;

export const LEMANS_COLORS = {
  blue: '#86bde0',
  orange: '#f07a2a',
  white: '#f4f1ea',
  trim: '#1d1d22',
  bay: '#1c1c22',
  glass: '#2c4f6e',
  screen: '#22405a',
  lens: '#fff3c4',
  fan: '#3a3a42',
  chrome: '#cfd2d6',
} as const;

const D = DIMENSIONS;
const S = CAR_SPECS.lemans;

/**
 * Shell keys from the slices, tail to nose: `roof` is the fender line (the top's outer edge at
 * `xRoof`) and `crown` how far the centre stands above it (negative: the bonnet's valley and the
 * concave deck). Through the cabin the centre is held at the 0.56 m the cockpit's fittings clear
 * (decision 114), the fenders beside it at the measured 0.67.
 */
const shellKeys: LoftKey[] = [
  // The tail: the lip over the engine bay, the underside high over the open frame.
  {
    z: D.tail,
    floor: 0.8,
    sill: 0.82,
    belt: 0.86,
    roof: D.lip,
    crown: 0,
    xSill: 0.86,
    xBody: 0.92,
    xBelt: 0.92,
    xRoof: 0.88,
    bow: 0,
  },
  {
    z: -2.0,
    floor: 0.62,
    sill: 0.66,
    belt: 0.76,
    roof: 0.91,
    crown: -0.06,
    xSill: 0.95,
    xBody: 1.03,
    xBelt: 1.04,
    xRoof: 0.92,
  },
  { z: -1.85, floor: 0.45, sill: 0.5, roof: 0.88, crown: -0.11, xBody: 1.05, xBelt: 1.05 },
  { z: -1.65, floor: 0.28, sill: 0.36, roof: 0.87, crown: -0.1 },
  // The rear fenders at full width, climbing; the deck between them flat at 0.78.
  {
    z: -1.4,
    floor: 0.12,
    sill: 0.16,
    belt: 0.52,
    roof: 0.85,
    crown: -0.07,
    xSill: 1.0,
    xBody: D.xRear,
    xBelt: D.xRear,
    xRoof: 0.92,
    bow: 0.01,
  },
  { z: -1.05, roof: 0.8, crown: -0.02, xBody: 1.04, xBelt: 1.05, xRoof: 0.9 },
  { z: -0.75, roof: 0.76, crown: -0.08, xBody: 1.02, xBelt: 1.03, xRoof: 0.88 },
  // The waist at the doors: the fender line at 0.67, the centre under the cabin at 0.56.
  {
    z: -0.3,
    floor: 0.1,
    sill: 0.13,
    belt: 0.45,
    roof: 0.69,
    crown: -0.13,
    xSill: 0.95,
    xBody: 0.99,
    xBelt: 1.0,
    xRoof: 0.86,
  },
  { z: 0.2, roof: 0.67, crown: -0.11, xBody: 0.98, xBelt: 0.98, xRoof: D.xWaist - 0.03 },
  { z: 0.7, roof: 0.71, crown: -0.15, xBody: 0.97, xBelt: 0.97, xRoof: D.xWaist },
  // The front fenders peaking over the wheels, the bonnet dipping between them.
  {
    z: 1.1,
    floor: 0.1,
    sill: 0.12,
    belt: 0.5,
    roof: D.fenderPeak,
    crown: D.bonnet - D.fenderPeak,
    xSill: 0.93,
    xBody: D.xFront,
    xBelt: D.xFront,
    xRoof: 0.8,
  },
  { z: 1.5, roof: 0.64, crown: -0.11, belt: 0.45, xBody: 0.96, xBelt: 0.96, xRoof: 0.76 },
  { z: 1.75, roof: 0.5, crown: -0.07, belt: 0.36, xBody: 0.93, xBelt: 0.93, xRoof: 0.72 },
  // The low, blunt nose wedge.
  {
    z: 2.0,
    floor: 0.11,
    sill: 0.12,
    belt: 0.24,
    roof: 0.31,
    crown: 0,
    xSill: 0.8,
    xBody: D.xNose,
    xBelt: D.xNose,
    xRoof: 0.66,
  },
  {
    z: D.nose,
    floor: 0.13,
    sill: 0.14,
    belt: 0.2,
    roof: 0.26,
    crown: 0,
    xSill: 0.58,
    xBody: 0.62,
    xBelt: 0.62,
    xRoof: 0.46,
    bow: 0,
  },
];

export const LEMANS_SHELL: HullSpec = {
  wells: { ...wellsFor(S), radius: S.wheelRadius + 0.07, segments: 10 },
  colors: {
    body: LEMANS_COLORS.blue,
    trim: LEMANS_COLORS.trim,
    glass: LEMANS_COLORS.glass,
    stripe: LEMANS_COLORS.orange,
  },
  // The orange skirt is the hull's own band, from the sill to 16 cm under the belt (about 0.3 m up
  // along the flanks): faces of its own, no overlay. The bottom offset overshoots the sill on purpose.
  stripeBand: [0.6, 0.16],
  // Crisp: a flat flank, one facet from its top to the fender line, two across the top for the crown.
  rounding: { upper: 1, fullness: 0, top: 2 },
  stations: loft(shellKeys, { step: 0.22 }),
};

/** Canopy keys from the glass slices: its base, the roof, the half widths at each. */
const canopyKeys: LoftKey[] = [
  // The fastback fairing: the roof running back off the cabin and down into the engine cover,
  // narrowing, its tail under the deck so the two meet with no step.
  {
    z: -1.0,
    floor: 0.6,
    sill: 0.62,
    belt: 0.68,
    roof: 0.75,
    crown: 0.01,
    xSill: 0.36,
    xBody: 0.38,
    xBelt: 0.38,
    xRoof: 0.24,
  },
  { z: -0.65, belt: 0.64, roof: 0.77, crown: 0.02, xBody: 0.44, xBelt: 0.44, xRoof: 0.26 },
  { z: -0.35, belt: 0.63, roof: 0.84, crown: 0.02, xBody: 0.48, xBelt: 0.48, xRoof: 0.28 },
  {
    z: -0.1,
    floor: 0.58,
    sill: 0.59,
    belt: 0.62,
    roof: D.roof - 0.02,
    crown: 0.02,
    xSill: 0.5,
    xBody: D.canopyHalf,
    xBelt: D.canopyHalf,
    xRoof: 0.3,
  },
  { z: 0.3, roof: 0.92, crown: 0.02, xBody: 0.51, xBelt: 0.51, xRoof: 0.3 },
  // The windscreen raking down between the fenders to the bonnet's valley.
  { z: 0.7, belt: 0.6, roof: 0.84, crown: 0.02, xBody: 0.48, xBelt: 0.48, xRoof: 0.27 },
  { z: 1.0, belt: 0.58, roof: 0.74, crown: 0.01, xBody: 0.42, xBelt: 0.42, xRoof: 0.22 },
  // The screen's foot sunk a few centimetres into the bonnet, so the glass meets it with no
  // ledge and the bonnet's stripe runs straight up to it.
  {
    z: D.screenFoot[0] + 0.07,
    floor: 0.47,
    sill: 0.48,
    belt: 0.5,
    roof: 0.52,
    crown: 0,
    xSill: 0.16,
    xBody: 0.18,
    xBelt: 0.18,
    xRoof: 0.09,
  },
];

/** The windscreen from its foot to the roof's front edge; the door windows beside it and the roof. */
const SCREEN_FROM = 0.3;
// Glazed down the sides to the screen's foot, so the screen wraps round its corners with no
// body-coloured triangle either side.
const SIDE_GLASS: readonly [number, number] = [-0.05, 1.5];

function canopyFlags(z0: number, z1: number): Partial<HullStation> {
  const z = (z0 + z1) / 2;
  const side = z > SIDE_GLASS[0] && z < SIDE_GLASS[1];
  if (z > SCREEN_FROM) return { screen: true, glass: side, sideGlass: side };
  return side ? { glass: true } : {};
}

export const LEMANS_CANOPY: HullSpec = {
  colors: {
    body: LEMANS_COLORS.blue,
    trim: LEMANS_COLORS.trim,
    glass: LEMANS_COLORS.glass,
    screen: LEMANS_COLORS.screen,
  },
  rounding: { upper: 2, fullness: 0.7, top: 2 },
  stations: loft(canopyKeys, {
    step: 0.2,
    breaks: [SCREEN_FROM, ...SIDE_GLASS],
    flags: canopyFlags,
  }),
};

/* ------------------------------------------------------------------- livery */

type Outline = readonly (readonly [number, number])[];
const ALL_X: Outline = [
  [-1.3, -0.1],
  [1.3, -0.1],
  [1.3, 1.3],
  [-1.3, 1.3],
];
const ALL_TOP: Outline = [
  [-2.3, -1.3],
  [2.3, -1.3],
  [2.3, 1.3],
  [-2.3, 1.3],
];
/** A regular polygon round (u, v), for round solids. */
const round = (u: number, v: number, r: number, n = 14): Outline =>
  Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * k) / n;
    return [u + Math.cos(a) * r, v + Math.sin(a) * r] as const;
  });
const solid = (color: string, side: Outline, front: Outline, top: Outline, mirror = false) =>
  ({ color, side, front, top, mirror }) satisfies LiverySolid;

/** The plain white roundel on the bonnet ahead of the screen, and one on each door. */
const BONNET_ROUNDEL = solid(
  LEMANS_COLORS.white,
  [
    [1.3, 0.3],
    [1.9, 0.3],
    [1.9, 0.9],
    [1.3, 0.9],
  ],
  ALL_X,
  round(1.6, 0, 0.17),
);
const DOOR_ROUNDEL = solid(
  LEMANS_COLORS.white,
  round(0.05, 0.48, 0.15),
  [
    [0.8, -0.1],
    [1.2, -0.1],
    [1.2, 1.3],
    [0.8, 1.3],
  ],
  ALL_TOP,
  true,
);
/**
 * The headlamps, after the references: on each front fender's sloping face a dark oval recess,
 * taller than wide, and in it a big round main lamp high and outboard and a smaller one below it
 * and inboard. All three are solids seen from ahead (round in x, y), cut through the fender's
 * face only (z 1.2–2.0), so the recess's edge is one clean oval on every facet; the lamps lie a
 * layer over it (`layer`), so they never fight it.
 */
// From well back up the slope (the fender's top behind stands above the recess, so it isn't hit),
// so the oval's top is never cut off where the face curves back.
const FACE_Z: readonly [number, number] = [1.2, 2.0];
const onFace = (color: string, front: Outline, layer: number): LiverySolid => {
  const xs = front.map((p) => p[0]);
  const ys = front.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return {
    ...solid(
      color,
      [
        [FACE_Z[0], y0],
        [FACE_Z[1], y0],
        [FACE_Z[1], y1],
        [FACE_Z[0], y1],
      ],
      front,
      [
        [FACE_Z[0], x0],
        [FACE_Z[1], x0],
        [FACE_Z[1], x1],
        [FACE_Z[0], x1],
      ],
      true,
    ),
    layer,
  };
};
/** An ellipse round (u, v), as a polygon. */
const oval = (u: number, v: number, ru: number, rv: number, n = 20): Outline =>
  Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * k) / n;
    return [u + Math.cos(a) * ru, v + Math.sin(a) * rv] as const;
  });
/** The recess, clear of the nose's orange (0.36 m) below and the fender's crown above. */
const RECESS = { x: 0.74, y: 0.51, rx: 0.17, ry: 0.145 } as const;
const LENSES = [
  onFace(LEMANS_COLORS.trim, oval(RECESS.x, RECESS.y, RECESS.rx, RECESS.ry), 0),
  // The main lamp and its bright centre, the small lamp and its; each well inside the recess.
  onFace(LEMANS_COLORS.lens, oval(0.79, 0.545, 0.075, 0.075, 16), 1),
  onFace(LEMANS_COLORS.chrome, oval(0.79, 0.545, 0.03, 0.03, 10), 2),
  onFace(LEMANS_COLORS.lens, oval(0.665, 0.45, 0.05, 0.05, 14), 1),
  onFace(LEMANS_COLORS.chrome, oval(0.665, 0.45, 0.02, 0.02, 8), 2),
];
/** The nose's wide intake low in the orange, and a small one each side of it. */
const NOSE_INTAKE = solid(
  LEMANS_COLORS.trim,
  [
    [1.95, 0.14],
    [2.3, 0.14],
    [2.3, 0.22],
    [1.95, 0.22],
  ],
  [
    [-0.32, 0.14],
    [0.32, 0.14],
    [0.32, 0.22],
    [-0.32, 0.22],
  ],
  ALL_TOP,
);
const SIDE_INTAKE = solid(
  LEMANS_COLORS.trim,
  [
    [1.9, 0.15],
    [2.3, 0.15],
    [2.3, 0.21],
    [1.9, 0.21],
  ],
  [
    [0.4, 0.15],
    [0.58, 0.15],
    [0.58, 0.21],
    [0.4, 0.21],
  ],
  ALL_TOP,
  true,
);
/** Vents on the front fenders behind the wheels, and the intake ahead of each rear wheel. */
const FENDER_VENT = solid(
  LEMANS_COLORS.trim,
  [
    [0.82, 0.5],
    [0.95, 0.5],
    [0.95, 0.9],
    [0.82, 0.9],
  ],
  ALL_X,
  [
    [0.82, 0.62],
    [0.95, 0.62],
    [0.95, 0.86],
    [0.82, 0.86],
  ],
  true,
);
const REAR_INTAKE = solid(
  LEMANS_COLORS.trim,
  [
    [-0.75, 0.36],
    [-0.5, 0.36],
    [-0.55, 0.56],
    [-0.75, 0.56],
  ],
  [
    [0.9, -0.1],
    [1.3, -0.1],
    [1.3, 1.3],
    [0.9, 1.3],
  ],
  ALL_TOP,
  true,
);
/** The engine cover between the rear fenders: a dark grille behind the cockpit's fairing. */
const ENGINE_COVER = solid(
  LEMANS_COLORS.bay,
  [
    [-1.8, 0.7],
    [-1.02, 0.7],
    [-1.02, 1.0],
    [-1.8, 1.0],
  ],
  ALL_X,
  [
    [-1.8, -0.4],
    [-1.02, -0.4],
    [-1.02, 0.4],
    [-1.8, 0.4],
  ],
);
/** The cooling fan, a grey disc lying in the middle of the engine cover, a layer over it. */
const FAN: LiverySolid = {
  ...solid(
    LEMANS_COLORS.fan,
    [
      [-1.8, 0.6],
      [-1.02, 0.6],
      [-1.02, 1.0],
      [-1.8, 1.0],
    ],
    ALL_X,
    round(-1.41, 0, 0.2, 16),
  ),
  layer: 1,
};
const SIDE_U: ViewAxis = [2, -2.3, 2.3];
const SIDE_V: ViewAxis = [1, 0, 1.2];
const ACROSS: ViewAxis = [0, -1.3, 1.3];

/** The orange over the nose's lower half, up to 0.36 m ahead of the front wheels. */
const NOSE_SKIRT = poly(
  [
    [1.5, 0],
    [2.3, 0],
    [2.3, 0.36],
    [1.85, 0.36],
    [1.5, 0.3],
  ],
  LEMANS_COLORS.orange,
);
/** The orange centre stripe, nose to tail, 26 cm wide. */
const STRIPE_TOP = rect(-2.3, 2.3, -0.13, 0.13, LEMANS_COLORS.orange);

/**
 * The skirt and the stripe are the livery's base layer, view by view; the details are solids a
 * layer further out, so none of them fights the orange it overlaps. Solids paint in this order.
 */
export const LEMANS_LIVERY: LiveryShapes = {
  // Over the nose the skirt rises above the hull's band, to 0.36 m.
  left: { u: SIDE_U, v: SIDE_V, paint: [NOSE_SKIRT] },
  right: { u: SIDE_U, v: SIDE_V, paint: [NOSE_SKIRT] },
  top: { u: SIDE_U, v: ACROSS, paint: [STRIPE_TOP] },
  front: {
    u: ACROSS,
    v: SIDE_V,
    paint: [rect(-1.3, 1.3, 0, 0.36, LEMANS_COLORS.orange)],
  },
  solids: [
    ENGINE_COVER,
    FAN,
    BONNET_ROUNDEL,
    DOOR_ROUNDEL,
    ...LENSES,
    NOSE_INTAKE,
    SIDE_INTAKE,
    FENDER_VENT,
    REAR_INTAKE,
  ],
};

/** The canopy's roof carries the centre stripe on. */
export const LEMANS_CANOPY_LIVERY: LiveryShapes = {
  left: { u: SIDE_U, v: SIDE_V, paint: [] },
  right: { u: SIDE_U, v: SIDE_V, paint: [] },
  top: { u: SIDE_U, v: ACROSS, paint: [STRIPE_TOP] },
};
