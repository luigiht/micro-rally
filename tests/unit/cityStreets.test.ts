import { describe, expect, it } from 'vitest';
import { cityStreets } from '@/game/stage/city/CityMap';
import { isSimple, overlaps } from '@/game/stage/Footprints';
import { buildingIndex } from '@/game/stage/BuildingIndex';
import { createRoadHit } from '@/game/stage/RoadPath';
import { generateStage } from '@/game/stage/StageGenerator';
import { TerrainField } from '@/game/stage/TerrainField';
import { junctionKerbs } from '@/game/stage/TownKerbs';
import { stageIndexOf } from './stageIndex';

const SEEDS = [1, 2, 3, 4, 5, 6];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// Generating a city takes about a second, so tests that build several get time for it.
describe('city streets', { timeout: 30_000 }, () => {
  const stages = SEEDS.map((seed) => generateStage(seed, stageIndexOf('urban', 1)));

  it('lays every street from junction to junction: each crossroads off the route meets two or more', () => {
    for (const stage of stages) {
      const map = stage.town!.map!;
      const { nodes, edges } = cityStreets(map);
      const routeAt = new Set(map.route);
      expect(nodes.has(map.route[0]!)).toBe(false);
      expect(nodes.has(map.route[map.route.length - 1]!)).toBe(false);
      for (const n of nodes) {
        if (routeAt.has(n)) continue;
        expect(map.adjacency[n]!.filter((e) => edges.has(e)).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('meets every street end with a junction arm along it, so its pavements stop at the corner', () => {
    for (const [k, stage] of stages.entries()) {
      const town = stage.town!;
      for (const st of town.streets) {
        if (st.route) continue;
        const h = Math.atan2(st.x1 - st.x0, st.z1 - st.z0);
        for (const [x, z, heading] of [
          [st.x0, st.z0, h],
          [st.x1, st.z1, h + Math.PI],
        ] as const) {
          const j = town.junctions.find((q) => Math.hypot(q.x - x, q.z - z) < 1e-3);
          if (!j) continue;
          const off = Math.min(
            ...j.arms
              .filter((a) => a.role === 'blocked')
              .map((a) => Math.abs(wrap(a.heading - heading))),
          );
          expect(
            off,
            `seed ${SEEDS[k]} street end at ${x.toFixed(0)}, ${z.toFixed(0)}`,
          ).toBeLessThan(0.01);
        }
      }
    }
  });

  it('lays every street flat from side to side, however steep it climbs', () => {
    const hit = createRoadHit();
    for (const [k, stage] of stages.slice(0, 3).entries()) {
      const field = new TerrainField(stage);
      let worst = 0;
      for (const st of stage.town!.streets) {
        const len = Math.hypot(st.x1 - st.x0, st.z1 - st.z0);
        const ux = (st.x1 - st.x0) / len;
        const uz = (st.z1 - st.z0) / len;
        for (let d = 2; d < len - 2; d += 8) {
          // The route's last street runs on past where the road ends: only where the road is.
          const cx = st.x0 + ux * d;
          const cz = st.z0 + uz * d;
          if (st.route && !(stage.path.nearest(cx, cz, 30, hit) && hit.distance < 1)) continue;
          const ys = [-0.9, 0, 0.9].map((f) => {
            const l = f * st.halfWidth;
            return field.deckAt(st.x0 + ux * d + uz * l, st.z0 + uz * d - ux * l);
          });
          worst = Math.max(worst, Math.max(...ys) - Math.min(...ys));
        }
      }
      expect(worst, `seed ${SEEDS[k]}`).toBeLessThan(0.05);
    }
  });

  it('lines every side street with buildings from junction to junction', () => {
    for (const [k, stage] of stages.slice(0, 3).entries()) {
      const town = stage.town!;
      const idx = buildingIndex(town.buildings);
      const infills = (town.infills ?? []).map((f) => [...f.front, ...f.back]);
      const covered = (x: number, z: number) =>
        idx.covers(x, z, 0.5) || infills.some((poly) => inside(poly, x, z));
      const rings = town.roundabouts ?? [];
      for (const st of town.streets) {
        const len = Math.hypot(st.x1 - st.x0, st.z1 - st.z0);
        // The route's own and a ring's chords (drawn with the ring) have no frontage of their own.
        if (st.route || len < 20) continue;
        const ux = (st.x1 - st.x0) / len;
        const uz = (st.z1 - st.z0) / len;
        for (const side of [1, -1] as const) {
          let run = 0;
          for (let d = 0; d < len; d += 1) {
            const cx = st.x0 + ux * d;
            const cz = st.z0 + uz * d;
            const near =
              town.junctions.some((j) => Math.hypot(j.x - cx, j.z - cz) < 22) ||
              rings.some((r) => Math.hypot(r.x - cx, r.z - cz) < 40);
            const off = (st.halfWidth + 3 + 1.5) * side;
            if (near || covered(cx + uz * off, cz - ux * off)) run = 0;
            else run++;
            expect(
              run,
              `seed ${SEEDS[k]} street at ${cx.toFixed(0)}, ${cz.toFixed(0)}`,
            ).toBeLessThan(20);
          }
        }
      }
    }
  });

  it('backs every metre of every pavement with a building, catalog or fitted', () => {
    for (const [k, stage] of stages.entries()) {
      const town = stage.town!;
      const idx = buildingIndex(town.buildings);
      const outlines = (town.infills ?? []).map((f) => [...f.front, ...f.back]);
      let total = 0;
      let bare = 0;
      for (const c of town.frontage ?? []) {
        for (let i = 1; i < c.pts.length; i++) {
          const a = c.pts[i - 1]!;
          const b = c.pts[i]!;
          const len = Math.hypot(b.x - a.x, b.z - a.z);
          if (len < 1e-6) continue;
          // Half a metre in from the front, on the chain's left, where its buildings stand.
          const lx = (b.z - a.z) / len;
          const lz = -(b.x - a.x) / len;
          for (let d = 0.5; d < len; d += 1) {
            total++;
            const x = a.x + ((b.x - a.x) * d) / len + lx * 0.5;
            const z = a.z + ((b.z - a.z) * d) / len + lz * 0.5;
            if (!idx.covers(x, z, 0.1) && !outlines.some((o) => inside(o, x, z))) bare++;
          }
        }
      }
      expect(total, `seed ${SEEDS[k]}`).toBeGreaterThan(10_000);
      // A metre or two at most, where two fitted buildings' fronts meet at an outside corner.
      expect(bare / total, `seed ${SEEDS[k]}`).toBeLessThan(0.0005);
    }
  });

  it('stands no building inside another: catalog and fitted footprints only touch', () => {
    for (const [k, stage] of stages.slice(0, 3).entries()) {
      const town = stage.town!;
      const idx = buildingIndex(town.buildings);
      const outlines = (town.infills ?? []).map((f) => [...f.front, ...f.back]);
      const clashes: string[] = [];
      outlines.forEach((o, i) => {
        expect(isSimple(o)).toBe(true);
        const cx = o.reduce((s, p) => s + p.x, 0) / o.length;
        const cz = o.reduce((s, p) => s + p.z, 0) / o.length;
        const reach = Math.max(...o.map((p) => Math.hypot(p.x - cx, p.z - cz)));
        idx.near(cx, cz, reach, ({ corners }) => {
          if (
            overlaps(
              o,
              [0, 1, 3, 2].map((n) => ({ x: corners[n]![0], z: corners[n]![1] })),
            )
          )
            clashes.push(`fitted ${i} on a catalog building`);
        });
        for (let m = i + 1; m < outlines.length; m++)
          if (overlaps(o, outlines[m]!)) clashes.push(`fitted ${i} on fitted ${m}`);
      });
      expect(clashes, `seed ${SEEDS[k]}`).toEqual([]);
    }
  });

  it('passes two roundabouts or more', () => {
    for (const stage of stages) expect(stage.town!.roundabouts!.length).toBeGreaterThanOrEqual(2);
  });

  it('closes no street the route passes unless it runs on beyond the barrier', () => {
    for (const [k, stage] of stages.entries()) {
      const town = stage.town!;
      for (const j of town.junctions) {
        for (const arm of j.arms) {
          if (arm.role !== 'blocked') continue;
          // A laid street leaves the junction along the arm.
          const laid = town.streets.some((st) => {
            if (st.route) return false;
            for (const [ax, az, bx, bz] of [
              [st.x0, st.z0, st.x1, st.z1],
              [st.x1, st.z1, st.x0, st.z0],
            ] as const) {
              if (Math.hypot(ax - j.x, az - j.z) > 30) continue;
              if (Math.abs(wrap(Math.atan2(bx - ax, bz - az) - arm.heading)) < 0.35) return true;
            }
            return false;
          });
          expect(laid, `seed ${SEEDS[k]} junction at ${j.x.toFixed(0)}, ${j.z.toFixed(0)}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('lays each junction’s paving on the deck, level where its streets meet', () => {
    for (const [k, stage] of stages.slice(0, 3).entries()) {
      const field = new TerrainField(stage);
      let worst = 0;
      for (const j of stage.town!.junctions) {
        for (const poly of junctionKerbs(j, stage, stage.halfWidth).surface.polygons) {
          if (poly.length === 4) continue;
          // The paving is a fan from its first corner, each vertex on the deck: between the
          // vertices it must stay on the deck too, so the deck may not step inside it.
          const ys = poly.map((v) => field.deckAt(v.x, v.z));
          for (let i = 1; i + 1 < poly.length; i++) {
            const [a, b, c] = [poly[0]!, poly[i]!, poly[i + 1]!];
            const x = (a.x + b.x + c.x) / 3;
            const z = (a.z + b.z + c.z) / 3;
            const y = (ys[0]! + ys[i]! + ys[i + 1]!) / 3;
            worst = Math.max(worst, Math.abs(y - field.deckAt(x, z)));
          }
        }
      }
      expect(worst, `seed ${SEEDS[k]}`).toBeLessThan(0.15);
    }
  });
});

/** Point in polygon, by ray casting. */
function inside(poly: readonly { x: number; z: number }[], x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const a = poly[k]!;
    const b = poly[i]!;
    if (a.z > z !== b.z > z && x < a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z || 1e-12))
      hit = !hit;
  }
  return hit;
}
