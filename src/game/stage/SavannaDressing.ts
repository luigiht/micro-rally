import { hashSeed, mulberry32 } from '../rng';
import type { BoxObstacle } from '../vehicle/Collisions';
import { createRoadHit, type RoadSample } from './RoadPath';
import type { TerrainField } from './TerrainField';

/**
 * Safari country (the Savanna's): herds of giraffes and zebras grazing well
 * back from the road, blocks of sisal plantation in rows of tall flower
 * poles, and red termite mounds standing in the grass. Laid on their own
 * seeded stream on gentle open ground, never on a road, in a lake or a
 * river. Plain data: `SavannaDressingBuilder` draws it. Pure TS.
 */

export interface Animal {
  kind: 'giraffe' | 'zebra';
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
}

export interface Pole {
  x: number;
  y: number;
  z: number;
  /** Height of the flower pole, metres, and its lean. */
  height: number;
  lean: number;
}

export interface Mound {
  x: number;
  y: number;
  z: number;
  height: number;
}

export interface SavannaDressing {
  animals: Animal[];
  poles: Pole[];
  mounds: Mound[];
}

/** Herds per 100 m of road, how many in each, and how far from the road's edge they graze. */
const HERDS_PER_100 = 0.35;
const GIRAFFES = [2, 5] as const;
const ZEBRAS = [4, 10] as const;
const HERD_NEAR = 16;
const HERD_FAR = 70;
/** Plantation blocks: how often, how deep and long, how far out, the rows' spacing. */
const BLOCK_EVERY = 520;
const BLOCK_LENGTH = [50, 110] as const;
const BLOCK_DEPTH = [16, 34] as const;
const BLOCK_OUT = [14, 40] as const;
const ROW = 3.2;
/** Termite mounds per 100 m of road, and how far out. */
const MOUNDS_PER_100 = 1.2;
const MOUND_NEAR = 8;
const MOUND_FAR = 70;
/** Nothing stands on ground steeper than this. */
const MAX_SLOPE = 0.4;

export function planSavannaDressing(field: TerrainField): SavannaDressing {
  const stage = field.stage;
  const rand = mulberry32(hashSeed(stage.seed, 'savanna-dressing'));
  const path = stage.path;
  const hit = createRoadHit();
  const s: RoadSample = { x: 0, z: 0, heading: 0 };
  const from = 20;
  const to = path.length - 20;
  const between = ([lo, hi]: readonly [number, number]) => lo + rand() * (hi - lo);
  const slope = (x: number, z: number) =>
    Math.max(
      Math.abs(field.heightAt(x + 1, z) - field.heightAt(x - 1, z)),
      Math.abs(field.heightAt(x, z + 1) - field.heightAt(x, z - 1)),
    ) / 2;
  /** True where a prop may stand: this far off every road, dry, gentle. */
  const open = (x: number, z: number, clear: number) =>
    !path.nearest(x, z, stage.halfWidth + clear, hit) &&
    !field.inLake(x, z, 3) &&
    !field.inRiver(x, z, 3) &&
    slope(x, z) <= MAX_SLOPE;
  const out = (d: number, side: number, offset: number, along = 0) => {
    path.sample(d, s);
    return {
      x: s.x + Math.cos(s.heading) * offset * side + Math.sin(s.heading) * along,
      z: s.z - Math.sin(s.heading) * offset * side + Math.cos(s.heading) * along,
      heading: s.heading,
    };
  };

  const animals: Animal[] = [];
  const herds = Math.round(((to - from) / 100) * HERDS_PER_100);
  for (let h = 0; h < herds; h++) {
    const kind = rand() < 0.45 ? 'giraffe' : 'zebra';
    const d = from + rand() * (to - from);
    const side = rand() < 0.5 ? 1 : -1;
    const centre = out(d, side, stage.halfWidth + between([HERD_NEAR, HERD_FAR]));
    const n = Math.round(between(kind === 'giraffe' ? GIRAFFES : ZEBRAS));
    // A herd faces roughly one way, grazing across the plain.
    const facing = rand() * Math.PI * 2;
    const spread = kind === 'giraffe' ? 14 : 10;
    for (let k = 0; k < n; k++) {
      const x = centre.x + (rand() - 0.5) * spread;
      const z = centre.z + (rand() - 0.5) * spread;
      const yaw = facing + (rand() - 0.5) * 1.2;
      const scale = 0.85 + rand() * 0.3;
      if (!open(x, z, HERD_NEAR - 6)) continue;
      animals.push({ kind, x, y: field.heightAt(x, z), z, yaw, scale });
    }
  }

  // Sisal plantations: blocks of poles in rows parallel to the road, set back from it.
  const poles: Pole[] = [];
  for (let d = from + rand() * BLOCK_EVERY; d < to; d += BLOCK_EVERY * (0.6 + rand() * 0.8)) {
    const side = rand() < 0.5 ? 1 : -1;
    const length = between(BLOCK_LENGTH);
    const depth = between(BLOCK_DEPTH);
    const near = stage.halfWidth + between(BLOCK_OUT);
    for (let a = 0; a < length; a += ROW) {
      for (let b = 0; b < depth; b += ROW) {
        const p = out(d, side, near + b, a + (rand() - 0.5) * 0.6);
        if (!open(p.x, p.z, near - 4)) continue;
        // Not every plant has flowered: some rows thin out.
        if (rand() < 0.25) continue;
        poles.push({
          x: p.x,
          y: field.heightAt(p.x, p.z),
          z: p.z,
          height: 4 + rand() * 2.5,
          lean: (rand() - 0.5) * 0.12,
        });
      }
    }
  }

  const mounds: Mound[] = [];
  const count = Math.round(((to - from) / 100) * MOUNDS_PER_100);
  for (let k = 0; k < count; k++) {
    const d = from + rand() * (to - from);
    const side = rand() < 0.5 ? 1 : -1;
    const p = out(d, side, stage.halfWidth + between([MOUND_NEAR, MOUND_FAR]));
    const height = 0.8 + rand() * 1.6;
    if (!open(p.x, p.z, MOUND_NEAR - 2)) continue;
    mounds.push({ x: p.x, y: field.heightAt(p.x, p.z), z: p.z, height });
  }
  return { animals, poles, mounds };
}

/** Termite mounds and the plantation's poles stop a car; the animals stand too far off to reach. */
export function savannaObstacles(dressing: SavannaDressing): BoxObstacle[] {
  const boxes: BoxObstacle[] = [];
  for (const m of dressing.mounds) {
    const r = 0.35 + m.height * 0.25;
    boxes.push({ x: m.x, z: m.z, hx: r, hz: r, yaw: 0 });
  }
  for (const p of dressing.poles) boxes.push({ x: p.x, z: p.z, hx: 0.5, hz: 0.5, yaw: 0 });
  return boxes;
}
