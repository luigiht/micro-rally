import { describe, expect, it } from 'vitest';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { stageHasTown, stageTypeAt } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { ROAD_LIFT, VERGE_WIDTH, type TerrainField } from '@/game/stage/TerrainField';

/** The terrain chunks' grid: `DEFAULT_STAGE_RENDER` meshes 64 m chunks at 32 cells. */
const STEP = 2;

/**
 * The terrain mesh's height at (x, z): the field sampled at the grid's
 * corners, blended across the same two triangles per cell that
 * `meshTerrainChunk` emits (split along the cell's (0,0)–(1,1) diagonal).
 */
function meshHeight(field: TerrainField, cache: Map<number, number>) {
  const s = { height: 0, roadBlend: 0, roadDistance: 0 };
  const corner = (i: number, j: number) => {
    const key = i * 1_000_003 + j;
    let h = cache.get(key);
    if (h === undefined) {
      field.sample(i * STEP, j * STEP, s);
      h = s.height;
      cache.set(key, h);
    }
    return h;
  };
  return (x: number, z: number) => {
    const i = Math.floor(x / STEP);
    const j = Math.floor(z / STEP);
    const fx = x / STEP - i;
    const fz = z / STEP - j;
    const a = corner(i, j);
    const b = corner(i, j + 1);
    const c = corner(i + 1, j + 1);
    const d = corner(i + 1, j);
    return fz >= fx ? a + fx * (c - b) + fz * (b - a) : a + fx * (d - a) + fz * (c - d);
  };
}

describe('terrain under the verge strips', () => {
  it('never shares the strip’s plane, so no terrain face flickers through the Autumnal verge', () => {
    let index = 0;
    while (stageTypeAt(index).stageType !== 'autumnal' || stageHasTown(index)) {
      index++;
      if (index > 200) throw new Error('no open-road Autumnal stage in the first 200');
    }
    const { stage, field } = createStageWorld(1, index);
    const mesh = meshHeight(field, new Map());
    const at = { x: 0, z: 0, heading: 0 };
    let samples = 0;
    let close = 0;
    for (let d = 20; d < Math.min(1500, stage.path.length - 20); d += 1) {
      stage.path.sample(d, at);
      const hw = halfWidthAt(stage, d);
      const lx = Math.cos(at.heading);
      const lz = -Math.sin(at.heading);
      const strip = field.roadHeightAt(d) + ROAD_LIFT;
      for (const side of [1, -1]) {
        for (let e = 0.1; e < VERGE_WIDTH; e += 0.2) {
          const off = side * (hw + e);
          const gap = strip - mesh(at.x + lx * off, at.z + lz * off);
          samples++;
          // Where the Autumnal verge fades from the mud (its inner 1.6 m), the mesh stays clearly under it.
          if (e < 1.6) expect(gap).toBeGreaterThan(0.01);
          if (gap < 0.03) close++;
        }
      }
    }
    // Across the whole strip, hardly anywhere is the mesh within 3 cm of it (it was 60–90 %).
    expect(close / samples).toBeLessThan(0.03);
  }, 60_000);
});
