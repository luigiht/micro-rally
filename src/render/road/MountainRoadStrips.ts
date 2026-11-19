import type { Color } from 'three';
import type { RoadPath } from '@/game/stage/RoadPath';
import type { Strip } from './RoadBuilder';
import { alongNoise, cellTone, dustBand, MAX_BANDS, wornDip, wornTone } from './SurfaceDetail';

/**
 * The Greenvale's mountain road, as ribbon strips (`RoadBuilder`): the
 * carriageway cut into wandering lane bands of worn, uneven tarmac
 * (`SurfaceDetail.wornTone`, `wornDip`), and a raised edge that crumbles into
 * the gravel shoulder rather than stopping at a line. Past the carriageway
 * the asphalt's broken edge falls to the shoulder (the drop is the terrain's
 * `embankment`, so wheels feel it too), half asphalt and half grit, its outer
 * line wandering in and out every few metres; then a band of grit spilt
 * onto the gravel, wandering too; then the shoulder, every piece mottled
 * like loose gravel.
 */

/** The broken edge: this much of the way from the road's colour to the gravel's, and this much darker. */
const EDGE_MIX = 0.35;
const EDGE_SHADE = 0.8;
/** The spilt grit: this much of the way from the road's colour to the gravel's. */
const GRIT_MIX = 0.65;
/** The broken edge runs from 55 % to 145 % of the lip's width, the grit band 0.3–1.1 m past it. */
const EDGE_SPAN = [0.55, 1.45] as const;
const GRIT_SPAN = [0.3, 1.1] as const;
/** Over this many road samples the two wander. */
const EDGE_PERIOD = 2.6;
const GRIT_PERIOD = 4.1;
/** Pieces stray this much lighter or darker: the edge and grit, and the gravel. */
const EDGE_JITTER = 0.08;
const GRAVEL_JITTER = 0.09;

/** The road's signed curvature (1/m) at sample `k`, from the headings either side. */
function bendAt(path: RoadPath, k: number): number {
  const i0 = Math.max(0, k - 1);
  const i1 = Math.min(path.count - 1, k + 1);
  const dh = path.headings[i1]! - path.headings[i0]!;
  return Math.atan2(Math.sin(dh), Math.cos(dh)) / Math.max(path.spacing, (i1 - i0) * path.spacing);
}

/** Replace the carriageway strip with worn lane bands. */
export function wornCarriageway(strips: Strip[], carriageway: Strip, path: RoadPath): void {
  const at = strips.indexOf(carriageway);
  if (at < 0) return;
  strips.splice(
    at,
    1,
    ...Array.from({ length: MAX_BANDS }, (_, i): Strip => ({
      ...carriageway,
      // Each band its own share of any cover (mud tracked onto the tarmac lies in patches across the road).
      ...(carriageway.cover
        ? { cover: (k: number, hw: number) => carriageway.cover!(k, hw, i) }
        : {}),
      a: (hw, k) => dustBand(hw, i, k)?.a ?? hw,
      b: (hw, k) => dustBand(hw, i, k)?.b ?? hw,
      detail: (hw, k) => wornTone(hw, i, k, bendAt(path, k)),
      dip: (hw, k) => wornDip(hw, i, k),
    })),
  );
}

const between = ([lo, hi]: readonly [number, number], t: number) => lo + (hi - lo) * t;

/**
 * Split each verge strip (`side` set, `verge` coloured) into the asphalt's
 * broken edge, about `lip` metres past the carriageway, the spilt grit beyond
 * it and the gravel shoulder.
 */
export function raisedEdge(strips: Strip[], verge: Color, road: Color, lip: number): void {
  const edgeColour = road.clone().lerp(verge, EDGE_MIX).multiplyScalar(EDGE_SHADE);
  const gritColour = road.clone().lerp(verge, GRIT_MIX);
  for (const side of [1, -1] as const) {
    const at = strips.findIndex(
      (s) => s.side === side && s.color === verge && s.rise === undefined,
    );
    if (at < 0) continue;
    const strip = strips[at]!;
    const salt = side === 1 ? 0 : 50;
    // How far past the carriageway's edge the broken edge and the grit reach at sample `k`.
    const edge = (k: number) => lip * between(EDGE_SPAN, alongNoise(k, EDGE_PERIOD, 461 + salt));
    const grit = (k: number) =>
      edge(k) + between(GRIT_SPAN, alongNoise(k, GRIT_PERIOD, 467 + salt));
    const mottle = (salt2: number, jitter: number) => (_hw: number, k: number) =>
      cellTone(k, side, salt2 + salt, jitter);
    // Out from +hw on the left verge, in to −hw on the right one.
    const out = (reach: (k: number) => number) =>
      side === 1
        ? (hw: number, k: number) => hw + reach(k)
        : (hw: number, k: number) => -hw - reach(k);
    const at0 = side === 1 ? (hw: number) => hw : (hw: number) => -hw;
    const span = (from: Strip['a'], to: Strip['a']) =>
      side === 1 ? { a: from, b: to } : { a: to, b: from };
    strips.splice(
      at,
      1,
      {
        ...strip,
        ...span(at0, out(edge)),
        color: edgeColour,
        shaded: false,
        detail: mottle(433, EDGE_JITTER),
      },
      {
        ...strip,
        ...span(out(edge), out(grit)),
        color: gritColour,
        detail: mottle(439, EDGE_JITTER),
      },
      {
        ...strip,
        ...span(out(grit), side === 1 ? strip.b : strip.a),
        detail: mottle(443, GRAVEL_JITTER),
      },
    );
  }
}
