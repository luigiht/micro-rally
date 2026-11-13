import type { BoxObstacle } from '../vehicle/Collisions';
import { BUILDING_SIZE, DOOR_OFFSET } from './BuildingCatalog';
import type { Median } from './Median';
import type { Infill } from './TownInfill';
import type { CityMap } from './city/CityMap';
import type { FrontageChain } from './city/CityFrontage';
import type { TramLoopDef } from './city/TramLoop';
import { roundaboutBlocks, type Roundabout } from './Roundabout';
import type { Prop } from './SceneryScatter';
import { junctionReach } from './TownJunctions';
import { TRAM_BED_HALF, type TramLine } from './Tram';

/**
 * A town section on a stage: a level plateau carrying a street grid the route
 * threads through with right-angle turns. Everything here is plain data
 * derived deterministically from the stage, so the terrain worker rebuilds it
 * from the seed exactly as the main thread does.
 *
 * Frame: `heading` is the yaw of the entry street (forward = (sin, 0, cos));
 * `u` runs along it from the town centre, `v` to its left.
 */
export interface TownDef {
  /** Plateau centre. */
  x: number;
  z: number;
  heading: number;
  /** Plateau half extents along `u` and `v`; the hills blend down to it over `PLATEAU_BLEND` beyond them. */
  halfU: number;
  halfV: number;
  /** Route distance interval [from, to] inside the town. */
  from: number;
  to: number;
  /** Every street centreline, route and side streets alike. */
  streets: Street[];
  buildings: Building[];
  /** Rows of traffic cones marking each blocked side street as closed. */
  cones: ConeRow[];
  /** Direction boards at the route's turns. */
  arrows: Arrow[];
  /** Every crossroads: the polygon corners and the mid-leg crossings, with the arms that meet there. */
  junctions: Junction[];
  /** Low garden walls that carry the facade line wherever no building stands behind the pavement. */
  walls: Wall[];
  /** Trees and bushes planted in the walled corners of the junctions. */
  plantings: Planting[];
  /** A city (see `UrbanGenerator`): metres of hill relief kept inside the footprint instead of `TOWN_RELIEF_METRES`. */
  relief?: number;
  /** A city's roundabouts: the route circles each island on a 'curve' leg. */
  roundabouts?: Roundabout[];
  /** A city's tram tracks, across the route at crossroads and down the middle of its boulevards. */
  trams?: TramLine[];
  /** A city's kerbed green dividers down the middle of its boulevards. */
  medians?: Median[];
  /** A city's per-sample half widths (each street one width, changing across the corner arcs), for `StageDef.widths`. */
  widths?: Float64Array;
  /** Set for a city: the street detail (crossings, bays, furniture) is the city's. */
  city?: true;
  /** A city's buildings fitted to the plots no catalog building could take (`TownInfill`); their walls are only colliders. */
  infills?: Infill[];
  /** A city's street map in the world (`city/CityMap`): every crossroads and street, the route's among them. */
  map?: CityMap;
  /** Barriers across the city streets the route passes, so the car keeps to the route. */
  barriers?: Barrier[];
  /** A mapped city's tram circuit (`city/TramLoop`); `trams` then holds its rail pieces. */
  tramLoop?: TramLoopDef;
  /** A mapped city's frontage (`city/CityFrontage`): every pavement's back edge, buildings on each chain's left. */
  frontage?: FrontageChain[];
}

/** One arm of a junction: a street leaving the junction centre on `heading`. */
export interface Arm {
  heading: number;
  halfWidth: number;
  /** The route arriving ('in', pointing back the way the car came), leaving ('out'), or a blocked side street. */
  role: 'in' | 'out' | 'blocked';
}

export interface Junction {
  x: number;
  z: number;
  arms: Arm[];
  /** The route's corner arc radius here when the leg set its own (see `cornerRadius`). */
  radius?: number;
  /** A city corner, laid as a square junction of straight arms (see `JunctionBox`). */
  box?: true;
}

/** Garden wall segment along a facade line. */
export interface Wall {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Facades (and garden walls) stand right behind the pavement: this far beyond the carriageway edge. */
export const FRONT_SETBACK = 3;
/** Pavement width, matching the ribbon's verge strips. */
export const PAVEMENT_WIDTH = 3;
/** Kerb return radius where two arms of a junction meet. */
export const FILLET = 3;
/** Garden walls: half thickness for colliders and render. */
export const WALL_HALF = 0.15;

/** Straight street centreline segment between two world points. */
export interface Street {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  halfWidth: number;
  /** True for the streets the route drives; false for the blocked side streets. */
  route: boolean;
  /** A city side street that runs on to meet another road: no building or pavement closes its far end. */
  open?: true;
}

/** The four village styles, and the city's apartment `block`, glass `office`, brick `tenement` and arcaded `arcade`. */
export type BuildingStyle =
  'townhouse' | 'shop' | 'tower' | 'hall' | 'block' | 'office' | 'tenement' | 'arcade';

/** Footprint-aligned building: `yaw` faces the door (local -z) at the street, half extents in its own frame. */
export interface Building {
  style: BuildingStyle;
  x: number;
  z: number;
  yaw: number;
  hx: number;
  hz: number;
  variant: number;
}

/** A row of cones across a blocked side street at (x, z), reaching `halfLength` either side of its centreline. */
export interface ConeRow {
  x: number;
  z: number;
  yaw: number;
  halfLength: number;
}

/** A crowd barrier across a city street the route passes, `halfLength` either side of (x, z), the street running on along `yaw`. */
export interface Barrier {
  x: number;
  z: number;
  yaw: number;
  halfLength: number;
  /** A tram runs through: the barrier is drawn with a gap for its rails (its collider still spans the street). */
  tramGap?: true;
}

/** A barrier collides as a box this thick. */
export const BARRIER_HALF = 0.3;

/** A tree or bush planted inside the village. */
export interface Planting {
  kind: 'tree' | 'bush';
  x: number;
  z: number;
  scale: number;
  rotation: number;
  variant: number;
}

export interface Arrow {
  x: number;
  z: number;
  yaw: number;
  /** +1 left turn, -1 right turn. */
  turn: 1 | -1;
}

/** Width of the band beyond the plateau over which the hills blend down to it. */
export const PLATEAU_BLEND = 40;

/** Signed-ish distance from (x, z) to the plateau rectangle: 0 inside, Euclidean distance to its edge outside. */
export function plateauDistance(town: TownDef, x: number, z: number): number {
  const dx = x - town.x;
  const dz = z - town.z;
  const sy = Math.sin(town.heading);
  const cy = Math.cos(town.heading);
  const u = dx * sy + dz * cy;
  const v = dx * cy - dz * sy;
  const eu = Math.max(0, Math.abs(u) - town.halfU);
  const ev = Math.max(0, Math.abs(v) - town.halfV);
  return Math.hypot(eu, ev);
}

/** Unsigned distance from (x, z) to a street's centreline segment. */
export function streetDistance(s: Street, x: number, z: number): number {
  const dx = s.x1 - s.x0;
  const dz = s.z1 - s.z0;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - s.x0) * dx + (z - s.z0) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (s.x0 + dx * t), z - (s.z0 + dz * t));
}

/** True when (x, z) lies on a town street (within its half width). */
export function onTownStreet(town: TownDef, x: number, z: number): boolean {
  for (const s of town.streets) if (streetDistance(s, x, z) <= s.halfWidth) return true;
  return false;
}

/** Oriented-box colliders for every building and garden wall in the town; cones only mark a closed street. */
export function townObstacles(town: TownDef): BoxObstacle[] {
  const out: BoxObstacle[] = [];
  for (const b of town.buildings) out.push({ x: b.x, z: b.z, hx: b.hx, hz: b.hz, yaw: b.yaw });
  for (const w of town.walls) {
    const dx = w.x1 - w.x0;
    const dz = w.z1 - w.z0;
    out.push({
      x: (w.x0 + w.x1) / 2,
      z: (w.z0 + w.z1) / 2,
      hx: WALL_HALF,
      hz: Math.hypot(dx, dz) / 2,
      yaw: Math.atan2(dx, dz),
    });
  }
  // A barrier runs across its street: its length along the street's left.
  for (const b of town.barriers ?? [])
    out.push({ x: b.x, z: b.z, hx: BARRIER_HALF, hz: b.halfLength, yaw: b.yaw + Math.PI / 2 });
  return out;
}

/**
 * True where wild scenery must not grow: on or beside a street (pavement
 * and a strip), inside or against a building, or against a wall. The rest
 * of the town, yards behind the terraces and open corners, stays green.
 */
export function townBlocks(town: TownDef, x: number, z: number): boolean {
  if (town.roundabouts && roundaboutBlocks(town.roundabouts, x, z)) return true;
  for (const s of town.streets)
    if (streetDistance(s, x, z) < s.halfWidth + PAVEMENT_WIDTH + 3) return true;
  for (const b of town.buildings)
    if (Math.hypot(b.x - x, b.z - z) < Math.hypot(b.hx, b.hz) + 2) return true;
  for (const w of town.walls) if (segmentDistance(w.x0, w.z0, w.x1, w.z1, x, z) < 1.5) return true;
  return false;
}

export function segmentDistance(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  x: number,
  z: number,
) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - x0) * dx + (z - z0) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t));
}
/** A cone keeps this far clear of a tram bed's edge, so the trams pass between the cones. */
const CONE_CLEAR = 0.3;

/** Cones stand this far apart across a closed street. */
export const CONE_SPACING = 1.5;
/** Pavements stand this far above the carriageway, behind a vertical kerb face. */
export const KERB_LIFT = 0.1;
/** The physics surface climbs the kerb over this distance, so a wheel mounts it as a bump rather than a wall. */
export const KERB_RAMP = 0.3;
/** The route turns from the stage surface into town tarmac, verges into pavements, over this distance either side. */
export const TOWN_FADE = 40;

/** How far into the town the route is at path distance `along`: 0 on the open road, 1 inside, easing over `TOWN_FADE`. */
export function townFade(town: TownDef, along: number): number {
  const ease = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  return (
    ease(town.from - TOWN_FADE, town.from, along) * (1 - ease(town.to, town.to + TOWN_FADE, along))
  );
}
/**
 * Junction plates reach this far beyond the carriageway edge around the
 * polygon corner the route's arc cuts; side-street plates begin there, and
 * side-street decks follow the route's deck within it.
 */
export const JUNCTION_REACH = 8;
/** Lamp posts along the route's pavements, every `LAMP_SPACING` metres, alternating sides, none within a junction's reach plus `LAMP_JUNCTION_CLEAR`. */
export const LAMP_SPACING = 30;
const LAMP_JUNCTION_CLEAR = 4;
export const LAMP_OFFSET = 1.0;

/** Whatever answers the driving-surface height, usually the stage's `TerrainField`. */
export interface GroundQuery {
  /** The surface wheels ride on, kerbs included. */
  heightAt(x: number, z: number): number;
  /** The same surface without the pavements' kerb lift: what tarmac, kerb faces and pavements are built on. */
  deckAt(x: number, z: number): number;
}

/** World positions of a building's four footprint corners (local x is the left axis (cos, -sin), local z forward (sin, cos)). */
/** An oriented box on the ground: a building's footprint, or any other rectangle of ground laid out the same way. */
export type Footprint = Pick<Building, 'x' | 'z' | 'yaw' | 'hx' | 'hz'>;

export function buildingCorners(b: Footprint): [number, number][] {
  const sy = Math.sin(b.yaw);
  const cy = Math.cos(b.yaw);
  return (
    [
      [b.hx, b.hz],
      [-b.hx, b.hz],
      [b.hx, -b.hz],
      [-b.hx, -b.hz],
    ] as const
  ).map(([u, v]) => [b.x + u * cy + v * sy, b.z - u * sy + v * cy]);
}

/**
 * A building's foundation reaches this far below its base (the render kits
 * draw it 1.6 m down), so its front may stand this much over the pavement.
 */
const FOUNDATION_REACH = 1.5;

/** Where a catalog building's door meets its front, as wide as the building is drawn. */
export function buildingDoor(b: Building): { x: number; z: number } {
  const lx = DOOR_OFFSET[b.style] * (b.hx / BUILDING_SIZE[b.style].hx);
  const lz = -b.hz;
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
}

/**
 * Ground height at a building's front: the pavement its door opens onto.
 * Its terrace is levelled here, so the sill meets the street whatever the
 * hill does behind; on a steep street a door far off the middle of a wide
 * front is raised at most so far that the foundation still reaches the
 * pavement at the front's lower corner.
 */
export function buildingBaseHeight(b: Building, ground: GroundQuery): number {
  const [, , fr, fl] = buildingCorners(b);
  const door = buildingDoor(b);
  const low = Math.min(ground.deckAt(fr![0], fr![1]), ground.deckAt(fl![0], fl![1]));
  return Math.min(ground.deckAt(door.x, door.z), low + FOUNDATION_REACH) + KERB_LIFT;
}

/**
 * Terrace pads reach a little beyond a building's footprint (less along the
 * terrace, where the next house is only a party wall away) and blend out
 * over `TERRACE_BLEND`, short enough never to reach a neighbour's corner.
 */
export const TERRACE_MARGIN = 0.1;
export const TERRACE_BLEND = 0.2;
/** The pad starts this far behind the facade, so its blend never reaches the pavement. */
export const TERRACE_FRONT = 0.2;

/**
 * Render props for the town: one per building, one per cone, a
 * direction board per turn and lamp posts along the route's pavements, each
 * standing on the ground the field reports there (streets at deck height,
 * pavements a kerb higher).
 */
export function townProps(
  town: TownDef,
  ground: GroundQuery,
  treeKind: 'tree' | 'broadleaf' = 'tree',
): Prop[] {
  const out: Prop[] = [];
  for (const b of town.buildings) {
    const prop: Prop = {
      kind: b.style,
      x: b.x,
      y: buildingBaseHeight(b, ground),
      z: b.z,
      scale: 1,
      rotation: b.yaw,
      variant: b.variant,
    };
    // A city building stretched or narrowed to close its terrace is drawn that wide.
    const widen = b.hx / BUILDING_SIZE[b.style].hx;
    if (Math.abs(widen - 1) > 1e-3) prop.widen = widen;
    out.push(prop);
  }
  const trams = town.trams ?? [];
  for (const r of town.cones) {
    const n = Math.max(3, Math.round((2 * r.halfLength) / CONE_SPACING) + 1);
    const lx = Math.cos(r.yaw);
    const lz = -Math.sin(r.yaw);
    for (let i = 0; i < n; i++) {
      const o = -r.halfLength + (2 * r.halfLength * i) / (n - 1);
      const x = r.x + lx * o;
      const z = r.z + lz * o;
      // No cone on a tram bed: the trams run through the rows across their side streets.
      if (
        trams.some(
          (t) => segmentDistance(t.x0, t.z0, t.x1, t.z1, x, z) < TRAM_BED_HALF + CONE_CLEAR,
        )
      )
        continue;
      out.push({
        kind: 'cone',
        x,
        y: ground.deckAt(x, z),
        z,
        scale: 1,
        rotation: r.yaw,
        variant: 0,
      });
    }
  }
  for (const a of town.arrows)
    out.push({
      kind: a.turn > 0 ? 'arrowLeft' : 'arrowRight',
      x: a.x,
      y: ground.deckAt(a.x, a.z),
      z: a.z,
      scale: 1,
      rotation: a.yaw,
      variant: 0,
    });
  for (const p of town.plantings)
    out.push({
      kind: p.kind === 'tree' ? treeKind : 'bush',
      x: p.x,
      y: ground.heightAt(p.x, p.z),
      z: p.z,
      scale: p.scale,
      rotation: p.rotation,
      variant: p.variant,
    });
  // A city's lamps come with its street furniture (`StreetFurniture`); a village lays its own.
  let side = 1;
  for (const s of town.streets) {
    if (!s.route || town.city) continue;
    const dx = s.x1 - s.x0;
    const dz = s.z1 - s.z0;
    const len = Math.hypot(dx, dz);
    const heading = Math.atan2(dx, dz);
    const lx = Math.cos(heading);
    const lz = -Math.sin(heading);
    for (let d = LAMP_SPACING / 2; d < len - 8; d += LAMP_SPACING) {
      const off = (s.halfWidth + LAMP_OFFSET) * side;
      const x = s.x0 + (dx / len) * d + lx * off;
      const z = s.z0 + (dz / len) * d + lz * off;
      // Not in a junction's mouth (a crossroads part-way along the street paves the pavement's line
      // there), nor on or beside another street.
      if (
        town.junctions.some(
          (j) =>
            Math.hypot(j.x - x, j.z - z) < junctionReach(j) + s.halfWidth + LAMP_JUNCTION_CLEAR,
        ) ||
        town.streets.some(
          (o) => o !== s && !o.route && streetDistance(o, x, z) < o.halfWidth + PAVEMENT_WIDTH + 1,
        )
      )
        continue;
      // The arm (local -x) reaches back over the street from whichever pavement the post stands on.
      out.push({
        kind: 'lamp',
        x,
        y: ground.deckAt(x, z) + KERB_LIFT,
        z,
        scale: 1,
        rotation: side > 0 ? heading : heading + Math.PI,
        variant: 0,
      });
      side = -side;
    }
  }
  return out;
}
