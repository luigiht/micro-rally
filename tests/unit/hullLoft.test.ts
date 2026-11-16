import { describe, expect, it } from 'vitest';
import { buildCarHull, type HullSpec } from '@/render/car/CarHull';
import { loft, monotone } from '@/render/car/HullLoft';
import { BERLINETTE_HULL } from '@/render/car/BerlinetteShape';
import { SATORY_HULL } from '@/render/car/SatoryShape';

describe('hull loft', () => {
  it('runs a monotone curve through its keys without overshooting them', () => {
    const f = monotone([0, 1, 2, 3], [0, 1, 1, 0.2]);
    expect(f(1)).toBeCloseTo(1, 9);
    for (let x = 0; x <= 3; x += 0.01) {
      expect(f(x)).toBeLessThanOrEqual(1 + 1e-9);
      expect(f(x)).toBeGreaterThanOrEqual(0 - 1e-9);
    }
    // Flat between the two equal keys, held past the ends.
    expect(f(1.5)).toBeCloseTo(1, 9);
    expect(f(-1)).toBe(0);
    expect(f(9)).toBeCloseTo(0.2, 9);
  });

  it('lays stations at every key and break, no further apart than the step, with their flags', () => {
    const stations = loft(
      [
        { z: -1, floor: 0.3, sill: 0.4, belt: 0.9, roof: 0.9, xSill: 0.7, xBody: 0.8, xRoof: 0.6 },
        { z: 1, roof: 1.3 },
      ],
      {
        step: 0.1,
        breaks: [0.25],
        flags: (z0, z1) => (z0 >= 0.25 && z1 > z0 ? { glass: true } : {}),
      },
    );
    const zs = stations.map((s) => s.z);
    expect(zs[0]).toBe(-1);
    expect(zs.at(-1)).toBe(1);
    expect(zs).toContain(0.25);
    for (let i = 1; i < zs.length; i++) expect(zs[i]! - zs[i - 1]!).toBeLessThanOrEqual(0.1 + 1e-9);
    for (const s of stations.slice(0, -1)) expect(Boolean(s.glass)).toBe(s.z >= 0.25);
    // A field given once holds; xBelt follows the body when no key gives it.
    expect(stations.every((s) => s.belt === 0.9 && s.xBelt === s.xBody)).toBe(true);
  });

  it('rounds sections with extra profile points and keeps a flat hull as it was', () => {
    const flat: HullSpec = { ...SATORY_HULL, rounding: undefined };
    const round = buildCarHull(SATORY_HULL);
    const plain = buildCarHull(flat);
    expect(round.positions.length).toBeGreaterThan(plain.positions.length * 1.2);
    // The (lightly) crowned roof stands over its edge: the highest point is on the centre line.
    let top = -Infinity;
    let topX = 0;
    for (let i = 0; i < round.positions.length; i += 3) {
      if (round.positions[i + 1]! > top) {
        top = round.positions[i + 1]!;
        topX = round.positions[i]!;
      }
    }
    expect(Math.abs(topX)).toBeLessThan(1e-6);
    expect(top).toBeGreaterThan(1.33);
  });

  it('measures both new cars to their references', () => {
    const extent = (hull: HullSpec) => {
      const m = buildCarHull(hull);
      const r = { z0: Infinity, z1: -Infinity, x: 0, y: 0 };
      for (let i = 0; i < m.positions.length; i += 3) {
        r.x = Math.max(r.x, Math.abs(m.positions[i]!));
        r.y = Math.max(r.y, m.positions[i + 1]!);
        r.z0 = Math.min(r.z0, m.positions[i + 2]!);
        r.z1 = Math.max(r.z1, m.positions[i + 2]!);
      }
      return r;
    };
    const satory = extent(SATORY_HULL);
    expect(satory.z1 - satory.z0).toBeCloseTo(4.17, 1);
    expect(satory.x * 2).toBeCloseTo(1.8, 1);
    const berlinette = extent(BERLINETTE_HULL);
    expect(berlinette.z1 - berlinette.z0).toBeCloseTo(3.75, 1);
    expect(berlinette.x * 2).toBeCloseTo(1.58, 1);
    // Roof crowns over the real cars' heights (hull metres, the ground at about 0).
    expect(berlinette.y).toBeGreaterThan(1.13);
    expect(berlinette.y).toBeLessThan(1.2);
  });
});
