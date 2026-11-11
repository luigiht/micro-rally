import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/game/rng';
import { createRoadHit } from '@/game/stage/RoadPath';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { createStageWorld } from '@/game/stage/StageWorld';
import { GravelStoneBuilder, lateralAt } from '@/render/road/GravelStones';
import { stageIndexOf } from './stageIndex';

describe('the gravel road', () => {
  it('throws most stones to the edges and the hump between the tracks', () => {
    const rand = mulberry32(5);
    const hw = 3.5;
    const lats = Array.from({ length: 4000 }, () => lateralAt(hw, rand));
    for (const l of lats) expect(Math.abs(l)).toBeLessThanOrEqual(hw + 0.3);
    const edges = lats.filter((l) => Math.abs(l) > hw - 1.5).length;
    const hump = lats.filter((l) => Math.abs(l) < 0.4).length;
    expect(edges / lats.length).toBeGreaterThan(0.5);
    expect(hump / lats.length).toBeGreaterThan(0.2);
  });

  it('strews stones along the whole Pinewood road, on it, the same every time', () => {
    const { stage, field } = createStageWorld(2, stageIndexOf('pinewood', 1));
    const a = new GravelStoneBuilder(stage, field);
    const b = new GravelStoneBuilder(stage, field);
    const meshes = a.group.children as unknown as {
      count: number;
      getMatrixAt(i: number, m: Matrix4): void;
    }[];
    const total = meshes.reduce((s, m) => s + m.count, 0);
    expect(total / stage.path.length).toBeGreaterThan(2);
    const m = new Matrix4();
    const p = new Vector3();
    const hit = createRoadHit();
    let checked = 0;
    for (const mesh of meshes)
      for (let i = 0; i < mesh.count; i += 7) {
        mesh.getMatrixAt(i, m);
        p.setFromMatrixPosition(m);
        expect(stage.path.nearest(p.x, p.z, 20, hit)).toBe(true);
        expect(hit.distance).toBeLessThan(halfWidthAt(stage, hit.along) + 0.35);
        checked++;
      }
    expect(checked).toBeGreaterThan(100);
    const first = (x: GravelStoneBuilder) => {
      const mm = new Matrix4();
      (x.group.children[0] as unknown as { getMatrixAt(i: number, m: Matrix4): void }).getMatrixAt(
        3,
        mm,
      );
      return mm.elements;
    };
    expect(first(b)).toEqual(first(a));
    a.dispose();
    b.dispose();
  });
});
