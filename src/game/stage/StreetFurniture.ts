import { hashSeed, mulberry32 } from '../rng';
import { onMedian } from './Median';
import { createRoadHit, type RoadSample } from './RoadPath';
import { halfWidthAt, type RoadWidthSource } from './RoadWidth';
import { handoffRadius, onRoundabout } from './Roundabout';
import type { Prop } from './SceneryScatter';
import { SpatialHash } from './SpatialHash';
import {
  buildingDoor,
  KERB_LIFT,
  LAMP_OFFSET,
  LAMP_SPACING,
  PAVEMENT_WIDTH,
  streetDistance,
  type GroundQuery,
  type Street,
  type TownDef,
} from './Town';
import { junctionReach, offsetCorner, stubCut } from './TownJunctions';
import { junctionKerbs } from './TownKerbs';

/**
 * A city's street furniture, as props. Every street, route and side street
 * alike, carries the same rhythm on both pavements, block by block: street
 * trees in kerbed pits spread evenly along each stretch between junctions
 * (about `TREE_SPACING` apart, the same spots on both sides), and between
 * them a lamp every other gap alternating sides, with a bench, a bin, a
 * hydrant or a bollard on the pavement opposite each lamp; bushes down the
 * boulevards' green dividers; traffic lights at every junction's corners;
 * manhole covers down the carriageway. Pure data worked out from the town
 * and the route, like `Crossings`.
 */
/** Street trees line every pavement about this often, a lamp every other gap between them. */
const TREE_SPACING = LAMP_SPACING / 4;
/**
 * Street trees in six species (`CityGreenKits` draws them, all in greens):
 * round lime, oval hornbeam, layered plane, slim column, and now and then a
 * pale birch or a dark holm oak. A stretch of street is mostly one species,
 * `OTHER_SPECIES` of its trees another; each species at its own size.
 */
export const STREET_TREE_SPECIES = 6;
const SPECIES_WEIGHTS = [4, 3, 3, 2, 0.6, 0.6] as const;
const TREE_SIZE = [0.85, 0.85, 0.8, 0.9, 0.75, 0.8] as const;
const OTHER_SPECIES = 0.15;

function pickSpecies(rand: () => number): number {
  const total = SPECIES_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < SPECIES_WEIGHTS.length; i++) {
    r -= SPECIES_WEIGHTS[i]!;
    if (r <= 0) return i;
  }
  return 0;
}

/**
 * Median shrubs in five shapes, all in shades of green: round bush,
 * hedge mound, small conifer, leafy bush, grass clump; each divider planted
 * to one scheme, repeated down its length, each shape at its own size
 * range, with tall grass in the gaps between them.
 */
export const SHRUB_SHAPES = 5;
const HEDGE_MOUND = 1;
const MEDIAN_SCHEMES: readonly (readonly number[])[] = [
  [0],
  [1],
  [2, 0],
  [3, 0, 3],
  [4, 1],
  [2, 4],
];
const SHRUB_SCALE: readonly (readonly [number, number])[] = [
  [0.38, 0.52],
  [0.45, 0.55],
  [0.45, 0.65],
  [0.38, 0.48],
  [0.55, 0.85],
];

/** Tall grass between a median's shrubs: this many tufts a gap, up to this far off its middle, sunk this much into the turf. */
const MEDIAN_GRASS = 2;
const MEDIAN_GRASS_ASIDE = 0.15;
const GRASS_SINK = 0.05;

/** Shrubs stand down a median's middle about this far apart, this far in from its ends. */
const MEDIAN_BUSH_SPACING = 6;
const MEDIAN_BUSH_END = 2;
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
/** Traffic lights stand this far outside each arm's carriageway at the corner between two arms, and none this near a rail (a tram loop's curve can cut a corner). */
const LIGHT_ACROSS = 2.4;
const LIGHT_TRAM_CLEAR = 1.5;
/** Manholes down the route: this often, this far off the axis, kept this far from junction paving and trams. */
const MANHOLE_SPACING = 40;
const MANHOLE_LATERAL = 1.2;
const MANHOLE_JUNCTION_CLEAR = 6;
const MANHOLE_TRAM_CLEAR = 3;

type FurnitureKind = 'lamp' | 'treePit' | 'bench' | 'bin' | 'hydrant' | 'bollard';

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
  const hit = createRoadHit();
  const rings = town.roundabouts ?? [];
  // Doors and streets gridded, so each candidate checks the few round it rather than the city's thousands.
  const doors = new SpatialHash<Pt>(DOOR_CLEAR);
  for (const b of town.buildings) {
    const d = buildingDoor(b);
    doors.insert(d, d.x, d.z);
  }
  for (const f of town.infills ?? []) for (const d of f.doors ?? []) doors.insert(d, d.x, d.z);
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
    const ax = st.x0 + Math.sin(heading) * d;
    const az = st.z0 + Math.cos(heading) * d;
    // On the route the pavement follows the ribbon's actual edge, which tapers before a junction.
    const hw =
      st.route && stage.path.nearest(ax, az, 10, hit)
        ? halfWidthAt(stage, hit.along)
        : st.halfWidth;
    const off = (hw + ACROSS[kind]) * side;
    const x = ax + lx * off;
    const z = az + lz * off;
    if (inMouth(st, x, z)) return false;
    // Off the doors (a tree there is left out, so the rest keep their spots).
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
    if (kind === 'treePit') {
      // Mostly the stretch's own species, now and then another; each a little bigger or smaller.
      const species = rand() < OTHER_SPECIES ? pickSpecies(rand) : stretchSpecies;
      const size = TREE_SIZE[species]! * (0.85 + rand() * 0.3);
      out.push(prop('streetTree', x, y, z, rand() * Math.PI * 2, size, species));
    }
    return true;
  };
  let stretchSpecies = 0;
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
    // The stretches between the junctions on the street, each with its own even rhythm.
    for (const [a, b] of freeStretches(town, st, from, to)) {
      const n = Math.round((b - a) / TREE_SPACING);
      if (n < 1) continue;
      stretchSpecies = pickSpecies(rand);
      const step = (b - a) / n;
      // A tree in the middle of every step, the same spots on both pavements.
      for (let i = 0; i < n; i++)
        for (const side of [1, -1] as const)
          place('treePit', st, a + (i + 0.5) * step, side, heading);
      // A lamp on every other step's end between the trees, alternating sides, a small piece opposite.
      for (let i = 2; i < n; i += 2) {
        place('lamp', st, a + i * step, lampSide, heading);
        place(pick(), st, a + i * step, lampSide > 0 ? -1 : 1, heading);
        lampSide = lampSide > 0 ? -1 : 1;
      }
    }
  }
  // Shrubs down the middle of every boulevard's green divider, evenly spaced, clear of its ends,
  // each divider planted to one of the schemes.
  for (const m of town.medians ?? []) {
    const len = Math.hypot(m.x1 - m.x0, m.z1 - m.z0);
    const n = Math.floor((len - 2 * MEDIAN_BUSH_END) / MEDIAN_BUSH_SPACING);
    if (n < 1) continue;
    const span = (len - 2 * MEDIAN_BUSH_END) / n;
    const scheme = MEDIAN_SCHEMES[Math.floor(rand() * MEDIAN_SCHEMES.length)]!;
    const along = Math.atan2(m.x1 - m.x0, m.z1 - m.z0);
    for (let i = 0; i <= n; i++) {
      const t = (MEDIAN_BUSH_END + i * span) / len;
      const x = m.x0 + (m.x1 - m.x0) * t;
      const z = m.z0 + (m.z1 - m.z0) * t;
      const shape = scheme[i % scheme.length]!;
      const [lo, hi] = SHRUB_SCALE[shape]!;
      // A hedge mound's length (its local x) lies along the divider, either way round; the rest
      // stand any way round.
      const yaw =
        shape === HEDGE_MOUND
          ? along + (rand() < 0.5 ? 0.5 : -0.5) * Math.PI
          : rand() * Math.PI * 2;
      out.push(prop('shrub', x, ground.heightAt(x, z), z, yaw, lo + rand() * (hi - lo), shape));
      // Tall grass in the gap before the next shrub, a tuft or two off the middle.
      if (i === n) continue;
      const across = { x: Math.cos(along), z: -Math.sin(along) };
      for (let k = 0; k < MEDIAN_GRASS; k++) {
        const g = (MEDIAN_BUSH_END + (i + (k + 1) / (MEDIAN_GRASS + 1)) * span) / len;
        const off = (rand() - 0.5) * 2 * MEDIAN_GRASS_ASIDE;
        const gx = m.x0 + (m.x1 - m.x0) * g + across.x * off;
        const gz = m.z0 + (m.z1 - m.z0) * g + across.z * off;
        out.push({
          kind: 'grass',
          x: gx,
          y: ground.heightAt(gx, gz) - GRASS_SINK,
          z: gz,
          scale: 0.5 + rand() * 0.2,
          stretch: 0.8 + rand() * 0.4,
          // Kept in [0, 2π): the renderer shades tall grass by its heading.
          rotation: rand() * Math.PI * 2,
          // The two green tints only, none of the straw.
          variant: rand() < 0.5 ? 0 : 1,
        });
      }
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
      const rails = town.trams ?? [];
      if (rails.some((t) => segmentDistance(t.x0, t.z0, t.x1, t.z1, c.x, c.z) < LIGHT_TRAM_CLEAR))
        continue;
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
  // Manhole covers down the route, off the axis, clear of junction paving, kerb ramps, medians and tram beds.
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
    // A cover lies flat on the carriageway: none where a kerb's ramp (a junction corner) lifts it.
    const deck = ground.deckAt(x, z);
    if (ground.heightAt(x, z) - deck > 1e-4) continue;
    out.push(prop('manhole', x, deck, z, sample.heading));
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

/**
 * The stretches of `st` from `from` to `to` along it clear of every junction
 * on it (its paving, its streets' mouths and `JUNCTION_CLEAR` beyond), in order.
 */
function freeStretches(town: TownDef, st: Street, from: number, to: number): [number, number][] {
  const dx = st.x1 - st.x0;
  const dz = st.z1 - st.z0;
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const cuts: [number, number][] = [];
  for (const j of town.junctions) {
    const t = (j.x - st.x0) * ux + (j.z - st.z0) * uz;
    const lateral = Math.abs((j.x - st.x0) * uz - (j.z - st.z0) * ux);
    const reach = junctionReach(j) + st.halfWidth + JUNCTION_CLEAR;
    if (lateral > st.halfWidth + 8 || t < from - reach || t > to + reach) continue;
    cuts.push([t - reach, t + reach]);
  }
  cuts.sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let a = from;
  for (const [c0, c1] of cuts) {
    if (c0 > a) out.push([a, Math.min(c0, to)]);
    a = Math.max(a, c1);
  }
  if (a < to) out.push([a, to]);
  return out.filter(([p, q]) => q - p >= TREE_SPACING);
}
