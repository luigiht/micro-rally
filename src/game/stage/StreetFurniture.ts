import { hashSeed, mulberry32 } from '../rng';
import { DOOR_OFFSET } from './BuildingCatalog';
import { onMedian } from './Median';
import type { RoadSample } from './RoadPath';
import { halfWidthAt, type RoadWidthSource } from './RoadWidth';
import { handoffRadius, onRoundabout } from './Roundabout';
import type { Prop } from './SceneryScatter';
import { SpatialHash } from './SpatialHash';
import {
  KERB_LIFT,
  LAMP_OFFSET,
  LAMP_SPACING,
  PAVEMENT_WIDTH,
  streetDistance,
  type Building,
  type GroundQuery,
  type Street,
  type TownDef,
} from './Town';
import { junctionReach, offsetCorner, stubCut } from './TownJunctions';
import { junctionKerbs } from './TownKerbs';

/**
 * A city's street furniture, as props. Every street, route and side street
 * alike, carries the same rhythm on both pavements: a street tree in its
 * kerbed pit every `TREE_SPACING` metres on each side (shifted a little
 * where a door or a mouth is in the way, so the row stays unbroken), and
 * between the trees a lamp every `LAMP_SPACING` metres alternating sides,
 * with a bench, a bin, a hydrant or a bollard on the pavement opposite each
 * lamp; traffic lights at every junction's corners; manhole covers down the
 * carriageway. Pure data worked out from the town and the route, like
 * `Crossings`.
 */
const TREE_SPACING = LAMP_SPACING / 2;
/** A tree whose spot is taken tries these shifts along the street before the row goes without it. */
const TREE_SHIFTS = [0, 2, -2, 3.5, -3.5] as const;
/** Pavement furniture clears a junction's paving by this much along the route, and a ring's hand-off. */
const JUNCTION_CLEAR = 4;
const RING_CLEAR = 2;
/** Nothing but a lamp or a bollard stands within this of a building's door. */
const DOOR_CLEAR = 2.0;
interface Pt {
  x: number;
  z: number;
}
/** Street grid cell for the mouth checks. */
const STREET_CELL = 32;
/** Where each kind stands across the pavement, from the carriageway edge. */
const ACROSS: Record<FurnitureKind, number> = {
  lamp: LAMP_OFFSET,
  treePit: 1.6,
  bench: 2.0,
  bin: 1.2,
  hydrant: 0.8,
  bollard: 0.6,
};
const WEIGHTS: readonly (readonly [FurnitureKind, number])[] = [
  ['bench', 3],
  ['bin', 3],
  ['hydrant', 1],
  ['bollard', 1],
];
/** Side streets carry the rhythm from past their junction's cut to short of their end. */
const SIDE_FROM = 6;
const SIDE_END = 6;
/** The route's streets carry it from their start to short of their end (the corner arcs take over). */
const ROUTE_END = 8;
/** Traffic lights stand this far outside each arm's carriageway at the corner between two arms. */
const LIGHT_ACROSS = 2.4;
/** Manholes down the route: this often, this far off the axis, kept this far from junction paving and trams. */
const MANHOLE_SPACING = 40;
const MANHOLE_LATERAL = 1.2;
const MANHOLE_JUNCTION_CLEAR = 6;
const MANHOLE_TRAM_CLEAR = 3;

type FurnitureKind = 'lamp' | 'treePit' | 'bench' | 'bin' | 'hydrant' | 'bollard';

/** A building's door in the world. */
function doorAt(b: Building): { x: number; z: number } {
  const lx = DOOR_OFFSET[b.style];
  const lz = -b.hz;
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
}

const prop = (
  kind: Prop['kind'],
  x: number,
  y: number,
  z: number,
  rotation: number,
  scale = 1,
  variant = 0,
): Prop => ({ kind, x, y, z, scale, rotation, variant });

export function streetFurniture(
  town: TownDef,
  stage: RoadWidthSource,
  ground: GroundQuery,
  seed: number,
): Prop[] {
  const out: Prop[] = [];
  const rand = mulberry32(hashSeed(seed, 'furniture'));
  const rings = town.roundabouts ?? [];
  // Doors and streets gridded, so each candidate checks the few round it rather than the city's thousands.
  const doors = new SpatialHash<Pt>(DOOR_CLEAR);
  for (const b of town.buildings) {
    const d = doorAt(b);
    doors.insert(d, d.x, d.z);
  }
  const nearDoor = (x: number, z: number) =>
    doors.near(x, z, DOOR_CLEAR, (d) => Math.hypot(d.x - x, d.z - z) < DOOR_CLEAR);
  const streets = new SpatialHash<Street>(STREET_CELL);
  for (const o of town.streets) {
    const reach = o.halfWidth + PAVEMENT_WIDTH + 1;
    const n = Math.max(1, Math.ceil(Math.hypot(o.x1 - o.x0, o.z1 - o.z0) / (STREET_CELL / 2)));
    for (let i = 0; i <= n; i++)
      streets.insert(o, o.x0 + ((o.x1 - o.x0) * i) / n, o.z0 + ((o.z1 - o.z0) * i) / n, reach);
  }
  const inMouth = (st: Street, x: number, z: number) =>
    town.junctions.some(
      (j) => Math.hypot(j.x - x, j.z - z) < junctionReach(j) + st.halfWidth + JUNCTION_CLEAR,
    ) ||
    streets.near(
      x,
      z,
      0,
      (o) =>
        o !== st &&
        !(o.route && st.route) &&
        streetDistance(o, x, z) < o.halfWidth + PAVEMENT_WIDTH + 1,
    ) ||
    rings.some((r) => Math.hypot(r.x - x, r.z - z) < handoffRadius(r) + RING_CLEAR);
  const pick = (): FurnitureKind => {
    let total = 0;
    for (const [, w] of WEIGHTS) total += w;
    let r = rand() * total;
    for (const [k, w] of WEIGHTS) {
      r -= w;
      if (r <= 0) return k;
    }
    return 'bench';
  };
  // A piece on a pavement: on the kerb-high ground, turned so its -z faces the carriageway on `side`.
  const place = (
    kind: FurnitureKind,
    st: Street,
    d: number,
    side: 1 | -1,
    heading: number,
  ): boolean => {
    const lx = Math.cos(heading);
    const lz = -Math.sin(heading);
    const off = (st.halfWidth + ACROSS[kind]) * side;
    const x = st.x0 + Math.sin(heading) * d + lx * off;
    const z = st.z0 + Math.cos(heading) * d + lz * off;
    if (inMouth(st, x, z)) return false;
    if (kind !== 'lamp' && kind !== 'bollard' && nearDoor(x, z)) return false;
    const y = ground.deckAt(x, z) + KERB_LIFT;
    // Facing the road: a yaw r points local -z along (-sin r, -cos r); from the left pavement the
    // road lies to the right of travel, (-cos h, sin h), so r = h + π/2; from the right, h - π/2.
    const facing = side > 0 ? heading + Math.PI / 2 : heading - Math.PI / 2;
    if (kind === 'lamp') {
      // The arm (local -x) reaches back over the street from whichever pavement the post stands on.
      out.push(prop('lamp', x, y, z, side > 0 ? heading : heading + Math.PI));
      return true;
    }
    out.push(prop(kind, x, y, z, facing));
    if (kind === 'treePit')
      out.push(
        prop('broadleaf', x, y, z, rand() * Math.PI * 2, 0.75 + rand() * 0.2, rand() < 0.5 ? 0 : 1),
      );
    return true;
  };
  let lampSide: 1 | -1 = 1;
  for (const st of town.streets) {
    const dx = st.x1 - st.x0;
    const dz = st.z1 - st.z0;
    const len = Math.hypot(dx, dz);
    const heading = Math.atan2(dx, dz);
    // The stretch the rhythm runs over: a route street from its start, a side street from past its
    // junction's cut; both stop short of their far end.
    let from = 0;
    let to = len - ROUTE_END;
    if (!st.route) {
      const j = town.junctions.find((q) => Math.hypot(q.x - st.x0, q.z - st.z0) < 1e-3);
      const arm = j?.arms.find(
        (a) => a.role === 'blocked' && Math.abs(wrap(a.heading - heading)) < 0.01,
      );
      from = (j && arm ? stubCut(j, arm, stage.halfWidth) : st.halfWidth + 8) + SIDE_FROM;
      to = len - SIDE_END;
    }
    if (to - from < TREE_SPACING / 2) continue;
    // Trees on both pavements, midway between the lamp marks, shifted a little where something is in the way.
    for (let d = from + TREE_SPACING / 2; d < to; d += TREE_SPACING)
      for (const side of [1, -1] as const)
        for (const shift of TREE_SHIFTS)
          if (d + shift > from && d + shift < to && place('treePit', st, d + shift, side, heading))
            break;
    // Lamps every other mark, alternating sides, with a small piece on the pavement opposite.
    for (let d = from + TREE_SPACING; d < to; d += TREE_SPACING) {
      place('lamp', st, d, lampSide, heading);
      place(pick(), st, d, lampSide > 0 ? -1 : 1, heading);
      lampSide = lampSide > 0 ? -1 : 1;
    }
  }
  // Traffic lights at every corner of every junction with a side street, facing the junction.
  for (const j of town.junctions) {
    if (!j.arms.some((a) => a.role === 'blocked')) continue;
    const arms = [...j.arms].sort((p, q) => wrap0(p.heading) - wrap0(q.heading));
    for (let i = 0; i < arms.length; i++) {
      const a = arms[i]!;
      const b = arms[(i + 1) % arms.length]!;
      if (a.role !== 'blocked' && b.role !== 'blocked') continue;
      const c = offsetCorner(j, a, b, a.halfWidth + LIGHT_ACROSS, b.halfWidth + LIGHT_ACROSS);
      if (ground.heightAt(c.x, c.z) - ground.deckAt(c.x, c.z) < KERB_LIFT * 0.5) continue;
      out.push(
        prop(
          'trafficLight',
          c.x,
          ground.deckAt(c.x, c.z) + KERB_LIFT,
          c.z,
          Math.atan2(j.x - c.x, j.z - c.z) + Math.PI,
        ),
      );
    }
  }
  // Manhole covers down the route, off the axis, clear of junction paving, medians and tram beds.
  const zones: [number, number][] = [];
  for (const j of town.junctions) {
    const kerbs = junctionKerbs(j, stage, stage.halfWidth);
    const all = [...kerbs.openings.left, ...kerbs.openings.right];
    if (all.length)
      zones.push([Math.min(...all.map((o) => o.from)), Math.max(...all.map((o) => o.to))]);
  }
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const trams = town.trams ?? [];
  let lat = 1;
  for (let d = town.from + MANHOLE_SPACING / 2; d < town.to; d += MANHOLE_SPACING, lat = -lat) {
    if (
      zones.some((z) => z && d > z[0] - MANHOLE_JUNCTION_CLEAR && d < z[1] + MANHOLE_JUNCTION_CLEAR)
    )
      continue;
    if (onRoundabout(rings, d, 2 * stage.halfWidth)) continue;
    stage.path.sample(d, sample);
    const e = MANHOLE_LATERAL * lat;
    const x = sample.x + Math.cos(sample.heading) * e;
    const z = sample.z - Math.sin(sample.heading) * e;
    if (Math.abs(e) > halfWidthAt(stage, d) - 1) continue;
    if (onMedian(town.medians ?? [], x, z)) continue;
    if (trams.some((t) => segmentDistance(t.x0, t.z0, t.x1, t.z1, x, z) < MANHOLE_TRAM_CLEAR))
      continue;
    out.push(prop('manhole', x, ground.deckAt(x, z), z, sample.heading));
  }
  return out;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const wrap0 = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

function segmentDistance(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  x: number,
  z: number,
): number {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len2 = dx * dx + dz * dz;
  let u = len2 > 0 ? ((x - x0) * dx + (z - z0) * dz) / len2 : 0;
  u = Math.min(1, Math.max(0, u));
  return Math.hypot(x - (x0 + dx * u), z - (z0 + dz * u));
}
