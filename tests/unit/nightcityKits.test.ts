import { Color, MeshBasicMaterial, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { Prop, PropKind } from '@/game/stage/SceneryScatter';
import {
  GLOW,
  hueAt,
  nightcityKits,
  propHash,
  tierFor,
  treeRole,
} from '@/render/scenery/kits/NightcityKits';
import {
  CANTILEVER,
  CORE_HALF,
  towerBodyGeometry,
} from '@/render/scenery/night/NightTowerGeometry';

const KINDS: PropKind[] = [
  'tree',
  'broadleaf',
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

const prop = (kind: PropKind, x = 0, z = 0, variant = 0): Prop => ({
  kind,
  x,
  y: 0,
  z,
  scale: 1,
  rotation: 1,
  variant,
});

function dispose(kits: ReturnType<typeof nightcityKits>) {
  for (const k of kits) {
    k.geometry.dispose();
    k.material.dispose();
  }
}

describe('nightcityKits', () => {
  it('dresses every prop kind; tree slots split into towers, masts and dark gaps by hash', () => {
    const kits = nightcityKits({ shadows: true, near: () => ({ dist: 50, x: 0, z: 0 }) });
    const roles = { tower: 0, mast: 0, none: 0 };
    for (const kind of KINDS) {
      let hits = 0;
      for (let i = 0; i < 60; i++) {
        const p = prop(kind, i * 7.3, i * 3.1);
        if (kits.some((k) => k.sources.includes(kind) && (k.accept?.(p) ?? true))) hits++;
        if (kind === 'tree') roles[treeRole(p) ?? 'none']++;
      }
      // Trees and bushes are thinned by hash; everything else is dressed every time.
      if (kind === 'tree' || kind === 'broadleaf' || kind === 'spruce')
        expect(hits).toBeGreaterThan(15);
      else expect(hits).toBe(60);
    }
    expect(roles.tower).toBeGreaterThan(8);
    expect(roles.mast).toBeGreaterThan(5);
    expect(roles.none).toBeGreaterThan(15);
    for (const k of kits) {
      expect(k.geometry.index).toBeNull();
      expect(k.geometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(k.geometry.getAttribute('color').count).toBe(
        k.geometry.getAttribute('position').count,
      );
      if (k.colorAt) expect(k.material).toBeInstanceOf(MeshBasicMaterial);
    }
    dispose(kits);
  });

  it('towers rise with distance from the road and signs turn to face it', () => {
    expect(tierFor(5)).toBe('kiosk');
    expect(tierFor(20)).toBe('mid');
    expect(tierFor(45)).toBe('tall');
    let tree = prop('tree');
    for (let i = 0; treeRole(tree) !== 'tower'; i++) tree = prop('tree', i * 5.5, i * 2.2);
    for (const [dist, tier] of [
      [5, 'kiosk'],
      [20, 'mid'],
      [45, 'tall'],
    ] as const) {
      const kits = nightcityKits({ shadows: false, near: () => ({ dist, x: 0, z: 0 }) });
      const accepting = kits.filter((k) => k.sources.includes('tree') && k.accept?.(tree));
      // Body and glow of exactly one tier.
      expect(accepting).toHaveLength(2);
      const heights = accepting.map((k) => {
        k.geometry.computeBoundingBox();
        return k.geometry.boundingBox!.max.y;
      });
      expect(Math.max(...heights)).toBeGreaterThan(tier === 'kiosk' ? 5 : tier === 'mid' ? 15 : 30);
      expect(Math.max(...heights)).toBeLessThan(tier === 'kiosk' ? 8 : tier === 'mid' ? 20 : 40);
      dispose(kits);
    }
    const kits = nightcityKits({ shadows: false, near: () => ({ dist: 8, x: 0, z: 0 }) });
    let bush = prop('bush', 10, 0);
    let sign = kits.find((k) => k.sources.includes('bush') && k.place && k.accept?.(bush));
    for (let i = 1; !sign; i++) {
      bush = prop('bush', 10 + i * 3.7, i * 1.9);
      sign = kits.find((k) => k.sources.includes('bush') && k.place && k.accept?.(bush));
    }
    const dummy = new Object3D();
    sign!.place!(bush, dummy);
    // The -z face should look back along the line from the prop to the road point (0, 0).
    const dx = -Math.sin(dummy.rotation.y);
    const dz = -Math.cos(dummy.rotation.y);
    const len = Math.hypot(bush.x, bush.z);
    expect(dx).toBeCloseTo(-bush.x / len, 5);
    expect(dz).toBeCloseTo(-bush.z / len, 5);
    dispose(kits);
  });

  it('keeps every tower inside the tree collider below the cantilever and glows in HDR hues', () => {
    for (const tier of ['kiosk', 'mid', 'tall'] as const) {
      const geo = towerBodyGeometry(tier);
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) < CANTILEVER - 0.05) {
          expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(0.45);
          expect(Math.abs(pos.getZ(i))).toBeLessThanOrEqual(0.45);
        }
      }
      expect(CORE_HALF * 1.1).toBeLessThanOrEqual(0.45);
      geo.dispose();
    }
    const c = new Color();
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      hueAt(prop('tree', i * 4.1, i * 9.7), c);
      expect(Math.max(c.r, c.g, c.b)).toBeCloseTo(GLOW, 5);
      seen.add(c.getHexString());
    }
    expect(seen.size).toBe(4);
    const a = propHash(prop('tree', 1, 2), 1);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(propHash(prop('tree', 1, 2), 2)).not.toBe(a);
  });
});
