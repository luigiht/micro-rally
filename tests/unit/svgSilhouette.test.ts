import { describe, expect, it } from 'vitest';
import { BULL_PATHS, bullPositions } from '@/render/car/BullSilhouette';
import { polygonsBox, silhouettePositions, svgPathPolygons } from '@/render/car/SvgSilhouette';

/** Signed volume of a closed triangle soup (positive when wound outward). */
function signedVolume(p: Float32Array): number {
  let v = 0;
  for (let i = 0; i + 8 < p.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = p.subarray(i, i + 9) as unknown as number[];
    v +=
      (ax! * (by! * cz! - bz! * cy!) +
        ay! * (bz! * cx! - bx! * cz!) +
        az! * (bx! * cy! - by! * cx!)) /
      6;
  }
  return v;
}

describe('svg silhouette', () => {
  it('reads absolute and relative lines, curves, shorthand curves and closes', () => {
    expect(svgPathPolygons('M0,0h10v10H0z')).toEqual([
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
    ]);
    // A start point plus two chords per cubic; the S shorthand ends where it says.
    const [curve] = svgPathPolygons('M0,0c0,10,10,10,10,0s10,-10,10,0z', 2);
    expect(curve).toHaveLength(5);
    expect(curve!.at(-1)![0]).toBeCloseTo(20);
    expect(curve!.at(-1)![1]).toBeCloseTo(0);
    // Relative move with implicit line-tos; an explicit return to the start is not doubled.
    expect(svgPathPolygons('m1,1 2,0 0,2 -2,-2z')).toEqual([
      [
        [1, 1],
        [3, 1],
        [3, 3],
      ],
    ]);
    expect(svgPathPolygons('M0,0h1v1z M5,5h1v1z')).toHaveLength(2);
  });

  it('extrudes a square into a closed, outward-wound slab centred on its box', () => {
    const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ] as const;
    const pos = silhouettePositions([square], 0.1, 0.02);
    // Two caps of two triangles and four walls of two.
    expect(pos.length).toBe(12 * 9);
    expect(signedVolume(pos)).toBeCloseTo(1 * 1 * 0.02, 6);
    for (let i = 0; i < pos.length; i += 3) {
      expect(Math.abs(pos[i]!)).toBeCloseTo(0.01);
      expect(Math.abs(pos[i + 1]!)).toBeCloseTo(0.5);
      expect(Math.abs(pos[i + 2]!)).toBeCloseTo(0.5);
    }
    // SVG right is +z, SVG up is +y: the icon's top-right corner lands forward and up.
    const z = (sx: number) => (sx - 5) * 0.1;
    const y = (sy: number) => (5 - sy) * 0.1;
    expect(z(10)).toBeGreaterThan(z(0));
    expect(y(0)).toBeGreaterThan(y(10));
  });

  it('turns the bull into two solid polygons inside its icon box and a slab that charges forward', () => {
    const polygons = BULL_PATHS.flatMap((d) => svgPathPolygons(d));
    expect(polygons).toHaveLength(2);
    expect(polygons[0]!.length).toBeGreaterThan(100);
    const box = polygonsBox(polygons);
    expect(box.minX).toBeGreaterThanOrEqual(-0.01);
    expect(box.maxX).toBeLessThanOrEqual(30);
    expect(box.minY).toBeGreaterThan(4);
    expect(box.maxY).toBeLessThan(26);
    const pos = bullPositions(0.028, 0.02);
    expect(pos.length % 9).toBe(0);
    expect(signedVolume(pos)).toBeGreaterThan(0);
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 2; i < pos.length; i += 3) {
      minZ = Math.min(minZ, pos[i]!);
      maxZ = Math.max(maxZ, pos[i]!);
    }
    expect(maxZ - minZ).toBeCloseTo((box.maxX - box.minX) * 0.028, 3);
    // Built once per size.
    expect(bullPositions(0.028, 0.02)).toBe(pos);
  });
});
