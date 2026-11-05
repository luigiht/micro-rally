import { describe, expect, it } from 'vitest';
import type { HullStation } from '@/render/car/CarHull';
import { ellipseOnHull, hullTopAt } from '@/render/car/HullSurface';

const flat = (z: number, roof: number): HullStation => ({
  z,
  floor: 0.1,
  sill: 0.2,
  belt: 0.4,
  roof,
  xSill: 0.8,
  xBody: 0.8,
  xRoof: 0.6,
});

describe('hull surface', () => {
  it('reads the flat top, the slope to the belt and blends between stations', () => {
    const st = [flat(0, 0.6), flat(1, 0.8)];
    expect(hullTopAt(st, 0, 0)).toBeCloseTo(0.6);
    expect(hullTopAt(st, 0.3, 0.5)).toBeCloseTo(0.7);
    // Halfway down the slope from the roof edge (0.6) to the belt (0.8 across, 0.4 high).
    expect(hullTopAt(st, 0.7, 0)).toBeCloseTo(0.5);
    expect(hullTopAt(st, 0.9, 0)).toBeCloseTo(0.4);
  });

  it('follows a shoulder crown standing above the roof', () => {
    const crown = (z: number): HullStation => ({ ...flat(z, 0.5), shoulder: 0.6, xShoulder: 0.7 });
    const st = [crown(0), crown(1)];
    expect(hullTopAt(st, 0.7, 0.5)).toBeCloseTo(0.6);
    expect(hullTopAt(st, 0.65, 0.5)).toBeCloseTo(0.55);
    expect(hullTopAt(st, 0.2, 0.5)).toBeCloseTo(0.5);
  });

  it('lays an ellipse on the surface, facing up', () => {
    const st = [flat(0, 0.6), flat(1, 0.8)];
    const p = ellipseOnHull(st, { cx: 0, cz: 0.5, rx: 0.2, rz: 0.3, lift: 0.01 });
    expect(p.length % 9).toBe(0);
    for (let i = 0; i < p.length; i += 3) {
      expect(p[i + 1]!).toBeCloseTo(hullTopAt(st, p[i]!, p[i + 2]!) + 0.01, 5);
    }
    for (let i = 0; i < p.length; i += 9) {
      const ux = p[i + 3]! - p[i]!,
        uz = p[i + 5]! - p[i + 2]!;
      const vx = p[i + 6]! - p[i]!,
        vz = p[i + 8]! - p[i + 2]!;
      expect(uz * vx - ux * vz).toBeGreaterThanOrEqual(-1e-9);
    }
  });
});
