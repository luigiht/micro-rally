import { describe, expect, it } from 'vitest';
import {
  buildFenderShell,
  fenderPoint,
  fenderRadiusAt,
  type FenderSpec,
} from '@/render/car/FenderShell';

const FENDER: FenderSpec = {
  z: 1.55,
  axleY: 0.47,
  inner: 0.55,
  outline: [
    [-95, 0.66],
    [-60, 0.78],
    [-15, 0.85],
    [30, 0.82],
    [70, 0.7],
    [92, 0.64],
  ],
  xIn: 0.58,
  xOut: 1.14,
  bevel: 0.08,
  colors: { body: '#1a337a', trim: '#2b2a33' },
};

/** Signed volume of a closed triangle soup (positive when wound outward). */
function signedVolume(p: Float32Array, side: 1 | -1): number {
  let v = 0;
  for (let i = 0; i + 8 < p.length; i += 9) {
    if (Math.sign(p[i]!) !== side) continue;
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = p.subarray(i, i + 9) as unknown as number[];
    v +=
      (ax! * (by! * cz! - bz! * cy!) +
        ay! * (bz! * cx! - bx! * cz!) +
        az! * (bx! * cy! - by! * cx!)) /
      6;
  }
  return v;
}

describe('fender shell', () => {
  it('interpolates the outer radius along the outline and seats parts on the dome', () => {
    expect(fenderRadiusAt(FENDER, -15)).toBeCloseTo(0.85);
    expect(fenderRadiusAt(FENDER, -120)).toBeCloseTo(0.66);
    expect(fenderRadiusAt(FENDER, 120)).toBeCloseTo(0.64);
    expect(fenderRadiusAt(FENDER, 50)).toBeCloseTo(0.76);
    const top = fenderPoint(FENDER, 0, 0.01);
    expect(top.z).toBeCloseTo(1.55);
    expect(top.y).toBeCloseTo(0.47 + fenderRadiusAt(FENDER, 0) + 0.01);
    expect(top.tilt).toBe(0);
    const ahead = fenderPoint(FENDER, 90);
    expect(ahead.y).toBeCloseTo(0.47);
    expect(ahead.z).toBeCloseTo(1.55 + fenderRadiusAt(FENDER, 90));
    expect(ahead.tilt).toBeCloseTo(Math.PI / 2);
  });

  it('builds a mirrored shell that clears the tyre and stays inside its outline', () => {
    const mesh = buildFenderShell(FENDER);
    const p = mesh.positions;
    expect(p.length % 9).toBe(0);
    expect(mesh.colors.length).toBe(p.length);
    expect(mesh.glowStart).toBe(p.length / 3);
    const maxOuter = Math.max(...FENDER.outline.map(([, r]) => r));
    const keys = new Set<string>();
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i]!;
      const y = p[i + 1]!;
      const z = p[i + 2]!;
      expect(Math.abs(x)).toBeGreaterThanOrEqual(FENDER.xIn - 1e-6);
      expect(Math.abs(x)).toBeLessThanOrEqual(FENDER.xOut + 1e-6);
      const radial = Math.hypot(y - FENDER.axleY, z - FENDER.z);
      expect(radial).toBeGreaterThanOrEqual(FENDER.inner - 1e-6);
      expect(radial).toBeLessThanOrEqual(maxOuter + 1e-6);
      keys.add(`${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`);
    }
    for (const key of keys) {
      const [x, y, z] = key.split(',');
      expect(keys.has(`${(-Number(x)).toFixed(4)},${y},${z}`)).toBe(true);
    }
  });

  it('winds every face outward: each side encloses a positive volume near the ring area times its width', () => {
    const mesh = buildFenderShell(FENDER);
    // Ring area by the trapezoid rule over the outline, less the chamfer.
    let area = 0;
    const o = FENDER.outline;
    for (let i = 0; i < o.length - 1; i++) {
      const da = ((o[i + 1]![0] - o[i]![0]) * Math.PI) / 180;
      const r0 = o[i]![1];
      const r1 = o[i + 1]![1];
      area += (da * ((r0 * r0 + r1 * r1) / 2 - FENDER.inner * FENDER.inner)) / 2;
    }
    const width = FENDER.xOut - FENDER.xIn;
    const expected = area * width;
    for (const side of [1, -1] as const) {
      const v = signedVolume(mesh.positions, side);
      expect(v).toBeGreaterThan(expected * 0.85);
      expect(v).toBeLessThan(expected * 1.0);
    }
  });

  it('paints the arch underside in trim and everything else in body colour', () => {
    const mesh = buildFenderShell(FENDER);
    const shades = new Set<string>();
    for (let i = 0; i < mesh.colors.length; i += 3)
      shades.add(`${mesh.colors[i]!.toFixed(4)},${mesh.colors[i + 1]!.toFixed(4)}`);
    expect(shades.size).toBe(2);
  });
});
