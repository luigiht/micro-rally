import { Color, MeshStandardMaterial, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/game/stage/regions';
import type { Prop, PropKind } from '@/game/stage/SceneryScatter';
import { rallyKits } from '@/render/scenery/kits/RallyKits';
import type { KindKit } from '@/render/scenery/SceneryChunkManager';
import { sceneryKitsFor } from '@/render/scenery/kits/sceneryKits';
import { dayTheme, NIGHTCITY_THEME } from '@/render/theme/WorldTheme';

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
    const kits = rallyKits(REGIONS.forest.palette, true, false);
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
    const trunk = kits.find((k) => k.sources.length === 2)!;
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
    const forest = rallyKits(REGIONS.forest.palette, true, false);
    const alpine = rallyKits(REGIONS.alpine.palette, true, true);
    const roof = (kits: typeof forest) => kits.filter((k) => k.sources.includes('house'))[1]!;
    expect(roof(forest).tint![0]!.getHexString()).not.toBe(roof(alpine).tint![0]!.getHexString());
    for (const k of [...forest, ...alpine]) {
      k.geometry.dispose();
      k.material.dispose();
    }
  });

  it('forest mud stages dress the trees in autumn and nothing else', () => {
    const near = () => ({ dist: 50, x: 0, z: 0 });
    const theme = dayTheme(REGIONS.forest);
    const summer = sceneryKitsFor(theme, { region: 'forest', surface: 'gravel' }, true, near);
    const autumn = sceneryKitsFor(theme, { region: 'forest', surface: 'mud' }, true, near);
    const tint = (kits: KindKit[], kind: PropKind) =>
      kits.find((k) => k.sources.includes(kind) && k.tint)!.tint!.map((c) => c.getHexString());
    expect(tint(autumn, 'broadleaf')).not.toEqual(tint(summer, 'broadleaf'));
    expect(tint(autumn, 'tree')).not.toEqual(tint(summer, 'tree'));
    // Warm: orange and rust canopies, a golden larch for every other pine.
    for (const hex of [...tint(autumn, 'broadleaf'), tint(autumn, 'tree')[1]!]) {
      const c = new Color('#' + hex);
      expect(c.r).toBeGreaterThan(c.g);
      expect(c.g).toBeGreaterThan(c.b);
    }
    // Houses, rocks and trunks keep the summer colours.
    expect(tint(autumn, 'house')).toEqual(tint(summer, 'house'));
    const trunk = (kits: KindKit[]) =>
      (
        kits.find((k) => k.sources.length === 2)!.material as MeshStandardMaterial
      ).color.getHexString();
    expect(trunk(autumn)).toBe(trunk(summer));
    for (const k of [...summer, ...autumn]) {
      k.geometry.dispose();
      k.material.dispose();
    }
  });

  it('sceneryKitsFor picks the rally kits by day and a set covering every kind at night', () => {
    for (const theme of [dayTheme(REGIONS.forest), NIGHTCITY_THEME]) {
      const kits = sceneryKitsFor(theme, { region: 'forest', surface: 'gravel' }, true, () => ({
        dist: 50,
        x: 0,
        z: 0,
      }));
      for (const kind of KINDS) expect(kits.some((k) => k.sources.includes(kind))).toBe(true);
      for (const k of kits) {
        k.geometry.dispose();
        k.material.dispose();
      }
    }
  });
});
