import { type BufferGeometry, Color } from 'three';
import { describe, expect, it } from 'vitest';
import type { BuildingStyle } from '@/game/stage/Town';
import { BUILDING_SIZE } from '@/game/stage/TownTerraces';
import { buildingRoofGeometry, buildingWallsGeometry } from '@/render/scenery/BuildingGeometry';
import { hipRoofGeometry } from '@/render/scenery/CivicGeometry';

const STYLES: readonly BuildingStyle[] = [
  'townhouse',
  'shop',
  'tower',
  'hall',
  'block',
  'office',
  'tenement',
  'arcade',
];
/** Roofs, canopies, awnings and steps may reach this far beyond the footprint. */
const OVERHANG = 0.5;
const FOUNDATION_BOTTOM = -1.6;
const EPS = 1e-3;

/** Dot of the face normal of triangle `t` with the offset of its centroid from (cx, cy, cz). */
function faceDot(geo: BufferGeometry, t: number, cx: number, cy: number, cz: number): number {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const mx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3 - cx;
  const my = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3 - cy;
  const mz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3 - cz;
  return nor.getX(t) * mx + nor.getY(t) * my + nor.getZ(t) * mz;
}

/**
 * Share of triangles whose normal points away from the centroid of their own
 * part (vertices welded by position, then joined through triangles). The kits
 * are unions of convex boxes and prisms, so an outward-wound face always
 * scores positive against its part; a whole-geometry centroid would not do,
 * as every detail box has faces turned toward the building's middle.
 */
function outwardRatio(geo: BufferGeometry): number {
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const byPosition = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    const first = byPosition.get(key);
    if (first === undefined) byPosition.set(key, i);
    else union(first, i);
  }
  for (let t = 0; t < n; t += 3) {
    union(t, t + 1);
    union(t, t + 2);
  }
  const sums = new Map<number, [number, number, number, number]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const s = sums.get(root) ?? [0, 0, 0, 0];
    s[0] += pos.getX(i);
    s[1] += pos.getY(i);
    s[2] += pos.getZ(i);
    s[3]++;
    sums.set(root, s);
  }
  let outward = 0;
  for (let t = 0; t < n; t += 3) {
    const s = sums.get(find(t))!;
    if (faceDot(geo, t, s[0] / s[3], s[1] / s[3], s[2] / s[3]) > 0) outward++;
  }
  return outward / (n / 3);
}

/** True when every triangle's vertex order (CCW is front-facing in three.js) agrees with its stored normal. */
function windingMatchesNormals(geo: BufferGeometry): boolean {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  for (let t = 0; t < pos.count; t += 3) {
    const ax = pos.getX(t + 1) - pos.getX(t);
    const ay = pos.getY(t + 1) - pos.getY(t);
    const az = pos.getZ(t + 1) - pos.getZ(t);
    const bx = pos.getX(t + 2) - pos.getX(t);
    const by = pos.getY(t + 2) - pos.getY(t);
    const bz = pos.getZ(t + 2) - pos.getZ(t);
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    if (nx * nor.getX(t) + ny * nor.getY(t) + nz * nor.getZ(t) <= 0) return false;
  }
  return true;
}

/** Vertices painted pure white (tinted per instance) versus any other colour (fixed). */
function tintSplit(geo: BufferGeometry): { white: number; fixed: number } {
  const col = geo.getAttribute('color');
  let white = 0;
  for (let i = 0; i < col.count; i++)
    if (col.getX(i) === 1 && col.getY(i) === 1 && col.getZ(i) === 1) white++;
  return { white, fixed: col.count - white };
}

describe('BuildingGeometry', () => {
  describe.each(STYLES)('%s', (style) => {
    const walls = buildingWallsGeometry(style);
    const roof = buildingRoofGeometry(style);
    const { hx, hz } = BUILDING_SIZE[style];

    it('builds non-indexed walls and roof kits with normals and vertex colours', () => {
      for (const geo of [walls, roof]) {
        expect(geo.index).toBeNull();
        const pos = geo.getAttribute('position');
        expect(pos.count % 3).toBe(0);
        expect(pos.count).toBeGreaterThan(36);
        expect(geo.getAttribute('normal').count).toBe(pos.count);
        expect(geo.getAttribute('color').count).toBe(pos.count);
      }
    });

    it('winds every face so it is not back-face culled', () => {
      for (const geo of [walls, roof]) {
        expect(windingMatchesNormals(geo)).toBe(true);
        expect(outwardRatio(geo)).toBeGreaterThanOrEqual(0.97);
      }
    });

    it('fits the footprint plus overhang and stands on a deep foundation', () => {
      for (const geo of [walls, roof]) {
        geo.computeBoundingBox();
        const b = geo.boundingBox!;
        expect(Math.max(-b.min.x, b.max.x)).toBeLessThanOrEqual(hx + OVERHANG + EPS);
        expect(Math.max(-b.min.z, b.max.z)).toBeLessThanOrEqual(hz + OVERHANG + EPS);
      }
      expect(walls.boundingBox!.min.y).toBeCloseTo(FOUNDATION_BOTTOM, 3);
      expect(walls.boundingBox!.max.y).toBeGreaterThanOrEqual(style === 'hall' ? 6 : 5);
      expect(roof.boundingBox!.min.y).toBeGreaterThan(0);
      expect(roof.boundingBox!.max.y).toBeGreaterThan(walls.boundingBox!.max.y - 3);
    });

    it('mixes tintable white with fixed-colour detail in both kits', () => {
      for (const geo of [walls, roof]) {
        const { white, fixed } = tintSplit(geo);
        expect(white).toBeGreaterThan(0);
        expect(fixed).toBeGreaterThan(0);
      }
      walls.dispose();
      roof.dispose();
    });
  });
});

describe('hipRoofGeometry', () => {
  it('closes a pyramid over a square and a hipped prism over a rectangle, all faces outward', () => {
    const pyramid = hipRoofGeometry(6, 6, 2, 0.2, 3, new Color('#fff'));
    // Soffit (2), four eave faces (8), four triangular slopes (4).
    expect(pyramid.getAttribute('position').count).toBe(14 * 3);
    const hipped = hipRoofGeometry(8, 6, 2, 0.2, 3, new Color('#fff'));
    // Soffit (2), four eave faces (8), two trapezoid slopes (4), two hips (2).
    expect(hipped.getAttribute('position').count).toBe(16 * 3);
    for (const geo of [pyramid, hipped]) {
      expect(geo.index).toBeNull();
      expect(windingMatchesNormals(geo)).toBe(true);
      expect(outwardRatio(geo)).toBe(1);
      geo.computeBoundingBox();
      expect(geo.boundingBox!.max.y).toBeCloseTo(5, 5);
      expect(geo.boundingBox!.min.y).toBeCloseTo(3, 5);
      const nor = geo.getAttribute('normal');
      let soffit = 0;
      for (let t = 0; t < nor.count; t += 3) if (nor.getY(t) < -0.99) soffit++;
      expect(soffit).toBe(2);
      geo.dispose();
    }
  });
});
