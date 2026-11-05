import { describe, expect, it } from 'vitest';
import { CheckpointTracker, crossesGate, type Gate } from '@/game/stage/Checkpoints';
import { createRoadHit, RoadPath } from '@/game/stage/RoadPath';
import {
  CANOPY_RADIUS,
  HOUSE_SLAB_TOP,
  propObstacles,
  scatterScenery,
} from '@/game/stage/SceneryScatter';
import { MARKER_CLEARANCE, MARKER_SPACING, markerDistances } from '@/game/stage/RoadMarkers';
import { REGION_CYCLE, REGIONS, isCircuitStage, stagePalette } from '@/game/stage/regions';
import { generateStage, stageBrief, stageHasTown, stageRegion } from '@/game/stage/StageGenerator';
import { StageRun, TREE_PENALTY_SECONDS } from '@/game/stage/StageRun';
import { ROAD_BED_DROP, ROAD_LIFT, TRENCH_OUT, TerrainField } from '@/game/stage/TerrainField';
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

  it('follows the region cycle, never three alike, every region three times a cycle', () => {
    const n = REGION_CYCLE.length;
    const regions = Array.from({ length: 3 * n }, (_, i) => stageRegion(i).region);
    // The cycle's region everywhere but the circuit stages, which are every tenth (index 9, 19, …).
    regions.forEach((r, i) => expect(r).toBe(isCircuitStage(i) ? 'circuit' : REGION_CYCLE[i % n]));
    expect(regions.flatMap((r, i) => (r === 'circuit' ? [i] : []))).toEqual([9, 19, 29]);
    for (let i = 2; i < regions.length; i++) {
      expect(regions[i - 2] === regions[i - 1] && regions[i - 1] === regions[i]).toBe(false);
    }
    for (const id of ['forest', 'alpine', 'coast', 'desert'])
      expect(REGION_CYCLE.filter((r) => r === id)).toHaveLength(3);
    // One circuit in every ten stages, never two in a row, never with a town, and never on a
    // stage the fixtures and region tests pin.
    for (let start = 0; start + 10 <= 100; start += 10)
      expect(
        Array.from({ length: 10 }, (_, k) => isCircuitStage(start + k)).filter(Boolean),
      ).toHaveLength(1);
    for (let i = 1; i < 100; i++) expect(isCircuitStage(i) && isCircuitStage(i - 1)).toBe(false);
    for (let i = 0; i < 100; i++) if (isCircuitStage(i)) expect(stageHasTown(i)).toBe(false);
    for (const i of [0, 1, 2, 3, 4, 5, 6, 11, 12, 15]) expect(isCircuitStage(i)).toBe(false);
    for (let seed = 1; seed <= 6; seed++) {
      const alpine = generateStage(seed, 3);
      expect(['snow', 'tarmac']).toContain(alpine.surface);
      expect(alpine.region).toBe('alpine');
    }
  });

  it('alpine roads bend more sharply than forest roads', () => {
    const curvature = (index: number) => {
      let total = 0;
      let n = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const stage = generateStage(seed, index);
        // Open-road tuning only: a stage with a town is a different kind of road.
        if (stage.town) continue;
        const { headings } = stage.path;
        let sum = 0;
        for (let i = 1; i < headings.length; i++) {
          let d = headings[i]! - headings[i - 1]!;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          sum += Math.abs(d);
        }
        total += sum / headings.length;
        n++;
      }
      return total / n;
    };
    expect(curvature(3)).toBeGreaterThan(curvature(0) * 1.15);
  });

  it('steps the difficulty loop every six stages, apart from the region cycle', () => {
    expect(stageRegion(0)).toEqual({ region: 'forest', loop: 0 });
    expect(stageRegion(5).loop).toBe(0);
    expect(stageRegion(6).loop).toBe(1);
    expect(stageRegion(30).loop).toBe(5);
  });
});

describe('stagePalette', () => {
  it('forest mud stages wear autumn in the trees only; every other stage keeps its region palette', () => {
    const summer = REGIONS.forest.palette;
    const autumn = stagePalette({ region: 'forest', surface: 'mud' });
    expect(autumn).not.toBe(summer);
    expect(stagePalette({ region: 'forest', surface: 'mud' })).toBe(autumn);
    const treeKeys = ['foliage', 'foliageAlt', 'canopy', 'canopyAlt'];
    for (const key of Object.keys(summer) as (keyof typeof summer)[]) {
      expect(autumn[key] === summer[key]).toBe(!treeKeys.includes(key));
    }
    expect(stagePalette({ region: 'forest', surface: 'gravel' })).toBe(summer);
    expect(stagePalette({ region: 'forest', surface: 'tarmac' })).toBe(summer);
    expect(stagePalette({ region: 'alpine', surface: 'snow' })).toBe(REGIONS.alpine.palette);
    // Mud is a forest surface the generator actually draws, so autumn is reachable.
    const briefs = Array.from({ length: 24 }, (_, seed) => stageBrief(seed + 1, 1));
    expect(briefs.some((b) => b.surface === 'mud')).toBe(true);
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
    const road = field.roadHeightAt(g.distance);
    field.sample(g.x, g.z, bed);
    // Wheels ride the ribbon deck; the mesh bed is sunk beneath it.
    expect(field.heightAt(g.x, g.z)).toBeCloseTo(road + ROAD_LIFT, 6);
    expect(bed.height).toBeCloseTo(road - ROAD_BED_DROP, 6);
    // On the verge, mesh and driving surface coincide at deck level: no step off the road.
    const off = stage.halfWidth + 1;
    field.sample(g.x + lx * off, g.z + lz * off, bed);
    expect(field.heightAt(g.x + lx * off, g.z + lz * off)).toBeCloseTo(bed.height, 6);
    expect(bed.height).toBeCloseTo(field.roadHeightAt(g.distance) + ROAD_LIFT, 1);
  });

  it('keeps the terrain bed well under the ribbon across the whole carriageway', () => {
    const bed = { height: 0, roadBlend: 0, roadDistance: 0 };
    const at = { x: 0, z: 0, heading: 0 };
    for (let d = 0; d < stage.path.length; d += 7) {
      stage.path.sample(d, at);
      const road = field.roadHeightAt(d);
      for (const lateral of [-0.9, -0.5, 0, 0.5, 0.9]) {
        const off = lateral * (stage.halfWidth - 1.2);
        field.sample(at.x + Math.cos(at.heading) * off, at.z - Math.sin(at.heading) * off, bed);
        // Nearest-point parameter differs a hair from `d` on bends; allow 3 cm.
        expect(bed.height).toBeLessThanOrEqual(road - ROAD_BED_DROP + 0.03);
      }
      // Just past the trench ramp (under the road mesh's verge strip) and at the strip's outer
      // edge, the terrain is at deck level, flush with the strip.
      for (const out of [TRENCH_OUT + 0.2, 2]) {
        const off = stage.halfWidth + out;
        field.sample(at.x + Math.cos(at.heading) * off, at.z - Math.sin(at.heading) * off, bed);
        // Out on the verge the nearest-point parameter shifts more on bends; 0.08 still rules out the drop.
        expect(Math.abs(bed.height - (road + ROAD_LIFT))).toBeLessThan(0.08);
      }
    }
  });

  it('scatters scenery off the road, deterministically', () => {
    const props = scatterScenery(field);
    expect(props.length).toBeGreaterThan(200);
    expect(scatterScenery(field)).toEqual(props);
    const hit = createRoadHit();
    for (const p of props)
      expect(stage.path.nearest(p.x, p.z, stage.halfWidth + 2, hit)).toBe(false);
  });

  it('keeps tree canopies from overlapping while staying dense', () => {
    const trees = scatterScenery(field).filter((p) => p.kind === 'tree' || p.kind === 'broadleaf');
    expect(trees.length).toBeGreaterThan(400);
    // Plain arithmetic over every pair, one assertion at the end: an expect per
    // pair is ~150k assertions and times out on slow CI runners.
    const overlaps: string[] = [];
    for (let i = 0; i < trees.length; i++) {
      const a = trees[i]!;
      const ra = CANOPY_RADIUS[a.kind]! * a.scale;
      for (let j = i + 1; j < trees.length; j++) {
        const b = trees[j]!;
        const r = ra + CANOPY_RADIUS[b.kind]! * b.scale;
        if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 < r * r - 1e-6) overlaps.push(`${i}-${j}`);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('dots houses well back from the road, apart from each other, with footprint colliders', () => {
    const stage = generateStage(3, 0);
    const field = new TerrainField(stage);
    const houses = scatterScenery(field).filter((p) => p.kind === 'house');
    expect(houses.length).toBeGreaterThan(3);
    const hit = createRoadHit();
    for (const h of houses) {
      expect(stage.path.nearest(h.x, h.z, stage.halfWidth + 13, hit)).toBe(false);
      for (const other of houses)
        if (other !== h) expect(Math.hypot(other.x - h.x, other.z - h.z)).toBeGreaterThan(20);
    }
    const obstacles = propObstacles(houses);
    expect(obstacles.length).toBe(houses.length * 3);
    expect(obstacles.every((o) => o.r > 2)).toBe(true);
  });

  it('flattens a level pad under each house at its slab top and keeps other props out', () => {
    for (const seed of [3, 11, 27]) {
      const stage = generateStage(seed, 0);
      const field = new TerrainField(stage);
      const props = scatterScenery(field);
      const houses = props.filter((p) => p.kind === 'house');
      expect(houses.length).toBeGreaterThan(0);
      for (const h of houses) {
        const ax = Math.cos(h.rotation);
        const az = -Math.sin(h.rotation);
        const bx = Math.sin(h.rotation);
        const bz = Math.cos(h.rotation);
        for (const [u, v] of [
          [3.3, 2.55],
          [-3.3, 2.55],
          [3.3, -2.55],
          [-3.3, -2.55],
        ]) {
          const gx = h.x + (ax * u! + bx * v!) * h.scale;
          const gz = h.z + (az * u! + bz * v!) * h.scale;
          // The pad puts every corner, and the door sill, at the slab top.
          expect(Math.abs(field.heightAt(gx, gz) - (h.y + HOUSE_SLAB_TOP))).toBeLessThan(0.02);
        }
        for (const p of props)
          if (p.kind !== 'house')
            expect(Math.hypot(p.x - h.x, p.z - h.z)).toBeGreaterThanOrEqual(5 * h.scale);
      }
    }
  });

  it('turns each house so its door (local -z) looks toward the road', () => {
    const stage = generateStage(50, 0);
    const field = new TerrainField(stage);
    const hit = createRoadHit();
    const sample = { x: 0, z: 0, heading: 0 };
    for (const h of scatterScenery(field).filter((p) => p.kind === 'house')) {
      stage.path.nearest(h.x, h.z, 400, hit);
      stage.path.sample(hit.along, sample);
      const toRoad = [sample.x - h.x, sample.z - h.z];
      const len = Math.hypot(toRoad[0]!, toRoad[1]!);
      // Local -z after a Y rotation r is (-sin r, -cos r).
      const dot = (-Math.sin(h.rotation) * toRoad[0]! - Math.cos(h.rotation) * toRoad[1]!) / len;
      expect(dot).toBeGreaterThan(0.5);
    }
  });
});

describe('markerDistances', () => {
  it('drops the marker pair wherever a checkpoint board stands', () => {
    const gates: Gate[] = [gate(30, 30), gate(70.5, 70), { ...gate(130, 130), kind: 'finish' }];
    const d = markerDistances(200, gates);
    expect(d).toEqual([10, 50, 90, 110, 130, 150, 170, 190]);
    expect(d.every((x) => (x - MARKER_SPACING / 2) % MARKER_SPACING === 0)).toBe(true);
  });

  it('leaves every generated stage with no post inside a checkpoint board', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const stage = generateStage(seed, seed % 4);
      const posts = markerDistances(stage.path.length, stage.gates);
      for (const g of stage.gates)
        if (g.kind === 'checkpoint')
          for (const d of posts)
            expect(Math.abs(d - g.distance)).toBeGreaterThanOrEqual(MARKER_CLEARANCE);
    }
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
