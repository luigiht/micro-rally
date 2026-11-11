import { hashSeed, mulberry32 } from '../rng';
import { stageScenery } from './regions';
import { createRoadHit, type RoadSample } from './RoadPath';
import type { Prop } from './SceneryScatter';
import type { TerrainField } from './TerrainField';
import { townBlocks } from './Town';

/** Leaves start this far past the carriageway's edge: on the verge, never on the road. */
const FROM_EDGE = 0.4;
/** Mean distance out over the grass, metres: most lie within sight of the road. */
const MEAN_OUT = 5;
const MAX_OUT = 45;
/** Sampling step along the road, metres. */
const STEP = 5;
/** Clusters under each broadleaf, within this share of its canopy radius (2.2 m × scale). */
const UNDER_TREE = 3;
const CANOPY = 2.2;
/** Lifted a hair over the ground so the flat leaves don't fight it for depth. */
const LIFT = 0.02;
/** Ground slope is read over this span either side, metres. */
const SLOPE_SPAN = 0.5;
/** Leaf colour variants the renderer tints from. */
export const LEAF_VARIANTS = 4;

/**
 * Fallen leaves on the ground: small clusters lying flat on the grass and
 * the verges (tilted to the slope) along the road, and a few under every
 * broadleaf, for stage types whose scenery sets `leaves`. Visual only (no
 * colliders), deterministic per stage, and drawn from its own random stream,
 * so the trees and crowds stand exactly where they did without them.
 */
export function scatterLeaves(field: TerrainField, props: readonly Prop[]): Prop[] {
  const stage = field.stage;
  const perHundred = stageScenery(stage.stageType).leaves ?? 0;
  if (perHundred <= 0) return [];
  const rand = mulberry32(hashSeed(stage.seed, 'leaves'));
  const path = stage.path;
  const hit = createRoadHit();
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const out: Prop[] = [];

  const lay = (x: number, z: number) => {
    // Off every stretch of road (other legs of a hairpin too) and out of the town's buildings.
    if (path.nearest(x, z, stage.halfWidth + FROM_EDGE, hit)) return;
    if (stage.town && townBlocks(stage.town, x, z)) return;
    // Lie in the slope's plane: point local +z downhill and pitch by the slope's angle.
    const gx =
      (field.heightAt(x + SLOPE_SPAN, z) - field.heightAt(x - SLOPE_SPAN, z)) / (2 * SLOPE_SPAN);
    const gz =
      (field.heightAt(x, z + SLOPE_SPAN) - field.heightAt(x, z - SLOPE_SPAN)) / (2 * SLOPE_SPAN);
    const slope = Math.hypot(gx, gz);
    out.push({
      kind: 'leaves',
      x,
      y: field.heightAt(x, z) + LIFT,
      z,
      scale: 0.7 + rand() * 0.6,
      rotation: slope > 1e-4 ? Math.atan2(-gx, -gz) : rand() * Math.PI * 2,
      pitch: Math.atan(slope),
      variant: Math.floor(rand() * LEAF_VARIANTS),
    });
  };

  for (let d = 0; d < path.length; d += STEP) {
    const expected = (perHundred * STEP) / 100;
    let n = Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);
    while (n-- > 0) {
      path.sample(d + rand() * STEP, sample);
      const side = rand() < 0.5 ? -1 : 1;
      const offset =
        stage.halfWidth + FROM_EDGE + Math.min(MAX_OUT, -Math.log(1 - rand()) * MEAN_OUT);
      lay(
        sample.x + Math.cos(sample.heading) * offset * side,
        sample.z - Math.sin(sample.heading) * offset * side,
      );
    }
  }
  for (const p of props) {
    if (p.kind !== 'broadleaf') continue;
    for (let i = 0; i < UNDER_TREE; i++) {
      const r = (0.3 + rand() * 0.7) * CANOPY * p.scale;
      const a = rand() * Math.PI * 2;
      lay(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
    }
  }
  return out;
}
