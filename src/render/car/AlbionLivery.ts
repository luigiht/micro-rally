import type { LiverySolid, LiveryShapes, LiveryView, ViewAxis } from './HullLivery';
import { mergePaint } from './LiveryStrips';

/**
 * The Albion RS Hatch's livery: our own works livery after the mid-2000s
 * rally hatch in `context/ford-focus-rework` (the procedural livery drawn
 * there by `build2.mjs`, and photos, used as references only; no names,
 * logos or marks), drawn as shapes for `HullLivery.paintLivery`:
 *
 * - **Flanks:** a lime nose and front wings, ending in a sweep that leans
 *   back as it climbs, edged in royal blue then sky blue; a royal-blue tail
 *   and rear quarters, edged in sky blue, its sweep leaning forward as it
 *   climbs. Between them the doors: white over green, a white pinstripe
 *   along the sill.
 * - **Bonnet:** lime ahead of a curved edge (further back toward the wings),
 *   a sky-blue line along it, white behind to the scuttle.
 * - **Roof** navy and **tail** royal blue, a lime flash edged in sky blue
 *   on one corner of the tail.
 * - **Headlamps:** a swept white lens wrapping each top corner of the nose
 *   (`HEADLAMP`), a projector in each (`FocusHatchBody`).
 * - **Details:** a door handle and an amber side repeater each side over the paint; the
 *   panel gaps are the body's own grooves (`AlbionShape`).
 *
 * All coordinates are the hull's (`FocusHatchBody`): z forward, y up, x to
 * the car's left. Shapes are laid in narrow rows, each row's boundaries
 * taken at its two edges, so every slanted edge is exact.
 */

export const LIME = '#bcd52a';
export const GREEN = '#13963f';
export const BLUE = '#1b3d9c';
export const NAVY = '#101e55';
export const SKY = '#2f9be0';
export const WHITE = '#f3f4f1';
const AMBER = '#f2901c';
const GAP = '#20232b';
const TAIL_LAMP = '#d8231b';
const TAIL_DEEP = '#8e1210';
const GRILLE = '#1b1b1f';

type Paint = LiveryView['paint'];
/** Colour regions across a row at height `v`: [colour, from, to], from < to, in order along `u`. */
type Regions = (v: number) => readonly (readonly [string, number, number])[];

/** Rows `dv` high from `v0` to `v1`; each region a quad between its bounds at the row's two edges. */
function rows(v0: number, v1: number, dv: number, regions: Regions): Paint {
  const out = new Map<string, number[]>();
  const n = Math.max(1, Math.ceil((v1 - v0) / dv));
  for (let k = 0; k < n; k++) {
    const a = v0 + ((v1 - v0) * k) / n;
    const b = v0 + ((v1 - v0) * (k + 1)) / n;
    // Each edge read a hair inside the row, so a row starting where the regions change (the wings'
    // edge) takes its own side's regions at both edges.
    const ra = regions(a + 1e-7);
    const rb = regions(b - 1e-7);
    for (let i = 0; i < ra.length; i++) {
      const [color, fa, ta] = ra[i]!;
      const [, fb, tb] = rb[i]!;
      if (ta - fa < 1e-4 && tb - fb < 1e-4) continue;
      const tris = out.get(color) ?? [];
      tris.push(fa, a, Math.max(fa, ta), a, Math.max(fb, tb), b);
      tris.push(fa, a, Math.max(fb, tb), b, fb, b);
      out.set(color, tris);
    }
  }
  return [...out].map(([color, tris]) => ({ color, tris }));
}

/** An axis-aligned rectangle of `color` in a view. */
function rect(color: string, u0: number, u1: number, v0: number, v1: number): Paint[number] {
  return { color, tris: [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1] };
}

/** How far up the flank's sweeps run, 0 at the sill and 1 at the window line. */
const t = (y: number) => (y - 0.12) / 0.86;
/** The front sweep's trailing edge (sky blue starts there) along the car at height `y`. */
const frontSweep = (y: number) => 0.6 + 0.2 * t(y) + 0.07 * Math.sin(Math.PI * t(y));
/** The rear sweep's leading edge (the royal blue's sky-blue edge ends there). */
const rearSweep = (y: number) => -0.66 - 0.62 * t(y) - 0.06 * Math.sin(Math.PI * t(y));
/** The doors' green runs up to here, white above. */
const GREEN_TOP = 0.71;
/** The white pinstripe along the sill. */
const PIN: readonly [number, number] = [0.235, 0.252];
const NOSE = 2.4;
const TAIL = -2.4;

/**
 * The bonnet's blue band: across the bonnet's whole back, out to the wings' blue (the flank's
 * front sweep, ending at `BONNET_JOIN` on the wing tops) so they join as one; then from this
 * half-width at that point narrowing to `BONNET_NOSE` where it ends.
 */
const BONNET_JOIN = 0.97;
const BONNET_BACK: readonly [number, number] = [BONNET_JOIN, 0.52];
const BONNET_NOSE: readonly [number, number] = [1.95, 0.24];
/** The white beside the blue band is this wide. */
const BONNET_WHITE = 0.1;
/** Along the bonnet, how far back the blue band reaches at half-width `a` (it narrows forward). */
function bonnetBlue(a: number): number {
  const [z0, w0] = BONNET_BACK;
  const [z1, w1] = BONNET_NOSE;
  if (a >= w0) return z0;
  if (a <= w1) return z1;
  return z0 + ((w0 - a) / (w0 - w1)) * (z1 - z0);
}

/** The roof's navy stripe runs down its middle, this far either side of the centre line. */
const ROOF_STRIPE = 0.4;

/** The navy roof starts here: behind it, over the C-pillars and the hatch, everything is blue. */
const ROOF_FROM = -1.32;

/**
 * The B-pillar and the quarter window behind it, one near-black shape painted in the livery's
 * own layer (not over it), so no white lies under its edges to show past them at an angle: from
 * the door glass's trailing edge back over the pillar, the window's foot along the belt, ending in
 * a point toward the tail, its top on the roof's edge, never over the roof.
 */
const QUARTER_GLASS = '#1d1d22';
/** The door glass ends here: the pillar's black starts at it. */
const PILLAR_FRONT = -0.76;
/** The window's top corner over the C-pillar's foot, and its point along the belt. */
const QUARTER_BACK = -1.32;
const QUARTER_TIP = -1.75;
/** The belt under the window: 1.01 m at the B-pillar's foot rising to 1.03 at the point. */
const BELT: readonly [number, number] = [1.01, 1.03];
/** The roof's edge over the window (with the boxier roof, about 1.40–1.42 m up, 0.647 m out). */
const ROOF_EDGE_Y = 1.4;
const ROOF_EDGE_X = 0.645;
/** From above, the point's outer edge: past it the window ends at its tip. */
const QUARTER_OUT = 0.86;

/** Where the black starts, along the car, at height `y` on the flank (null: none at this height). */
function quarterRearSide(y: number): number | null {
  const [b0, b1] = BELT;
  if (y < b0) return null;
  // The belt rises toward the tail under the window: the black starts further back as it climbs.
  if (y < b1) return -0.86 + ((y - b0) / (b1 - b0)) * (QUARTER_TIP + 0.86);
  if (y < ROOF_EDGE_Y)
    return QUARTER_TIP + ((y - b1) / (ROOF_EDGE_Y - b1)) * (QUARTER_BACK - QUARTER_TIP);
  return QUARTER_BACK;
}

/** Where the black starts, along the car, at half-width `a` from above (null: none so far in). */
function quarterRearTop(a: number): number | null {
  if (a < ROOF_EDGE_X) return null;
  if (a >= QUARTER_OUT) return QUARTER_TIP;
  return (
    QUARTER_BACK + ((a - ROOF_EDGE_X) / (QUARTER_OUT - ROOF_EDGE_X)) * (QUARTER_TIP - QUARTER_BACK)
  );
}

/**
 * `regions` with the black laid over [from, PILLAR_FRONT]: every region clipped either side of it.
 * Always the same number of regions (some empty), so a row's two edges match up.
 */
function carveQuarter(
  regions: readonly (readonly [string, number, number])[],
  from: number | null,
): (readonly [string, number, number])[] {
  const [a, b] = from === null ? [PILLAR_FRONT, PILLAR_FRONT] : [from, PILLAR_FRONT];
  const out: (readonly [string, number, number])[] = [];
  for (const [color, f, t] of regions) {
    out.push([color, f, Math.max(f, Math.min(t, a))]);
    out.push([color, Math.min(t, Math.max(f, b)), t]);
  }
  out.push([QUARTER_GLASS, a, b]);
  return out;
}

/** The flank at height `y`, tail to nose. */
const flankRegions: Regions = (y) => {
  const f = frontSweep(y);
  const r = rearSweep(y);
  const middle = y >= GREEN_TOP || (y >= PIN[0] && y < PIN[1]) ? WHITE : GREEN;
  return [
    [BLUE, TAIL, r - 0.05],
    [SKY, r - 0.05, r],
    [middle, r, f],
    [SKY, f, f + 0.045],
    [BLUE, f + 0.045, f + 0.17],
    [LIME, f + 0.17, NOSE],
  ];
};

/** Rows cut at the green's top and the pinstripe's edges, so no row straddles a change of colour. */
function flank(): Paint {
  const bands: [number, number][] = [
    [0.1, PIN[0]],
    [PIN[0], PIN[1]],
    [PIN[1], GREEN_TOP],
    [GREEN_TOP, BELT[0]],
    [BELT[0], BELT[1]],
    [BELT[1], 1.2],
  ];
  // Above the windows the roof's edge, rolling round from the top: navy over the cabin, blue
  // over the hatch, as the top view paints it, so no white line shows along it.
  const roofEdge: Regions = () => [
    [BLUE, TAIL, ROOF_FROM],
    [WHITE, ROOF_FROM, NOSE],
  ];
  const withQuarter =
    (regions: Regions): Regions =>
    (y) =>
      carveQuarter(regions(y), quarterRearSide(y));
  return mergePaint(
    ...bands.map(([a, b]) => rows(a, b, 0.01, withQuarter(flankRegions))),
    rows(1.2, ROOF_EDGE_Y, 0.04, withQuarter(roofEdge)),
    rows(ROOF_EDGE_Y, 1.6, 0.1, withQuarter(roofEdge)),
  );
}

/** The top: royal-blue tail deck, navy roof, white bonnet to its lime edge, the wing tops in the flank's colours at the belt. */
const topRegions: Regions = (x) => {
  const a = Math.abs(x);
  if (a > 0.7) {
    // Along the wing tops and the belt: the flank's colours where it meets them.
    const y = 0.9;
    const f = frontSweep(y);
    const r = rearSweep(1.0);
    return [
      [BLUE, TAIL, r - 0.05],
      [SKY, r - 0.05, r],
      [WHITE, r, f],
      [SKY, f, f + 0.045],
      [BLUE, f + 0.045, f + 0.17],
      [LIME, f + 0.17, NOSE],
    ];
  }
  return [
    [BLUE, TAIL, ROOF_FROM],
    // The roof: a navy stripe down its middle, white either side of it out to its edges.
    [a < ROOF_STRIPE ? BLUE : WHITE, ROOF_FROM, 0.04],
    // The sun strip over the windscreen: the roof's stripe carried on down it to the glass, white
    // either side, a blue line along its foot.
    [a < ROOF_STRIPE ? BLUE : WHITE, 0.04, 0.14],
    [BLUE, 0.14, 0.74],
    // The scuttle under the windscreen's foot.
    [GRILLE, 0.74, 0.84],
    // The bonnet: a blue band down its middle, wide at the scuttle and narrowing toward the
    // nose, white either side of it, lime beyond and across the nose.
    [BLUE, 0.84, bonnetBlue(a)],
    [WHITE, bonnetBlue(a), bonnetBlue(a - BONNET_WHITE)],
    [LIME, bonnetBlue(a - BONNET_WHITE), NOSE],
  ];
};

/** Row by row out from the middle each way, so no row spans the |x| kink at 0 or the wings' edge. */
function top(): Paint {
  // Cut at the roof stripe's edge, the roof's edge, the wings' edge and the quarter window's
  // point too, so no row straddles any of them.
  const cuts: [number, number, number][] = [
    [0, ROOF_STRIPE, 0.03],
    [ROOF_STRIPE, ROOF_EDGE_X, 0.03],
    [ROOF_EDGE_X, 0.7, 0.01],
    [0.7, QUARTER_OUT, 0.02],
    [QUARTER_OUT, 1.05, 0.05],
  ];
  const half = (s: 1 | -1) =>
    mergePaint(
      ...cuts.map(([a, b, dv]) =>
        rows(a, b, dv, (v) => carveQuarter(topRegions(s * v), quarterRearTop(v))).map((p) => ({
          ...p,
          tris: flipV(p.tris, s),
        })),
      ),
    );
  return mergePaint(half(1), half(-1));
}

/** Mirror a row soup's `v` (every second value) when it was laid out on the negative side. */
function flipV(tris: readonly number[], s: 1 | -1): number[] {
  return tris.map((n, i) => (i % 2 === 1 ? n * s : n));
}

/** Nose: lime all over (the grille, plate and lamps are the hull's own decals). */
function front(): Paint {
  return [rect(LIME, -1.1, 1.1, 0.1, 1.2)];
}

/** Tail: royal blue, a lime flash edged in sky blue rising toward one corner. */
function back(): Paint {
  return rows(0.6, 0.95, 0.05, (y) => {
    const edge = 0.3 + (y - 0.6) * 0.25;
    return [
      [BLUE, -1.1, edge - 0.05],
      [SKY, edge - 0.05, edge],
      [LIME, edge, 1.1],
    ];
  }).concat([rect(BLUE, -1.1, 1.1, 0.1, 0.6), rect(BLUE, -1.1, 1.1, 0.95, 1.2)]);
}

/** Details over the flank: door handles and the amber side repeater (the panel gaps are the hull's own grooves). */
function flankDetails(): Paint {
  return mergePaint(
    // The door's one handle, near its trailing edge.
    [rect(GAP, -0.7, -0.58, 0.875, 0.9)],
    [rect(AMBER, 1.0, 1.1, 0.74, 0.775)],
  );
}

/** Nose details, across the car (x) and up: lower grille, the navy number panel, fog lamps (the headlamps are the body's own). */
function noseDetails(): Paint {
  const both = (x0: number, x1: number, y0: number, y1: number, color: string) => [
    rect(color, x0, x1, y0, y1),
    rect(color, -x1, -x0, y0, y1),
  ];
  return mergePaint(
    [rect(GRILLE, -0.56, 0.56, 0.16, 0.37)],
    [rect(NAVY, -0.3, 0.3, 0.39, 0.57)],
    both(0.36, 0.44, 0.43, 0.51, GRILLE),
    both(0.49, 0.57, 0.43, 0.51, GRILLE),
  );
}

/** Tail details, across the car and up: the dark diffuser (the lamps are `TAIL_LAMP_PARTS`). */
function tailDetails(): Paint {
  return [rect(GRILLE, -0.95, 0.95, 0.1, 0.3)];
}

/**
 * The headlamps (after `build2.mjs`'s): a long swept lens at each top corner of the nose, under
 * the bonnet's edge, narrow beside the grille and widening as it wraps round the corner and back
 * along the wing toward the front wheel. A region in three views, so the one shape runs across
 * the nose's, the corner's and the wing's faces.
 */
export const HEADLAMP: LiverySolid = {
  color: '#f4f7fa',
  mirror: true,
  // Side (z, y): rising toward the nose, its foot falling toward it.
  side: [
    [1.88, 0.67],
    [2.26, 0.595],
    [2.26, 0.785],
    [1.88, 0.745],
  ],
  // Front (x, y): tapering to a point by the grille, deepest at the corner.
  front: [
    [0.4, 0.66],
    [0.95, 0.6],
    [0.95, 0.785],
    [0.4, 0.705],
  ],
  // Top (z, x): its inner edge sweeping out toward the back.
  top: [
    [1.88, 0.66],
    [2.26, 0.4],
    [2.26, 0.95],
    [1.88, 0.95],
  ],
};

/**
 * The tail lamps (after the references, a mark of the type): high in each rear pillar beside the
 * hatch glass, a tall lamp running from the tail's corner up the pillar along the glass's edge
 * nearly to the roof, wrapping from the tail onto the flank and over onto the pillar's top.
 */
/** The lamp's side outline (z, y): from the tail's corner, climbing forward up the pillar beside the glass nearly to the roof's corner. */
const TAIL_SIDE: readonly (readonly [number, number])[] = [
  [-2.17, 0.88],
  [-2.08, 0.9],
  [-1.56, 1.28],
  [-1.56, 1.34],
  [-2.13, 1.0],
];

/** The part of a convex (z, y) outline between heights `lo` and `hi` (still convex). */
function band(
  outline: readonly (readonly [number, number])[],
  lo: number,
  hi: number,
): [number, number][] {
  let pts = outline.map(([z, y]): [number, number] => [z, y]);
  for (const [limit, keep] of [
    [lo, (y: number) => y >= lo],
    [hi, (y: number) => y <= hi],
  ] as const) {
    const out: [number, number][] = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k]!;
      const b = pts[(k + 1) % pts.length]!;
      if (keep(a[1])) out.push(a);
      if (keep(a[1]) !== keep(b[1])) {
        const t = (limit - a[1]) / (b[1] - a[1]);
        out.push([a[0] + (b[0] - a[0]) * t, limit]);
      }
    }
    pts = out;
  }
  return pts;
}

/**
 * The tail lamps (after the references, a mark of the type): high in each rear pillar beside the
 * hatch glass, a tall lamp from the tail's corner up the pillar along the glass's edge nearly to
 * the roof's corner, wrapping from the tail onto the flank and over the pillar's top. In three
 * bands, as the type's: amber at its foot, bright red through the middle, a deeper red at the top.
 */
const tailPart = (color: string, lo: number, hi: number): LiverySolid => ({
  color,
  mirror: true,
  side: band(TAIL_SIDE, lo, hi),
  // Back (x, y): from the glass's edge out to the corner.
  // Its inner edges reach in under the glass: the glass is left as it is, so the lamp starts right
  // at the glass's edge and follows it up the pillar.
  front: [
    [0.6, 0.88],
    [0.98, 0.88],
    [0.98, 1.36],
    [0.5, 1.36],
  ],
  // Top (z, x): from under the glass's edge out over the pillar.
  top: [
    [-2.2, 0.5],
    [-1.56, 0.5],
    [-1.56, 0.98],
    [-2.2, 0.98],
  ],
});

export const TAIL_LAMP_PARTS: readonly LiverySolid[] = [
  tailPart(AMBER, 0, 1.0),
  tailPart(TAIL_LAMP, 1.0, 1.17),
  tailPart(TAIL_DEEP, 1.17, 2),
];

const SIDE_U: ViewAxis = [2, -2.4, 2.4];
const SIDE_V: ViewAxis = [1, 0, 1.6];
const ACROSS: ViewAxis = [0, -1.1, 1.1];
const FLANK = flank();

export const ALBION_LIVERY: LiveryShapes = {
  left: { u: SIDE_U, v: SIDE_V, paint: FLANK },
  right: { u: SIDE_U, v: SIDE_V, paint: FLANK },
  top: { u: SIDE_U, v: ACROSS, paint: top() },
  front: { u: ACROSS, v: SIDE_V, paint: front() },
  back: { u: ACROSS, v: SIDE_V, paint: back() },
  over: {
    left: { u: SIDE_U, v: SIDE_V, paint: flankDetails() },
    right: { u: SIDE_U, v: SIDE_V, paint: flankDetails() },
    top: { u: SIDE_U, v: ACROSS, paint: [] },
    front: { u: ACROSS, v: SIDE_V, paint: noseDetails() },
    back: { u: ACROSS, v: SIDE_V, paint: tailDetails() },
  },
  solids: [HEADLAMP, ...TAIL_LAMP_PARTS],
};
