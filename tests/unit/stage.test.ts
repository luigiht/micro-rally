import { describe, expect, it } from 'vitest';
import { CheckpointTracker, crossesGate, type Gate } from '@/game/stage/Checkpoints';
import { createRoadHit, RoadPath } from '@/game/stage/RoadPath';
import { propObstacles, scatterScenery } from '@/game/stage/SceneryScatter';
import { generateStage, stageRegion } from '@/game/stage/StageGenerator';
import { StageRun, TREE_PENALTY_SECONDS } from '@/game/stage/StageRun';
import { ROAD_LIFT, TerrainField } from '@/game/stage/TerrainField';
import { ObstacleGrid, resolveObstacleCollisions } from '@/game/vehicle/Collisions';
import { createVehicleState } from '@/game/vehicle/VehicleSim';

const gate = (distance: number, z: number): Gate => ({
  kind: 'checkpoint',
  distance,
  x: 0,
  z,
  heading: 0,
  halfWidth: 5,
});

describe('RoadPath', () => {
  it('resamples to even spacing and finds signed lateral offsets', () => {
    const path = RoadPath.fromPolyline([0, 0, 0, 100], 2);
    expect(path.count).toBe(51);
    const hit = createRoadHit();
    expect(path.nearest(3, 40, 10, hit)).toBe(true);
    expect(hit.along).toBeCloseTo(40);
    expect(hit.lateral).toBeCloseTo(3); // +x is left when travelling +z
    expect(path.nearest(30, 40, 10, hit)).toBe(false);
  });
});

describe('Checkpoints', () => {
  it('detects forward crossings inside the gate only', () => {
    const g = gate(10, 10);
    expect(crossesGate(g, 0, 9, 0, 11)).toBe(true);
    expect(crossesGate(g, 0, 11, 0, 9)).toBe(false);
    expect(crossesGate(g, 8, 9, 8, 11)).toBe(false);
  });

  it('enforces checkpoint order', () => {
    const t = new CheckpointTracker([gate(10, 10), gate(20, 20), gate(30, 30)]);
    expect(t.update(0, 19, 0, 21)).toBe(-1);
    expect(t.update(0, 9, 0, 11)).toBe(0);
    expect(t.update(0, 29, 0, 31)).toBe(-1);
    expect(t.update(0, 19, 0, 21)).toBe(1);
    expect(t.update(0, 29, 0, 31)).toBe(2);
    expect(t.finished).toBe(true);
  });
});

describe('StageGenerator', () => {
  it('is deterministic for the same seed and index', () => {
    const a = generateStage(42, 0);
    const b = generateStage(42, 0);
    expect(a.name).toBe(b.name);
    expect(a.length).toBe(b.length);
    expect(Array.from(a.path.xs)).toEqual(Array.from(b.path.xs));
    expect(generateStage(43, 0).path.xs[100]).not.toBe(a.path.xs[100]);
  });

  it('places gates in order along the road ending with the finish', () => {
    const s = generateStage(7, 1);
    expect(s.gates.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < s.gates.length; i++) {
      expect(s.gates[i]!.distance).toBeGreaterThan(s.gates[i - 1]!.distance);
    }
    expect(s.gates.at(-1)!.kind).toBe('finish');
    expect(s.path.length).toBeGreaterThan(s.startDistance + s.length);
    expect(s.parTime).toBeGreaterThan(60);
  });

  it('is curvy but never brings distant parts of the road close together', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const p = generateStage(seed * 7919, seed % 3).path;
      let turn = 0;
      for (let i = 1; i < p.count; i++) {
        const dh = p.headings[i]! - p.headings[i - 1]!;
        turn += Math.abs(Math.atan2(Math.sin(dh), Math.cos(dh)));
      }
      expect(turn / (p.length / 1000)).toBeGreaterThan(8);
      let minSep = Infinity;
      for (let i = 0; i < p.count; i += 4) {
        for (let j = i + 100; j < p.count; j += 4) {
          minSep = Math.min(minSep, Math.hypot(p.xs[i]! - p.xs[j]!, p.zs[i]! - p.zs[j]!));
        }
      }
      expect(minSep).toBeGreaterThan(50);
    }
  });

  it('loops regions and grows stages on later loops', () => {
    expect(stageRegion(0)).toEqual({ region: 'forest', loop: 0 });
    const later = stageRegion(30);
    expect(later.loop).toBeGreaterThan(0);
  });
});

describe('TerrainField', () => {
  const stage = generateStage(99, 0);
  const field = new TerrainField(stage);

  it('reports the stage surface on the road and grass off it', () => {
    const g = stage.gates[0]!;
    expect(field.surfaceAt(g.x, g.z)).toBe(stage.surface);
    const far = stage.halfWidth + 40;
    expect(field.surfaceAt(g.x + Math.cos(g.heading) * far, g.z - Math.sin(g.heading) * far)).toBe(
      'grass',
    );
  });

  it('keeps the road bed flat across its width and grade-limited', () => {
    const g = stage.gates[1]!;
    const lx = Math.cos(g.heading);
    const lz = -Math.sin(g.heading);
    const centre = field.heightAt(g.x, g.z);
    const edge = field.heightAt(
      g.x + lx * (stage.halfWidth - 0.5),
      g.z + lz * (stage.halfWidth - 0.5),
    );
    expect(Math.abs(edge - centre)).toBeLessThan(0.15);
    for (let d = 0; d < stage.path.length - 2; d += 2) {
      expect(Math.abs(field.roadHeightAt(d + 2) - field.roadHeightAt(d))).toBeLessThanOrEqual(0.25);
    }
  });

  it('lifts the driving surface onto the road ribbon, but not the terrain bed beside it', () => {
    const g = stage.gates[1]!;
    const lx = Math.cos(g.heading);
    const lz = -Math.sin(g.heading);
    const bed = { height: 0, roadBlend: 0, roadDistance: 0 };
    field.sample(g.x, g.z, bed);
    expect(field.heightAt(g.x, g.z)).toBeCloseTo(bed.height + ROAD_LIFT, 6);
    const off = stage.halfWidth + 1;
    field.sample(g.x + lx * off, g.z + lz * off, bed);
    expect(field.heightAt(g.x + lx * off, g.z + lz * off)).toBeCloseTo(bed.height, 6);
  });

  it('scatters scenery off the road, deterministically', () => {
    const props = scatterScenery(field);
    expect(props.length).toBeGreaterThan(200);
    expect(scatterScenery(field)).toEqual(props);
    const hit = createRoadHit();
    for (const p of props)
      expect(stage.path.nearest(p.x, p.z, stage.halfWidth + 2, hit)).toBe(false);
  });
});

describe('StageRun', () => {
  it('counts down, times, applies tree penalties and finishes on the last gate', () => {
    const stage = generateStage(5, 0);
    const run = new StageRun(stage);
    run.tick(1);
    expect(run.phase).toBe('countdown');
    expect(run.onImpact(10)).toBe(false);
    run.tick(2.5);
    expect(run.phase).toBe('running');
    run.tick(10);
    expect(run.onImpact(8)).toBe(true);
    expect(run.onImpact(8)).toBe(false); // cooldown
    for (const g of stage.gates) {
      const fx = Math.sin(g.heading);
      const fz = Math.cos(g.heading);
      expect(run.onMove(g.x - fx, g.z - fz, g.x + fx, g.z + fz)).toBeGreaterThanOrEqual(0);
    }
    expect(run.phase).toBe('finished');
    expect(run.totalTime).toBeCloseTo(10 + TREE_PENALTY_SECONDS);
    expect(run.splits).toHaveLength(stage.gates.length);
    expect(run.repairCost).toBeGreaterThan(0);
  });
});

describe('Collisions', () => {
  it('stops the car at a tree and reports impact speed', () => {
    const grid = new ObstacleGrid(
      propObstacles([{ kind: 'tree', x: 0, y: 0, z: 3, scale: 1, rotation: 0, variant: 0 }]),
    );
    const s = createVehicleState();
    s.vz = 15;
    s.z = 1.5;
    const impact = resolveObstacleCollisions(s, grid);
    expect(impact).toBeCloseTo(15);
    expect(s.vz).toBeLessThan(0);
  });
});

describe('StageRun progress', () => {
  it('maps road distance to a 0..1 stage fraction and holds it while off the road', () => {
    const stage = generateStage(11, 0);
    const run = new StageRun(stage);
    const at = { x: 0, z: 0, heading: 0 };
    stage.path.sample(stage.startDistance + stage.length / 2, at);
    expect(run.progressAt(at.x, at.z)).toBeCloseTo(0.5, 2);
    expect(run.progressAt(at.x + 5000, at.z + 5000)).toBeCloseTo(0.5, 2);
    stage.path.sample(stage.startDistance, at);
    expect(run.progressAt(at.x, at.z)).toBeCloseTo(0, 2);
    const fractions = run.gateFractions;
    expect(fractions.length).toBe(stage.gates.length);
    expect(fractions.at(-1)).toBeGreaterThan(0.97);
    expect(fractions.at(-1)).toBeLessThanOrEqual(1);
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]!).toBeGreaterThan(fractions[i - 1]!);
    }
  });
});
