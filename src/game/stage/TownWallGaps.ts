import { buildingIndex } from './BuildingIndex';
import { SpatialHash } from './SpatialHash';
import type { Wall } from './Town';
import type { Site } from './TownTerraces';

/**
 * Closing the garden walls. The walls are laid piecewise, along facades and
 * round junction wedges, and trimmed wherever a street crosses them; where
 * two pieces stop short of each other a slit of open ground shows between
 * them. This pass finds every wall end that meets neither another wall nor
 * a building and joins it to the nearest such end a short way off, so the
 * walled greens close.
 */

/** A wall end within this of another end, or a building's edge, is already closed. */
const TOUCH = 0.35;
const BUILDING_TOUCH = 0.5;
/** Ends further apart than this are left: that is a street's mouth, not a slit. */
const MAX_GAP = 6;
/** A joining wall must stay this far clear of every carriageway's pavement (0 = the facade line). */
const JOIN_SLACK = 0.6;

interface End {
  x: number;
  z: number;
  wall: Wall;
}

export function closeWallGaps(site: Site): void {
  const ends: End[] = [];
  for (const w of site.walls)
    ends.push({ x: w.x0, z: w.z0, wall: w }, { x: w.x1, z: w.z1, wall: w });
  const buildings = buildingIndex(site.buildings);
  // Ends gridded by position: each end only looks a short way round itself.
  const grid = new SpatialHash<End>(MAX_GAP);
  for (const e of ends) grid.insert(e, e.x, e.z);
  const touches = (e: End) =>
    grid.near(
      e.x,
      e.z,
      TOUCH,
      (o) => o.wall !== e.wall && Math.hypot(o.x - e.x, o.z - e.z) < TOUCH,
    );
  const loose = ends.filter((e) => !touches(e) && !buildings.covers(e.x, e.z, BUILDING_TOUCH));
  const looseGrid = new SpatialHash<End>(MAX_GAP);
  for (const e of loose) looseGrid.insert(e, e.x, e.z);
  const used = new Set<End>();
  for (const e of loose) {
    if (used.has(e)) continue;
    const pick: { end: End | null; d: number } = { end: null, d: MAX_GAP };
    looseGrid.near(e.x, e.z, MAX_GAP, (o) => {
      if (o === e || used.has(o) || o.wall === e.wall) return;
      const d = Math.hypot(o.x - e.x, o.z - e.z);
      if (d < pick.d) {
        pick.end = o;
        pick.d = d;
      }
    });
    const best = pick.end;
    if (!best) continue;
    // The joining piece must not cross a carriageway: its ends and middle stay off the pavements.
    const mx = (e.x + best.x) / 2;
    const mz = (e.z + best.z) / 2;
    if (!site.clear(mx, mz, JOIN_SLACK)) continue;
    site.walls.push({ x0: e.x, z0: e.z, x1: best.x, z1: best.z });
    used.add(e);
    used.add(best);
  }
}
