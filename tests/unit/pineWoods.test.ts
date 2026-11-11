import { Box3, Color } from 'three';
import { describe, expect, it } from 'vitest';
import { createRoadHit } from '@/game/stage/RoadPath';
import { stagePalette, stageScenery } from '@/game/stage/regions';
import { canopyRadius } from '@/game/stage/SceneryScatter';
import { GRASS_REACH, scatterGrass } from '@/game/stage/TallGrass';
import { createStageWorld } from '@/game/stage/StageWorld';
import { rallyKits } from '@/render/scenery/kits/RallyKits';
import { PINE_SHAPES, pineFoliage, pineStandIn, pineTrunk } from '@/render/scenery/PineGeometry';
import { tallGrassGeometry, tallGrassStandIn } from '@/render/scenery/TallGrassGeometry';
import { stageIndexOf } from './stageIndex';

describe('Pinewood pines', () => {
  const pinewood = createStageWorld(2, stageIndexOf('pinewood', 1));
  const forest = createStageWorld(2, stageIndexOf('forest', 1));
  type World = typeof pinewood;
  const of = (w: World, kind: string) => w.props.filter((p) => p.kind === kind);
  const perKm = (w: World) => of(w, 'tree').length / (w.stage.path.length / 1000);
  const gaps = (w: World, kind: string) => {
    const hit = createRoadHit();
    return of(w, kind)
      .map((p) =>
        w.stage.path.nearest(p.x, p.z, 200, hit) ? hit.distance - w.stage.halfWidth : 200,
      )
      .sort((a, b) => a - b);
  };
  const median = (xs: number[]) => xs[Math.floor(xs.length / 2)]!;

  // Ground under canopy per km of road: the pines are bigger, so fewer of them cover far more.
  const coverPerKm = (w: World) => {
    const d = stageScenery(w.stage.stageType);
    const trees = w.props.filter((p) => p.kind === 'tree' || p.kind === 'broadleaf');
    const area = trees.reduce((s, p) => s + Math.PI * (canopyRadius(p, d)! * p.scale) ** 2, 0);
    return area / (w.stage.path.length / 1000);
  };

  it('grow denser, bigger, taller and nearer the road than the Forest’s', () => {
    expect(coverPerKm(pinewood)).toBeGreaterThan(coverPerKm(forest) * 2);
    expect(perKm(pinewood)).toBeGreaterThan(perKm(forest) * 0.6);
    // Lining the road: more pines within 8 m of its edge, per km, than the Forest has.
    const lining = (w: World) =>
      gaps(w, 'tree').filter((g) => g < 8).length / (w.stage.path.length / 1000);
    expect(lining(pinewood)).toBeGreaterThan(lining(forest) * 1.3);
    const mean = (w: World) =>
      of(w, 'tree').reduce((s, p) => s + p.scale, 0) / of(w, 'tree').length;
    expect(mean(pinewood)).toBeGreaterThan(mean(forest) * 1.2);
    expect(of(pinewood, 'tree').every((p) => p.stretch === 1.15)).toBe(true);
  });

  it('line the verges with small pines, off the carriageway, and only in Pinewood', () => {
    const saplings = of(pinewood, 'sapling');
    expect(saplings.length / (pinewood.stage.path.length / 100)).toBeGreaterThan(30);
    const g = gaps(pinewood, 'sapling');
    expect(g[0]!).toBeGreaterThan(0.6);
    expect(median(g)).toBeLessThan(5);
    for (const s of saplings) expect(s.scale).toBeLessThan(0.6);
    expect(of(forest, 'sapling')).toHaveLength(0);
  });

  it('keep their boughs off the road and out of each other', () => {
    const d = stageScenery('pinewood');
    const pines = [...of(pinewood, 'tree'), ...of(pinewood, 'sapling')];
    const reach = pines.map((p) => canopyRadius(p, d)! * p.scale);
    const hit = createRoadHit();
    pines.forEach((p, i) =>
      expect(pinewood.stage.path.nearest(p.x, p.z, pinewood.stage.halfWidth + reach[i]!, hit)).toBe(
        false,
      ),
    );
    // Every pair, the full reach of both: plain arithmetic, one assertion.
    const touching: string[] = [];
    for (let i = 0; i < pines.length; i++)
      for (let j = i + 1; j < pines.length; j++) {
        const a = pines[i]!;
        const b = pines[j]!;
        const r = reach[i]! + reach[j]!;
        if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 < r * r - 1e-6) touching.push(`${i}-${j}`);
      }
    expect(touching).toEqual([]);
  });

  it('stand tall with bare trunks by the road and carry on into the distance', () => {
    const band = stageScenery('pinewood').pineWood!.roadside;
    const trees = of(pinewood, 'tree');
    const hit = createRoadHit();
    const edge = (p: (typeof trees)[number]) =>
      pinewood.stage.path.nearest(p.x, p.z, 400, hit)
        ? hit.distance - pinewood.stage.halfWidth
        : 400;
    const roadside = trees.filter((p) => edge(p) < band - 1);
    expect(roadside.length).toBeGreaterThan(50);
    expect(roadside.every((p) => p.pine === 'tall')).toBe(true);
    // The tall shape's lowest boughs hang well above a car, so its lower trunk shows.
    const all = rallyKits(stagePalette('pinewood'), false, false);
    const tallKit = all.find((k) => k.lod === 'near' && k.accept!(roadside[0]!))!;
    const box = new Box3().setFromBufferAttribute(
      tallKit.geometry.getAttribute('position') as never,
    );
    expect(box.min.y).toBeGreaterThan(2.5);
    for (const k of all) {
      k.geometry.dispose();
      k.material.dispose();
    }
    // A good share of the wood stands far out, not just along the verges.
    expect(trees.filter((p) => edge(p) > 60).length).toBeGreaterThan(trees.length * 0.2);
  });

  // Scatters a whole stage's grass twice and checks every patch: a few seconds, longer on CI runners.
  it('grow tall grass on the verges and over the hills, every blade off the road, clear of trunks and people', () => {
    const grass = scatterGrass(pinewood.field, pinewood.props);
    expect(grass.length / (pinewood.stage.path.length / 100)).toBeGreaterThan(500);
    expect(scatterGrass(pinewood.field, pinewood.props)).toEqual(grass);
    // No blade reaches the road, on any stretch of it.
    const hit = createRoadHit();
    const onRoad = grass.filter((c) =>
      pinewood.stage.path.nearest(c.x, c.z, pinewood.stage.halfWidth + GRASS_REACH * c.scale, hit),
    );
    expect(onRoad).toEqual([]);
    const g = gaps({ ...pinewood, props: grass }, 'grass');
    // Thick along the verges, and far out over the hills as well.
    expect(g.filter((d) => d < 6).length).toBeGreaterThan(grass.length * 0.15);
    expect(g.filter((d) => d > 60).length).toBeGreaterThan(grass.length * 0.25);
    const pines = of(pinewood, 'tree');
    for (const c of grass.slice(0, 400))
      for (const p of pines)
        expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeGreaterThan(0.6 * p.scale - 1e-6);
    // No blade reaches a spectator: plain arithmetic, one assertion.
    const crowd = of(pinewood, 'spectator');
    expect(crowd.length).toBeGreaterThan(0);
    const touching = grass.filter((c) =>
      crowd.some((s) => Math.hypot(c.x - s.x, c.z - s.z) < 0.5 + GRASS_REACH * c.scale - 1e-6),
    );
    expect(touching).toEqual([]);
    expect(scatterGrass(forest.field, forest.props)).toEqual([]);
    // In drifts, not evenly: some 20 m stretches of a side carry several times the grass of others.
    const bins = new Map<string, number>();
    for (const c of grass) {
      if (!pinewood.stage.path.nearest(c.x, c.z, pinewood.stage.halfWidth + 25, hit)) continue;
      const k = `${Math.floor(hit.along / 20)}:${hit.lateral > 0 ? 1 : 0}`;
      bins.set(k, (bins.get(k) ?? 0) + 1);
    }
    const counts = [...bins.values()].sort((a, b) => a - b);
    expect(counts[Math.floor(counts.length * 0.9)]!).toBeGreaterThan(
      counts[Math.floor(counts.length * 0.2)]! * 2.5,
    );
    // Leaning with one wind: headings bunched, not spread all round.
    const mean = Math.hypot(
      grass.reduce((s, c) => s + Math.cos(c.rotation), 0),
      grass.reduce((s, c) => s + Math.sin(c.rotation), 0),
    );
    expect(mean / grass.length).toBeGreaterThan(0.8);
  }, 30_000);

  it('draw a patch of grass about a metre tall, within its reach, and a stand-in of its own blades', () => {
    const patch = tallGrassGeometry();
    const pos = patch.getAttribute('position');
    const box = new Box3().setFromBufferAttribute(pos as never);
    expect(box.max.x - box.min.x).toBeGreaterThan(1.2);
    expect(box.min.y).toBe(0);
    expect(box.max.y).toBeGreaterThan(0.9);
    expect(box.max.y).toBeLessThan(1.1);
    for (let i = 0; i < pos.count; i++)
      expect(Math.hypot(pos.getX(i), pos.getZ(i))).toBeLessThanOrEqual(GRASS_REACH);
    const far = tallGrassStandIn().getAttribute('position');
    const corners = new Set<string>();
    for (let i = 0; i < pos.count; i++) corners.add(`${pos.getX(i)},${pos.getY(i)},${pos.getZ(i)}`);
    for (let i = 0; i < far.count; i++)
      expect(corners.has(`${far.getX(i)},${far.getY(i)},${far.getZ(i)}`)).toBe(true);
    expect(far.count).toBeLessThan(pos.count / 2.5);
  });

  it('grow no round bushes', () => {
    expect(of(pinewood, 'bush')).toHaveLength(0);
  });

  it('are pines only', () => {
    expect(of(pinewood, 'broadleaf')).toHaveLength(0);
  });

  it('draw each pine as one shape near, one stand-in far and one trunk, in five greens chosen by spot', () => {
    const all = rallyKits(stagePalette('pinewood'), false, false);
    const pineKits = all.filter(
      (k) => k.sources.includes('tree') && !k.sources.includes('broadleaf'),
    );
    const near = pineKits.filter((k) => k.lod === 'near');
    const far = pineKits.filter((k) => k.lod === 'far');
    const trunks = pineKits.filter((k) => !k.lod);
    expect([near.length, far.length, trunks.length]).toEqual([4, 4, 4]);
    const trees = of(pinewood, 'tree');
    for (const p of trees)
      for (const set of [near, far, trunks])
        expect(set.filter((k) => k.accept!(p))).toHaveLength(1);
    for (const n of near)
      expect(trees.filter((p) => n.accept!(p)).length).toBeGreaterThan(trees.length * 0.03);
    // Most pines are leafy all the way down: the full and tall builds.
    const leafy = trees.filter((p) => p.pine === 'full' || p.pine === 'tall');
    expect(leafy.length).toBeGreaterThan(trees.length * 0.7);
    // Saplings: the young shape and its trunk, near the car only.
    const sapling = of(pinewood, 'sapling')[0]!;
    expect(
      all
        .filter((k) => k.sources.includes('sapling') && k.accept!(sapling))
        .map((k) => k.lod ?? 'trunk')
        .sort(),
    ).toEqual(['near', 'trunk']);
    // The shared trunk kit turns pines away.
    const shared = all.find((k) => k.sources.includes('broadleaf') && k.sources.length === 2)!;
    expect(shared.accept!(trees[0]!)).toBe(false);
    const a = new Color();
    const b = new Color();
    for (const p of trees.slice(0, 50)) {
      near[0]!.colorAt!(p, a);
      near[0]!.colorAt!(p, b);
      expect(a.equals(b)).toBe(true);
      expect(a.g).toBeGreaterThan(a.r);
    }
  });

  it('stand in far off with the same hems, every other point, so the swap never changes their shape', () => {
    for (const shape of PINE_SHAPES) {
      const near = pineFoliage(shape).getAttribute('position');
      const far = pineStandIn(shape).getAttribute('position');
      const corners = new Set<string>();
      const key = (a: typeof near, i: number) =>
        `${a.getX(i).toFixed(4)},${a.getY(i).toFixed(4)},${a.getZ(i).toFixed(4)}`;
      for (let i = 0; i < near.count; i++) corners.add(key(near, i));
      for (let i = 0; i < far.count; i++) expect(corners.has(key(far, i))).toBe(true);
      expect(far.count * 2).toBe(near.count);
    }
  });

  it('come as full, tall, sparse and young pines', () => {
    expect([...PINE_SHAPES].sort()).toEqual(['full', 'sparse', 'tall', 'young']);
  });

  it('end every trunk inside its crown, and curve it gently', () => {
    for (const shape of PINE_SHAPES) {
      const leaves = new Box3().setFromBufferAttribute(
        pineFoliage(shape).getAttribute('position') as never,
      );
      const trunk = pineTrunk(shape);
      const wood = new Box3().setFromBufferAttribute(trunk.getAttribute('position') as never);
      // The trunk's tip sits inside the top tier: below its apex, with foliage wider than the trunk all round it.
      expect(leaves.max.y - wood.max.y).toBeGreaterThan(0.3);
      const fol = pineFoliage(shape).getAttribute('position');
      const tip = new Box3().setFromBufferAttribute(trunk.getAttribute('position') as never);
      const cx = (tip.min.x + tip.max.x) / 2;
      let around = 0;
      for (let i = 0; i < fol.count; i++)
        if (Math.abs(fol.getY(i) - wood.max.y) < 0.6 && Math.abs(fol.getX(i) - cx) > 0.15) around++;
      expect(around).toBeGreaterThan(3);
      // The trunk's tip sits off the axis its foot stands on.
      const pos = trunk.getAttribute('position');
      let tipX = 0;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > wood.max.y - 1e-3) tipX = pos.getX(i);
      expect(Math.abs(tipX)).toBeGreaterThan(0.1);
    }
  });

  it('build every pine of umbrella tiers, shaded dark at the apex to light at the hem', () => {
    const box = (shape: (typeof PINE_SHAPES)[number]) =>
      new Box3().setFromBufferAttribute(pineFoliage(shape).getAttribute('position') as never);
    for (const shape of PINE_SHAPES) {
      const geo = pineFoliage(shape);
      const col = geo.getAttribute('color');
      let lo = Infinity;
      let hi = 0;
      for (let i = 0; i < col.count; i++) {
        lo = Math.min(lo, col.getY(i));
        hi = Math.max(hi, col.getY(i));
      }
      expect(hi / lo).toBeGreaterThan(1.8);
      expect(box(shape).max.y).toBeLessThan(12.5);
      expect(box(shape).max.x - box(shape).min.x).toBeLessThan(5.5);
      // Low poly like the reference packs: a dozen or so faces a tier.
      expect(geo.getAttribute('position').count / 3).toBeLessThan(160);
    }
    // Every pine shows trunk under its lowest tier; the young pine's tiers come lowest.
    expect(box('full').min.y).toBeGreaterThan(1.2);
    expect(box('sparse').min.y).toBeGreaterThan(3);
    expect(box('tall').min.y).toBeGreaterThan(3.3);
    expect(box('young').min.y).toBeGreaterThan(0.3);
    expect(box('young').min.y).toBeLessThan(1);
  });
});
