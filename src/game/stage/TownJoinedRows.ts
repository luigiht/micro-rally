import { BUILDING_SIZE, MAX_WIDEN, pickStyle, VILLAGE_VARIANTS } from './BuildingCatalog';
import { buildingIndex } from './BuildingIndex';
import { buildingCorners, type Building, type BuildingStyle, type Wall } from './Town';
import {
  apart,
  MAX_BULGE,
  polylineFacade,
  wallAlong,
  type Facade,
  type Pt,
  type Site,
} from './TownTerraces';

/**
 * A city's terraces stand wall to wall: no party gap between neighbours,
 * and no garden wall or hedge across the street front. Where a row leaves a
 * gap (no style fits what is left, a bend turned a house away, a junction
 * cut the row short), the building beside it is stretched along its front
 * to close it, or a narrower or wider one is fitted in.
 */

/** A building may be drawn this much narrower than its catalog front to fit a gap (`MAX_WIDEN` wider). */
const MIN_SQUEEZE = 0.6;
/**
 * Neighbours in a row may overlap this deep (m): on a bend the backs of two
 * fronts standing edge to edge cross, always behind both fronts. Buildings
 * of other rows (round a corner, across a junction) may only touch.
 */
const ROW_OVERLAP = 1.5;
const TOUCH = 0.02;
/** Front widths (shares of the catalog's) a building tries before the row moves on. */
const SQUEEZES = [1, 0.85, 0.7, 0.6] as const;
/** When a house will not fit, the row moves on by this much and tries again. */
const RETRY_STEP = 0.25;
/** A front may follow the pavement line round this much of a turn, and no more. */
const MAX_FRONT_TURN = (25 * Math.PI) / 180;

/** How far the facade turns between `s0` and `s1`. */
function frontTurn(facade: Facade, s0: number, s1: number): number {
  const heading = (s: number) => {
    const a = facade.point(Math.max(0, s - 0.25));
    const b = facade.point(Math.min(facade.length, s + 0.25));
    return Math.atan2(b.x - a.x, b.z - a.z);
  };
  const d = heading(s1) - heading(s0);
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
}

/** Halvings when stretching a building as far as it will stand. */
const STRETCH_STEPS = 8;
/** Gaps narrower than this are left as they are (the fronts touch within a hair). */
const HAIR = 0.05;
/** A footprint's edges (as corner index pairs from `buildingCorners`), checked every `EDGE_STEP` m. */
const EDGES = [
  [0, 1],
  [1, 3],
  [3, 2],
  [2, 0],
] as const;
const EDGE_STEP = 2;

interface Planned {
  b: Building;
  /** Where its front starts and ends along the facade. */
  s: number;
  e: number;
}

/** Whether `b` stands behind every pavement and clear of the town's buildings and the row's, `skip` aside. */
function fits(site: Site, b: Building, row: readonly Planned[], skip?: Planned): boolean {
  const corners = buildingCorners(b);
  const onIsland = (x: number, z: number) =>
    site.islands?.some((r) => Math.hypot(x - r.x, z - r.z) < r.r) ?? false;
  if (onIsland(b.x, b.z)) return false;
  // Every edge, not just the corners: a stretched front could otherwise straddle a side street.
  for (const [i, j] of EDGES) {
    const [x0, z0] = corners[i]!;
    const [x1, z1] = corners[j]!;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / EDGE_STEP));
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const z = z0 + ((z1 - z0) * k) / n;
      // Corners stay behind the pavement; on a curve a front's middle may stand over it a little.
      const slack = k === 0 || k === n ? 0.05 : MAX_BULGE + 0.05;
      if (!site.clear(x, z, slack) || onIsland(x, z)) return false;
    }
  }
  const reach = Math.hypot(b.hx, b.hz);
  const blocked = buildingIndex(site.buildings).near(
    b.x,
    b.z,
    reach,
    (k) => !apart(k.b, b, -TOUCH, k.corners, corners),
  );
  if (blocked) return false;
  return row.every((p) => p === skip || apart(p.b, b, -ROW_OVERLAP));
}

/** A building of `style` with its front from `s` to about `s + 2·hx` on the facade, or null where it does not stand. */
function stand(
  site: Site,
  facade: Facade,
  style: BuildingStyle,
  s: number,
  hx: number,
  variant: number,
  limit: number,
  row: readonly Planned[],
  skip?: Planned,
): Planned | null {
  const hz = BUILDING_SIZE[style].hz;
  const h = facade.house(s, hx, hz);
  if (!h || h.end > limit + 1e-6) return null;
  // Not round a corner: where the pavement line turns hard along a front, one fitted building
  // takes the whole curve (`TownInfill`) rather than rectangles turned this way and that.
  if (frontTurn(facade, s, h.end) > MAX_FRONT_TURN) return null;
  const b: Building = { style, x: h.x, z: h.z, yaw: h.yaw, hx, hz, variant };
  return fits(site, b, row, skip) ? { b, s, e: h.end } : null;
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

/**
 * A city terrace along the facade between `from` and `to`: buildings wall to
 * wall, then every gap closed by stretching a neighbour (up to `MAX_WIDEN`)
 * or fitting a building to it. A gap nothing closes keeps a garden wall, so
 * the pavement is still backed.
 */
export function joinedRow(site: Site, facade: Facade, from: number, to: number): void {
  const row: Planned[] = [];
  const variants = site.variants ?? VILLAGE_VARIANTS;
  const narrowest = Math.min(
    ...(site.styles ?? []).map(([s]) => 2 * BUILDING_SIZE[s].hx * MIN_SQUEEZE),
  );
  let cursor = from;
  while (to - cursor >= narrowest) {
    const style = pickStyle(site.rand, site.styles, to - cursor);
    if (!style) break;
    const variant = Math.floor(site.rand() * variants);
    // On a tight curve a full front would stand over the pavement mid-chord: try it narrower.
    let p: Planned | null = null;
    for (const squeeze of SQUEEZES) {
      p = stand(site, facade, style, cursor, BUILDING_SIZE[style].hx * squeeze, variant, to, row);
      if (p) break;
    }
    if (p) {
      row.push(p);
      cursor = p.e;
    } else cursor += RETRY_STEP;
  }
  // Close the gaps, row start to row end: fit a building into a wide one, then stretch the
  // building before it and the one after as far as each will stand.
  const stretch = (p: Planned, dir: 1 | -1, room: number, limit: number): Planned | null => {
    const front = p.e - p.s;
    const max = Math.min(room, 2 * BUILDING_SIZE[p.b.style].hx * MAX_WIDEN - front);
    if (max < HAIR) return null;
    const by = (d: number) =>
      stand(
        site,
        facade,
        p.b.style,
        dir > 0 ? p.s : p.s - d,
        (front + d) / 2,
        p.b.variant,
        limit,
        row,
        p,
      );
    const full = by(max);
    if (full) return full;
    let lo = 0;
    let hi = max;
    let best: Planned | null = null;
    for (let k = 0; k < STRETCH_STEPS; k++) {
      const mid = (lo + hi) / 2;
      const c = by(mid);
      if (c) {
        best = c;
        lo = mid;
      } else hi = mid;
    }
    return lo >= HAIR ? best : null;
  };
  for (let i = 0; i <= row.length; i++) {
    const start = () => row[i - 1]?.e ?? from;
    const end = () => row[i]?.s ?? to;
    if (end() - start() < HAIR) continue;
    const style = nearestStyle(site, end() - start());
    const ratio = (end() - start()) / (2 * BUILDING_SIZE[style].hx);
    if (ratio >= MIN_SQUEEZE && ratio <= MAX_WIDEN) {
      const variant = Math.floor(site.rand() * variants);
      const fill = stand(site, facade, style, start(), (end() - start()) / 2, variant, end(), row);
      if (fill) {
        row.splice(i, 0, fill);
        continue;
      }
    }
    const prev = row[i - 1];
    if (prev) {
      const longer = stretch(prev, 1, end() - start(), end());
      if (longer) row[i - 1] = longer;
    }
    const next = row[i];
    if (next && end() - start() >= HAIR) {
      const earlier = stretch(next, -1, end() - start(), row[i + 1]?.s ?? to);
      if (earlier) row[i] = earlier;
    }
  }
  // Whatever is still open keeps a garden wall.
  let edge = from;
  for (const p of row) {
    if (p.s - edge >= HAIR) wallAlong(site, facade, edge, p.s);
    edge = Math.max(edge, p.e);
    site.buildings.push(p.b);
  }
  if (to - edge >= HAIR) wallAlong(site, facade, edge, to);
}

/** Walls are checked for buildings standing over them this often (m), and kept clear of their faces by this much. */
const TRIM_STEP = 0.5;
const TRIM_MARGIN = 0.35;
/** A city drops wall stretches shorter than this: a stub between two buildings backs nothing. */
const MIN_WALL = 1;

/**
 * A city's garden walls less every stretch that runs under or along a
 * building: the junction corners' walls were laid before the terraces that
 * now fill those corners, and a wall inside a building only shows as a
 * strip along its face.
 */
export function trimWallsUnderBuildings(site: Site): void {
  const index = buildingIndex(site.buildings);
  const kept: Wall[] = [];
  for (const w of site.walls) {
    const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
    const n = Math.max(1, Math.ceil(len / TRIM_STEP));
    const at = (k: number) => ({
      x: w.x0 + ((w.x1 - w.x0) * k) / n,
      z: w.z0 + ((w.z1 - w.z0) * k) / n,
    });
    let run: { x: number; z: number } | null = null;
    for (let k = 0; k <= n; k++) {
      const p = at(k);
      const open = !index.covers(p.x, p.z, TRIM_MARGIN);
      if (open && !run) run = p;
      if ((!open || k === n) && run) {
        const end = open ? p : at(k - 1);
        if (Math.hypot(end.x - run.x, end.z - run.z) >= MIN_WALL)
          kept.push({ x0: run.x, z0: run.z, x1: end.x, z1: end.z });
        run = null;
      }
    }
  }
  site.walls.length = 0;
  site.walls.push(...kept);
}

/** Wall runs shorter than this keep their wall: no building fits. */
const MIN_RUN = 6;
/** Wall pieces whose ends lie this close continue one run. */
const RUN_JOIN = 0.05;
/** How far either side of a run's middle the street and the plot behind it are looked for. */
const SIDE_PROBE = 2.5;

/** A run turning more than this in all, over less than `CORNER_LENGTH`, is a corner, not a frontage. */
const CORNER_TURN = (40 * Math.PI) / 180;
const CORNER_LENGTH = 40;

/** Whether a run is a corner: it turns hard over a short way. */
function isCorner(run: readonly Pt[], length: number): boolean {
  if (length >= CORNER_LENGTH) return false;
  let turn = 0;
  for (let i = 2; i < run.length; i++) {
    const a = Math.atan2(run[i - 1]!.x - run[i - 2]!.x, run[i - 1]!.z - run[i - 2]!.z);
    const b = Math.atan2(run[i]!.x - run[i - 1]!.x, run[i]!.z - run[i - 1]!.z);
    turn += Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
  }
  return turn > CORNER_TURN;
}

/** Chain the walls into runs of consecutive pieces, end to start. */
function wallRuns(walls: readonly Wall[]): Pt[][] {
  const runs: Pt[][] = [];
  for (const w of walls) {
    const last = runs[runs.length - 1];
    const end = last?.[last.length - 1];
    if (last && end && Math.hypot(end.x - w.x0, end.z - w.z0) < RUN_JOIN)
      last.push({ x: w.x1, z: w.z1 });
    else
      runs.push([
        { x: w.x0, z: w.z0 },
        { x: w.x1, z: w.z1 },
      ]);
  }
  return runs;
}

/**
 * A city's last walls into terraces: each run of wall that backs a pavement
 * (a street on one side, open ground on the other) takes a joined row on
 * its open side. Whatever no building can close keeps its wall.
 */
export function wallsToTerraces(site: Site): void {
  const walls = site.walls.splice(0);
  for (const run of wallRuns(walls)) {
    let length = 0;
    for (let i = 1; i < run.length; i++)
      length += Math.hypot(run[i]!.x - run[i - 1]!.x, run[i]!.z - run[i - 1]!.z);
    const keep = () => {
      for (let i = 1; i < run.length; i++)
        site.walls.push({ x0: run[i - 1]!.x, z0: run[i - 1]!.z, x1: run[i]!.x, z1: run[i]!.z });
    };
    // A corner (a run that turns hard over a short way) is left whole for one fitted building.
    if (length < MIN_RUN || isCorner(run, length)) {
      keep();
      continue;
    }
    // The open side, judged at the run's middle piece: left of travel when the right is street.
    const m = Math.floor((run.length - 1) / 2);
    const a = run[m]!;
    const b = run[m + 1]!;
    const d = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const lx = (b.z - a.z) / d;
    const lz = -(b.x - a.x) / d;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const openLeft = site.clear(mx + lx * SIDE_PROBE, mz + lz * SIDE_PROBE, 0);
    const openRight = site.clear(mx - lx * SIDE_PROBE, mz - lz * SIDE_PROBE, 0);
    if (openLeft === openRight) {
      keep();
      continue;
    }
    joinedRow(site, polylineFacade(run, openLeft ? 1 : -1), 0, length);
  }
}
