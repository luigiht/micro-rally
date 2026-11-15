import { Box3, Color } from 'three';
import { describe, expect, it } from 'vitest';
import { STAGE_TYPES } from '@/game/stage/regions';
import { createRoadHit } from '@/game/stage/RoadPath';
import { createStageWorld } from '@/game/stage/StageWorld';
import { TerrainField } from '@/game/stage/TerrainField';
import { snowyBoulderGeometry, snowyStumpGeometry } from '@/render/scenery/SnowyGroundGeometry';
import { alpineKits } from '@/render/scenery/kits/AlpineKits';
import { PINE_SPECS, snowPineGeometry } from '@/render/scenery/SnowPineGeometry';
import { terrainColors } from '@/render/terrain/meshTerrainChunk';
import { valleyFaceColor, type ValleyFace } from '@/render/terrain/valleyFaceColor';
import { stageIndexOf } from './stageIndex';

describe('Alpine woods', () => {
  const greens = [new Color('#3a6451'), new Color('#6a8c82')] as const;
  const trunk = new Color('#4e3a2b');
  const box = new Box3();

  it('lay snowy boulders and stumps low on the ground', () => {
    for (const g of [snowyBoulderGeometry(new Color('#8b9098')), snowyStumpGeometry(trunk)]) {
      box.setFromBufferAttribute(g.getAttribute('position') as never);
      expect(box.max.y).toBeLessThan(1.3);
      g.dispose();
    }
  });

  it('vary the tiered pines in width and height, chunky ones among them', () => {
    const sizes = PINE_SPECS.map((spec) => {
      const g = snowPineGeometry(spec, greens, trunk);
      box.setFromBufferAttribute(g.getAttribute('position') as never);
      g.dispose();
      return { width: Math.max(box.max.x - box.min.x, box.max.z - box.min.z), height: box.max.y };
    });
    const widths = sizes.map((s) => s.width);
    const heights = sizes.map((s) => s.height);
    // From slim to broad, from squat to tall.
    expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths) * 1.9);
    expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights) * 1.9);
    for (const s of sizes) expect(s.width).toBeLessThan(5.2);
    expect(PINE_SPECS.filter((s) => s.tips !== undefined).length).toBeGreaterThanOrEqual(3);
  });

  it('dresses every pine, bush and rock once, and only the Alpine’s', () => {
    const kits = alpineKits(STAGE_TYPES.alpine.palette, false);
    const props = Array.from({ length: 400 }, (_, i) => ({
      kind: 'tree' as const,
      x: i * 3.7,
      y: 0,
      z: i * 1.3,
      scale: 1,
      rotation: 0,
      variant: 0,
    }));
    const forms = new Set<number>();
    for (const p of props) {
      const taking = kits.filter((k) => k.sources.includes('tree') && (!k.accept || k.accept(p)));
      expect(taking).toHaveLength(1);
      forms.add(kits.indexOf(taking[0]!));
    }
    // Nearly every tiered silhouette turns up.
    expect(forms.size).toBeGreaterThan(14);
    for (const kind of ['bush', 'rock'] as const)
      for (const p of props.slice(0, 50)) {
        const q = { ...p, kind };
        const meshes = kits.filter((k) => k.sources.includes(kind) && (!k.accept || k.accept(q)));
        // A bush is green and its snow, or a stump; a rock one snowy boulder.
        if (kind === 'rock') expect(meshes).toHaveLength(1);
        else expect([1, 2]).toContain(meshes.length);
      }
    for (const k of kits) {
      k.geometry.dispose();
      k.material.dispose();
    }
  });
});

describe('Alpine wood', () => {
  it('is a thick wood of tiered snow pines, by the road and up the hillsides', () => {
    const w = createStageWorld(1, stageIndexOf('alpine', 1));
    const perKm = w.props.filter((p) => p.kind === 'tree').length / (w.stage.path.length / 1000);
    expect(perKm).toBeGreaterThan(1500);
    expect(w.props.filter((p) => p.kind === 'broadleaf')).toHaveLength(0);
  });
});

describe('Alpine snowfields', () => {
  const tones = terrainColors(STAGE_TYPES.alpine.palette).valley!;
  const face = (over: Partial<ValleyFace>): ValleyFace => ({
    x: 10,
    z: 10,
    h: 0,
    ny: 0.99,
    hollow: 0,
    road: 0,
    hashA: 0.5,
    hashB: 0.5,
    ...over,
  });
  const colour = (f: ValleyFace) => {
    const out = [0, 0, 0];
    valleyFaceColor(tones, f, out);
    return out as [number, number, number];
  };

  it('shade blue down the hollows, warm on the crests, and turn to grey rock on the steep faces', () => {
    const hollow = colour(face({ hollow: 5 }));
    const crest = colour(face({ hollow: -5 }));
    expect(hollow[2]).toBeGreaterThan(hollow[0] * 1.15);
    expect(crest[0]).toBeGreaterThan(hollow[0] * 1.3);
    const rock = colour(face({ ny: 0.6 }));
    expect(rock[0]).toBeLessThan(crest[0] * 0.5);
    expect(Math.abs(rock[2] - rock[0])).toBeLessThan(rock[1] * 0.3);
  });

  it('crowd round every checkpoint on benches beside the road', () => {
    for (const seed of [1, 2]) {
      const w = createStageWorld(seed, stageIndexOf('alpine', 1));
      const hit = createRoadHit();
      const along = w.props
        .filter((p) => p.kind === 'spectator')
        .map((p) => (w.stage.path.nearest(p.x, p.z, 40, hit) ? hit.along : -1e9));
      const near = (d: number, a: number, b: number) =>
        along.filter((x) => x > d - a && x < d + b).length;
      expect(near(w.stage.startDistance, 25, 35)).toBeGreaterThan(30);
      for (const g of w.stage.gates)
        expect(
          near(g.distance, g.kind === 'finish' ? 45 : 22, g.kind === 'finish' ? 25 : 18),
        ).toBeGreaterThan(10);
      // A bench beside the first checkpoint stands level with the road, across its width.
      const bare = new TerrainField(w.stage);
      const g = w.stage.gates[0]!;
      const at = { x: 0, z: 0, heading: 0 };
      w.stage.path.sample(g.distance - 12, at);
      const deck = bare.roadHeightAt(g.distance - 12) + 0.08;
      let benched = 0;
      for (const side of [1, -1]) {
        const h = (e: number) =>
          bare.heightAt(
            at.x + Math.cos(at.heading) * (w.stage.halfWidth + e) * side,
            at.z - Math.sin(at.heading) * (w.stage.halfWidth + e) * side,
          );
        if (Math.abs(h(10) - deck) > 0.05) continue;
        benched++;
        for (const e of [8, 11, 13]) expect(h(e)).toBeCloseTo(deck, 1);
      }
      expect(benched).toBeGreaterThan(0);
    }
  });
});
