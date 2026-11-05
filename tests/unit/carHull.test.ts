import { describe, expect, it } from 'vitest';
import { buildCarHull, wellsFor, type HullSpec } from '@/render/car/CarHull';
import { prismPositions } from '@/components/game/CarParts';
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

  it('carries stripes across the end caps only when asked', () => {
    const stripe = '0,1,0';
    const capStripes = (m: ReturnType<typeof buildCarHull>) =>
      triangles(m.positions).filter((t, i) => {
        const c = centroid(t);
        return Math.abs(Math.abs(c[2]!) - 2) < 1e-6 && colorOfTri(m.colors, i) === stripe;
      }).length;
    expect(capStripes(mesh)).toBe(0);
    expect(capStripes(buildCarHull({ ...spec, wrapStripes: true }))).toBeGreaterThan(0);
  });

  it('leans the flank out to a shoulder when xBelt is wider than xBody', () => {
    const shouldered = buildCarHull({
      ...spec,
      stations: spec.stations.map((s) => ({ ...s, xBelt: 1.0 })),
    });
    let widest = 0;
    for (let i = 0; i < shouldered.positions.length; i += 3)
      widest = Math.max(widest, Math.abs(shouldered.positions[i]!));
    expect(widest).toBeCloseTo(1.0, 6);
    // Without xBelt the hull never exceeds xBody.
    let plain = 0;
    for (let i = 0; i < mesh.positions.length; i += 3)
      plain = Math.max(plain, Math.abs(mesh.positions[i]!));
    expect(plain).toBeCloseTo(0.9, 6);
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

describe('prismPositions', () => {
  it('extrudes a convex polygon into closed, outward-facing faces', () => {
    const pts = prismPositions(
      [
        [0, 1],
        [1, 1],
        [1, 0],
      ],
      0.2,
    );
    // Two triangular caps + three rectangular sides (2 triangles each) = 8 triangles.
    expect(pts.length).toBe(8 * 9);
    for (let t = 0; t < pts.length; t += 9) {
      const a = [pts[t]!, pts[t + 1]!, pts[t + 2]!];
      const b = [pts[t + 3]!, pts[t + 4]!, pts[t + 5]!];
      const c = [pts[t + 6]!, pts[t + 7]!, pts[t + 8]!];
      const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
      const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
      const n = [
        u[1]! * v[2]! - u[2]! * v[1]!,
        u[2]! * v[0]! - u[0]! * v[2]!,
        u[0]! * v[1]! - u[1]! * v[0]!,
      ];
      const m = [
        (a[0]! + b[0]! + c[0]!) / 3,
        (a[1]! + b[1]! + c[1]!) / 3 - 2 / 3,
        (a[2]! + b[2]! + c[2]!) / 3 - 2 / 3,
      ];
      expect(n[0]! * m[0]! + n[1]! * m[1]! + n[2]! * m[2]!).toBeGreaterThan(0);
    }
  });
});

describe('hull decals', () => {
  const lens = '#ff00ff';
  const magenta = '1,0,1';
  const decorated = buildCarHull({
    ...spec,
    sideDecals: [{ z0: -2, z1: -1, u0: 0, u1: 0.5, color: lens, glow: true }],
    capDecals: [
      { end: 'tail', x0: 0.5, x1: 1, y0: 0.8, y1: 0.95, color: lens, glow: true, mirror: true },
    ],
  });
  const tris = triangles(decorated.positions);
  const faces = tris.map((t, i) => ({ i, c: centroid(t), color: colorOfTri(decorated.colors, i) }));
  const lit = faces.filter((f) => f.i * 3 < decorated.glowStart);
  const glowing = faces.filter((f) => f.i * 3 >= decorated.glowStart);

  it('paints side and cap decals into the surface and keeps them apart as the glowing group', () => {
    expect(glowing.length).toBeGreaterThan(0);
    expect(glowing.every((f) => f.color === magenta)).toBe(true);
    expect(lit.every((f) => f.color !== magenta)).toBe(true);
    // Without decals nothing glows and the geometry is unchanged in size.
    const plain = buildCarHull(spec);
    expect(plain.glowStart).toBe(plain.positions.length / 3);
  });

  it('lays the pillar lens along the outer half of the C-pillar band, between the tail and the pillar station', () => {
    const pillar = glowing.filter((f) => f.c[2]! > -2 + 1e-6 && f.c[2]! < -1 - 1e-6);
    expect(pillar.length).toBeGreaterThan(0);
    for (const f of pillar) {
      // The band runs from the belt edge (|x| 0.9) in toward the roof edge (0.7); the lens keeps to its outer half.
      expect(Math.abs(f.c[0]!)).toBeGreaterThan(0.78);
      expect(f.c[1]!).toBeGreaterThan(0.9 - 1e-6);
      expect(f.c[1]!).toBeLessThan(1.4);
    }
    expect(pillar.some((f) => f.c[0]! > 0)).toBe(true);
    expect(pillar.some((f) => f.c[0]! < 0)).toBe(true);
  });

  it('wraps the cap lens onto the tail panel at both corners, inside its height band only', () => {
    const cap = glowing.filter((f) => Math.abs(f.c[2]! + 2) < 1e-6);
    expect(cap.some((f) => f.c[0]! > 0.5)).toBe(true);
    expect(cap.some((f) => f.c[0]! < -0.5)).toBe(true);
    for (const f of cap) {
      expect(Math.abs(f.c[0]!)).toBeGreaterThan(0.5);
      expect(f.c[1]!).toBeGreaterThan(0.8);
      expect(f.c[1]!).toBeLessThan(0.95);
    }
    // The panel's centre and the nose stay paint.
    const tailCentre = lit.filter((f) => Math.abs(f.c[2]! + 2) < 1e-6 && Math.abs(f.c[0]!) < 0.4);
    expect(tailCentre.length).toBeGreaterThan(0);
    expect(faces.filter((f) => f.c[2]! > 1.99).every((f) => f.color !== magenta)).toBe(true);
  });

  it('cuts finer arches when a well asks for more segments', () => {
    const car = CAR_SPECS.hatchback;
    const zsOf = (segments?: number) => {
      const hull = buildCarHull({ ...spec, wells: { ...wellsFor(car), segments } });
      const zs = new Set<number>();
      for (let i = 2; i < hull.positions.length; i += 3)
        zs.add(Math.round(hull.positions[i]! * 1e3));
      return zs.size;
    };
    expect(zsOf(16)).toBeGreaterThan(zsOf());
  });

  it('tints the windscreen apart from the side glass when asked', () => {
    // A tint no other band uses: pure yellow.
    const tinted = buildCarHull({ ...spec, colors: { ...spec.colors, screen: '#ffff00' } });
    const plain = buildCarHull(spec);
    const yellows = (h: typeof plain) => {
      let n = 0;
      for (let i = 0; i < h.colors.length; i += 3)
        if (h.colors[i]! > 0.99 && h.colors[i + 1]! > 0.99 && h.colors[i + 2]! < 0.01) n++;
      return n;
    };
    expect(yellows(tinted)).toBeGreaterThan(0);
    expect(yellows(plain)).toBe(0);
  });

  it('adds a shoulder crease to every station once one names it', () => {
    const plain = buildCarHull(spec);
    const creased = buildCarHull({
      ...spec,
      stations: spec.stations.map((s, i) =>
        i === 2 ? { ...s, shoulder: (s.belt + s.roof) / 2 + 0.02, xShoulder: s.xBody + 0.05 } : s,
      ),
    });
    expect(creased.positions.length).toBeGreaterThan(plain.positions.length);
    // The named crease is a vertex of the hull.
    const s = spec.stations[2]!;
    let hit = false;
    for (let i = 0; i < creased.positions.length; i += 3) {
      if (
        Math.abs(creased.positions[i]! - (s.xBody + 0.05)) < 1e-6 &&
        Math.abs(creased.positions[i + 1]! - ((s.belt + s.roof) / 2 + 0.02)) < 1e-6 &&
        Math.abs(creased.positions[i + 2]! - s.z) < 1e-6
      )
        hit = true;
    }
    expect(hit).toBe(true);
  });

  it("paints a station's pillar band in its own colour when asked", () => {
    const painted = buildCarHull({
      ...spec,
      stations: spec.stations.map((s, i) => (i === 0 ? { ...s, sidePaint: '#ffff00' } : s)),
    });
    let yellows = 0;
    for (let i = 0; i < painted.colors.length; i += 3)
      if (
        painted.colors[i]! > 0.99 &&
        painted.colors[i + 1]! > 0.99 &&
        painted.colors[i + 2]! < 0.01
      )
        yellows++;
    expect(yellows).toBeGreaterThan(0);
  });

  it('builds the same hull whichever way the stations are listed', () => {
    const forward = buildCarHull({ ...spec, wells: wellsFor(CAR_SPECS.hatchback) });
    const reversed = buildCarHull({
      ...spec,
      wells: wellsFor(CAR_SPECS.hatchback),
      stations: [...spec.stations].reverse(),
    });
    expect(Array.from(reversed.positions)).toEqual(Array.from(forward.positions));
    expect(Array.from(reversed.colors)).toEqual(Array.from(forward.colors));
  });
});
