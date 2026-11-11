import { Box3, Color } from 'three';
import { describe, expect, it } from 'vitest';
import { stagePalette } from '@/game/stage/regions';
import { createStageWorld } from '@/game/stage/StageWorld';
import { rallyKits } from '@/render/scenery/kits/RallyKits';
import {
  canopyGeometry,
  firGeometry,
  foliageGeometry,
  ovalCanopyGeometry,
  spireGeometry,
  tieredCanopyGeometry,
} from '@/render/scenery/TreeGeometry';
import { stageIndexOf } from './stageIndex';

describe('autumn trees', () => {
  const palette = stagePalette('autumnal');
  const kits = rallyKits(palette, false, false);
  const { props } = createStageWorld(3, stageIndexOf('autumnal', 1));

  it('give every Autumnal tree exactly one of three silhouettes, all three in use', () => {
    for (const kind of ['tree', 'broadleaf'] as const) {
      const shapes = kits.filter((k) => k.sources.length === 1 && k.sources[0] === kind);
      expect(shapes).toHaveLength(3);
      const trees = props.filter((p) => p.kind === kind);
      const counts = shapes.map((k) => trees.filter((p) => k.accept!(p)).length);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(trees.length);
      for (const c of counts) expect(c).toBeGreaterThan(trees.length * 0.15);
    }
  });

  it('colour each from the autumn mix, the same on every visit, in at least five colours', () => {
    const kit = kits.find((k) => k.sources[0] === 'broadleaf')!;
    const crowns = palette.autumn!.broadleaves.map((c) => new Color(c));
    const seen = new Set<number>();
    const a = new Color();
    const b = new Color();
    for (const p of props.filter((q) => q.kind === 'broadleaf')) {
      kit.colorAt!(p, a);
      kit.colorAt!(p, b);
      expect(a.equals(b)).toBe(true);
      const base = crowns.findIndex((c) => Math.abs(a.r / c.r - a.g / c.g) < 1e-6 || c.g === 0);
      expect(base).toBeGreaterThanOrEqual(0);
      seen.add(base);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('leave the other regions on their two-tone pine and broadleaf', () => {
    const forest = rallyKits(stagePalette('forest'), false, false);
    const trees = forest.filter((k) => k.sources.length === 1 && k.sources[0] === 'tree');
    expect(trees).toHaveLength(1);
    expect(trees[0]!.colorAt).toBeUndefined();
  });

  it('start every silhouette’s foliage above the trunk’s foot and keep it tree-sized', () => {
    for (const make of [
      foliageGeometry,
      firGeometry,
      spireGeometry,
      canopyGeometry,
      ovalCanopyGeometry,
      tieredCanopyGeometry,
    ]) {
      const geo = make();
      const box = new Box3().setFromBufferAttribute(geo.getAttribute('position') as never);
      expect(box.min.y).toBeGreaterThan(1);
      expect(box.max.y).toBeLessThan(6.5);
      expect(box.max.x - box.min.x).toBeLessThan(4);
      geo.dispose();
    }
  });
});
