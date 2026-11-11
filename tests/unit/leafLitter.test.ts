import { Euler, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { scatterLeaves } from '@/game/stage/LeafLitter';
import { createRoadHit } from '@/game/stage/RoadPath';
import { createStageWorld } from '@/game/stage/StageWorld';
import { leafLitterGeometry } from '@/render/scenery/LeafLitterGeometry';
import { stageIndexOf } from './stageIndex';

describe('fallen leaves', () => {
  const autumnal = createStageWorld(3, stageIndexOf('autumnal', 1));

  it('lie along an Autumnal road and under its broadleaves, the same every time, never on the road', () => {
    const { stage, field, props } = autumnal;
    const leaves = scatterLeaves(field, props);
    expect(leaves.length / (stage.path.length / 100)).toBeGreaterThan(100);
    expect(scatterLeaves(field, props)).toEqual(leaves);
    const hit = createRoadHit();
    for (const l of leaves) {
      expect(l.kind).toBe('leaves');
      expect(stage.path.nearest(l.x, l.z, stage.halfWidth + 0.39, hit)).toBe(false);
    }
    const broadleaves = props.filter((p) => p.kind === 'broadleaf');
    const under = broadleaves.filter((t) =>
      leaves.some((l) => Math.hypot(l.x - t.x, l.z - t.z) < 2.2 * t.scale),
    );
    expect(under.length / broadleaves.length).toBeGreaterThan(0.8);
  });

  it('lie in the ground’s slope', () => {
    const { field, props } = autumnal;
    const up = new Vector3();
    const ground = new Vector3();
    let checked = 0;
    for (const l of scatterLeaves(field, props)) {
      const gx = (field.heightAt(l.x + 0.5, l.z) - field.heightAt(l.x - 0.5, l.z)) / 1;
      const gz = (field.heightAt(l.x, l.z + 0.5) - field.heightAt(l.x, l.z - 0.5)) / 1;
      if (Math.hypot(gx, gz) < 0.1) continue;
      // The cluster's local up, turned the way the scenery manager turns it.
      up.set(0, 1, 0).applyEuler(new Euler(l.pitch ?? 0, l.rotation, 0, 'YXZ'));
      ground.set(-gx, 1, -gz).normalize();
      expect(up.angleTo(ground)).toBeLessThan(0.02);
      if (++checked > 200) break;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('are only shed where the stage type asks for them', () => {
    const forest = createStageWorld(3, stageIndexOf('forest', 1));
    expect(scatterLeaves(forest.field, forest.props)).toEqual([]);
  });

  it('come with taller Autumnal trees and broadleaves, and Forest ones unstretched', () => {
    const trees = autumnal.props.filter((p) => p.kind === 'tree' || p.kind === 'broadleaf');
    expect(trees.length).toBeGreaterThan(0);
    expect(trees.every((p) => p.stretch === 1.3)).toBe(true);
    const forest = createStageWorld(3, stageIndexOf('forest', 1));
    expect(forest.props.some((p) => p.stretch !== undefined)).toBe(false);
  });

  it('draws every leaf facing up', () => {
    const geo = leafLitterGeometry();
    const normals = geo.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) expect(normals.getY(i)).toBeGreaterThan(0.99);
    geo.dispose();
  });
});
