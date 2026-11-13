import {
  FRONT_SETBACK,
  JUNCTION_REACH,
  PAVEMENT_WIDTH,
  type Arm,
  type BuildingStyle,
  type Footprint,
  type Junction,
  type Street,
} from './Town';
import { wedges } from './TownJunctions';
import { meet, type JunctionKerbs } from './TownKerbs';
import {
  apart,
  at,
  BUILDING_SIZE,
  forward,
  left,
  openGround,
  place,
  polylineFacade,
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
const TREE_SPOTS: readonly (readonly [number, number])[] = [
  [5, 0],
  [4, 0],
  [3, 0],
  [6.5, 0],
  [8, 3.5],
  [8, -3.5],
  [11, 0],
];
const BUSH_SPOTS: readonly (readonly [number, number])[] = [
  [1.6, 1.4],
  [1.6, -1.4],
  [3, 2.6],
  [3, -2.6],
  [2.4, 0],
  [4.5, 3.6],
  [4.5, -3.6],
  [6, 5],
  [6, -5],
  [9, 1.8],
  [9, -1.8],
];
/** At most this many trees and bushes per corner. */
const MAX_TREES = 2;
const MAX_BUSHES = 5;
const TREE_ROOM = 1;
const BUSH_ROOM = 0.8;
/** Crowns keep this much off the garden walls, and plantings this much apart beyond their room. */
const WALL_ROOM = 0.3;
const PLANT_GAP = 0.8;
/** Terraces down a side street start this far from the junction, past the facade corner of the widest wedge. */
export const ROW_SETBACK = 16;
/** A side street shortened to clear another junction's keeps at least this much carriageway. */
export const MIN_STUB_LENGTH = 20;
/** An open street's terraces end this far before the road it meets: that road's pavement and a strip. */
const OPEN_END_SETBACK = PAVEMENT_WIDTH + 1;
/** A corner's street forced below that keeps at least its junction's cut plus this much. */
export const FORCED_STUB_MARGIN = 2;
/** Pavements of side streets from different junctions keep this much apart. */
const STUB_GAP = 0.5;
const CLEAR_STEP = 0.25;

/** A blocked side street waiting to be fitted among the others, laid and given its buildings. */
export interface StubSite {
  j: Pt;
  heading: number;
  hw: number;
  /** Carriageway length from the junction: `full` unless cut down to clear another junction's street. */
  length: number;
  /** The length the street was asked for (`STUB_LENGTH` in a village, longer in a city). */
  full: number;
  endStyle?: BuildingStyle;
  /** A direction board for the route's turn stands before this street's cones. */
  arrowTurn?: 1 | -1;
  /** Half width of the building closing the end, once it stands. */
  endHx?: number;
  /** The street runs on to meet another road (a city): nothing closes its far end. */
  open?: true;
  /** An open street's terraces stop this far short of its end (the road it meets and a strip); `OPEN_END_SETBACK` when unset. */
  endClear?: number;
}

/** How far down a side street its cones stand: part-way, beyond the junction's own surface on a wide street, or short of a shortened street's end. */
export function coneDistance(s: StubSite): number {
  return Math.min(Math.max(CONE_DISTANCE, s.hw + JUNCTION_REACH + 1), s.length - 4);
}

/** A plan to fit a side street: its length, and the other streets to cut down for it. */
export interface StubPlan {
  length: number;
  cuts: [StubSite, number][];
}

/** The ground a side street of `length` takes from `j` along `heading`: carriageway, pavements and the pavement across its end, as one box. */
function ground(j: Pt, heading: number, hw: number, length: number): Footprint {
  const half = (length + PAVEMENT_WIDTH) / 2;
  const c = at(j, heading, half, 0);
  return { x: c.x, z: c.z, yaw: heading, hx: hw + PAVEMENT_WIDTH, hz: half };
}

function corridor(s: StubSite, length: number): Footprint {
  return ground(s.j, s.heading, s.hw, length);
}

/** The ground a laid side street takes, pavements included. */
export function streetGround(st: Street): Footprint {
  const dx = st.x1 - st.x0;
  const dz = st.z1 - st.z0;
  return ground({ x: st.x0, z: st.z0 }, Math.atan2(dx, dz), st.halfWidth, Math.hypot(dx, dz));
}

/**
 * The longest `a` can be before its ground comes within `STUB_GAP` of `b`'s
 * (`b` at its current length); its full length when they never meet. Streets
 * from the same junction share its mouth and never clash, and streets whose
 * grounds cannot reach each other are not stepped through.
 */
export function clearLength(a: StubSite, b: StubSite): number {
  const apartBy = Math.hypot(a.j.x - b.j.x, a.j.z - b.j.z);
  if (apartBy < 1e-6) return a.full;
  const reachA = a.full + PAVEMENT_WIDTH + a.hw + PAVEMENT_WIDTH;
  const reachB = b.length + PAVEMENT_WIDTH + b.hw + PAVEMENT_WIDTH;
  if (apartBy > reachA + reachB + STUB_GAP) return a.full;
  const other = corridor(b, b.length);
  // The length grows in steps until the two boxes come within the gap; the last clear step stands.
  for (let l = CLEAR_STEP; l <= a.full; l += CLEAR_STEP)
    if (!apart(corridor(a, l), other, STUB_GAP)) return l - CLEAR_STEP;
  return a.full;
}

/**
 * Lengths for `s` and `o` when they can only clear each other by both
 * giving way (streets facing each other from two corners): the longest `o`
 * can keep, down to the minimum, that leaves `s` at least as much. Null when
 * even that is not enough.
 */
function splitLengths(s: StubSite, o: StubSite): [number, number] | null {
  for (let l = o.full; l >= MIN_STUB_LENGTH; l -= CLEAR_STEP) {
    const la = clearLength(s, { ...o, length: l });
    if (la >= l) return [la, l];
  }
  return null;
}

/**
 * Fit a side street among those already planned. Where its pavement would
 * run into another junction's street, whichever of the two keeps more
 * street is cut down, never below `MIN_STUB_LENGTH`; streets that can only
 * clear each other by both giving way split the room between them. Null
 * when a clash cannot be cleared that way; with `force` the new street is
 * kept anyway, cut to what fits beside the other at the minimum but never
 * shorter than its junction's cut, for a corner's streets, which the
 * junction cannot do without; if that still leaves the two touching, the
 * other gives way below the minimum too, down to its own junction's cut.
 */
export function planStub(stubs: readonly StubSite[], s: StubSite, force: boolean): StubPlan | null {
  let length = s.length;
  const cuts: [StubSite, number][] = [];
  for (const o of stubs) {
    const la = clearLength(s, o);
    if (la >= length) continue;
    const lo = clearLength(o, { ...s, length });
    if (lo >= MIN_STUB_LENGTH && lo >= la) {
      cuts.push([o, lo]);
      continue;
    }
    if (la >= MIN_STUB_LENGTH) {
      length = la;
      continue;
    }
    const split = splitLengths({ ...s, length }, o);
    if (split) {
      length = Math.min(length, split[0]);
      cuts.push([o, split[1]]);
      continue;
    }
    if (!force) return null;
    length = Math.max(
      s.hw + JUNCTION_REACH + FORCED_STUB_MARGIN,
      Math.min(length, clearLength(s, { ...o, length: MIN_STUB_LENGTH })),
    );
    // Still touching with the other at the minimum: it gives way further, down to its own junction's cut.
    const room = clearLength(o, { ...s, length });
    cuts.push([
      o,
      Math.max(o.hw + JUNCTION_REACH + FORCED_STUB_MARGIN, Math.min(MIN_STUB_LENGTH, room)),
    ]);
  }
  return { length, cuts };
}

export function applyPlan(s: StubSite, plan: StubPlan): void {
  s.length = plan.length;
  for (const [o, l] of plan.cuts) o.length = Math.min(o.length, l);
}

/** The route's facades through the town, the houses' side of the pavement. */
export interface RouteFacades {
  left: Facade;
  right: Facade;
}

/** A blocked side street from junction `j` at full length (`STUB_LENGTH` unless a city asks for longer), to be fitted among the others before it is laid. */
export function stubSite(
  j: Pt,
  heading: number,
  hw: number,
  endStyle?: BuildingStyle,
  full = STUB_LENGTH,
): StubSite {
  return { j, heading, hw, length: full, full, ...(endStyle ? { endStyle } : {}) };
}

/** Lay a fitted side street: the carriageway, the cones across it and any direction board before them. */
export function layStub(site: Site, s: StubSite): void {
  const st = street(s.j, at(s.j, s.heading, s.length, 0), s.hw, false);
  if (s.open) st.open = true;
  site.streets.push(st);
  const cones = coneDistance(s);
  const b = at(s.j, s.heading, cones, 0);
  site.cones.push({ x: b.x, z: b.z, yaw: s.heading, halfLength: s.hw - CONE_MARGIN });
  if (s.arrowTurn !== undefined) {
    const a = at(s.j, s.heading, cones - ARROW_AHEAD_OF_CONES, 0);
    site.arrows.push({ x: a.x, z: a.z, yaw: s.heading, turn: s.arrowTurn });
  }
}

/** The building that closes a side street, facing back up it; a wall across the end where it cannot stand. */
export function stubEnd(site: Site, s: StubSite): void {
  if (s.open) return;
  const style = s.endStyle ?? (site.rand() < 0.5 ? 'townhouse' : 'shop');
  const { hx, hz } = BUILDING_SIZE[style];
  const front = s.length + FRONT_SETBACK;
  const c = at(s.j, s.heading, front + hz, 0);
  const variant = site.rand() < 0.5 ? 0 : 1;
  if (place(site, { style, x: c.x, z: c.z, yaw: s.heading, hx, hz, variant })) {
    s.endHx = hx;
    return;
  }
  const f = s.hw + FRONT_SETBACK;
  pushWall(site, at(s.j, s.heading, front, -f), at(s.j, s.heading, front, f));
}

/**
 * Where a side street's frontage first stands clear past its junction's
 * paving: walking out from the junction's centre, the first clear point
 * after one that is not (a ring's centre is its island, clear until the
 * ring itself), and never past `ROW_SETBACK`: each building checks its own
 * clearance as the row is laid, while a late start leaves the frontage bare.
 * `ROW_SETBACK` too if it crosses no paving within `ROW_START_REACH`.
 */
function rowStart(site: Site, facade: Facade): number {
  let crossed = false;
  for (let s = 0; s < Math.min(facade.length, ROW_START_REACH); s += ROW_SCAN) {
    const p = facade.point(s);
    if (!site.clear(p.x, p.z, 0)) crossed = true;
    else if (crossed) return Math.min(s, ROW_SETBACK);
  }
  return ROW_SETBACK;
}
const ROW_SCAN = 0.5;
/** A junction's paving reaches no further along a street's frontage than this. */
const ROW_START_REACH = 40;

/**
 * A city terrace along the straight line from `a` to `b`, its buildings
 * standing on the side the `back` heading points to.
 */
function terraceAlong(site: Site, a: Pt, b: Pt, back: number): void {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  if (length < 1) return;
  const along = Math.atan2(b.x - a.x, b.z - a.z);
  const l = left(along);
  const f = forward(back);
  row(site, polylineFacade([a, b], l.x * f.x + l.z * f.z > 0 ? 1 : -1), 0, length);
}

/** Terraces down both sides of a side street, and walls closing the corners at its end. */
export function stubRows(site: Site, s: StubSite): void {
  // An open street's rows stop short of the road it meets, leaving that road's pavement free.
  const front = s.open ? s.length - (s.endClear ?? OPEN_END_SETBACK) : s.length + FRONT_SETBACK;
  const end = front - 0.6;
  for (const side of [1, -1] as const) {
    const facade = straightFacade(s.j, s.heading, s.hw, side, end);
    // A city's rows start where the frontage leaves the junction's paving, so the side street's
    // first building meets the corner one.
    row(site, facade, site.joined ? rowStart(site, facade) : ROW_SETBACK, end);
    if (s.open) continue;
    const f = (s.hw + FRONT_SETBACK) * side;
    const k = at(s.j, s.heading, front, f);
    pushWall(site, at(s.j, s.heading, end, f), k);
    // A city closes the street's end with buildings either side of the end one, not walls.
    if (site.joined) continue;
    if (s.endHx !== undefined && s.endHx < Math.abs(f) - 0.3)
      pushWall(site, k, at(s.j, s.heading, front, s.endHx * side));
  }
  if (site.joined && !s.open) {
    const f = s.hw + FRONT_SETBACK;
    terraceAlong(site, at(s.j, s.heading, front, -f), at(s.j, s.heading, front, f), s.heading);
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
  let trees = 0;
  for (const [into, aside] of TREE_SPOTS) {
    const x = k.x + bx * into + bz * aside;
    const z = k.z + bz * into - bx * aside;
    if (!fits(x, z, TREE_ROOM)) continue;
    plant('tree', x, z, 0.7 + site.rand() * 0.3);
    if (++trees >= MAX_TREES) break;
  }
  let bushes = 0;
  for (const [into, aside] of BUSH_SPOTS) {
    const x = k.x + bx * into + bz * aside;
    const z = k.z + bz * into - bx * aside;
    if (!fits(x, z, BUSH_ROOM)) continue;
    plant('bush', x, z, 0.6 + site.rand() * 0.4);
    if (++bushes >= MAX_BUSHES) break;
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
  kerbs: JunctionKerbs,
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
    const apron = kerbs.aprons.find((ap) => ap.route === route);
    if (apron) {
      // At a corner the pavement runs straight along the apron's edge while the ribbon bends away
      // behind it: the facade corner lies on that straight edge, and a wall follows it back to
      // where the ribbon hands over, so the terrace row and the kerb agree.
      const start = at(j, stub.heading, ROW_SETBACK, across);
      const edge = {
        x: apron.e1.x + apron.e1.nx * FRONT_SETBACK,
        z: apron.e1.z + apron.e1.nz * FRONT_SETBACK,
      };
      const corner = meet(start, forward(stub.heading), edge, apron.u) ?? edge;
      const end = facade.nearest(
        apron.handoff.x + apron.handoff.nx * FRONT_SETBACK,
        apron.handoff.z + apron.handoff.nz * FRONT_SETBACK,
      );
      // The corner's line round the apron; in a city its building is fitted to it (`TownInfill`).
      pushWall(site, start, corner);
      pushWall(site, corner, end);
      cuts.corners.push({ k: corner, a: w.a, b: w.b });
      (side === 1 ? cuts.left : cuts.right).push(end.s);
      continue;
    }
    const k = facade.cross(j, stub.heading, across) ?? facade.nearest(w.kx, w.kz);
    pushWall(site, at(j, stub.heading, ROW_SETBACK, across), k);
    cuts.corners.push({ k, a: w.a, b: w.b });
    (side === 1 ? cuts.left : cuts.right).push(k.s);
  }
  return cuts;
}
