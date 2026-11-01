import { FRONT_SETBACK, type BuildingStyle, type Junction } from './Town';
import { wedges } from './TownJunctions';
import {
  at,
  BUILDING_SIZE,
  place,
  row,
  straightFacade,
  street,
  pushWall,
  type Facade,
  type Pt,
  type Site,
} from './TownTerraces';

/** Blocked side streets reach this far from the junction; the barrier row stands part-way down. */
export const STUB_LENGTH = 32;
export const BARRIER_DISTANCE = 14;
/** Direction boards stand this far in front of the barrier row they belong to. */
export const ARROW_AHEAD_OF_BARRIER = 1.6;
/** Terraces down a side street start this far from the junction, past the facade corner of the widest wedge. */
export const ROW_SETBACK = 16;

/** A blocked side street waiting for its buildings. */
export interface StubSite {
  j: Pt;
  heading: number;
  hw: number;
  endStyle?: BuildingStyle;
  /** Half width of the building closing the end, once it stands. */
  endHx?: number;
}

/** The route's facades through the town, the houses' side of the pavement. */
export interface RouteFacades {
  left: Facade;
  right: Facade;
}

/** Lay a blocked side street from junction `j`: the carriageway and the barrier row across it. */
export function sideStreet(
  site: Site,
  stubs: StubSite[],
  j: Pt,
  heading: number,
  hw: number,
  endStyle?: BuildingStyle,
): void {
  site.streets.push(street(j, at(j, heading, STUB_LENGTH, 0), hw, false));
  const b = at(j, heading, BARRIER_DISTANCE, 0);
  // The row reaches the facade line, so the pavement cannot be used to squeeze past.
  site.barriers.push({ x: b.x, z: b.z, yaw: heading, halfLength: hw + FRONT_SETBACK - 0.3 });
  stubs.push({ j, heading, hw, ...(endStyle ? { endStyle } : {}) });
}

/** The building that closes a side street, facing back up it; a wall across the end where it cannot stand. */
export function stubEnd(site: Site, s: StubSite): void {
  const style = s.endStyle ?? (site.rand() < 0.5 ? 'townhouse' : 'shop');
  const { hx, hz } = BUILDING_SIZE[style];
  const front = STUB_LENGTH + FRONT_SETBACK;
  const c = at(s.j, s.heading, front + hz, 0);
  const variant = site.rand() < 0.5 ? 0 : 1;
  if (place(site, { style, x: c.x, z: c.z, yaw: s.heading, hx, hz, variant })) {
    s.endHx = hx;
    return;
  }
  const f = s.hw + FRONT_SETBACK;
  pushWall(site, at(s.j, s.heading, front, -f), at(s.j, s.heading, front, f));
}

/** Terraces down both sides of a side street, and walls closing the corners at its end. */
export function stubRows(site: Site, s: StubSite): void {
  const front = STUB_LENGTH + FRONT_SETBACK;
  const end = front - 0.6;
  for (const side of [1, -1] as const) {
    row(site, straightFacade(s.j, s.heading, s.hw, side, end), ROW_SETBACK, end);
    const f = (s.hw + FRONT_SETBACK) * side;
    const k = at(s.j, s.heading, front, f);
    pushWall(site, at(s.j, s.heading, end, f), k);
    if (s.endHx !== undefined && s.endHx < Math.abs(f) - 0.3)
      pushWall(site, k, at(s.j, s.heading, front, s.endHx * side));
  }
}

/**
 * Garden walls around a junction, one L per wedge between neighbouring
 * arms: from where one arm's terrace starts to the facade corner and on to
 * the other's. Where a wedge meets the route, its corner is where the side
 * street's facade line crosses the route's facade, and the route's terrace
 * is interrupted there: those crossings come back, per side. The wedge
 * between the route's own two arms is its inner corner, which the route's
 * facade lines itself.
 */
export function junctionWalls(
  site: Site,
  j: Junction,
  facades: RouteFacades,
): { left: number[]; right: number[] } {
  const cuts = { left: [] as number[], right: [] as number[] };
  for (const w of wedges(j)) {
    const aBlocked = w.a.role === 'blocked';
    const bBlocked = w.b.role === 'blocked';
    if (!aBlocked && !bBlocked) continue;
    if (aBlocked && bBlocked) {
      const k = { x: w.kx, z: w.kz };
      pushWall(site, at(j, w.a.heading, ROW_SETBACK, w.a.halfWidth + FRONT_SETBACK), k);
      pushWall(site, k, at(j, w.b.heading, ROW_SETBACK, -(w.b.halfWidth + FRONT_SETBACK)));
      continue;
    }
    const stub = aBlocked ? w.a : w.b;
    const route = aBlocked ? w.b : w.a;
    const across = (aBlocked ? 1 : -1) * (stub.halfWidth + FRONT_SETBACK);
    // The wedge lies left of `a` and right of `b`; an arm pointing back up the route has the route's right on its left.
    const side = (route === w.a) === (route.role === 'out') ? 1 : -1;
    const facade = side === 1 ? facades.left : facades.right;
    const k = facade.cross(j, stub.heading, across) ?? facade.nearest(w.kx, w.kz);
    pushWall(site, at(j, stub.heading, ROW_SETBACK, across), k);
    (side === 1 ? cuts.left : cuts.right).push(k.s);
  }
  return cuts;
}
