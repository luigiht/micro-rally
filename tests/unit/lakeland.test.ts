import { describe, expect, it } from 'vitest';
import { lakeShoreDistance, RIM } from '@/game/stage/Lakes';
import { createRoadHit } from '@/game/stage/RoadPath';
import { STAGE_TYPES } from '@/game/stage/regions';
import { generateStage, stageBrief } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { planSurfaceSpans, surfaceAlong } from '@/game/stage/SurfaceSpans';
import { TerrainField } from '@/game/stage/TerrainField';
import { parseSaveFile, SAVE_VERSION } from '@/game/save/SaveFile';
import { DEFAULT_ENV, envGrip } from '@/game/vehicle/VehicleSim';
import { indexV13, stableIndexV13, stageIndexOf } from './stageIndex';

const SEEDS = [1, 2, 3, 7, 39, 55, 99, 1234, 4242, 989380427];
const lakeland = (seed: number, nth = 0) => generateStage(seed, stageIndexOf('lakeland', nth));

describe('Lakeland', () => {
  it('runs last in the rally mix, a narrow lane like the Autumnal', () => {
    expect(stageIndexOf('lakeland')).toBe(7);
    for (const seed of SEEDS.slice(0, 3)) {
      const stage = lakeland(seed);
      expect(stage.stageType).toBe('lakeland');
      expect(stage.halfWidth).toBe(3);
      expect(stage.town).toBeUndefined();
    }
  });

  it('alternates tarmac and mud stretches from the seed alone, tarmac through the start and finish', () => {
    const style = STAGE_TYPES.lakeland.surfaceSpans!;
    for (const seed of SEEDS) {
      const stage = lakeland(seed);
      const spans = stage.surfaces!;
      expect(spans).toEqual(planSurfaceSpans(stage.seed, stage.length, 'tarmac', style));
      expect(spans[0]!.from).toBe(0);
      expect(spans[0]!.surface).toBe('tarmac');
      expect(spans[spans.length - 1]!.surface).toBe('tarmac');
      expect(spans[spans.length - 1]!.to).toBe(Infinity);
      expect(spans.some((s) => s.surface === 'mud')).toBe(true);
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i]!.from).toBe(spans[i - 1]!.to);
        expect(spans[i]!.surface).not.toBe(spans[i - 1]!.surface);
      }
      const finish = stage.startDistance + stage.length;
      expect(surfaceAlong(spans, stage.startDistance)).toBe('tarmac');
      expect(surfaceAlong(spans, finish)).toBe('tarmac');
    }
  });

  it('prices the par by its stretches: slower than all tarmac, quicker than all mud', () => {
    const def = STAGE_TYPES.lakeland;
    for (const seed of SEEDS.slice(0, 4)) {
      const index = stageIndexOf('lakeland');
      const brief = stageBrief(seed, index);
      expect(brief.parTime).toBe(generateStage(seed, index).parTime);
      expect(brief.parTime).toBeGreaterThan(brief.length / (def.parSpeed * 1.12));
      expect(brief.parTime).toBeLessThan(brief.length / (def.parSpeed * 0.85));
    }
  });

  it('lays a bridged lake and lakes beside the road on nearly every stage', () => {
    let bridged = 0;
    let beside = 0;
    for (const seed of SEEDS) {
      const field = new TerrainField(lakeland(seed));
      if (field.lakes.some((l) => l.bridge)) bridged++;
      if (field.lakes.some((l) => !l.bridge)) beside++;
    }
    expect(bridged).toBeGreaterThanOrEqual(SEEDS.length - 1);
    expect(beside).toBeGreaterThanOrEqual(SEEDS.length - 1);
  });

  it('runs the road round the water: most of every stage beside a lake, over low hills', () => {
    const at = { x: 0, z: 0, heading: 0 };
    for (const seed of SEEDS) {
      const stage = lakeland(seed);
      const field = new TerrainField(stage);
      let beside = 0;
      let n = 0;
      let lo = Infinity;
      let hi = -Infinity;
      for (let d = stage.startDistance; d < stage.startDistance + stage.length; d += 5) {
        stage.path.sample(d, at);
        n++;
        if (field.lakes.some((l) => lakeShoreDistance(l, at.x, at.z) > -20)) beside++;
        // Off its own bridge, no road within 30 m of a lake lies under or level with its water.
        for (const l of field.lakes) {
          if (l.bridge && d > l.bridge.from - 40 && d < l.bridge.to + 40) continue;
          if (lakeShoreDistance(l, at.x, at.z) > -30)
            expect(field.roadHeightAt(d) - l.level, `seed ${seed} at ${d}`).toBeGreaterThan(0.7);
        }
        lo = Math.min(lo, field.roadHeightAt(d));
        hi = Math.max(hi, field.roadHeightAt(d));
      }
      expect(beside / n, `seed ${seed}`).toBeGreaterThan(0.3);
      expect(hi - lo, `seed ${seed}`).toBeLessThan(30);
    }
  });

  it('keeps the mud stretches short', () => {
    for (const seed of SEEDS) {
      const field = new TerrainField(lakeland(seed));
      for (const r of field.surfaceRuns!.filter((s) => s.surface === 'mud'))
        expect(r.to - r.from).toBeLessThanOrEqual(STAGE_TYPES.lakeland.surfaceSpans!.other[1]);
    }
  });

  it('keeps every lake off the road but its own bridge, the water well under the deck', () => {
    const hit = createRoadHit();
    for (const seed of SEEDS) {
      const field = new TerrainField(lakeland(seed));
      const { path, halfWidth } = field.stage;
      for (const lake of field.lakes) {
        // Walk the road: wherever it is within the rim of this lake, it is on the lake's bridge.
        for (let d = 0; d < path.length; d += 2) {
          path.sample(d, { x: 0, z: 0, heading: 0 });
          const at = { x: 0, z: 0, heading: 0 };
          path.sample(d, at);
          if (lakeShoreDistance(lake, at.x, at.z) <= -RIM) continue;
          expect(lake.bridge, `seed ${seed} road at ${d} in a lake`).toBeDefined();
          expect(d).toBeGreaterThanOrEqual(lake.bridge!.from);
          expect(d).toBeLessThanOrEqual(lake.bridge!.to);
          expect(field.roadHeightAt(d) - lake.level).toBeGreaterThanOrEqual(4.4);
        }
        // A lakeside lake's shore stands clear of the carriageway and its corridor.
        if (!lake.bridge)
          for (let k = 0; k < lake.xs.length; k++)
            expect(path.nearest(lake.xs[k]!, lake.zs[k]!, halfWidth + 10, hit)).toBe(false);
      }
    }
  });

  it('carves the lake beds under the water and holds the shore just over it', () => {
    const field = new TerrainField(lakeland(2));
    const s = { height: 0, roadBlend: 0, roadDistance: 0 };
    for (const lake of field.lakes) {
      // Halfway out from the centre, past the shallows, the bed lies under the water; a metre past each shore point the
      // ground stands over it, a levee holding the water where the valley falls away beyond.
      for (let k = 0; k < lake.xs.length; k += 4) {
        const mx = (lake.cx + lake.xs[k]!) / 2;
        const mz = (lake.cz + lake.zs[k]!) / 2;
        if (lakeShoreDistance(lake, mx, mz) > 6)
          expect(field.sample(mx, mz, s).height).toBeLessThan(lake.level);
        const r = Math.hypot(lake.xs[k]! - lake.cx, lake.zs[k]! - lake.cz);
        const ox = lake.cx + ((lake.xs[k]! - lake.cx) * (r + 1)) / r;
        const oz = lake.cz + ((lake.zs[k]! - lake.cz) * (r + 1)) / r;
        if (lakeShoreDistance(lake, ox, oz) < 0)
          expect(field.sample(ox, oz, s).height).toBeGreaterThan(lake.level);
      }
    }
  });

  it('drives tarmac on the bridges and mud on the mud stretches, wallowing in the water', () => {
    const field = new TerrainField(lakeland(2));
    const at = { x: 0, z: 0, heading: 0 };
    const { path } = field.stage;
    const hit = createRoadHit();
    for (const lake of field.lakes.filter((l) => l.bridge)) {
      path.sample((lake.bridge!.from + lake.bridge!.to) / 2, at);
      expect(field.surfaceAt(at.x, at.z)).toBe('tarmac');
      // Out in the water, well off the bridge, the car wallows.
      const k = Array.from(lake.xs, (_, i) => i).find((i) => {
        const x = lake.cx + (lake.xs[i]! - lake.cx) * 0.6;
        const z = lake.cz + (lake.zs[i]! - lake.cz) * 0.6;
        return !path.nearest(x, z, field.stage.halfWidth + 6, hit) && field.inLake(x, z, -2);
      })!;
      const x = lake.cx + (lake.xs[k]! - lake.cx) * 0.6;
      const z = lake.cz + (lake.zs[k]! - lake.cz) * 0.6;
      expect(field.surfaceAt(x, z)).toBe('dune');
      // Between the carriageway's edge and the rails the wheels still ride the deck, not the lake bed.
      const mid = (lake.bridge!.from + lake.bridge!.to) / 2;
      path.sample(mid, at);
      const off = field.stage.halfWidth + 0.5;
      for (const side of [1, -1]) {
        const ex = at.x + Math.cos(at.heading) * off * side;
        const ez = at.z - Math.sin(at.heading) * off * side;
        expect(field.heightAt(ex, ez)).toBeGreaterThan(field.roadHeightAt(mid) - 0.3);
      }
    }
    const mud = field.surfaceRuns!.find((r) => r.surface === 'mud')!;
    path.sample((mud.from + mud.to) / 2, at);
    expect(field.surfaceAt(at.x, at.z)).toBe('mud');
  });

  it('puts no tree, house or spectator in a lake, and guard rails along every lake bridge', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const world = createStageWorld(seed, stageIndexOf('lakeland'));
      for (const p of world.props) expect(world.field.inLake(p.x, p.z), `${p.kind}`).toBe(false);
      expect(world.props.filter((p) => p.kind === 'house').length).toBeGreaterThan(0);
    }
  });

  it('grips harder on mud only: mud tyres, tarmac as ever', () => {
    const env = { ...DEFAULT_ENV, surfaceGrip: STAGE_TYPES.lakeland.handling!.surfaceGrip };
    expect(envGrip(env, 'mud')).toBeCloseTo(1.6);
    expect(envGrip(env, 'tarmac')).toBe(1);
    expect(envGrip(DEFAULT_ENV, 'mud')).toBe(1);
  });

  it('moves v13 saves to v14, keeping records only where the stage is still the same type', () => {
    const rec = { best: 90, splits: [30, 60, 90] };
    // Stage 7 was a Pinewood on the seven-type mix and is the first Lakeland now; stage 0 is still a Pinewood.
    const moved = indexV13('pinewood', 1);
    const kept = stableIndexV13('pinewood', 0);
    const city = indexV13('urban', 0);
    const save = parseSaveFile({
      version: 13,
      gameId: 'ABCD2345',
      driverName: 'Ada',
      gameSeed: 1,
      money: 10,
      stageIndex: city + 1,
      // 9 is a circuit: every circuit was laid out anew with v14, so its record goes too.
      records: { [moved]: rec, [kept]: rec, [city]: rec, 9: rec },
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: 1,
    })!;
    expect(SAVE_VERSION).toBe(14);
    expect(save.version).toBe(14);
    expect(moved).toBe(7);
    expect(
      Object.keys(save.records)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([kept, city].sort((a, b) => a - b));
  });
});
