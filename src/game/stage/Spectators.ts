import { hashSeed, mulberry32 } from '../rng';
import { barrierAt, circuitTrackside, grandstandSpot } from './CircuitTrackside';
import { STAGE_TYPES } from './regions';
import { crowdSpans, STRIDE } from './CrowdSpans';
import { createRoadHit, type RoadSample } from './RoadPath';
import type { Prop } from './SceneryScatter';
import type { TerrainMound } from './TerrainDetail';
import { VERGE_WIDTH, type TerrainField } from './TerrainField';
import { townBlocks } from './Town';

/** Jacket colours and poses a spectator's variant picks from: `variant % jackets`, then the pose. */
export const SPECTATOR_JACKETS = 6;
export const SPECTATOR_POSES = 9;
/** Wild props this close to a spectator are dropped. */
export const SPECTATOR_CLEAR = 2.2;

/** Roadside groups: five or six people, the first this far into the stage, standing this far past the banks. */
const GROUP_MIN = 5;
const GROUP_MAX = 6;
const FIRST = 80;
const BACK = 1.2;
/** Crowds: the second row stands this far behind the front one (a stride apart, `STRIDE`). */
const ROW_GAP = 1.3;
/** The control boards and the arches' posts stand in a gap this long either side of their line. */
const GATE_GAP = 4;
/** In a crowd, no pose-and-jacket pairing comes up twice within this many people dealt in a row. */
const DEAL_APART = 6;
/** Groups keep this far from a crowd's ends, so the two never pile up. */
const CROWD_MARGIN = 10;
/**
 * Small protective berms: earth heaped beyond the verge, between the road
 * and spectators, in runs this long. Their foot stays most of a terrain
 * cell (2 m) clear of the road mesh's verge strip: a terrain face with a
 * corner up on a berm would otherwise tilt up through the strip's edge.
 */
export const BERM_FROM = VERGE_WIDTH + 1.6;
export const BERM_DEPTH = 2.2;
const BERM_HEIGHT = 0.35;
const BERM_RUN = 8;

/**
 * Where a spectator may stand: the ground within `FOOT_REACH` of their feet
 * rises or falls no more than `FOOT_RISE` (fairly level), nothing within
 * `BRINK_REACH` falls more than `BRINK_DROP` below them (no valley's edge, no
 * cutting's lip), and nothing of the hill rises within `VIEW_MARGIN` of the
 * line from their eyes to a car on the road in front of them, and to one
 * side or the other along it.
 */
const FOOT_REACH = 0.9;
const FOOT_RISE = 0.3;
const BRINK_REACH = 3;
const BRINK_DROP = 1.4;
const EYE = 1.55;
const VIEW_ALONG = 12;
const VIEW_MARGIN = 0.15;
/** They watch the cars: the line of sight ends this high over the road. */
const CAR_HEIGHT = 1;
const VIEW_STEPS = 8;
/** Spectators keep this far off a frozen river's ice. */
const RIVER_GAP = 5;
/** A crowd's place that fails steps back this far, once and again; a group also tries along the road. */
const STEP_BACK = [0, 1.5, 3] as const;
const GROUP_SHIFTS = [0, 5, -5, 10, -10] as const;
const GROUP_BACK = [0, 1.5, 3, 5] as const;

/** Whether nothing of the hill rises between an eye at (x, eye, z) and the road's deck at (rx, rz). */
function seesRoad(
  field: TerrainField,
  x: number,
  z: number,
  eye: number,
  rx: number,
  rz: number,
): boolean {
  const target = field.heightAt(rx, rz) + CAR_HEIGHT;
  for (let i = 1; i < VIEW_STEPS; i++) {
    const t = i / VIEW_STEPS;
    const line = eye + (target - eye) * t;
    if (field.heightAt(x + (rx - x) * t, z + (rz - z) * t) > line - VIEW_MARGIN) return false;
  }
  return true;
}

/** Whether a spectator can stand at (x, z), beside the road at distance `d` (see `FOOT_REACH`). */
export function standable(field: TerrainField, x: number, z: number, d: number): boolean {
  const y = field.heightAt(x, z);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    if (
      Math.abs(field.heightAt(x + Math.cos(a) * FOOT_REACH, z + Math.sin(a) * FOOT_REACH) - y) >
      FOOT_RISE
    )
      return false;
  }
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    if (
      field.heightAt(x + Math.cos(a) * BRINK_REACH, z + Math.sin(a) * BRINK_REACH) <
      y - BRINK_DROP
    )
      return false;
  }
  const path = field.stage.path;
  const road = { x: 0, z: 0, heading: 0 };
  const eye = y + EYE;
  path.sample(d, road);
  if (!seesRoad(field, x, z, eye, road.x, road.z)) return false;
  path.sample(Math.max(0, d - VIEW_ALONG), road);
  if (seesRoad(field, x, z, eye, road.x, road.z)) return true;
  path.sample(Math.min(path.length, d + VIEW_ALONG), road);
  return seesRoad(field, x, z, eye, road.x, road.z);
}

interface SpectatorOptions {
  berms?: boolean;
  eventsOnly?: boolean;
}

/**
 * The spectators down a stage: crowds at the start, the checkpoints, the
 * jumps and the finish (`crowds`), and between them `perHundred` groups
 * per 100 m, five or six people a stride apart, on either side, no two in a
 * group striking the same pose or wearing the same jacket. When `berms` is
 * enabled, crowds stand behind a small mound between them and the road
 * (returned as `mounds` for the terrain). All stand just behind the snow
 * banks (or the verge) facing the road, never inside a town's buildings nor
 * where another stretch of road passes close.
 */
export function scatterSpectators(
  field: TerrainField,
  perHundred: number,
  options: SpectatorOptions = {},
): { people: Prop[]; mounds: TerrainMound[] } {
  const stage = field.stage;
  const { berms = false, eventsOnly = false } = options;
  const rand = mulberry32(hashSeed(stage.seed, 'spectators'));
  const path = stage.path;
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const coastSample: RoadSample = { x: 0, z: 0, heading: 0 };
  const hit = createRoadHit();
  const banks = STAGE_TYPES[stage.stageType].terrain.banks;
  const verge = stage.halfWidth + 0.6 + (banks ? banks.width : 2);
  const back = verge + BACK;
  const out: Prop[] = [];
  const mounds: TerrainMound[] = [];
  const hw = stage.halfWidth;
  const trackside = circuitTrackside(stage);
  const grandstand = trackside ? grandstandSpot(stage, trackside) : null;
  const bermAt = () => berms;
  const landwardSide = (d: number): 1 | -1 => {
    path.sample(d, coastSample);
    const lx = Math.cos(coastSample.heading) * 8;
    const lz = -Math.sin(coastSample.heading) * 8;
    return field.coast!.shoreDistance(coastSample.x + lx, coastSample.z + lz) >
      field.coast!.shoreDistance(coastSample.x - lx, coastSample.z - lz)
      ? 1
      : -1;
  };
  const sideAllowed = (d: number, side: 1 | -1) => !field.coast || side === landwardSide(d);
  const landwardPoint = (x: number, z: number): boolean => {
    if (!field.coast) return true;
    return path.nearest(x, z, 100, hit) && Math.sign(hit.lateral) === landwardSide(hit.along);
  };
  const spine = (d: number, side: 1 | -1) =>
    (trackside ? barrierAt(trackside, path, d, side) : hw) + BERM_FROM + BERM_DEPTH / 2;
  const hasBerm = (d: number, side: 1 | -1): boolean => {
    const [x, z] = at(d, side, spine(d, side));
    return mounds.some((m) => {
      const dx = m.x1 - m.x0;
      const dz = m.z1 - m.z0;
      const len2 = dx * dx + dz * dz;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - m.x0) * dx + (z - m.z0) * dz) / len2)) : 0;
      return Math.hypot(x - (m.x0 + dx * t), z - (m.z0 + dz * t)) < m.radius * 0.5;
    });
  };
  const at = (d: number, side: 1 | -1, off: number): [number, number] => {
    path.sample(d, sample);
    return [
      sample.x + Math.cos(sample.heading) * off * side,
      sample.z - Math.sin(sample.heading) * off * side,
    ];
  };
  /** A berm along the road from `d0` to `d1` on `side`, unless another stretch of road runs under it. */
  const berm = (d0: number, d1: number, side: 1 | -1): void => {
    const [x0, z0] = at(d0, side, spine(d0, side));
    const [x1, z1] = at(d1, side, spine(d1, side));
    if (!landwardPoint(x0, z0) || !landwardPoint(x1, z1)) return;
    for (const [x, z, d] of [
      [x0, z0, d0],
      [x1, z1, d1],
    ] as const) {
      if (
        path.nearest(x, z, spine(d, side) + BERM_DEPTH, hit) &&
        Math.abs(hit.along - d) > BERM_RUN * 2
      )
        return;
      if (stage.town && townBlocks(stage.town, x, z)) return;
    }
    mounds.push({ x0, z0, x1, z1, radius: BERM_DEPTH / 2, height: BERM_HEIGHT });
  };

  /** Whether the place `off` out from the road at `d` is free and good ground (`standable`), the circuit's barrier aside. */
  const placeable = (d: number, side: 1 | -1, off: number): boolean => {
    if (trackside) return true;
    const [x, z] = at(d, side, off);
    if (path.nearest(x, z, verge, hit)) return false;
    // Nobody stands on a frozen river or at the lip of its gorge.
    if (field.inRiver(x, z, RIVER_GAP)) return false;
    return standable(field, x, z, d);
  };
  const stand = (d: number, side: 1 | -1, off: number, variant: number): boolean => {
    // A place on bad ground steps back once or twice before it is given up.
    const extra = trackside ? 0 : STEP_BACK.find((e) => placeable(d, side, off + e));
    if (extra === undefined) return false;
    off += extra;
    path.sample(d, sample);
    const distance = trackside ? Math.max(off, barrierAt(trackside, path, d, side) + 3) : off;
    const x = sample.x + Math.cos(sample.heading) * distance * side;
    const z = sample.z - Math.sin(sample.heading) * distance * side;
    if (field.coast) {
      if (!path.nearest(x, z, 100, hit)) return false;
      path.sample(hit.along, coastSample);
      const lx = Math.cos(coastSample.heading) * 8;
      const lz = -Math.sin(coastSample.heading) * 8;
      const left = field.coast.shoreDistance(coastSample.x + lx, coastSample.z + lz);
      const right = field.coast.shoreDistance(coastSample.x - lx, coastSample.z - lz);
      if (Math.sign(hit.lateral) !== (left > right ? 1 : -1)) return false;
    }
    if (stage.town && townBlocks(stage.town, x, z)) return false;
    if (grandstand && Math.hypot(x - grandstand.x, z - grandstand.z) < grandstand.radius)
      return false;
    // Another stretch of road (a hairpin's other leg) inside the banks: nobody stands on it.
    if (path.nearest(x, z, verge, hit)) return false;
    if (bermAt() && sideAllowed(d, side) && !hasBerm(d, side)) return false;
    // Facing the road: from the left of travel the road lies to the right, so the front (−z)
    // turns by heading + π/2; from the right, heading − π/2; a little head-turn either way.
    out.push({
      kind: 'spectator',
      x,
      y: field.heightAt(x, z),
      z,
      scale: 0.92 + rand() * 0.12,
      rotation: sample.heading + (side * Math.PI) / 2 + (rand() - 0.5) * 0.5,
      variant,
    });
    return true;
  };

  // Crowds deal from a shuffled deck of every pose-and-jacket pairing, skipping any of the last
  // few dealt when a fresh deck starts, so no pairing repeats among neighbours.
  const deck: number[] = [];
  const recent: number[] = [];
  const deal = (): number => {
    if (deck.length === 0) deck.push(...shuffled(SPECTATOR_JACKETS * SPECTATOR_POSES, rand));
    let i = deck.length - 1;
    while (i > 0 && recent.includes(deck[i]!)) i--;
    const card = deck.splice(i, 1)[0]!;
    recent.push(card);
    if (recent.length > DEAL_APART) recent.shift();
    return card;
  };

  const lined = crowdSpans(stage, field.crestsAt, eventsOnly);
  for (const c of lined) {
    for (const side of [1, -1] as const) {
      const step = STRIDE * c.spacing;
      if (c.berm)
        for (let a = c.from; a < c.to; a += BERM_RUN)
          if (bermAt()) berm(a, Math.min(a + BERM_RUN, c.to), side);
      for (let d = c.from + rand() * step * 0.5; d < c.to; d += step * (0.8 + 0.4 * rand())) {
        if (c.gap !== undefined && Math.abs(d - c.gap) < GATE_GAP) continue;
        const behind = c.berm && bermAt() && sideAllowed(d, side);
        const front = behind ? spine(d, side) + BERM_DEPTH / 2 + 0.4 : back;
        stand(d, side, front + rand() * 0.5, deal());
        if (rand() < c.rows)
          stand(d + step * (rand() - 0.5), side, front + ROW_GAP + rand() * 0.5, deal());
      }
    }
  }

  if (!eventsOnly) {
    let side: 1 | -1 = rand() < 0.5 ? 1 : -1;
    for (
      let d = FIRST + rand() * 40;
      d < path.length - 60;
      d += (100 / perHundred) * (0.6 + 0.8 * rand())
    ) {
      if (field.coast) side = landwardSide(d);
      else if (rand() < 0.6) side = -side as 1 | -1;
      if (lined.some((c) => d > c.from - CROWD_MARGIN && d < c.to + CROWD_MARGIN)) continue;
      const n = GROUP_MIN + Math.floor(rand() * (GROUP_MAX - GROUP_MIN + 1));
      // Each member a different pose and a different jacket.
      const poses = shuffled(SPECTATOR_POSES, rand);
      const jackets = shuffled(SPECTATOR_JACKETS, rand);
      const behind = bermAt() && sideAllowed(d, side);
      const half = ((n - 1) / 2) * 0.9;
      // The group gathers on good ground: here, or a little along the road or further back.
      const base = behind ? spine(d, side) + BERM_DEPTH / 2 + 0.4 : back;
      let spot: { d: number; back: number } | undefined;
      for (const shift of GROUP_SHIFTS) {
        const g = d + shift;
        if (lined.some((c) => g > c.from - CROWD_MARGIN && g < c.to + CROWD_MARGIN)) continue;
        const b = GROUP_BACK.find(
          (e) =>
            placeable(g - half, side, base + e + 0.3) &&
            placeable(g, side, base + e + 0.3) &&
            placeable(g + half, side, base + e + 0.3),
        );
        if (b !== undefined) {
          spot = { d: g, back: b };
          break;
        }
      }
      if (!spot) continue;
      const g = spot.d;
      // Behind a berm of their own where the stage has them, a metre past either end of the group.
      if (behind) berm(g - half - 1, g + half + 1, side);
      // Along the road a stride apart, a little in and out of line.
      for (let i = 0; i < n; i++)
        stand(
          g + (i - (n - 1) / 2) * 0.9 + (rand() - 0.5) * 0.3,
          side,
          base + spot.back + rand() * (behind ? 0.6 : 1.4),
          jackets[i]! + SPECTATOR_JACKETS * poses[i]!,
        );
    }
  }
  return { people: out, mounds };
}

/** 0 … n − 1 in a seeded random order (Fisher–Yates). */
function shuffled(n: number, rand: () => number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A test for "a spectator stands within `SPECTATOR_CLEAR` of here", hashed so it stays quick for big crowds. */
export function nearSpectator(spectators: readonly Prop[]): (x: number, z: number) => boolean {
  const cells = new Map<string, Prop[]>();
  const key = (cx: number, cz: number) => `${cx},${cz}`;
  for (const s of spectators) {
    const k = key(Math.floor(s.x / SPECTATOR_CLEAR), Math.floor(s.z / SPECTATOR_CLEAR));
    const list = cells.get(k);
    if (list) list.push(s);
    else cells.set(k, [s]);
  }
  return (x, z) => {
    const cx = Math.floor(x / SPECTATOR_CLEAR);
    const cz = Math.floor(z / SPECTATOR_CLEAR);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const s of cells.get(key(cx + i, cz + j)) ?? [])
          if (Math.hypot(s.x - x, s.z - z) < SPECTATOR_CLEAR) return true;
    return false;
  };
}
