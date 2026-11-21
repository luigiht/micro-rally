import { hashSeed, mulberry32 } from '../rng';
import type { BoxObstacle } from '../vehicle/Collisions';
import { groves } from './Groves';
import { createRoadHit, type RoadSample } from './RoadPath';
import { stageScenery } from './regions';
import type { TerrainField } from './TerrainField';

/**
 * What makes open moor read as farmed hill country (the Moorland's): sheep
 * grazing the slopes well back from the road, post-and-wire fences along the
 * open stretches, and dry-stone walls further out across the fields. Laid
 * where the road runs over open moor, never through the spruce plantations
 * (`groves`), on its own seeded stream so no other scenery's draws move.
 * Plain data: `MoorlandDressingBuilder` draws it. Pure TS.
 */

export interface Sheep {
  x: number;
  y: number;
  z: number;
  /** Which way it faces, radians, and how big (1 a ewe). */
  yaw: number;
  scale: number;
}

/** A run parallel to the road, `offset` metres out on `side`, from road distance `from` to `to`. */
export interface RoadsideRun {
  from: number;
  to: number;
  side: 1 | -1;
  offset: number;
}

/** A wooden fence: its posts in order along it, the first and last at its ends; rails run between each pair. */
export interface Fence {
  posts: { x: number; z: number }[];
  /** Two or three rails a span. */
  rails: 2 | 3;
}

export interface MoorlandDressing {
  sheep: Sheep[];
  fences: Fence[];
  walls: RoadsideRun[];
}

/** Sheep per 100 m of road, in flocks of a few; how far from the road's edge they graze. */
const FLOCKS_PER_100 = 0.9;
const FLOCK = [3, 8] as const;
const SHEEP_NEAR = 30;
const SHEEP_FAR = 150;
/** Fences: a post every this many metres. */
const POST_EVERY = 3;
/** Fences: how far out from the carriageway's edge, how long a run, how often one starts. */
const FENCE_OUT = 5.5;
const FENCE_RUN = [50, 170] as const;
const FENCE_EVERY = 140;
/** Walls: how far out, how long a run, how often one starts. */
const WALL_OUT = [16, 34] as const;
const WALL_RUN = [40, 120] as const;
const WALL_EVERY = 220;
/** Check a run's line against the road every this many metres; keep it this far off any other stretch. */
const RUN_STEP = 4;
const ROAD_GAP = 3;
/** Nothing stands on ground steeper than this (rise over run). */
const MAX_SLOPE = 0.45;
/** Open moor: where the road is this little in a plantation. */
const OPEN = 0.15;

export function planMoorlandDressing(field: TerrainField): MoorlandDressing {
  const stage = field.stage;
  const density = stageScenery(stage.stageType);
  const inGrove = density.groves ? groves(stage.seed, density.groves) : () => 0;
  const rand = mulberry32(hashSeed(stage.seed, 'moor-dressing'));
  const path = stage.path;
  const hit = createRoadHit();
  const s: RoadSample = { x: 0, z: 0, heading: 0 };
  const from = 20;
  const to = path.length - 20;
  const slope = (x: number, z: number) =>
    Math.max(
      Math.abs(field.heightAt(x + 1, z) - field.heightAt(x - 1, z)),
      Math.abs(field.heightAt(x, z + 1) - field.heightAt(x, z - 1)),
    ) / 2;
  // A point `offset` metres out on `side` of the road at distance `d`.
  const out = (d: number, side: number, offset: number) => {
    path.sample(d, s);
    return {
      x: s.x + Math.cos(s.heading) * offset * side,
      z: s.z - Math.sin(s.heading) * offset * side,
    };
  };
  // A run is good where its whole line is open moor, off every other stretch of road, out of the lakes.
  const runFits = (run: RoadsideRun) => {
    for (let d = run.from; d <= run.to; d += RUN_STEP) {
      if (inGrove(d) > OPEN) return false;
      const p = out(d, run.side, stage.halfWidth + run.offset);
      if (path.nearest(p.x, p.z, stage.halfWidth + run.offset - ROAD_GAP, hit)) return false;
      if (field.inLake(p.x, p.z, 2) || field.inRiver(p.x, p.z, 2)) return false;
      if (slope(p.x, p.z) > MAX_SLOPE) return false;
    }
    return true;
  };
  const runs = (every: number, length: readonly [number, number], offset: () => number) => {
    const list: RoadsideRun[] = [];
    for (let d = from; d < to; d += every * (0.6 + rand() * 0.8)) {
      const run: RoadsideRun = {
        from: d,
        to: Math.min(to, d + length[0] + rand() * (length[1] - length[0])),
        side: rand() < 0.5 ? 1 : -1,
        offset: offset(),
      };
      if (runFits(run)) list.push(run);
    }
    return list;
  };
  // Each fence: a post every few metres from one end to the other, a post at the far end too.
  const fences: Fence[] = runs(FENCE_EVERY, FENCE_RUN, () => FENCE_OUT).map((run) => {
    const posts: { x: number; z: number }[] = [];
    const span = run.to - run.from;
    const n = Math.max(1, Math.round(span / POST_EVERY));
    for (let k = 0; k <= n; k++)
      posts.push(out(run.from + (span * k) / n, run.side, stage.halfWidth + run.offset));
    return { posts, rails: rand() < 0.5 ? 2 : 3 };
  });
  const walls = runs(
    WALL_EVERY,
    WALL_RUN,
    () => WALL_OUT[0] + rand() * (WALL_OUT[1] - WALL_OUT[0]),
  );

  const sheep: Sheep[] = [];
  const flocks = Math.round(((to - from) / 100) * FLOCKS_PER_100);
  for (let f = 0; f < flocks; f++) {
    const d = from + rand() * (to - from);
    const side = rand() < 0.5 ? 1 : -1;
    const offset = stage.halfWidth + SHEEP_NEAR + rand() * (SHEEP_FAR - SHEEP_NEAR);
    const centre = out(d, side, offset);
    const n = FLOCK[0] + Math.floor(rand() * (FLOCK[1] - FLOCK[0] + 1));
    for (let k = 0; k < n; k++) {
      const x = centre.x + (rand() - 0.5) * 16;
      const z = centre.z + (rand() - 0.5) * 16;
      const yaw = rand() * Math.PI * 2;
      const scale = 0.85 + rand() * 0.3;
      if (inGrove(d) > OPEN) continue;
      if (path.nearest(x, z, stage.halfWidth + SHEEP_NEAR - 8, hit)) continue;
      if (field.inLake(x, z, 3) || slope(x, z) > MAX_SLOPE) continue;
      sheep.push({ x, y: field.heightAt(x, z), z, yaw, scale });
    }
  }
  return { sheep, fences, walls };
}

/** Fences and field walls stop a car: a box along every fence span and every few metres of wall. */
const FENCE_HALF = 0.1;
const WALL_HALF = 0.32;

export function moorlandObstacles(field: TerrainField, dressing: MoorlandDressing): BoxObstacle[] {
  const boxes: BoxObstacle[] = [];
  const box = (x0: number, z0: number, x1: number, z1: number, half: number) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    boxes.push({
      x: (x0 + x1) / 2,
      z: (z0 + z1) / 2,
      hx: half,
      hz: Math.hypot(dx, dz) / 2 + half,
      yaw: Math.atan2(dx, dz),
    });
  };
  for (const fence of dressing.fences)
    for (let k = 1; k < fence.posts.length; k++) {
      const a = fence.posts[k - 1]!;
      const b = fence.posts[k]!;
      box(a.x, a.z, b.x, b.z, FENCE_HALF);
    }
  const s: RoadSample = { x: 0, z: 0, heading: 0 };
  const stage = field.stage;
  for (const wall of dressing.walls) {
    let px = 0;
    let pz = 0;
    for (let d = wall.from, first = true; d <= wall.to + 1e-6; d += RUN_STEP, first = false) {
      stage.path.sample(Math.min(d, wall.to), s);
      const off = (stage.halfWidth + wall.offset) * wall.side;
      const x = s.x + Math.cos(s.heading) * off;
      const z = s.z - Math.sin(s.heading) * off;
      if (!first) box(px, pz, x, z, WALL_HALF);
      px = x;
      pz = z;
    }
  }
  return boxes;
}
