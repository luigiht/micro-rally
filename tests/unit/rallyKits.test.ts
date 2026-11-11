import { stagePalette } from '@/game/stage/regions';
import { Color, MeshStandardMaterial, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { STAGE_TYPES } from '@/game/stage/regions';
import type { Prop, PropKind } from '@/game/stage/SceneryScatter';
import { rallyKits } from '@/render/scenery/kits/RallyKits';
import type { KindKit } from '@/render/scenery/SceneryChunkManager';
import { sceneryKitsFor } from '@/render/scenery/kits/sceneryKits';

const KINDS: PropKind[] = [
  'tree',
  'broadleaf',
  'palm',
  'bush',
  'rock',
  'house',
  'townhouse',
  'shop',
  'tower',
  'hall',
  'block',
  'office',
  'tenement',
  'arcade',
  'cone',
  'arrowLeft',
  'arrowRight',
  'lamp',
  'parkedCar',
  'trafficLight',
  'bench',
  'bin',
  'hydrant',
  'bollard',
  'treePit',
  'manhole',
  'spruce',
  'spectator',
];

const prop = (kind: PropKind, variant = 0): Prop => ({
  kind,
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  rotation: 1,
  variant,
});

describe('rallyKits', () => {
  it('dresses every prop kind, with the pre-refactor special cases as placement hooks', () => {
    const kits = rallyKits(STAGE_TYPES.forest.palette, true, false);
    for (const kind of KINDS) {
      expect(kits.some((k) => k.sources.includes(kind) && (k.accept?.(prop(kind)) ?? true))).toBe(
        true,
      );
    }
    // Houses and town buildings are two kits (walls, roof); flower boxes only on variant 1.
    expect(kits.filter((k) => k.sources.includes('house'))).toHaveLength(2);
    const planters = kits.filter((k) => k.accept && k.sources.includes('shop'));
    expect(planters.length).toBeGreaterThan(0);
    for (const k of planters) {
      expect(k.accept!(prop('shop', 1))).toBe(true);
      expect(k.accept!(prop('shop', 0))).toBe(false);
    }
    // City façades come in four renders; the village's in two.
    expect(kits.find((k) => k.sources.includes('tenement'))!.tint).toHaveLength(4);
    expect(kits.find((k) => k.sources.includes('townhouse'))!.tint).toHaveLength(2);
    const trunk = kits.find((k) => k.sources.length === 2 && k.sources.includes('broadleaf'))!;
    const dummy = new Object3D();
    dummy.scale.setScalar(1);
    trunk.place!(prop('broadleaf'), dummy);
    expect(dummy.scale.y).toBeCloseTo(1.6);
    const rock = kits.find((k) => k.sources.includes('rock'))!;
    dummy.position.set(0, 5, 0);
    rock.place!(prop('rock'), dummy);
    expect(dummy.position.y).toBeCloseTo(4.8);
    expect(dummy.rotation.x).toBeCloseTo(1);
    for (const k of kits) {
      expect(k.geometry.getAttribute('position').count).toBeGreaterThan(0);
      k.geometry.dispose();
      k.material.dispose();
    }
  });

  it('snow regions swap the house tints only', () => {
    const forest = rallyKits(STAGE_TYPES.forest.palette, true, false);
    const alpine = rallyKits(STAGE_TYPES.alpine.palette, true, true);
    const roof = (kits: typeof forest) => kits.filter((k) => k.sources.includes('house'))[1]!;
    expect(roof(forest).tint![0]!.getHexString()).not.toBe(roof(alpine).tint![0]!.getHexString());
    for (const k of [...forest, ...alpine]) {
      k.geometry.dispose();
      k.material.dispose();
    }
  });

  it('Autumnal dresses the trees in autumn and nothing else', () => {
    const summer = sceneryKitsFor({ stageType: 'pinewood' }, true);
    const autumn = sceneryKitsFor({ stageType: 'autumnal' }, true);
    const tint = (kits: KindKit[], kind: PropKind) =>
      kits.find((k) => k.sources.includes(kind) && k.tint)!.tint!.map((c) => c.getHexString());
    // The trees colour themselves from the autumn mix, spot by spot, instead of the two-tone tint.
    const foliage = autumn.filter(
      (k) => k.sources.length === 1 && (k.sources[0] === 'tree' || k.sources[0] === 'broadleaf'),
    );
    expect(foliage).toHaveLength(6);
    for (const k of foliage) expect(k.colorAt).toBeDefined();
    expect(summer.find((k) => k.sources[0] === 'broadleaf')!.colorAt).toBeUndefined();
    // Warm crowns: gold, orange, rust and crimson.
    for (const hex of stagePalette('autumnal').autumn!.broadleaves) {
      const c = new Color(hex);
      expect(c.r).toBeGreaterThan(c.g);
      expect(c.g).toBeGreaterThanOrEqual(c.b);
    }
    // Houses, rocks and trunks keep the summer colours.
    expect(tint(autumn, 'house')).toEqual(tint(summer, 'house'));
    const trunk = (kits: KindKit[]) =>
      (
        kits.find((k) => k.sources.length === 2 && k.sources.includes('broadleaf'))!
          .material as MeshStandardMaterial
      ).color.getHexString();
    expect(trunk(autumn)).toBe(trunk(summer));
    for (const k of [...summer, ...autumn]) {
      k.geometry.dispose();
      k.material.dispose();
    }
  });

  it('sceneryKitsFor returns the stage type kits', () => {
    const kits = sceneryKitsFor({ stageType: 'pinewood' }, true);
    for (const kind of KINDS) expect(kits.some((k) => k.sources.includes(kind))).toBe(true);
    for (const k of kits) {
      k.geometry.dispose();
      k.material.dispose();
    }
  });
});
