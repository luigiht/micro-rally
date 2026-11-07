import { describe, expect, it } from 'vitest';
import { inOasis, OASIS_WATER_ABOVE } from '@/game/stage/Oases';
import { REGION_CYCLE, REGIONS } from '@/game/stage/regions';
import { createRoadHit } from '@/game/stage/RoadPath';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { generateStage, stageBrief, stageHasTown, stageRegion } from '@/game/stage/StageGenerator';
import { TerrainField } from '@/game/stage/TerrainField';
import { SURFACES } from '@/game/vehicle/surfaces';
import { OasisBuilder } from '@/render/terrain/OasisBuilder';

/** The first Desert stage of the cycle. */
const DESERT_INDEX = 7;
const SEEDS = [1, 2, 3, 4, 5, 6];

const fields = new Map<number, TerrainField>();
function fieldFor(seed: number): TerrainField {
  let f = fields.get(seed);
  if (!f) {
    f = new TerrainField(generateStage(seed, DESERT_INDEX));
    scatterScenery(f);
    fields.set(seed, f);
  }
  return f;
}

describe('Desert stages', () => {
  it('never carry a town, even on a town index', () => {
    // Index 14 is a desert stage on a town index: no village, and the brief charges no town time.
    expect(stageRegion(14).region).toBe('desert');
    expect(stageHasTown(14)).toBe(false);
    for (let i = 0; i < 48; i++)
      if (stageRegion(i).region === 'desert') expect(stageHasTown(i)).toBe(false);
    for (const seed of [1, 2, 3]) {
      const stage = generateStage(seed, 14);
      expect(stage.town).toBeUndefined();
      expect(stageBrief(seed, 14).parTime).toBe(stage.parTime);
    }
  });

  it('sit in the cycle on a packed-sand piste through soft sand', () => {
    expect(REGION_CYCLE).toHaveLength(15);
    expect(stageRegion(DESERT_INDEX).region).toBe('desert');
    expect(SURFACES.sand.grip).toBeLessThan(SURFACES.gravel.grip);
    expect(SURFACES.sand.grip).toBeGreaterThan(SURFACES.dune.grip);
    expect(SURFACES.dune.drag).toBeGreaterThan(SURFACES.sand.drag);
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const stage = field.stage;
      expect(stage.region).toBe('desert');
      expect(stage.surface).toBe('sand');
      const g = stage.gates[1]!;
      expect(field.surfaceAt(g.x, g.z)).toBe('sand');
      const far = stage.halfWidth + 40;
      expect(
        field.surfaceAt(g.x + Math.cos(g.heading) * far, g.z - Math.sin(g.heading) * far),
      ).toBe('dune');
      for (let d = 0; d < stage.path.length - 2; d += 2)
        expect(Math.abs(field.roadHeightAt(d + 2) - field.roadHeightAt(d))).toBeLessThanOrEqual(
          0.25,
        );
    }
  });

  it('rolls in dunes: the bare ground rises and falls by metres across a few hundred metres', () => {
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      let lo = Infinity;
      let hi = -Infinity;
      for (let x = -300; x <= 300; x += 20)
        for (let z = -300; z <= 300; z += 20) {
          const h = field.baseHeight(x, z);
          lo = Math.min(lo, h);
          hi = Math.max(hi, h);
        }
      expect(hi - lo).toBeGreaterThan(8);
      expect(hi - lo).toBeLessThan(40);
    }
  });

  it('plans oases off the road, sinks each into a flat hollow, and rings it with palms', () => {
    for (const seed of SEEDS) {
      const field = fieldFor(seed);
      const { stage, oases } = field;
      expect(oases.length).toBeGreaterThanOrEqual(2);
      const hit = createRoadHit();
      for (const o of oases) {
        expect(stage.path.nearest(o.x, o.z, stage.halfWidth + 22, hit)).toBe(false);
        // The floor is flat at the pad height, under the water.
        expect(field.heightAt(o.x, o.z)).toBeCloseTo(o.y, 3);
        expect(field.heightAt(o.x + o.radius * 0.6, o.z)).toBeCloseTo(o.y, 3);
        // The rim climbs out of the water within the blend.
        expect(field.heightAt(o.x + o.radius + 8, o.z)).toBeGreaterThan(o.y + OASIS_WATER_ABOVE);
        for (const p of oases)
          if (p !== o) expect(Math.hypot(p.x - o.x, p.z - o.z)).toBeGreaterThan(79);
      }
      const props = scatterScenery(field);
      const palms = props.filter((p) => p.kind === 'palm');
      expect(palms.length).toBeGreaterThanOrEqual(oases.length * 6);
      for (const p of palms) {
        const near = oases.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < o.radius + 7);
        expect(near).toBe(true);
      }
      // Nothing but the oasis's own palms and scrub stands in a pool.
      for (const p of props)
        if (p.kind !== 'palm' && p.kind !== 'bush') expect(inOasis(oases, p.x, p.z)).toBe(false);
      expect(props.some((p) => p.kind === 'tree' || p.kind === 'house')).toBe(false);
    }
  });

  it('builds the pools as one mesh', () => {
    const field = fieldFor(1);
    const pools = new OasisBuilder(field.oases, REGIONS.coast.coast!.sea);
    expect(pools.group.children).toHaveLength(1);
    pools.dispose();
  });
});
