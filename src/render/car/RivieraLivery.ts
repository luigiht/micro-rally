import type { LiveryShapes, LiveryView, ViewAxis } from './HullLivery';
import { WRC_STATIONS } from './HullShapes';
import { curve, mergePaint, smoothstep, strips, type Layer } from './LiveryStrips';

/**
 * The Riviera WRC's livery, our own interpretation of the late-80s works
 * livery in `context/lancia-delta-integrale` (photos and renders, used as
 * references only; no names, logos or marks), drawn as shapes for
 * `HullLivery.paintLivery`:
 *
 * - **Flanks:** a broad red band up to the bonnet's edge and the windows'
 *   foot, easing down behind the rear door to the tail, over
 *   navy, sky-blue and navy pinstripes laid straight and level along the
 *   whole car, low but clear of the arches' lips.
 * - **Rear quarters:** a red field over the set from the rear door back,
 *   its leading edge climbing diagonally, crossed on the C-pillar by navy,
 *   sky-blue and navy diagonal bands rising toward the roof's rear corner;
 *   white behind them.
 * - **Bonnet:** a set along each edge, from the scuttle to the nose, red
 *   outermost.
 * - **Tail:** the flanks' bands carried straight across the tail panel at
 *   the heights they meet the tail, so the two sides join behind.
 *
 * Shapes are laid in narrow strips along the car, each strip cut across
 * into the colours at its ends, so curves are smooth, diagonals exact and
 * no two colours overlap.
 */

const RED = '#d6241e';
const NAVY = '#1f2a6e';
const SKY = '#5aa0dc';

/** The flank set's top edge (the red's) along the car. */
const SET_TOP = curve([
  [-1.97, 0.975],
  [-1.6, 0.96],
  [-1.3, 0.955],
  [-0.95, 0.975],
  [-0.6, 1.015],
  [-0.3, 1.025],
  [0.3, 1.02],
  [0.62, 1.0],
  [1.0, 0.965],
  [1.3, 0.955],
  [1.65, 0.925],
  [2.0, 0.865],
]);
/** The hull's belt line at `z` (linear between its stations, as the hull lofts it). */
const STATIONS = [...WRC_STATIONS].sort((a, b) => a.z - b.z);
function belt(z: number): number {
  let i = 0;
  while (i + 2 < STATIONS.length && STATIONS[i + 1]!.z < z) i++;
  const a = STATIONS[i]!;
  const b = STATIONS[i + 1]!;
  const t = Math.min(1, Math.max(0, (z - a.z) / (b.z - a.z)));
  return a.belt + (b.belt - a.belt) * t;
}
/**
 * From the rear door forward the red runs on up to the belt (the windows' foot, then the bonnet's
 * edge) and a little past, so no white shows under the glass and it meets the bonnet's own red
 * as one band; behind, under the rear field and on to the tail, the set's top is its own.
 */
const redTop = (z: number) =>
  SET_TOP(z) + Math.max(0, belt(z) + 0.02 - SET_TOP(z)) * smoothstep(-1.2, -1.0, z);
/** The pinstripes under the red, top to bottom, level along the car from this height; their foot stays over the lips (0.78). */
const STRIPES_TOP = 0.875;
const STRIPES: readonly (readonly [string, number])[] = [
  [NAVY, 0.035],
  [SKY, 0.03],
  [NAVY, 0.025],
];

/** The set: red from `top` down to the pinstripes, then the pinstripes, level. */
function setLayers(top: (z: number) => number): Layer[] {
  const layers: Layer[] = [{ color: RED, top, bottom: () => STRIPES_TOP }];
  let y = STRIPES_TOP;
  for (const [color, h] of STRIPES) {
    const y0 = y;
    layers.push({ color, top: () => y0, bottom: () => y0 - h });
    y -= h;
  }
  return layers;
}

/** The rear field's leading edge leaves the set here and climbs this steeply toward the rear. */
const FIELD_FROM = -0.42;
const FIELD_CLIMB = 1.7;
/** The field's top: the C-pillar's, at the roof's rear corner. */
const FIELD_TOP = 1.5;
/**
 * The C-pillar's diagonal bands, falling toward the tail: from the pillar's top by the roof down
 * to the tail lamps. Their edges cross y 1.0 at these z (front to back) and fall this much per
 * metre toward the rear; ahead of the first is the red field, then navy, sky blue and navy, then
 * white behind the last.
 */
const DIAG_FALL = 1.15;
const DIAGONALS = [-1.55, -1.63, -1.7, -1.76] as const;

/** The set's bands, then the rear field and the C-pillar's diagonals cut across it column by column. */
function flank(): LiveryView['paint'] {
  const set = setLayers(redTop);
  // Over the set: its top, the diagonals' edges, the field's top (the leading edge, then the
  // pillar's top), each held between the set and the field's top. At any z the edge crossing
  // further forward is lower, so the edges come bottom to top in the order listed.
  const fieldTop = (z: number) =>
    Math.min(FIELD_TOP, SET_TOP(z) + Math.max(0, FIELD_FROM - z) * FIELD_CLIMB);
  const cuts = (z: number) => {
    const lo = SET_TOP(z);
    const hi = Math.max(lo, fieldTop(z));
    return [
      lo,
      ...DIAGONALS.map((zc) => Math.min(hi, Math.max(lo, 1.0 + (z - zc) * DIAG_FALL))),
      hi,
    ];
  };
  const above: Layer[] = [];
  const order = [RED, NAVY, SKY, NAVY, ''];
  for (let i = 0; i < order.length; i++) {
    if (!order[i]) continue;
    above.push({ color: order[i]!, bottom: (z) => cuts(z)[i]!, top: (z) => cuts(z)[i + 1]! });
  }
  const base = strips(-1.97, 2.0, set);
  const field = strips(-1.97, FIELD_FROM, above);
  return mergePaint(base, field);
}

/** Along each bonnet edge from the scuttle to the nose, outermost first: red, navy, sky blue, navy. */
function bonnet(): LiveryView['paint'] {
  const bands: readonly (readonly [string, number, number])[] = [
    // Out past the bonnet's edge (0.95 over the flares), to meet the flank's red.
    [RED, 0.8, 1.0],
    [NAVY, 0.76, 0.8],
    [SKY, 0.725, 0.76],
    [NAVY, 0.7, 0.725],
  ];
  const layers: Layer[] = bands.flatMap(([color, a, b]) => [
    { color, bottom: () => a, top: () => b },
    { color, bottom: () => -b, top: () => -a },
  ]);
  return strips(0.66, 2.0, layers);
}

/** The flanks' set straight across the tail panel, at the height it reaches the tail. */
function tail(): LiveryView['paint'] {
  const top = SET_TOP(-1.97);
  // The view's `u` is across the car; past the panel's corners the flanks take over.
  return strips(
    -1.0,
    1.0,
    setLayers(() => top),
  );
}

const SIDE_U: ViewAxis = [2, -2.15, 2.15];
const SIDE_V: ViewAxis = [1, 0.2, 1.6];
const FLANK = flank();

export const RIVIERA_LIVERY: LiveryShapes = {
  left: { u: SIDE_U, v: SIDE_V, paint: FLANK },
  right: { u: SIDE_U, v: SIDE_V, paint: FLANK },
  top: { u: [2, -2.15, 2.15], v: [0, -1, 1], paint: bonnet() },
  back: { u: [0, -1, 1], v: [1, 0.2, 1.6], paint: tail() },
};
