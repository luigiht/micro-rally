import { describe, expect, it } from 'vitest';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { stageHasTown, stageTypeAt } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { ROAD_LIFT, VERGE_WIDTH, type TerrainField } from '@/game/stage/TerrainField';
import { stageIndexOf } from './stageIndex';

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

/** The first open-road (townless) Autumnal stage. */
function autumnalIndex(): number {
  let index = 0;
  while (stageTypeAt(index).stageType !== 'autumnal' || stageHasTown(index)) {
    index++;
    if (index > 200) throw new Error('no open-road Autumnal stage in the first 200');
  }
  return index;
}

describe('terrain under the verge strips', () => {
  it('never shares the strip’s plane, so no terrain face flickers through the Autumnal verge', () => {
    const { stage, field } = createStageWorld(1, autumnalIndex());
    const mesh = meshHeight(field, new Map());
    const at = { x: 0, z: 0, heading: 0 };
    let samples = 0;
    let close = 0;
    for (let d = 20; d < Math.min(1500, stage.path.length - 20); d += 1) {
      stage.path.sample(d, at);
      const hw = halfWidthAt(stage, d);
      const lx = Math.cos(at.heading);
      const lz = -Math.sin(at.heading);
      const deck = field.roadHeightAt(d) + ROAD_LIFT;
      for (const side of [1, -1]) {
        for (let e = 0.1; e < VERGE_WIDTH; e += 0.2) {
          // The strip slopes down the built-up lane's bank with the ground.
          const strip = deck - field.bankDrop(e);
          const off = side * (hw + e);
          const gap = strip - mesh(at.x + lx * off, at.z + lz * off);
          // Where the Autumnal verge fades from the mud (its inner 1.6 m), the mesh stays clearly under it.
          if (e < 1.6) expect(gap).toBeGreaterThan(0.01);
          // Its last half metre is the ground's own colour, where the bed rises to meet its edge.
          if (e > VERGE_WIDTH - 0.5) continue;
          samples++;
          if (gap < 0.03) close++;
        }
      }
    }
    // Across the strip short of its edge, hardly anywhere is the mesh within 3 cm of it (it was 60–90 %).
    expect(close / samples).toBeLessThan(0.03);
  }, 60_000);

  it('builds the Autumnal lane up on a bank: the ground falls 0.55 m across each verge, for the wheels too', () => {
    const { stage, field } = createStageWorld(1, autumnalIndex());
    const forest = createStageWorld(1, stageIndexOf('forest', 1));
    const at = { x: 0, z: 0, heading: 0 };
    let checked = 0;
    for (let d = 100; d < 1500; d += 50) {
      if (stage.town && d > stage.town.from - 200 && d < stage.town.to + 200) continue;
      stage.path.sample(d, at);
      const hw = halfWidthAt(stage, d);
      const deck = field.roadHeightAt(d) + ROAD_LIFT;
      const lx = Math.cos(at.heading);
      const lz = -Math.sin(at.heading);
      for (const side of [1, -1]) {
        const h = (e: number) =>
          field.heightAt(at.x + lx * side * (hw + e), at.z + lz * side * (hw + e));
        expect(h(0.1)).toBeCloseTo(deck, 1);
        expect(deck - h(2.9)).toBeGreaterThan(0.45);
        expect(h(1.5)).toBeLessThan(h(0.3));
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
    expect(forest.field.bankDrop(3)).toBe(0);
  });
});
