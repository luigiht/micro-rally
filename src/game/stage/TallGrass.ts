import { hashSeed, mulberry32 } from '../rng';
import { stageScenery } from './regions';
import { createRoadHit, type RoadSample } from './RoadPath';
import type { Prop } from './SceneryScatter';
import type { TerrainField } from './TerrainField';
import { townBlocks } from './Town';

/** A patch's farthest blade tip from its centre at scale 1, metres (`TallGrassGeometry` stays inside it). */
export const GRASS_REACH = 1.5;
/** Every blade stops this far short of the carriageway's edge. */
const ROAD_GAP = 0.2;
/** Verge layer: mean distance out past the clear margin, metres, and the farthest out. */
const MEAN_OUT = 3.5;
const MAX_OUT = 25;
/** Meadow layer: from this far past the road's edge out to `MEADOW_TO`, evenly. */
const MEADOW_FROM = 4;
const MEADOW_TO = 150;
/** Sampling step along the road, metres. */
const STEP = 5;
/** Sunk a little, so a patch on a slope never shows its base. */
const SINK = 0.05;
/** Patch centres stay this far from a tree's trunk (× its scale), so no tuft grows out of the bark. */
const TRUNK_GAP = 0.6;
/** Drifts: the grass thickens and thins over about this many metres. */
const DRIFT = 22;
/** Patches lean with one wind across the stage, each within this much of it, radians. */
const WIND_SPREAD = 0.5;
/** Grass tint variants the renderer colours from. */
export const GRASS_VARIANTS = 3;

/**
 * Tall grass: loose patches in two layers, for stage types whose scenery
 * sets `grass` (along the verges, thinning out from the road) and `meadow`
 * (spread evenly over the hills either side, out to 150 m). Both gather
 * into drifts with bare ground between, every patch leans with one wind and
 * varies in size and height. No blade reaches the road, a spectator, a rock
 * or a house, and no tuft grows out of a trunk. Visual only (the car brushes
 * straight through), deterministic per stage and drawn from its own random
 * stream, so nothing else moves.
 */
export function scatterGrass(field: TerrainField, props: readonly Prop[]): Prop[] {
  const stage = field.stage;
  const density = stageScenery(stage.stageType);
  const verge = density.grass ?? 0;
  const meadow = density.meadow ?? 0;
  if (verge <= 0 && meadow <= 0) return [];
  const rand = mulberry32(hashSeed(stage.seed, 'grass'));
  const path = stage.path;
  const hit = createRoadHit();
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const blockers = new BlockerGrid(props);
  const out: Prop[] = [];
  const wind = rand() * Math.PI * 2;
  const phase = [rand() * 100, rand() * 100, rand() * 100];
  // 0..1 over the ground: crossed waves at odd lengths, so drifts never repeat evenly.
  const drift = (x: number, z: number) => {
    const w =
      Math.sin(x / DRIFT + phase[0]!) * Math.cos(z / (DRIFT * 1.3) + phase[1]!) * 0.6 +
      Math.sin((x + z) / (DRIFT * 0.45) + phase[2]!) * 0.4;
    return Math.max(0, Math.min(1, 0.5 + 0.8 * w));
  };

  const layer = (perHundred: number, distance: (scale: number) => number) => {
    const expected = (perHundred * STEP) / 100;
    for (let d = 0; d < path.length; d += STEP) {
      let n = Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);
      while (n-- > 0) {
        path.sample(d + rand() * STEP, sample);
        const side = rand() < 0.5 ? -1 : 1;
        const scale = 0.55 + rand() * 0.75;
        const offset = stage.halfWidth + distance(scale);
        const x = sample.x + Math.cos(sample.heading) * offset * side;
        const z = sample.z - Math.sin(sample.heading) * offset * side;
        const stretch = 0.75 + rand() * 0.5;
        // Kept in [0, 2π): the renderer shades instances by heading.
        const rotation = (wind + (rand() - 0.5) * 2 * WIND_SPREAD + Math.PI * 2) % (Math.PI * 2);
        const variant = Math.floor(rand() * GRASS_VARIANTS);
        // Bare ground between the drifts, a few stray patches on it.
        if (rand() > 0.12 + 0.88 * drift(x, z)) continue;
        const reach = GRASS_REACH * scale;
        // No blade over any stretch of road (other legs of a hairpin too), in town or on a crowd's mound.
        if (path.nearest(x, z, stage.halfWidth + ROAD_GAP + reach, hit)) continue;
        if (stage.town && townBlocks(stage.town, x, z)) continue;
        if (field.onMound(x, z, reach)) continue;
        if (blockers.blocks(x, z, reach)) continue;
        const y = field.heightAt(x, z) - SINK;
        out.push({ kind: 'grass', x, y, z, scale, stretch, rotation, variant });
      }
    }
  };
  // The verges, thinning out from the road; then the hills either side, evenly.
  if (verge > 0)
    layer(
      verge,
      (scale) =>
        ROAD_GAP + GRASS_REACH * scale + Math.min(MAX_OUT, -Math.log(1 - rand()) * MEAN_OUT),
    );
  if (meadow > 0) layer(meadow, () => MEADOW_FROM + rand() * (MEADOW_TO - MEADOW_FROM));
  return out;
}

const CELL = 8;

interface Blocker {
  x: number;
  z: number;
  r: number;
  /** A solid thing (a person, a rock, a house): no blade may reach it, not just the patch's centre. */
  solid: boolean;
}

/** Trunks, spectators, rocks and houses in a coarse grid, so each patch checks only its neighbourhood. */
class BlockerGrid {
  private readonly cells = new Map<number, Blocker[]>();

  constructor(props: readonly Prop[]) {
    for (const p of props) {
      const b = blocker(p);
      if (!b) continue;
      const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
      const cell = this.cells.get(k);
      if (cell) cell.push(b);
      else this.cells.set(k, [b]);
    }
  }

  blocks(x: number, z: number, reach: number): boolean {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const b of this.cells.get(key(cx + i, cz + j)) ?? [])
          if (Math.hypot(b.x - x, b.z - z) < b.r + (b.solid ? reach : 0)) return true;
    return false;
  }
}

function blocker(p: Prop): Blocker | null {
  const at = { x: p.x, z: p.z };
  switch (p.kind) {
    case 'tree':
    case 'broadleaf':
    case 'sapling':
      return { ...at, r: TRUNK_GAP * p.scale, solid: false };
    case 'spectator':
      return { ...at, r: 0.5, solid: true };
    case 'rock':
      return { ...at, r: 1 * p.scale, solid: true };
    case 'house':
      return { ...at, r: 4.5 * p.scale, solid: true };
    default:
      return null;
  }
}

const key = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);
