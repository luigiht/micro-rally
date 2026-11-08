import { createNoise2D } from 'simplex-noise';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/game/rng';
import { createRoadHit } from '@/game/stage/RoadPath';
import { ROAD_LIFT } from '@/game/stage/TerrainField';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { createStageWorld } from '@/game/stage/StageWorld';
import { TerrainDetail } from '@/game/stage/TerrainDetail';
import { stageIndexOf } from './stageIndex';

/** A Forest stage on mud, and one not on mud. */
function forestStages(): { mud: [number, number]; dry: [number, number] } {
  return { mud: [2, stageIndexOf('forest', 'mud')], dry: [2, stageIndexOf('forest', 'gravel')] };
}

describe('terrain detail', () => {
  it('heaps a berm rounded across its spine and bumps the open ground a little, nothing by the road', () => {
    const d = new TerrainDetail(createNoise2D(mulberry32(7)));
    d.setMounds([{ x0: 0, z0: 0, x1: 10, z1: 0, radius: 1.6, height: 0.6 }]);
    expect(d.mound(5, 0)).toBeCloseTo(0.6, 5);
    expect(d.mound(5, 0.8)).toBeGreaterThan(0.2);
    expect(d.mound(5, 0.8)).toBeLessThan(0.6);
    expect(d.mound(5, 1.7)).toBe(0);
    // Round ends: past the segment the berm falls away the same way.
    expect(d.mound(10.8, 0)).toBeCloseTo(d.mound(5, 0.8), 5);
    expect(d.onMound(5, 1.9, 0.5)).toBe(true);
    expect(d.onMound(5, 2.3, 0.5)).toBe(false);
    let max = 0;
    let spread = 0;
    for (let i = 0; i < 400; i++) {
      const b = d.bumps(i * 1.37, i * 2.11, 1);
      max = Math.max(max, Math.abs(b));
      spread += Math.abs(b);
      expect(d.bumps(i * 1.37, i * 2.11, 0)).toBe(0);
    }
    expect(max).toBeLessThan(0.37);
    expect(spread / 400).toBeGreaterThan(0.04);
    expect(new TerrainDetail(null).bumps(3, 4, 1)).toBe(0);
  });

  it('keeps the carriageway level and bumps the ground off it', () => {
    const { field, stage } = createStageWorld(1, 0);
    const s = { x: 0, z: 0, heading: 0 };
    let offroad = 0;
    for (let d = 100; d < stage.path.length - 100; d += 50) {
      stage.path.sample(d, s);
      expect(field.heightAt(s.x, s.z)).toBeCloseTo(field.roadHeightAt(d) + ROAD_LIFT, 3);
      // 40 m out, two points 3 m apart along the road differ by more than the broad relief would.
      const lx = Math.cos(s.heading);
      const lz = -Math.sin(s.heading);
      const fx = Math.sin(s.heading);
      const fz = Math.cos(s.heading);
      const a = field.heightAt(s.x + lx * 40, s.z + lz * 40);
      const b = field.heightAt(s.x + lx * 40 + fx * 3, s.z + lz * 40 + fz * 3);
      offroad = Math.max(offroad, Math.abs(a - b));
    }
    expect(offroad).toBeGreaterThan(0.05);
  });

  it('puts a berm before every group and the start and finish crowds on mud, none off mud', () => {
    const { mud, dry } = forestStages();
    const dryWorld = createStageWorld(...dry);
    scatterScenery(dryWorld.field);
    expect(dryWorld.field.onMound(0, 0, 1e6)).toBe(false);

    const { field, stage } = createStageWorld(...mud);
    const people = scatterScenery(field).filter((p) => p.kind === 'spectator');
    const hit = createRoadHit();
    const s = { x: 0, z: 0, heading: 0 };
    let behind = 0;
    let checked = 0;
    for (const p of people) {
      stage.path.nearest(p.x, p.z, 40, hit);
      // Checkpoint and jump crowds stand at the old line, without a berm.
      if (hit.distance < stage.halfWidth + 6.5) continue;
      checked++;
      // The berm's crest, between this spectator and the road.
      stage.path.sample(hit.along, s);
      const side = Math.sign(hit.lateral);
      const crest = stage.halfWidth + 3.4 + 1.6;
      const cx = s.x + Math.cos(s.heading) * crest * side;
      const cz = s.z - Math.sin(s.heading) * crest * side;
      if (field.onMound(cx, cz)) behind++;
      // Standing behind it, never on it.
      expect(field.onMound(p.x, p.z)).toBe(false);
    }
    expect(checked).toBeGreaterThan(100);
    expect(behind / checked).toBeGreaterThan(0.95);
  }, 30_000);
});
