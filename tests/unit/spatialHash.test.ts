import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/game/rng';
import { BuildingIndex, buildingIndex, MAX_BUILDING_REACH } from '@/game/stage/BuildingIndex';
import { SpatialHash } from '@/game/stage/SpatialHash';
import { generateStage } from '@/game/stage/StageGenerator';
import { type Building } from '@/game/stage/Town';
import { apart, PARTY_GAP } from '@/game/stage/TownTerraces';

interface Pt {
  x: number;
  z: number;
}

const bruteCovers = (bs: readonly Building[], x: number, z: number, m: number) =>
  bs.some((b) => {
    const dx = x - b.x;
    const dz = z - b.z;
    const u = dx * Math.cos(b.yaw) - dz * Math.sin(b.yaw);
    const v = dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw);
    return Math.abs(u) <= b.hx + m && Math.abs(v) <= b.hz + m;
  });

describe('SpatialHash', () => {
  it('finds every item within reach of a query, including across cell borders and negatives', () => {
    const rand = mulberry32(7);
    const grid = new SpatialHash<Pt>(10);
    const pts: Pt[] = Array.from({ length: 400 }, () => ({
      x: rand() * 400 - 200,
      z: rand() * 400 - 200,
    }));
    for (const p of pts) grid.insert(p, p.x, p.z);
    for (let k = 0; k < 50; k++) {
      const x = rand() * 400 - 200;
      const z = rand() * 400 - 200;
      const r = 3 + rand() * 20;
      const seen = new Set<Pt>();
      grid.near(x, z, r, (p) => {
        seen.add(p);
      });
      for (const p of pts) if (Math.hypot(p.x - x, p.z - z) <= r) expect(seen.has(p)).toBe(true);
    }
  });

  it('stops early when the visitor returns true', () => {
    const grid = new SpatialHash<number>(5);
    for (let i = 0; i < 10; i++) grid.insert(i, 0, 0);
    let visited = 0;
    expect(
      grid.near(0, 0, 1, () => {
        visited++;
        return visited === 3;
      }),
    ).toBe(true);
    expect(visited).toBe(3);
  });

  it('rings cover every cell exactly once', () => {
    const grid = new SpatialHash<string>(1);
    for (let cx = -4; cx <= 4; cx++)
      for (let cz = -4; cz <= 4; cz++) grid.insert(`${cx},${cz}`, cx + 0.5, cz + 0.5);
    const seen: string[] = [];
    for (let r = 0; r <= 4; r++) {
      const ring: string[] = [];
      grid.ring(0, 0, r, (items) => ring.push(...items));
      expect(ring.length).toBe(r === 0 ? 1 : 8 * r);
      seen.push(...ring);
    }
    expect(new Set(seen).size).toBe(81);
  });
});

describe('BuildingIndex', () => {
  it('matches a scan of every building, and keeps up with buildings pushed later', () => {
    const rand = mulberry32(11);
    const buildings: Building[] = [];
    const idx = new BuildingIndex(buildings);
    const push = () =>
      buildings.push({
        style: 'block',
        x: rand() * 300,
        z: rand() * 300,
        yaw: rand() * Math.PI * 2,
        hx: 2 + rand() * 5,
        hz: 2 + rand() * 4,
        variant: 0,
      });
    for (let i = 0; i < 150; i++) push();
    const check = () => {
      for (let k = 0; k < 300; k++) {
        const x = rand() * 300;
        const z = rand() * 300;
        const m = rand() * 3;
        expect(idx.covers(x, z, m)).toBe(bruteCovers(buildings, x, z, m));
      }
    };
    check();
    for (let i = 0; i < 100; i++) push();
    check();
    expect(MAX_BUILDING_REACH).toBeGreaterThanOrEqual(Math.hypot(7, 5.5));
  });

  it('a village stands no two buildings closer than a party gap', () => {
    let index = 0;
    let town = generateStage(1, index).town;
    while (!town || town.city) town = generateStage(1, ++index).town;
    const bs = town.buildings;
    expect(bs.length).toBeGreaterThan(10);
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i]!;
        const b = bs[j]!;
        if (Math.hypot(a.x - b.x, a.z - b.z) > 2 * MAX_BUILDING_REACH + PARTY_GAP) continue;
        expect(apart(a, b, PARTY_GAP - 1e-6)).toBe(true);
      }
  });

  it('a city joins its buildings wall to wall, never one front into another', () => {
    const town = generateStage(1, 8).town!;
    const bs = town.buildings;
    expect(bs.length).toBeGreaterThan(500);
    const idx = buildingIndex(bs);
    const deep: string[] = [];
    const poking: string[] = [];
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i]!;
      // Overlaps only where row neighbours meet on a bend, behind their fronts, and never deep.
      idx.near(b.x, b.z, Math.hypot(b.hx, b.hz), ({ b: o }) => {
        if (o !== b && !apart(o, b, -1.5 - 1e-6)) deep.push(`${i}`);
      });
      // The street front (local -z) runs inside no other building, corners included.
      const c = Math.cos(b.yaw);
      const s = Math.sin(b.yaw);
      for (let k = 0; k <= 8; k++) {
        const u = -b.hx + (2 * b.hx * k) / 8;
        const x = b.x + u * c - b.hz * s;
        const z = b.z - u * s - b.hz * c;
        idx.near(x, z, 0, ({ b: o }) => {
          if (o === b) return;
          const dx = x - o.x;
          const dz = z - o.z;
          const ou = dx * Math.cos(o.yaw) - dz * Math.sin(o.yaw);
          const ov = dx * Math.sin(o.yaw) + dz * Math.cos(o.yaw);
          if (Math.abs(ou) < o.hx - 0.1 && Math.abs(ov) < o.hz - 0.1) poking.push(`${i}`);
        });
      }
    }
    expect(deep).toEqual([]);
    expect(poking).toEqual([]);
  });
});
