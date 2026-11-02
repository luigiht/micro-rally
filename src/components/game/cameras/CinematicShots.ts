import { mulberry32, pickWeighted } from '@/game/rng';
import { createRoadHit, type RoadSample } from '@/game/stage/RoadPath';
import { halfWidthAt, type RoadWidthSource } from '@/game/stage/RoadWidth';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';

/**
 * Shot library and director for the cinematic camera: pure data and maths,
 * applied to a three.js camera by `CinematicCameraRig`.
 *
 * The coverage follows rally broadcast practice. Trackside TV cameras carry
 * most of it: each is a fixed camera beside the road ahead of the car that
 * pans with it and zooms with its distance (an 18°–50° lens) until the car
 * has passed. A helicopter, a low chase car, a camera car alongside and a
 * reverse tracking shot from ahead break the trackside run up. Cuts keep to
 * two editing rules: the 180° rule, under which every camera in a scene
 * stands on one side of the car's line of travel, the side changing only
 * across a shot that sits on the line or high above it (the reverse and the
 * helicopter); and the 30° rule, under which a cut moves the camera at
 * least 30° round or above the car, so no cut reads as a jump.
 */

export type ShotKind = 'trackside' | 'helicopter' | 'lowChase' | 'sideDolly' | 'frontReverse';

export const SHOT_KINDS: readonly ShotKind[] = [
  'trackside',
  'helicopter',
  'lowChase',
  'sideDolly',
  'frontReverse',
];

export interface Shot {
  kind: ShotKind;
  /** Side of the car's line of travel the camera stands on: +1 left, -1 right. */
  side: 1 | -1;
  /** Seconds the shot holds at most. */
  duration: number;
  /** A fixed camera's world position (trackside), lifted clear of the terrain between it and the car. */
  x: number;
  y: number;
  z: number;
  /** A tracking camera's offset in the car's travel frame: metres behind, to the left and above the body. */
  back: number;
  lateral: number;
  up: number;
  /** Where the camera looks: metres ahead of the car along its travel, and above its body. */
  aimAhead: number;
  aimUp: number;
  /** Lens, degrees. A tracking shot holds `fov`; a fixed camera zooms between `minFov` and `maxFov` with the car's distance. */
  fov: number;
  minFov: number;
  maxFov: number;
  /** Helicopter: how fast it circles the car, rad/s, signed. */
  orbit: number;
}

export interface Pt3 {
  x: number;
  y: number;
  z: number;
}

export interface Director {
  rand: () => number;
  previous: ShotKind | null;
  /** Trackside cameras in a row so far. */
  tracksideRun: number;
  /** Shots since the helicopter last flew. */
  sinceHelicopter: number;
  /** Side of the line of travel the scene is shot from. */
  side: 1 | -1;
}

export function createDirector(seed: number): Director {
  const rand = mulberry32(seed);
  return {
    rand,
    previous: null,
    tracksideRun: 0,
    sinceHelicopter: 99,
    side: rand() < 0.5 ? -1 : 1,
  };
}

/** Relative frequency of each shot. */
const WEIGHTS: Readonly<Record<ShotKind, number>> = {
  trackside: 4,
  helicopter: 1.5,
  lowChase: 1.5,
  sideDolly: 1.5,
  frontReverse: 1,
};
/** Trackside cameras may follow one another this many times: a run of TV cameras down the road. */
const MAX_TRACKSIDE_RUN = 2;
/** The helicopter flies at most once in this many shots. */
const HELICOPTER_REST = 3;
/** Below this speed the car reaches no trackside camera, so those are rarer. */
const SLOW = 5;
const SLOW_TRACKSIDE = 0.3;
/** A cut that moves the camera less than this round and above the car is a jump cut. */
const JUMP_CUT = Math.PI / 6;
/** Trackside cameras stand this far ahead: 40 m standing, 1.6 m more per m/s, up to 110 m. */
const AHEAD_MIN = 40;
const AHEAD_PER_SPEED = 1.6;
const AHEAD_MAX = 110;
/** Road half width assumed off the stage (the test track). */
const OPEN_HALF_WIDTH = 4;
/** Trackside cameras stand this far off the carriageway edge: on the verge, inside the 3 m the scenery keeps clear of trees. */
const VERGE_MIN = 1.2;
const VERGE_SPAN = 1.6;
/** The sight line from a fixed camera clears the terrain by this much, checked at this many points. */
const SIGHT_CLEARANCE = 0.6;
const SIGHT_SAMPLES = 10;
/** Under reduced motion shots hold this much longer, so the view cuts less often. */
const REDUCED_HOLD = 1.4;

export function isFixed(kind: ShotKind): boolean {
  return kind === 'trackside';
}

/** Shots on the line of travel or high above it; the scene may change sides across them. */
export function isNeutral(kind: ShotKind): boolean {
  return kind === 'helicopter' || kind === 'frontReverse';
}

export function wrapAngle(a: number): number {
  let d = a % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** The car's direction of travel: its yaw, leaning half way to where it is actually going when it slides. */
export function travelHeading(t: Readonly<VehiclePose>): number {
  if (Math.abs(t.speed) < 3) return t.yaw;
  return t.yaw + wrapAngle(Math.atan2(t.vx, t.vz) - t.yaw) * 0.5;
}

/** World position of a tracking camera for a travel heading and helicopter orbit phase; `scale` is the wheel zoom. */
export function trackingPosition(
  shot: Shot,
  t: Readonly<VehiclePose>,
  heading: number,
  phase: number,
  scale: number,
  out: Pt3,
): Pt3 {
  // Travel frame: x to the left, z forward; the orbit turns the offset about the car.
  const ox = shot.lateral * scale;
  const oz = -shot.back * scale;
  const c = Math.cos(phase);
  const s = Math.sin(phase);
  const rx = ox * c - oz * s;
  const rz = ox * s + oz * c;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  out.x = t.x + fx * rz + fz * rx;
  out.y = t.y + shot.up * scale;
  out.z = t.z + fz * rz - fx * rx;
  return out;
}

/** Where a shot's camera stands as it opens. */
export function openingPosition(shot: Shot, t: Readonly<VehiclePose>, out: Pt3): Pt3 {
  if (isFixed(shot.kind)) {
    out.x = shot.x;
    out.y = shot.y;
    out.z = shot.z;
    return out;
  }
  return trackingPosition(shot, t, travelHeading(t), 0, 1, out);
}

/** Bearing (world yaw from the car to a point) and elevation of the point above the car. */
export function anglesFrom(
  t: Readonly<VehiclePose>,
  p: Pt3,
): { bearing: number; elevation: number } {
  const dx = p.x - t.x;
  const dz = p.z - t.z;
  return { bearing: Math.atan2(dx, dz), elevation: Math.atan2(p.y - t.y, Math.hypot(dx, dz)) };
}

const tmp: Pt3 = { x: 0, y: 0, z: 0 };

/** True when cutting from a camera at `from` to `shot` would move it less than 30° round and above the car. */
function jumpCut(from: Pt3, shot: Shot, t: Readonly<VehiclePose>): boolean {
  const a = anglesFrom(t, from);
  const b = anglesFrom(t, openingPosition(shot, t, tmp));
  return (
    Math.abs(wrapAngle(b.bearing - a.bearing)) < JUMP_CUT &&
    Math.abs(b.elevation - a.elevation) < JUMP_CUT
  );
}

function pickKind(d: Director, slow: boolean, banned: ReadonlySet<ShotKind>): ShotKind | null {
  const items: [ShotKind, number][] = [];
  for (const kind of SHOT_KINDS) {
    if (banned.has(kind)) continue;
    let w = WEIGHTS[kind];
    if (kind === 'trackside') {
      if (d.tracksideRun >= MAX_TRACKSIDE_RUN) continue;
      if (slow) w *= SLOW_TRACKSIDE;
    } else if (kind === d.previous) continue;
    if (kind === 'helicopter' && d.sinceHelicopter < HELICOPTER_REST) continue;
    items.push([kind, w]);
  }
  return items.length ? pickWeighted(d.rand, items) : null;
}

/**
 * The next shot. `from` is where the camera stands as the cut happens (null
 * for the first shot); the 30° rule is measured against it, and a candidate
 * that would read as a jump cut is dropped for another kind.
 */
export function nextShot(
  d: Director,
  t: Readonly<VehiclePose>,
  from: Pt3 | null,
  road: RoadWidthSource | null,
  terrain: TerrainQuery,
  bodyScale: number,
  reducedMotion: boolean,
): Shot {
  const slow = Math.abs(t.speed) < SLOW;
  if ((d.previous === null || isNeutral(d.previous)) && d.rand() < 0.5)
    d.side = d.side === 1 ? -1 : 1;
  const banned = new Set<ShotKind>();
  const first = pickKind(d, slow, banned) ?? 'trackside';
  let shot = place(first, d, t, road, terrain, bodyScale, reducedMotion);
  while (from && jumpCut(from, shot, t)) {
    banned.add(shot.kind);
    const kind = pickKind(d, slow, banned);
    if (kind === null) break;
    shot = place(kind, d, t, road, terrain, bodyScale, reducedMotion);
  }
  d.previous = shot.kind;
  d.tracksideRun = shot.kind === 'trackside' ? d.tracksideRun + 1 : 0;
  d.sinceHelicopter = shot.kind === 'helicopter' ? 0 : d.sinceHelicopter + 1;
  return shot;
}

interface RoadPoint {
  x: number;
  z: number;
  heading: number;
  halfWidth: number;
}

const sample: RoadSample = { x: 0, z: 0, heading: 0 };
const hit = createRoadHit();
const roadPoint: RoadPoint = { x: 0, z: 0, heading: 0, halfWidth: OPEN_HALF_WIDTH };

/** The road `ahead` metres along the car's travel: on the stage's centreline when there is one, else straight ahead. */
function roadAhead(
  t: Readonly<VehiclePose>,
  road: RoadWidthSource | null,
  ahead: number,
  out: RoadPoint,
): RoadPoint {
  const h = travelHeading(t);
  if (road && road.path.nearest(t.x, t.z, 60, hit)) {
    // Travelling with the stage, or back down it.
    const dir = Math.cos(wrapAngle(h - road.path.headings[hit.index]!)) >= 0 ? 1 : -1;
    const along = hit.along + dir * ahead;
    road.path.sample(along, sample);
    out.x = sample.x;
    out.z = sample.z;
    out.heading = dir > 0 ? sample.heading : sample.heading + Math.PI;
    out.halfWidth = halfWidthAt(road, along);
    return out;
  }
  out.x = t.x + Math.sin(h) * ahead;
  out.z = t.z + Math.cos(h) * ahead;
  out.heading = h;
  out.halfWidth = OPEN_HALF_WIDTH;
  return out;
}

/** Lift a camera at (x, y, z) until its sight line to the target clears the terrain between them. */
function clearSight(
  terrain: TerrainQuery,
  x: number,
  y: number,
  z: number,
  tx: number,
  ty: number,
  tz: number,
): number {
  for (let k = 1; k < SIGHT_SAMPLES; k++) {
    const f = k / SIGHT_SAMPLES;
    const ground = terrain.heightAt(x + (tx - x) * f, z + (tz - z) * f) + SIGHT_CLEARANCE;
    if (ground > y + (ty - y) * f) y = (ground - ty * f) / (1 - f);
  }
  return y;
}

function place(
  kind: ShotKind,
  d: Director,
  t: Readonly<VehiclePose>,
  road: RoadWidthSource | null,
  terrain: TerrainQuery,
  bodyScale: number,
  reducedMotion: boolean,
): Shot {
  const r = d.rand;
  const side = d.side;
  const hold = reducedMotion ? REDUCED_HOLD : 1;
  const base: Shot = {
    kind,
    side,
    duration: 0,
    x: 0,
    y: 0,
    z: 0,
    back: 0,
    lateral: 0,
    up: 0,
    aimAhead: 0,
    aimUp: 0,
    fov: 50,
    minFov: 50,
    maxFov: 50,
    orbit: 0,
  };
  switch (kind) {
    case 'trackside': {
      // A TV camera on the verge ahead, low on its tripod or, now and then, high on a crane or a bank.
      const ahead = Math.min(AHEAD_MAX, AHEAD_MIN + Math.abs(t.speed) * AHEAD_PER_SPEED);
      const p = roadAhead(t, road, ahead, roadPoint);
      const off = (p.halfWidth + VERGE_MIN + r() * VERGE_SPAN) * side;
      const x = p.x + Math.cos(p.heading) * off;
      const z = p.z - Math.sin(p.heading) * off;
      const high = r() < 0.3;
      let y = terrain.heightAt(x, z) + (high ? 7 + r() * 5 : 1.6 + r() * 1.6);
      y = clearSight(terrain, x, y, z, t.x, t.y + 0.8, t.z);
      y = clearSight(terrain, x, y, z, p.x, terrain.heightAt(p.x, p.z) + 0.8, p.z);
      const fixedFov = 38;
      return {
        ...base,
        duration: 9 * hold,
        x,
        y,
        z,
        aimUp: 0.5,
        fov: fixedFov,
        minFov: reducedMotion ? fixedFov : 14,
        maxFov: reducedMotion ? fixedFov : 50,
      };
    }
    case 'helicopter':
      return {
        ...base,
        duration: (7 + r() * 3) * hold,
        back: (6 + r() * 10) * bodyScale,
        lateral: side * (12 + r() * 12) * bodyScale,
        up: (10 + r() * 8) * bodyScale,
        aimAhead: 5,
        fov: 30,
        minFov: 30,
        maxFov: 30,
        orbit: reducedMotion ? 0 : side * (0.08 + r() * 0.06),
      };
    case 'lowChase':
      // Bumper height behind and beside the car, aimed up the road past it.
      return {
        ...base,
        duration: (4 + r() * 2) * hold,
        back: (6 + r() * 2) * bodyScale,
        lateral: side * (1.6 + r() * 1.4) * bodyScale,
        up: 0.1 * bodyScale,
        aimAhead: 12,
        aimUp: 0.3,
        fov: 60,
        minFov: 60,
        maxFov: 60,
      };
    case 'sideDolly':
      // A camera car alongside, the car in the near third of the frame and the road ahead beyond it.
      return {
        ...base,
        duration: (4 + r() * 2) * hold,
        back: (-1 + r() * 3) * bodyScale,
        lateral: side * (5.5 + r() * 2.5) * bodyScale,
        up: (0.9 + r() * 0.6) * bodyScale,
        aimAhead: 2,
        aimUp: 0.4,
        fov: 52,
        minFov: 52,
        maxFov: 52,
      };
    case 'frontReverse':
      // Backing away ahead of the car, looking at its nose.
      return {
        ...base,
        duration: (4 + r() * 1.5) * hold,
        back: -(7 + r() * 3) * bodyScale,
        lateral: side * (0.6 + r() * 1.4) * bodyScale,
        up: (0.9 + r() * 0.8) * bodyScale,
        aimAhead: 0.5,
        aimUp: 0.5,
        fov: 46,
        minFov: 46,
        maxFov: 46,
      };
  }
}
