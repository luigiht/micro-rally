import { FRONT_SETBACK, type Arm, type BuildingStyle, type Junction } from './Town';
import { wedges } from './TownJunctions';
import {
  at,
  BUILDING_SIZE,
  forward,
  left,
  openGround,
  place,
  row,
  straightFacade,
  street,
  pushWall,
  type Facade,
  type Pt,
  type Site,
} from './TownTerraces';

/** Blocked side streets reach this far from the junction; the row of cones stands part-way down. */
export const STUB_LENGTH = 32;
export const CONE_DISTANCE = 14;
/** Direction boards stand this far in front of the cones they belong to. */
export const ARROW_AHEAD_OF_CONES = 1.6;
/** Cones stop this short of the kerb. */
const CONE_MARGIN = 0.5;
/** Corner greenery: how far into a wedge from its facade corner a tree or bush may stand, and the room each needs. */
const TREE_SPOTS = [5, 4, 3, 6.5] as const;
const BUSH_SPOTS: readonly (readonly [number, number])[] = [
  [1.6, 1.4],
  [1.6, -1.4],
  [3, 2.6],
  [3, -2.6],
  [2.4, 0],
  [4.5, 3.6],
  [4.5, -3.6],
];
const TREE_ROOM = 1;
const BUSH_ROOM = 0.8;
/** Crowns keep this much off the garden walls, and plantings this much apart beyond their room. */
const WALL_ROOM = 0.3;
const PLANT_GAP = 0.8;
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

/** Lay a blocked side street from junction `j`: the carriageway and the cones across it. */
export function sideStreet(
  site: Site,
  stubs: StubSite[],
  j: Pt,
  heading: number,
  hw: number,
  endStyle?: BuildingStyle,
): void {
  site.streets.push(street(j, at(j, heading, STUB_LENGTH, 0), hw, false));
  const b = at(j, heading, CONE_DISTANCE, 0);
  site.cones.push({ x: b.x, z: b.z, yaw: heading, halfLength: hw - CONE_MARGIN });
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
/** A walled corner awaiting its greenery: the facade corner and the two arms it lies between. */
export interface Corner {
  k: { x: number; z: number };
  a: Arm;
  b: Arm;
}

/**
 * Greenery in a walled corner: candidate spots fan out into the wedge from
 * its facade corner; the deepest open one takes a low tree, up to three
 * nearer the walls take bushes. A spot must lie inside the wedge with room
 * for its crown off both walls, clear of every pavement and building, and
 * apart from what is already planted.
 */
function plantCorner(site: Site, { k, a, b }: Corner): void {
  const fa = forward(a.heading);
  const fb = forward(b.heading);
  const len = Math.hypot(fa.x + fb.x, fa.z + fb.z);
  if (len < 1e-6) return;
  const bx = (fa.x + fb.x) / len;
  const bz = (fa.z + fb.z) / len;
  const la = left(a.heading);
  const lb = left(b.heading);
  // Room behind each wall: beyond a's facade line on its left, beyond b's on its right.
  const behind = (x: number, z: number) => {
    const dax = x - k.x;
    const daz = z - k.z;
    return Math.min(dax * la.x + daz * la.z, -(dax * lb.x + daz * lb.z));
  };
  const planted: { x: number; z: number }[] = [];
  const fits = (x: number, z: number, r: number) =>
    behind(x, z) >= r + WALL_ROOM &&
    openGround(site, x, z, r) &&
    planted.every((p) => Math.hypot(p.x - x, p.z - z) >= r + PLANT_GAP);
  const plant = (kind: 'tree' | 'bush', x: number, z: number, scale: number) => {
    planted.push({ x, z });
    site.plantings.push({
      kind,
      x,
      z,
      scale,
      rotation: site.rand() * Math.PI * 2,
      variant: site.rand() < 0.5 ? 0 : 1,
    });
  };
  for (const into of TREE_SPOTS) {
    const x = k.x + bx * into;
    const z = k.z + bz * into;
    if (!fits(x, z, TREE_ROOM)) continue;
    plant('tree', x, z, 0.7 + site.rand() * 0.3);
    break;
  }
  let bushes = 0;
  for (const [into, aside] of BUSH_SPOTS) {
    const x = k.x + bx * into + bz * aside;
    const z = k.z + bz * into - bx * aside;
    if (!fits(x, z, BUSH_ROOM)) continue;
    plant('bush', x, z, 0.6 + site.rand() * 0.4);
    if (++bushes >= 3) break;
  }
}

/** Plant every walled corner, once the houses stand, so nothing grows through a wall or a floor. */
export function plantCorners(site: Site, corners: readonly Corner[]): void {
  for (const c of corners) plantCorner(site, c);
}

export function junctionWalls(
  site: Site,
  j: Junction,
  facades: RouteFacades,
): { left: number[]; right: number[]; corners: Corner[] } {
  const cuts = { left: [] as number[], right: [] as number[], corners: [] as Corner[] };
  for (const w of wedges(j)) {
    const aBlocked = w.a.role === 'blocked';
    const bBlocked = w.b.role === 'blocked';
    if (!aBlocked && !bBlocked) continue;
    if (aBlocked && bBlocked) {
      const k = { x: w.kx, z: w.kz };
      pushWall(site, at(j, w.a.heading, ROW_SETBACK, w.a.halfWidth + FRONT_SETBACK), k);
      pushWall(site, k, at(j, w.b.heading, ROW_SETBACK, -(w.b.halfWidth + FRONT_SETBACK)));
      cuts.corners.push({ k, a: w.a, b: w.b });
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
    cuts.corners.push({ k, a: w.a, b: w.b });
    (side === 1 ? cuts.left : cuts.right).push(k.s);
  }
  return cuts;
}
