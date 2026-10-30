import { describe, expect, it } from 'vitest';
import { buildCarHull, wellsFor, type HullSpec } from '@/render/car/CarHull';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';

const spec: HullSpec = {
  colors: {
    body: '#ff0000',
    trim: '#000000',
    glass: '#0000ff',
    stripe: '#00ff00',
    roof: '#ffffff',
  },
  stations: [
    {
      z: -2,
      floor: 0.3,
      sill: 0.4,
      belt: 0.9,
      roof: 0.9,
      xSill: 0.8,
      xBody: 0.9,
      xRoof: 0.9,
      glass: true,
    },
    {
      z: -1,
      floor: 0.3,
      sill: 0.4,
      belt: 0.9,
      roof: 1.4,
      xSill: 0.8,
      xBody: 0.9,
      xRoof: 0.7,
      glass: true,
    },
    {
      z: 1,
      floor: 0.3,
      sill: 0.4,
      belt: 0.9,
      roof: 1.4,
      xSill: 0.8,
      xBody: 0.9,
      xRoof: 0.7,
      glass: true,
    },
    { z: 2, floor: 0.3, sill: 0.4, belt: 0.7, roof: 0.7, xSill: 0.8, xBody: 0.9, xRoof: 0.9 },
  ],
};

type Tri = [number[], number[], number[]];

function triangles(positions: Float32Array): Tri[] {
  const out: Tri[] = [];
  for (let i = 0; i < positions.length; i += 9) {
    out.push([
      [positions[i]!, positions[i + 1]!, positions[i + 2]!],
      [positions[i + 3]!, positions[i + 4]!, positions[i + 5]!],
      [positions[i + 6]!, positions[i + 7]!, positions[i + 8]!],
    ]);
  }
  return out;
}

function normal([a, b, c]: Tri): number[] {
  const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
  const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
  return [
    u[1]! * v[2]! - u[2]! * v[1]!,
    u[2]! * v[0]! - u[0]! * v[2]!,
    u[0]! * v[1]! - u[1]! * v[0]!,
  ];
}

function centroid(t: Tri): number[] {
  return [0, 1, 2].map((k) => (t[0][k]! + t[1][k]! + t[2][k]!) / 3);
}

function colorOfTri(colors: Float32Array, index: number): string {
  return Array.from(colors.slice(index * 9, index * 9 + 3)).join(',');
}

describe('buildCarHull', () => {
  const mesh = buildCarHull(spec);
  const tris = triangles(mesh.positions);

  it('emits a finite triangle soup with matching colours inside the station envelope', () => {
    expect(mesh.positions.length % 9).toBe(0);
    expect(mesh.colors.length).toBe(mesh.positions.length);
    expect(tris.length).toBeGreaterThan(40);
    for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      expect(Math.abs(mesh.positions[i]!)).toBeLessThanOrEqual(0.9 + 1e-6);
      expect(mesh.positions[i + 1]!).toBeGreaterThanOrEqual(0.3 - 1e-6);
      expect(mesh.positions[i + 1]!).toBeLessThanOrEqual(1.4 + 1e-6);
      expect(Math.abs(mesh.positions[i + 2]!)).toBeLessThanOrEqual(2 + 1e-6);
    }
  });

  it('winds every face outward', () => {
    for (const t of tris) {
      const n = normal(t);
      const c = centroid(t);
      // Outward means away from the hull's axis (x=0, y=0.85) or along ±z for the caps.
      expect(n[0]! * c[0]! + n[1]! * (c[1]! - 0.85) + n[2]! * c[2]!).toBeGreaterThan(-1e-6);
    }
  });

  it('glazes the windscreen and rear glass as well as the side glass', () => {
    const glass = '0,0,1';
    // Windscreen: top faces between the A-pillar station (z=1) and the scuttle (z=2), above the belt.
    const screen = tris.filter((t, i) => {
      const c = centroid(t);
      return c[2]! > 1.01 && c[2]! < 1.99 && c[1]! > 0.95 && colorOfTri(mesh.colors, i) === glass;
    });
    expect(screen.length).toBeGreaterThan(0);
    const rear = tris.filter((t, i) => {
      const c = centroid(t);
      return c[2]! < -1.01 && c[2]! > -1.99 && c[1]! > 0.95 && colorOfTri(mesh.colors, i) === glass;
    });
    expect(rear.length).toBeGreaterThan(0);
    // The nose stays paint.
    const nose = tris.filter((t) => centroid(t)[2]! > 1.99);
    expect(nose.every((_, k) => colorOfTri(mesh.colors, tris.indexOf(nose[k]!)) !== glass)).toBe(
      true,
    );
  });

  it('cuts wheel wells that clear the tyres', () => {
    const car = CAR_SPECS.hatchback;
    const wells = wellsFor(car);
    const withWells = buildCarHull({ ...spec, wells });
    const vs: number[][] = [];
    for (let i = 0; i < withWells.positions.length; i += 3) {
      vs.push([withWells.positions[i]!, withWells.positions[i + 1]!, withWells.positions[i + 2]!]);
    }
    for (const wz of wells.zs) {
      // No hull vertex sits inside the tyre's swept volume on the outer flank.
      const inside = vs.filter(
        ([x, y, z]) =>
          Math.abs(x!) > wells.xInner + 1e-3 &&
          Math.hypot(y! - wells.axleY, z! - wz) < car.wheelRadius + 0.05,
      );
      expect(inside).toHaveLength(0);
      // At the sill width the lower edge of the side rides the arch, a radius above the axle.
      const edge = Math.min(
        ...vs
          .filter(([x, , z]) => Math.abs(Math.abs(x!) - 0.8) < 1e-3 && Math.abs(z! - wz) < 0.02)
          .map((v) => v[1]!),
      );
      expect(edge).toBeCloseTo(wells.axleY + wells.radius, 1);
    }
  });

  it('keeps the screens whole when wheel-well stations fall inside them', () => {
    const wells = wellsFor(CAR_SPECS.hatchback);
    const withWells = buildCarHull({ ...spec, wells });
    const t = triangles(withWells.positions);
    const glass = '0,0,1';
    // Every top face between the A-pillar (z=1) and the scuttle (z=2) is glass.
    const screen = t
      .map((tri, i) => ({ c: centroid(tri), color: colorOfTri(withWells.colors, i) }))
      .filter(({ c }) => c[2]! > 1.01 && c[2]! < 1.99 && c[1]! > 0.95 && Math.abs(c[0]!) < 0.6);
    expect(screen.length).toBeGreaterThan(2);
    expect(screen.every((f) => f.color === glass)).toBe(true);
  });

  it('splits a multi-colour stripe into bands listed top to bottom', () => {
    const mesh3 = buildCarHull({
      ...spec,
      colors: { ...spec.colors, stripe: ['#00ff00', '#ffffff', '#ff00ff'] },
      stripeBand: [0.15, 0.03],
    });
    const t = triangles(mesh3.positions);
    const at = (color: string) =>
      t
        .map((tri, i) => {
          const c = centroid(tri);
          return { x: c[0]!, y: c[1]!, z: c[2]!, color: colorOfTri(mesh3.colors, i) };
        })
        .filter((f) => f.color === color && Math.abs(f.x) > 0.85 && Math.abs(f.z) < 0.9);
    const green = at('0,1,0');
    const magenta = at('1,0,1');
    expect(green.length).toBeGreaterThan(0);
    expect(magenta.length).toBeGreaterThan(0);
    expect(Math.min(...green.map((f) => f.y))).toBeGreaterThan(
      Math.max(...magenta.map((f) => f.y)) - 1e-6,
    );
  });

  it('paints deck decals onto the top faces, inside their range and on the surface', () => {
    // In this hull both ends are glass, so the roof is the only deck that takes paint.
    const navy = '#000080';
    const mesh2 = buildCarHull({
      ...spec,
      deck: [{ x0: 0.2, x1: 0.5, z0: -0.5, z1: 0.5, color: navy, mirror: true }],
    });
    const t = triangles(mesh2.positions);
    const faces = t.map((tri, i) => ({
      tri,
      c: centroid(tri),
      color: colorOfTri(mesh2.colors, i),
    }));
    // Body red, glass blue, roof white, stripe green, trim black: anything else is the decal.
    const known = new Set(['1,0,0', '0,0,1', '1,1,1', '0,1,0', '0,0,0']);
    const painted = faces.filter((f) => !known.has(f.color));
    expect(painted.length).toBeGreaterThan(0);
    for (const f of painted) {
      expect(f.c[2]!).toBeGreaterThan(-0.5 - 1e-6);
      expect(f.c[2]!).toBeLessThan(0.5 + 1e-6);
      expect(Math.abs(f.c[0]!)).toBeGreaterThan(0.2 - 1e-6);
      expect(Math.abs(f.c[0]!)).toBeLessThan(0.5 + 1e-6);
      // Flat on the roof: every vertex at the roof height.
      for (const v of f.tri) expect(v[1]).toBeCloseTo(1.4, 6);
    }
    expect(painted.some((f) => f.c[0]! > 0)).toBe(true);
    expect(painted.some((f) => f.c[0]! < 0)).toBe(true);
    // The roof beside the decal is still roof colour, and the triangle count only grew.
    const beside = faces.filter(
      (f) => Math.abs(f.c[2]!) < 0.5 && f.c[1]! > 1.39 && Math.abs(f.c[0]!) < 0.19,
    );
    expect(beside.length).toBeGreaterThan(0);
    expect(beside.every((f) => f.color === '1,1,1')).toBe(true);
    expect(t.length).toBeGreaterThan(tris.length);
  });
});
