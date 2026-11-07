import { hashSeed, mulberry32 } from '../rng';
import type { UrbanDef } from './regions';
import { halfWidthAt, type RoadWidthSource } from './RoadWidth';
import { ringHandoff } from './Roundabout';
import type { TownDef } from './Town';
import { junctionKerbs } from './TownKerbs';

/**
 * Parking along a city's three-lane streets: the kerb lane each side is
 * painted as bays, leaving two driving lanes, and some bays hold a parked
 * car. Pure data worked out from the town and the route when asked, like
 * `Crossings`.
 */
export interface ParkingStretch {
  /** The bay-lined part of one street, along its centreline, and as path distances. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  from: number;
  to: number;
  /** The street's half width. */
  halfWidth: number;
}

export interface ParkedCar {
  x: number;
  z: number;
  /** Heading the car faces, along the street with the traffic on its side. */
  yaw: number;
  variant: number;
}

/** A bay's width off the kerb lane's edge line and its length along the street. */
export const BAY_WIDTH = 2.2;
export const BAY_LENGTH = 5.5;
/** Bays keep this far from a junction's paved reach, this far from the start gantry, and from a ring's hand-off. */
export const BAY_MARGIN = 6;
const BAY_FIRST = 45;
const RING_MARGIN = 6;
/** A stretch holds at least this many bays. */
const MIN_BAYS = 2;
/** The route counts as straight where the heading turns less than this per sample. */
const STRAIGHT_TURN = 0.004;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Share of bays with a car in them, and how many variants (two hull shapes × five colours) there are. */
const OCCUPANCY = 0.35;
export const CAR_VARIANTS = 10;

/**
 * The bay-lined stretches: every straight run of the route at the three-lane
 * width, less the junctions' paving with a margin, the start gantry's
 * stretch and every ring's hand-off, in path distances and as a segment.
 */
export function parkingStretches(
  town: TownDef,
  stage: RoadWidthSource,
  def: UrbanDef,
): ParkingStretch[] {
  const out: ParkingStretch[] = [];
  const path = stage.path;
  const sp = path.spacing;
  // Breaks along the route: junction paving with the margin, the start, the rings.
  const breaks: [number, number][] = [[-Infinity, BAY_FIRST]];
  for (const j of town.junctions) {
    const k = junctionKerbs(j, stage, stage.halfWidth);
    const all = [...k.openings.left, ...k.openings.right];
    if (all.length === 0) continue;
    breaks.push([
      Math.min(...all.map((o) => o.from)) - BAY_MARGIN,
      Math.max(...all.map((o) => o.to)) + BAY_MARGIN,
    ]);
  }
  for (const r of town.roundabouts ?? []) {
    const h = ringHandoff(r, stage);
    breaks.push([h.from - RING_MARGIN, h.to + RING_MARGIN]);
  }
  const broken = (d: number) => breaks.some(([a, b]) => d > a && d < b);
  const straight = (i: number) =>
    i + 1 < path.count &&
    Math.abs(wrap(path.headings[i + 1]! - path.headings[i]!)) < STRAIGHT_TURN &&
    Math.abs(halfWidthAt(stage, i * sp) - def.lanes.three) < 1e-6 &&
    Math.abs(halfWidthAt(stage, (i + 1) * sp) - def.lanes.three) < 1e-6 &&
    !broken(i * sp) &&
    !broken((i + 1) * sp);
  let run: number | null = null;
  const close = (i0: number, i1: number) => {
    if ((i1 - i0) * sp < MIN_BAYS * BAY_LENGTH) return;
    out.push({
      x0: path.xs[i0]!,
      z0: path.zs[i0]!,
      x1: path.xs[i1]!,
      z1: path.zs[i1]!,
      from: i0 * sp,
      to: i1 * sp,
      halfWidth: def.lanes.three,
    });
  };
  for (let i = 0; i < path.count; i++) {
    if (straight(i)) {
      if (run === null) run = i;
    } else if (run !== null) {
      close(run, i);
      run = null;
    }
  }
  if (run !== null) close(run, path.count - 1);
  return out;
}

/** Lateral offset of a bay's centre from the street's axis, on `side` (1 left). */
export function bayCentre(hw: number, side: 1 | -1): number {
  return side * (hw - 0.6 - BAY_WIDTH / 2);
}

/** The cars parked in the stretches' bays, a hashed share of them, facing the traffic on their side. */
export function parkedCars(stretches: readonly ParkingStretch[], seed: number): ParkedCar[] {
  const out: ParkedCar[] = [];
  const rand = mulberry32(hashSeed(seed, 'parking'));
  for (const s of stretches) {
    const dx = s.x1 - s.x0;
    const dz = s.z1 - s.z0;
    const len = Math.hypot(dx, dz);
    const h = Math.atan2(dx, dz);
    const lx = Math.cos(h);
    const lz = -Math.sin(h);
    const n = Math.floor(len / BAY_LENGTH);
    for (const side of [1, -1] as const) {
      const e = bayCentre(s.halfWidth, side);
      for (let i = 0; i < n; i++) {
        const r = rand();
        if (r >= OCCUPANCY) continue;
        const t = (len - n * BAY_LENGTH) / 2 + BAY_LENGTH * (i + 0.5);
        out.push({
          x: s.x0 + (dx / len) * t + lx * e,
          z: s.z0 + (dz / len) * t + lz * e,
          // Traffic keeps right: cars on the left kerb face back down the street.
          yaw: side > 0 ? h + Math.PI : h,
          variant: Math.floor((r / OCCUPANCY) * CAR_VARIANTS),
        });
      }
    }
  }
  return out;
}

/** True within `slack` of a stretch along the route: the lane count there allows for the bays. */
export function onParkingStretch(
  stretches: readonly ParkingStretch[],
  along: number,
  slack = BAY_MARGIN + 4,
): boolean {
  return stretches.some((s) => along > s.from - slack && along < s.to + slack);
}
