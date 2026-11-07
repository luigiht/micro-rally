import type { RoadWidthSource } from './RoadWidth';
import { FRONT_SETBACK, JUNCTION_REACH, PAVEMENT_WIDTH, type Street } from './Town';
import type { Pt } from './TownTerraces';

/**
 * A city roundabout (see `UrbanPlan`, `UrbanGenerator`): a kerbed island the
 * route circles on a 'curve' leg, a ring of carriageway round it, and
 * blocked exits leaving the ring. Plain data, rebuilt from the seed in the
 * terrain worker exactly as on the main thread.
 *
 * Angles here are headings from the centre: a point on the ring at angle
 * `a` is `centre + radius · (sin a, cos a)`, the game's heading convention.
 */
export interface Roundabout {
  x: number;
  z: number;
  /** The island's radius; the carriageway ring runs from it out to `islandRadius + 2 · halfWidth`. */
  islandRadius: number;
  /** Half width of the ring's carriageway. */
  halfWidth: number;
  /** Path distances where the route joins and leaves the ring. */
  from: number;
  to: number;
  /** Angles from the centre of the route's entry and exit points on the ring, and the turn's sense (+1 circling left). */
  angleIn: number;
  angleOut: number;
  sense: 1 | -1;
  /** Headings of the blocked exits, radial from the centre. */
  exits: number[];
}

/** The island's kerb steps up this much, like a pavement; its top is level ground a tree stands on. */
export const ISLAND_PAD_BLEND = 0.3;

/** Radius of the ring's outer carriageway edge. */
export function ringOuterRadius(r: Roundabout): number {
  return r.islandRadius + 2 * r.halfWidth;
}

/** Radius of the ring's carriageway centreline. */
export function ringLaneRadius(r: Roundabout): number {
  return r.islandRadius + r.halfWidth;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Sweep from `from` to `to` in the roundabout's sense of circulation, in
 * (0, 2π]: how far round the ring the route runs, or the undriven remainder.
 */
export function ringSweep(r: Roundabout, from: number, to: number): number {
  const d = wrap((to - from) * r.sense);
  return d <= 1e-9 ? d + Math.PI * 2 : d;
}

/** Point on the ring's carriageway centreline at angle `a` from the centre. */
export function ringPoint(r: Roundabout, a: number, radius = ringLaneRadius(r)): Pt {
  return { x: r.x + Math.sin(a) * radius, z: r.z + Math.cos(a) * radius };
}

/**
 * The part of the ring the route does not drive, as short chord streets
 * (`route: false`) so the terrain decks and paves it. Each chord is kept
 * under `halfWidth + JUNCTION_REACH` long, which is how far a side street's
 * deck follows the route's; every chord then lies level with the ring and
 * draws no plates of its own (its junction cut is longer than it is).
 */
export function ringChords(r: Roundabout): Street[] {
  const radius = ringLaneRadius(r);
  const sweep = ringSweep(r, r.angleOut, r.angleIn);
  if (sweep >= Math.PI * 2 - 1e-6) return [];
  const maxChord = r.halfWidth + JUNCTION_REACH - 0.5;
  const steps = Math.max(1, Math.ceil((sweep * radius) / maxChord));
  const out: Street[] = [];
  for (let k = 0; k < steps; k++) {
    const a = ringPoint(r, r.angleOut + (r.sense * sweep * k) / steps, radius);
    const b = ringPoint(r, r.angleOut + (r.sense * sweep * (k + 1)) / steps, radius);
    out.push({ x0: a.x, z0: a.z, x1: b.x, z1: b.z, halfWidth: r.halfWidth, route: false });
  }
  return out;
}

/** True when (x, z) lies on a roundabout's ring, island or its pavements, where nothing wild grows and no house stands. */
export function roundaboutBlocks(rs: readonly Roundabout[], x: number, z: number): boolean {
  for (const r of rs)
    if (Math.hypot(x - r.x, z - r.z) < ringOuterRadius(r) + PAVEMENT_WIDTH + 3) return true;
  return false;
}

/** True when (x, z) stands at least a pavement less `slack` outside every roundabout's ring (the village `Site.clear` rule). */
export function roundaboutsClear(
  rs: readonly Roundabout[],
  x: number,
  z: number,
  slack: number,
): boolean {
  for (const r of rs)
    if (Math.hypot(x - r.x, z - r.z) < ringOuterRadius(r) + FRONT_SETBACK - slack) return false;
  return true;
}

/** A ring's surface (`RoundaboutSurface`) reaches this far beyond its outer pavement; roads hand their pavements, kerbs and lines over to it there. */
export const HANDOFF_BEYOND = 6;

/** Radius from the ring's centre at which the roads' own pavements, kerbs and lines stop and the ring's surface takes over. */
export function handoffRadius(r: Roundabout): number {
  return ringOuterRadius(r) + PAVEMENT_WIDTH + HANDOFF_BEYOND;
}

/**
 * The stretch of the route, as path distances, inside a ring's hand-off
 * radius: from where the route comes within it on the way in to where it
 * leaves it on the way out, found by walking the route either side of its
 * arc. Over that stretch the ribbon paints only its carriageway; the ring's
 * surface paints the pavements, kerbs and lines on both sides.
 */
export function ringHandoff(r: Roundabout, stage: RoadWidthSource): { from: number; to: number } {
  const s = { x: 0, z: 0, heading: 0 };
  const radius = handoffRadius(r);
  const inside = (d: number) => {
    stage.path.sample(d, s);
    return Math.hypot(s.x - r.x, s.z - r.z) < radius;
  };
  let from = r.from;
  while (from > r.from - OPENING_REACH && inside(from - 1)) from -= 1;
  let to = r.to;
  while (to < r.to + OPENING_REACH && inside(to + 1)) to += 1;
  return { from, to };
}

/** The ribbon's openings for every ring, both sides: see `ringHandoff`. */
export function roundaboutOpenings(
  rs: readonly Roundabout[],
  stage: RoadWidthSource,
): { left: { from: number; to: number }[]; right: { from: number; to: number }[] } {
  const out = {
    left: [] as { from: number; to: number }[],
    right: [] as { from: number; to: number }[],
  };
  for (const r of rs) {
    const h = ringHandoff(r, stage);
    // The ribbon's strips overlap the ring's bands by a little, so no hairline opens at the seam.
    out.left.push({ from: h.from + HANDOFF_OVERLAP, to: h.to - HANDOFF_OVERLAP });
    out.right.push({ from: h.from + HANDOFF_OVERLAP, to: h.to - HANDOFF_OVERLAP });
  }
  return out;
}

/** The roads' own pavements, kerbs and lines run this far into the ring's surface, which lies a hair lower. */
export const HANDOFF_OVERLAP = 0.6;

/** The route is walked this far back from and on past the arc for the hand-off. */
const OPENING_REACH = 80;

/** Whether a path distance lies on a roundabout's ring (with `margin` either side), for gates and lane lines to keep off. */
export function onRoundabout(rs: readonly Roundabout[], along: number, margin = 0): boolean {
  for (const r of rs) if (along > r.from - margin && along < r.to + margin) return true;
  return false;
}
