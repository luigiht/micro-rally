import { describe, expect, it } from 'vitest';
import { createRoadHit } from '@/game/stage/RoadPath';
import { generateStage, type StageDef } from '@/game/stage/StageGenerator';
import { markerDistances } from '@/game/stage/RoadMarkers';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { ROAD_BED_DROP, ROAD_LIFT, TerrainField } from '@/game/stage/TerrainField';
import {
  BARRIER_HALF_DEPTH,
  onTownStreet,
  plateauDistance,
  streetDistance,
  townObstacles,
  type TownDef,
} from '@/game/stage/Town';
import { CROSSROADS_BLOCK, hasTown, STUB_LENGTH, TOWN_CHANCE } from '@/game/stage/TownGenerator';

/** A synthetic town laid on the route of a generated stage around distance `at`, with one blocked side street. */
function withTown(seed: number, index: number, at: number): { stage: StageDef; town: TownDef } {
  const stage = generateStage(seed, index);
  const s = { x: 0, z: 0, heading: 0 };
  stage.path.sample(at, s);
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const lx = Math.cos(s.heading);
  const lz = -Math.sin(s.heading);
  const town: TownDef = {
    x: s.x,
    z: s.z,
    heading: s.heading,
    // Wide enough that the approach ramps finish before the route interval starts.
    halfU: 170,
    halfV: 90,
    from: at - 80,
    to: at + 80,
    streets: [
      // A side street leaving the route to the left at the town centre, 30 m long.
      { x0: s.x, z0: s.z, x1: s.x + lx * 30, z1: s.z + lz * 30, halfWidth: 4, route: false },
    ],
    buildings: [
      {
        style: 'shop',
        x: s.x + lx * 12,
        z: s.z + lz * 12,
        yaw: s.heading,
        hx: 4,
        hz: 3,
        variant: 0,
      },
    ],
    barriers: [{ x: s.x + lx * 28, z: s.z + lz * 28, yaw: s.heading + Math.PI / 2, halfLength: 4 }],
    arrows: [],
  };
  stage.town = town;
  void fx;
  void fz;
  return { stage, town };
}

describe('town plateau', () => {
  it('measures distance to the plateau rectangle in the town frame', () => {
    const town = withTown(7, 1, 600).town;
    expect(plateauDistance(town, town.x, town.z)).toBe(0);
    const lx = Math.cos(town.heading);
    const lz = -Math.sin(town.heading);
    expect(plateauDistance(town, town.x + lx * 100, town.z + lz * 100)).toBeCloseTo(10, 6);
    expect(onTownStreet(town, town.x + lx * 15, town.z + lz * 15)).toBe(true);
    expect(
      onTownStreet(
        town,
        town.x + lx * 15 + Math.sin(town.heading) * 6,
        town.z + lz * 15 + Math.cos(town.heading) * 6,
      ),
    ).toBe(false);
  });

  it('levels the road and the ground onto one plateau inside the town', () => {
    for (const seed of [3, 11, 27]) {
      const { stage, town } = withTown(seed, 1, 700);
      const field = new TerrainField(stage);
      // The route is flat across the whole town interval, at the plateau height.
      for (let d = town.from; d <= town.to; d += 2)
        expect(Math.abs(field.roadHeightAt(d) - field.townY), `${seed}@${d}`).toBeLessThan(0.02);
      // Ground away from any street inside the footprint sits exactly on the plateau.
      const lx = Math.cos(town.heading);
      const lz = -Math.sin(town.heading);
      const sample = { height: 0, roadBlend: 0, roadDistance: 0 };
      field.sample(town.x - lx * 50, town.z - lz * 50, sample);
      expect(sample.height).toBeCloseTo(field.townY, 6);
      // The hills take over again well beyond the blend.
      const far = { x: town.x - lx * 200, z: town.z - lz * 200 };
      expect(field.groundHeight(far.x, far.z)).toBeCloseTo(field.baseHeight(far.x, far.z), 6);
    }
  });

  it('keeps the route trench and verge rules inside the town and still limits the grade', () => {
    const { stage, town } = withTown(5, 2, 650);
    const field = new TerrainField(stage);
    const s = { x: 0, z: 0, heading: 0 };
    const bed = { height: 0, roadBlend: 0, roadDistance: 0 };
    for (let d = town.from + 10; d <= town.to - 10; d += 7) {
      stage.path.sample(d, s);
      const road = field.roadHeightAt(d);
      field.sample(s.x, s.z, bed);
      expect(bed.height).toBeLessThanOrEqual(road - ROAD_BED_DROP + 0.03);
      const off = stage.halfWidth + 2;
      field.sample(s.x + Math.cos(s.heading) * off, s.z - Math.sin(s.heading) * off, bed);
      expect(Math.abs(bed.height - (road + ROAD_LIFT))).toBeLessThan(0.08);
    }
    for (let d = 2; d < stage.path.length; d += 2)
      expect(Math.abs(field.roadHeightAt(d) - field.roadHeightAt(d - 2))).toBeLessThanOrEqual(0.25);
  });

  it('drives side streets as paved plates at deck level', () => {
    const { stage, town } = withTown(9, 1, 600);
    const field = new TerrainField(stage);
    const lx = Math.cos(town.heading);
    const lz = -Math.sin(town.heading);
    const x = town.x + lx * 20;
    const z = town.z + lz * 20;
    expect(field.heightAt(x, z)).toBeCloseTo(field.townY + ROAD_LIFT, 6);
    expect(field.surfaceAt(x, z)).toBe('tarmac');
    // On the route inside the town the surface is paved too, whatever the stage is made of.
    stage.path.sample(600, { x: 0, z: 0, heading: 0 });
    expect(field.surfaceAt(town.x, town.z)).toBe('tarmac');
    // Off every street the plateau is the region's off-road surface.
    expect(field.surfaceAt(town.x + lx * 40, town.z + lz * 40)).not.toBe('tarmac');
  });
});

describe('town scenery and colliders', () => {
  it('keeps wild scenery and farmhouses off the plateau', () => {
    const { stage, town } = withTown(99, 1, 700);
    const field = new TerrainField(stage);
    const props = scatterScenery(field);
    expect(props.length).toBeGreaterThan(200);
    const wild = new Set(['tree', 'broadleaf', 'bush', 'rock', 'house']);
    const inside = props.filter((p) => wild.has(p.kind) && plateauDistance(town, p.x, p.z) < 10);
    expect(inside).toEqual([]);
    // The town's own props are there instead.
    expect(props.some((p) => p.kind === 'shop')).toBe(true);
    expect(props.filter((p) => p.kind === 'barrier').length).toBeGreaterThanOrEqual(2);
    const nearHouses = props.filter(
      (p) => p.kind === 'house' && plateauDistance(town, p.x, p.z) < 40,
    );
    expect(nearHouses).toEqual([]);
  });

  it('turns buildings and barrier rows into oriented box colliders', () => {
    const { town } = withTown(99, 1, 700);
    const boxes = townObstacles(town);
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatchObject({ hx: 4, hz: 3, yaw: town.heading });
    expect(boxes[1]).toMatchObject({ hx: 4, hz: BARRIER_HALF_DEPTH });
  });
});

/** Generated stages at index 1..3 for game seeds 1..60 that carry a town. */
function townStages(): StageDef[] {
  const out: StageDef[] = [];
  for (let seed = 1; seed <= 60; seed++)
    for (const index of [1, 2, 3]) {
      const stage = generateStage(seed, index);
      if (stage.town) out.push(stage);
    }
  return out;
}

describe('town generator', () => {
  it('gives roughly a third of stages a town, never the first stage', () => {
    let count = 0;
    for (let seed = 1; seed <= 400; seed++) {
      expect(hasTown(seed, 0)).toBe(false);
      if (hasTown(seed, 1)) count++;
    }
    expect(count / 400).toBeGreaterThan(TOWN_CHANCE - 0.08);
    expect(count / 400).toBeLessThan(TOWN_CHANCE + 0.08);
    for (let seed = 1; seed <= 20; seed++) expect(generateStage(seed, 0).town).toBeUndefined();
  });

  it('threads the route through the grid with right-angle turns at every corner', () => {
    const stages = townStages();
    expect(stages.length).toBeGreaterThan(30);
    const s = { x: 0, z: 0, heading: 0 };
    const hit = createRoadHit();
    for (const stage of stages) {
      const town = stage.town!;
      const legs = town.streets.filter((st) => st.route);
      const stubs = town.streets.filter((st) => !st.route);
      expect(legs.length).toBeGreaterThanOrEqual(3);
      expect(town.arrows.length).toBe(legs.length - 1);
      const block = Math.hypot(legs[1]!.x1 - legs[1]!.x0, legs[1]!.z1 - legs[1]!.z0);
      expect(stubs.length).toBe(town.arrows.length * 2 + (block > CROSSROADS_BLOCK - 1 ? 4 : 0));
      expect(town.barriers.length).toBe(stubs.length);
      expect(town.buildings.length).toBeGreaterThan(12);
      expect(town.from).toBeGreaterThan(stage.startDistance + 150);
      expect(town.to).toBeLessThan(stage.startDistance + stage.length - 100);
      // Every leg lies on the centreline and consecutive legs meet at right angles.
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i]!;
        expect(stage.path.nearest(leg.x0, leg.z0, 1, hit), `${stage.seed} leg ${i}`).toBe(true);
        expect(stage.path.nearest(leg.x1, leg.z1, 1, hit)).toBe(true);
        if (i > 0) {
          const prev = legs[i - 1]!;
          const a = Math.atan2(prev.x1 - prev.x0, prev.z1 - prev.z0);
          const b = Math.atan2(leg.x1 - leg.x0, leg.z1 - leg.z0);
          const turn = Math.atan2(Math.sin(b - a), Math.cos(b - a));
          expect(Math.abs(Math.abs(turn) - Math.PI / 2)).toBeLessThan(1e-9);
        }
      }
      // The route arrives and leaves on the same heading (measured where the spline is still on the straight legs).
      stage.path.sample(town.from - 10, s);
      const inHeading = s.heading;
      stage.path.sample(town.to - 30, s);
      expect(
        Math.abs(Math.atan2(Math.sin(s.heading - inHeading), Math.cos(s.heading - inHeading))),
      ).toBeLessThan(0.02);
    }
  });

  it('keeps buildings off every street and apart, barriers across the stubs, posts and gates out of town', () => {
    for (const stage of townStages()) {
      const town = stage.town!;
      const problems: string[] = [];
      for (const b of town.buildings) {
        // Front face sits beyond the pavement of its own street, and the whole footprint is clear of all streets.
        const nearest = Math.min(...town.streets.map((st) => streetDistance(st, b.x, b.z)));
        if (nearest < stage.halfWidth + 3 + Math.min(b.hx, b.hz) - 1e-6)
          problems.push(`building in street ${stage.seed}`);
        if (plateauDistance(town, b.x, b.z) !== 0)
          problems.push(`building off plateau ${stage.seed}`);
      }
      for (let i = 0; i < town.buildings.length; i++)
        for (let j = i + 1; j < town.buildings.length; j++) {
          const a = town.buildings[i]!;
          const b = town.buildings[j]!;
          if (Math.hypot(a.x - b.x, a.z - b.z) < Math.min(a.hx, a.hz) + Math.min(b.hx, b.hz))
            problems.push(`buildings overlap ${stage.seed}`);
        }
      for (const st of town.streets)
        if (plateauDistance(town, st.x0, st.z0) !== 0 || plateauDistance(town, st.x1, st.z1) !== 0)
          problems.push(`street off plateau ${stage.seed}`);
      for (const r of town.barriers) {
        const stub = town.streets.find((st) => !st.route && streetDistance(st, r.x, r.z) < 1e-6);
        if (!stub) problems.push(`barrier off its stub ${stage.seed}`);
        if (Math.hypot(r.x - stub!.x0, r.z - stub!.z0) > STUB_LENGTH)
          problems.push(`barrier past stub ${stage.seed}`);
      }
      for (const g of stage.gates)
        if (g.kind === 'checkpoint' && g.distance > town.from - 39 && g.distance < town.to + 39)
          problems.push(`gate in town ${stage.seed}`);
      for (let k = 1; k < stage.gates.length; k++)
        if (stage.gates[k]!.distance <= stage.gates[k - 1]!.distance)
          problems.push(`gate order ${stage.seed}`);
      for (const d of markerDistances(stage.path.length, stage.gates, [[town.from, town.to]]))
        if (d >= town.from && d <= town.to) problems.push(`post in town ${stage.seed}`);
      expect(problems).toEqual([]);
    }
  });

  it('keeps the generator invariants: no self-approach, dead-level route through the town', () => {
    for (const stage of townStages().slice(0, 12)) {
      const p = stage.path;
      let minSep = Infinity;
      for (let i = 0; i < p.count; i += 4)
        for (let j = i + 100; j < p.count; j += 4)
          minSep = Math.min(minSep, Math.hypot(p.xs[i]! - p.xs[j]!, p.zs[i]! - p.zs[j]!));
      expect(minSep, `${stage.seed}/${stage.index}`).toBeGreaterThan(50);
      const field = new TerrainField(stage);
      const town = stage.town!;
      let worst = 0;
      for (let d = town.from; d <= town.to; d += 2)
        worst = Math.max(worst, Math.abs(field.roadHeightAt(d) - field.townY));
      expect(worst, `${stage.seed}/${stage.index}`).toBeLessThan(0.02);
      for (let d = 2; d < p.length; d += 2)
        expect(Math.abs(field.roadHeightAt(d) - field.roadHeightAt(d - 2))).toBeLessThanOrEqual(
          0.25,
        );
    }
  });
});
