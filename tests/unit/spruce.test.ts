import { Box3, Color } from 'three';
import { describe, expect, it } from 'vitest';
import { STAGE_TYPES } from '@/game/stage/regions';
import { spruceForm, spruceKits } from '@/render/scenery/kits/SpruceKits';
import { SPRUCE_SPECS, spruceGeometry } from '@/render/scenery/SpruceGeometry';

const greens = [new Color('#2c4a3b'), new Color('#3a5c48')] as const;
const trunk = new Color('#4a3b2e');
const box = new Box3();

/** Positions and colours of a geometry, vertex by vertex. */
function vertices(spec: (typeof SPRUCE_SPECS)[number], detail: 0 | 1) {
  const g = spruceGeometry(spec, greens, trunk, detail);
  const p = g.getAttribute('position');
  const c = g.getAttribute('color');
  const out = Array.from({ length: p.count }, (_, i) => ({
    x: p.getX(i),
    y: p.getY(i),
    z: p.getZ(i),
    white: c.getX(i) > 0.8 && c.getY(i) > 0.8 && c.getZ(i) > 0.8,
    green: c.getY(i) > c.getX(i) * 1.15,
  }));
  box.setFromBufferAttribute(p as never);
  const bounds = box.clone();
  g.dispose();
  return { out, bounds };
}

describe('Arctic spruces', () => {
  it('stand 12–15 m tall on the ground, within their old reach', () => {
    for (const spec of SPRUCE_SPECS) {
      const { bounds } = vertices(spec, 1);
      expect(bounds.min.y).toBeLessThanOrEqual(0.05);
      expect(bounds.max.y).toBeGreaterThan(11.5);
      expect(bounds.max.y).toBeLessThan(15);
      expect(Math.max(-bounds.min.x, bounds.max.x, -bounds.min.z, bounds.max.z)).toBeLessThan(3);
    }
  });

  it('are mostly green with snow on their tiers’ tops, a quarter laden, very few bare', () => {
    let plain = 0;
    let partial = 0;
    let laden = 0;
    for (const spec of SPRUCE_SPECS) {
      const { out } = vertices(spec, 1);
      const white = out.filter((v) => v.white).length;
      const green = out.filter((v) => v.green).length;
      expect(green).toBeGreaterThan(out.length * 0.2);
      if (spec.snow === 0) {
        expect(white).toBe(0);
        plain += spec.share;
      } else expect(white).toBeGreaterThan(out.length * 0.05);
      if (spec.snow >= 0.95) laden += spec.share;
      else if (spec.snow > 0) {
        // Snow on the tops only: green still the larger part of the tree.
        expect(green).toBeGreaterThan(white);
        partial += spec.share;
      }
    }
    expect(SPRUCE_SPECS.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 6);
    expect(partial).toBeGreaterThan(0.6);
    expect(laden).toBeGreaterThan(0.2);
    expect(laden).toBeLessThan(0.35);
    expect(plain).toBeGreaterThan(0);
    expect(plain).toBeLessThanOrEqual(0.1);
  });

  it('end in their top tier’s point, with no stub on it', () => {
    for (const spec of SPRUCE_SPECS) {
      const { out, bounds } = vertices(spec, 1);
      // The top 0.4 m narrows to a point: nothing there spans more than 0.5 m.
      const tip = out.filter((v) => v.y > bounds.max.y - 0.4);
      const xs = tip.map((v) => v.x);
      const zs = tip.map((v) => v.z);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.5);
      expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(0.5);
      // And it is the top tier's own point, at the tree's top (its snow a few centimetres over it).
      expect(Math.abs(bounds.max.y - spec.top)).toBeLessThan(0.2);
    }
  });

  it('stand in for themselves far off with under half the triangles', () => {
    for (const spec of SPRUCE_SPECS) {
      const near = vertices(spec, 1).out.length;
      const far = vertices(spec, 0).out.length;
      expect(far).toBeLessThan(near * 0.5);
    }
  });

  it('take each spruce in exactly one near and one far kit, every silhouette turning up', () => {
    const palette = STAGE_TYPES.arctic.palette;
    const kits = spruceKits(
      [new Color(palette.foliage), new Color(palette.foliageAlt)],
      palette.trunk,
      false,
    );
    const forms = new Set<number>();
    const counts = new Map<number, number>();
    for (let i = 0; i < 1000; i++) {
      const p = {
        kind: 'spruce' as const,
        x: i * 2.9,
        y: 0,
        z: i * 1.7,
        scale: 1,
        rotation: 0,
        variant: i % 2,
      };
      const taking = kits.filter((k) => !k.accept || k.accept(p));
      expect(taking.filter((k) => k.lod === 'near')).toHaveLength(1);
      expect(taking.filter((k) => k.lod === 'far')).toHaveLength(1);
      forms.add(spruceForm(p));
      counts.set(spruceForm(p), (counts.get(spruceForm(p)) ?? 0) + 1);
    }
    expect(forms.size).toBe(SPRUCE_SPECS.length);
    // Each silhouette turns up in about its share.
    SPRUCE_SPECS.forEach((spec, n) =>
      expect(Math.abs((counts.get(n) ?? 0) / 1000 - spec.share)).toBeLessThan(0.05),
    );
    for (const k of kits) {
      k.geometry.dispose();
      k.material.dispose();
    }
  });
});
