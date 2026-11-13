import { BUILDING_SIZE, MAX_WIDEN, pickStyle } from '../BuildingCatalog';
import type { Building, BuildingStyle } from '../Town';
import { fitLot, type Infill } from '../TownInfill';
import { standsClear } from '../TownJoinedRows';
import { polylineFacade, type Facade, type Pt, type Site } from '../TownTerraces';
import type { FrontageChain } from './CityFrontage';

/**
 * Build along every metre of a city's frontage (`CityFrontage`) as lots that
 * never overlap. Each chain is cut into lots along its length, every cut
 * square to the frontage, so a lot is its own strip of ground and its
 * building meets its neighbours along a shared side:
 *
 * - each corner of a block is one lot reaching `CORNER_FACE` down both
 *   streets, built as one fitted building with a face (and a door) on each;
 * - each straight stretch between corners is shared out among catalog
 *   buildings, all widened or narrowed alike to fill it exactly, each with
 *   its door on the street;
 * - a lot no catalog building stands on gets a fitted building of its own.
 *
 * A corner lot reaches at least as far down each street as the deepest
 * catalog building, so the buildings of a block's two streets never reach
 * each other behind the corner.
 */

/** A corner lot's face down each street: at least the deepest catalog building (12 m). */
const CORNER_FACE = 13.5;
/** A fitted building is at most this deep; a corner's stays within its faces. */
const FITTED_DEPTH = 9;
/** Vertices turning more than `ZONE_MIN` within `ZONE_JOIN` of each other make one bend; more than `CORNER_TURN` in all, a corner. */
const ZONE_MIN = (6 * Math.PI) / 180;
const ZONE_JOIN = 4;
const CORNER_TURN = (25 * Math.PI) / 180;
/** A stretch shorter than this between two corners goes to them; the narrowest catalog front squeezed. */
const MIN_STRETCH = 2 * BUILDING_SIZE.townhouse.hx * 0.6;
/** Catalog fronts are drawn this much narrower at most (`MAX_WIDEN` wider). */
const MIN_SQUEEZE = 0.6;
/** A fitted lot longer than this is split into pieces of at most `PIECE`, cut square to the front. */
const SPLIT_OVER = 36;
const PIECE = 24;
/** Leftovers narrower than this are left: the fronts either side meet within a hair. */
const HAIR = 0.05;

type Lot = { s0: number; s1: number; fitted: boolean };

export function fillFrontage(site: Site, chains: readonly FrontageChain[]): Infill[] {
  const infills: Infill[] = [];
  for (const chain of chains) {
    const pts = prepare(chain);
    if (pts.length < 2) continue;
    const facade = polylineFacade(pts, 1);
    if (facade.length < HAIR) continue;
    for (const lot of lotsOf(facade)) {
      if (lot.s1 - lot.s0 < HAIR) continue;
      if (!lot.fitted && catalogRow(site, facade, lot.s0, lot.s1)) continue;
      const n = lot.s1 - lot.s0 > SPLIT_OVER ? Math.ceil((lot.s1 - lot.s0) / PIECE) : 1;
      for (let k = 0; k < n; k++) {
        const a = lot.s0 + ((lot.s1 - lot.s0) * k) / n;
        const b = lot.s0 + ((lot.s1 - lot.s0) * (k + 1)) / n;
        infills.push(fitLot(site, facade.trace(a, b), FITTED_DEPTH, infills));
      }
    }
  }
  return infills;
}

/**
 * The chain's lots in order: a corner lot round every bend of more than
 * `CORNER_TURN` (several close turns, as round a ring, make one), the
 * stretches between them for catalog rows, and a stretch too short for one
 * shared between the corners either side.
 */
function lotsOf(facade: Facade): Lot[] {
  const length = facade.length;
  const verts = facade.trace(0, length);
  const at: number[] = [0];
  for (let i = 1; i < verts.length; i++)
    at.push(at[i - 1]! + Math.hypot(verts[i]!.x - verts[i - 1]!.x, verts[i]!.z - verts[i - 1]!.z));
  // Bends: runs of turning vertices close together.
  const zones: { a: number; b: number; turn: number }[] = [];
  for (let i = 1; i < verts.length - 1; i++) {
    const t = turn(verts[i - 1]!, verts[i]!, verts[i + 1]!);
    if (Math.abs(t) < ZONE_MIN) continue;
    const last = zones[zones.length - 1];
    if (last && at[i]! - last.b <= ZONE_JOIN) {
      last.b = at[i]!;
      last.turn += Math.abs(t);
    } else zones.push({ a: at[i]!, b: at[i]!, turn: Math.abs(t) });
  }
  // Corner lots, merged where they meet or leave too little between them for a building.
  const corners: Lot[] = [];
  for (const z of zones) {
    if (z.turn < CORNER_TURN) continue;
    const lot = {
      s0: Math.max(0, z.a - CORNER_FACE),
      s1: Math.min(length, z.b + CORNER_FACE),
      fitted: true,
    };
    const last = corners[corners.length - 1];
    if (last && lot.s0 - last.s1 < MIN_STRETCH) {
      // Two corners close together share what lies between them, half each.
      const mid = (last.s1 + lot.s0) / 2;
      if (lot.s0 <= last.s1) last.s1 = Math.max(last.s1, lot.s1);
      else {
        last.s1 = mid;
        lot.s0 = mid;
        corners.push(lot);
      }
    } else corners.push(lot);
  }
  // The stretches between, each a catalog row, or shared out to its corners when too short.
  const lots: Lot[] = [];
  let edge = 0;
  for (const c of corners) {
    if (c.s0 - edge >= MIN_STRETCH) lots.push({ s0: edge, s1: c.s0, fitted: false });
    else if (lots.length > 0 && c.s0 > edge) {
      const prev = lots[lots.length - 1]!;
      const mid = (edge + c.s0) / 2;
      prev.s1 = mid;
      c.s0 = mid;
    } else c.s0 = edge;
    lots.push(c);
    edge = c.s1;
  }
  if (length - edge >= MIN_STRETCH || lots.length === 0)
    lots.push({ s0: edge, s1: length, fitted: length - edge < MIN_STRETCH });
  else lots[lots.length - 1]!.s1 = length;
  return lots;
}

/**
 * Catalog buildings along `[s0, s1]` of the facade, all widened or
 * narrowed alike so their fronts fill it end to end; each must stand clear,
 * or the whole stretch is left for a fitted building. True when it stood.
 */
function catalogRow(site: Site, facade: Facade, s0: number, s1: number): boolean {
  const room = s1 - s0;
  const styles: BuildingStyle[] = [];
  let used = 0;
  for (;;) {
    const style = pickStyle(site.rand, site.styles, room - used);
    if (!style) break;
    styles.push(style);
    used += 2 * BUILDING_SIZE[style].hx;
  }
  // What is left: one more squeezed in, or the row stretched over it.
  const nearest = nearestStyle(site, room - used);
  if (room - used >= 2 * BUILDING_SIZE[nearest].hx * MIN_SQUEEZE) {
    styles.push(nearest);
    used += 2 * BUILDING_SIZE[nearest].hx;
  }
  if (styles.length === 0) return false;
  const scale = room / used;
  if (scale < MIN_SQUEEZE || scale > MAX_WIDEN) return false;
  const variants = site.variants ?? 1;
  const planned: Building[] = [];
  let s = s0;
  for (const style of styles) {
    const { hx, hz } = BUILDING_SIZE[style];
    const h = facade.house(s, hx * scale, hz);
    if (!h) return false;
    const b: Building = {
      style,
      x: h.x,
      z: h.z,
      yaw: h.yaw,
      hx: hx * scale,
      hz,
      variant: Math.floor(site.rand() * variants),
    };
    if (!standsClear(site, b)) return false;
    planned.push(b);
    s = h.end;
  }
  // A bend shortens the chords: the last front must reach the stretch's end within a hair.
  if (Math.abs(s - s1) > 0.5) return false;
  site.buildings.push(...planned);
  return true;
}

/** The style whose catalog front is nearest `room` among the site's mix. */
function nearestStyle(site: Site, room: number): BuildingStyle {
  const styles = (site.styles ?? []).map(([s]) => s);
  return styles.reduce((best, s) =>
    Math.abs(2 * BUILDING_SIZE[s].hx - room) < Math.abs(2 * BUILDING_SIZE[best].hx - room)
      ? s
      : best,
  );
}

/** The chain's points without repeats; a loop opened at the middle of its longest piece, so no corner straddles its ends. */
function prepare(chain: FrontageChain): Pt[] {
  const pts: Pt[] = [];
  for (const p of chain.pts) {
    const q = pts[pts.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.z - q.z) > 1e-3) pts.push(p);
  }
  if (!chain.closed || pts.length < 3) return pts;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (Math.hypot(first.x - last.x, first.z - last.z) < 1e-3) pts.pop();
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  const p = pts[best]!;
  const q = pts[(best + 1) % pts.length]!;
  const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
  return [mid, ...pts.slice(best + 1), ...pts.slice(0, best + 1), mid];
}

/** How far the chain turns at `q` (left +), between the pieces `p`→`q` and `q`→`r`. */
function turn(p: Pt, q: Pt, r: Pt): number {
  const d = Math.atan2(r.x - q.x, r.z - q.z) - Math.atan2(q.x - p.x, q.z - p.z);
  return Math.atan2(Math.sin(d), Math.cos(d));
}
