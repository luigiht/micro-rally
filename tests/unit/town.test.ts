import { describe, expect, it } from 'vitest';
import { generateStage, type StageDef } from '@/game/stage/StageGenerator';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { ROAD_BED_DROP, ROAD_LIFT, TerrainField } from '@/game/stage/TerrainField';
import {
  BARRIER_HALF_DEPTH,
  onTownStreet,
  plateauDistance,
  townObstacles,
  type TownDef,
} from '@/game/stage/Town';

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
    const inside = props.filter((p) => plateauDistance(town, p.x, p.z) < 10);
    expect(inside).toEqual([]);
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
