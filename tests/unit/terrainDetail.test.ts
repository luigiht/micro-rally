import { Color, Mesh, Raycaster, Vector3 } from 'three';
import { createNoise2D } from 'simplex-noise';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/game/rng';
import { createRoadHit } from '@/game/stage/RoadPath';
import { generateStage } from '@/game/stage/StageGenerator';
import { ROAD_LIFT, TerrainField } from '@/game/stage/TerrainField';
import { STAGE_TYPES } from '@/game/stage/regions';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { createStageWorld } from '@/game/stage/StageWorld';
import { TerrainDetail } from '@/game/stage/TerrainDetail';
import { RoadBuilder } from '@/render/road/RoadBuilder';
import { dayTheme } from '@/render/theme/WorldTheme';
import { stageIndexOf } from './stageIndex';
import { BERM_DEPTH, BERM_FROM } from '@/game/stage/Spectators';

function forestStages(): { mud: [number, number]; dry: [number, number] } {
  return { mud: [2, stageIndexOf('autumnal')], dry: [2, stageIndexOf('pinewood')] };
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

  it('cuts deeper, darker wheel ruts into Autumnal mud roads', () => {
    const stage = generateStage(17, stageIndexOf('autumnal', 1));
    const field = new TerrainField(stage);
    const road = new RoadBuilder(stage, field, dayTheme(STAGE_TYPES.autumnal).road);
    expect(field.crestsAt.length).toBeGreaterThan(0);
    const mud = new Color('#6b4d33');
    const hit = createRoadHit();
    let deepest = 0;
    let darkest = 1;
    let edgeDepth = 0;
    let edgeDarkness = 1;

    for (const child of road.group.children) {
      if (!(child instanceof Mesh)) continue;
      const positions = child.geometry.getAttribute('position');
      const colors = child.geometry.getAttribute('color');
      if (!colors) continue;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        if (
          !stage.path.nearest(x, z, stage.halfWidth + 1, hit) ||
          Math.abs(hit.lateral) > stage.halfWidth
        )
          continue;
        deepest = Math.max(deepest, field.roadHeightAt(hit.along) + ROAD_LIFT - y);
        darkest = Math.min(darkest, colors.getX(i) / mud.r);
        if (
          Math.abs(hit.lateral) > stage.halfWidth - 1.6 &&
          Math.abs(hit.lateral) < stage.halfWidth - 0.05 &&
          Math.abs(hit.lateral) > stage.halfWidth - 1.2
        ) {
          edgeDepth = Math.max(edgeDepth, field.roadHeightAt(hit.along) + ROAD_LIFT - y);
          edgeDarkness = Math.min(edgeDarkness, colors.getX(i) / mud.r);
        }
      }
    }

    expect(deepest).toBeGreaterThan(0.07);
    expect(darkest).toBeLessThan(0.75);
    expect(edgeDepth).toBeGreaterThan(0.07);
    expect(edgeDarkness).toBeLessThan(0.75);
    expect(road.group.getObjectByName('mud-puddles')).toBeUndefined();
    road.dispose();
  });

  it('leaves dark edge groove floors visible from above, without road faces covering them', () => {
    const stage = generateStage(17, stageIndexOf('autumnal', 1));
    const field = new TerrainField(stage);
    const road = new RoadBuilder(stage, field, dayTheme(STAGE_TYPES.autumnal).road);
    road.group.updateMatrixWorld(true);
    const hit = createRoadHit();
    const mud = new Color('#6b4d33');
    const center = new Vector3();
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
    const checked = new Set<number>();
    try {
      for (const child of road.group.children) {
        if (!(child instanceof Mesh)) continue;
        const positions = child.geometry.getAttribute('position');
        const colors = child.geometry.getAttribute('color');
        const indices = child.geometry.index;
        if (!colors || !indices) continue;
        for (let index = 0; index < indices.count; index += 3) {
          const vertices = [indices.getX(index), indices.getX(index + 1), indices.getX(index + 2)];
          if (vertices.some((vertex) => colors.getX(vertex) / mud.r > 0.72)) continue;
          center.set(0, 0, 0);
          for (const vertex of vertices)
            center.add(new Vector3().fromBufferAttribute(positions, vertex));
          center.divideScalar(3);
          if (!stage.path.nearest(center.x, center.z, stage.halfWidth, hit)) continue;
          if (Math.abs(hit.lateral) < stage.halfWidth - 1.6) continue;
          const side = Math.sign(hit.lateral);
          if (checked.has(side)) continue;
          ray.ray.origin.copy(center).y += 1;
          const top = ray.intersectObject(child)[0];
          expect(top).toBeDefined();
          expect(top!.point.y).toBeCloseTo(center.y, 4);
          expect(field.roadHeightAt(hit.along) + ROAD_LIFT - top!.point.y).toBeGreaterThan(0.06);
          checked.add(side);
        }
      }
      expect([...checked].sort()).toEqual([-1, 1]);
    } finally {
      road.dispose();
    }
  });

  it('uses flat-coloured Autumnal verge facets on both sides without changing Pinewood', () => {
    for (const stageType of ['autumnal', 'pinewood'] as const) {
      const stage = generateStage(17, stageIndexOf(stageType, 1));
      const field = new TerrainField(stage);
      const theme = dayTheme(STAGE_TYPES[stageType]).road;
      const road = new RoadBuilder(stage, field, theme);
      const heading = stage.path.headings[0]!;
      const lx = Math.cos(heading);
      const lz = -Math.sin(heading);
      const mud = new Color(theme.surfaces.mud);
      const grass = new Color(theme.verge);
      try {
        for (const side of [-1, 1]) {
          const samples = new Map<number, Color>();
          for (const child of road.group.children) {
            if (!(child instanceof Mesh)) continue;
            const positions = child.geometry.getAttribute('position');
            const colors = child.geometry.getAttribute('color');
            if (!colors) continue;
            for (let vertex = 0; vertex < positions.count; vertex++) {
              const dx = positions.getX(vertex) - stage.path.xs[0]!;
              const dz = positions.getZ(vertex) - stage.path.zs[0]!;
              if (Math.abs(dx * Math.sin(heading) + dz * Math.cos(heading)) > 0.001) continue;
              const offset = (dx * lx + dz * lz) * side - stage.halfWidth;
              for (const target of [0, 0.65, 1.3, 3])
                if (Math.abs(offset - target) < 0.001)
                  samples.set(target, new Color().fromBufferAttribute(colors, vertex));
            }
          }
          const outer = samples.get(3)!;
          expect(outer).toBeDefined();
          const inner = samples.get(0)!;
          if (stageType === 'autumnal') {
            expect(inner.g / inner.r).toBeGreaterThan(mud.g / mud.r);
            expect(inner.g / inner.r).toBeLessThan(grass.g / grass.r);
            let facets = 0;
            for (const child of road.group.children) {
              if (!(child instanceof Mesh)) continue;
              const positions = child.geometry.getAttribute('position');
              const colors = child.geometry.getAttribute('color');
              const indices = child.geometry.index;
              if (!colors || !indices) continue;
              const hit = createRoadHit();
              for (let index = 0; index < indices.count; index += 3) {
                const vertices = [
                  indices.getX(index),
                  indices.getX(index + 1),
                  indices.getX(index + 2),
                ];
                const outsideRoad = vertices.every((vertex) => {
                  if (!stage.path.nearest(positions.getX(vertex), positions.getZ(vertex), 8, hit))
                    return false;
                  return hit.lateral * side > stage.halfWidth + 0.1;
                });
                if (!outsideRoad) continue;
                for (const vertex of vertices.slice(1)) {
                  expect(colors.getX(vertex)).toBeCloseTo(colors.getX(vertices[0]!), 3);
                  expect(colors.getY(vertex)).toBeCloseTo(colors.getY(vertices[0]!), 3);
                  expect(colors.getZ(vertex)).toBeCloseTo(colors.getZ(vertices[0]!), 3);
                }
                facets++;
                if (facets >= 30) break;
              }
              if (facets >= 30) break;
            }
            expect(facets).toBeGreaterThan(20);
          } else {
            const shade = outer.r / grass.r;
            expect(inner.r).toBeCloseTo(grass.r * shade, 5);
            expect(inner.g).toBeCloseTo(grass.g * shade, 5);
            expect(samples.has(0.65)).toBe(false);
          }
        }
      } finally {
        road.dispose();
      }
    }
  });

  it('puts a small berm before each crowd on Forest mud and gravel', () => {
    const { mud, dry } = forestStages();
    for (const args of [mud, dry]) {
      const { field, stage } = createStageWorld(...args);
      const people = scatterScenery(field).filter((p) => p.kind === 'spectator');
      expect(people.length).toBeGreaterThan(0);
      const hit = createRoadHit();
      const sample = { x: 0, z: 0, heading: 0 };
      let behind = 0;
      for (const p of people) {
        expect(stage.path.nearest(p.x, p.z, 40, hit)).toBe(true);
        const crest = stage.halfWidth + BERM_FROM + BERM_DEPTH / 2;
        stage.path.sample(hit.along, sample);
        const side = Math.sign(hit.lateral);
        const x = sample.x + Math.cos(sample.heading) * crest * side;
        const z = sample.z - Math.sin(sample.heading) * crest * side;
        if (field.onMound(x, z)) behind++;
        expect(field.onMound(p.x, p.z)).toBe(false);
      }
      expect(behind / people.length).toBeGreaterThan(0.9);
    }
  }, 30_000);
});
