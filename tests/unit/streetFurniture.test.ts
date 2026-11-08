import { describe, expect, it } from 'vitest';
import { createRoadHit } from '@/game/stage/RoadPath';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { generateStage } from '@/game/stage/StageGenerator';
import { TerrainField } from '@/game/stage/TerrainField';
import { KERB_LIFT, townObstacles } from '@/game/stage/Town';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { DOOR_OFFSET } from '@/game/stage/BuildingCatalog';
import { stageIndexOf } from './stageIndex';

const URBAN_INDEX = stageIndexOf('urban');
const SEEDS = [1, 2, 3];
const PAVEMENT_KINDS = [
  'lamp',
  'trafficLight',
  'bench',
  'bin',
  'hydrant',
  'bollard',
  'treePit',
] as const;

describe('streetFurniture', () => {
  it('stands every piece on a pavement, off the doors and buildings, and every manhole on the carriageway', () => {
    for (const seed of SEEDS) {
      const stage = generateStage(seed, URBAN_INDEX);
      const field = new TerrainField(stage);
      const props = scatterScenery(field);
      const town = stage.town!;
      const obstacles = townObstacles(town);
      const doors = town.buildings.map((b) => {
        const lx = DOOR_OFFSET[b.style];
        const lz = -b.hz;
        const c = Math.cos(b.yaw);
        const s = Math.sin(b.yaw);
        return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
      });
      const counts: Record<string, number> = {};
      const hit = createRoadHit();
      // Collected and asserted once: an expect per piece and building is millions of calls.
      const misplaced: string[] = [];
      for (const p of props) {
        counts[p.kind] = (counts[p.kind] ?? 0) + 1;
        if ((PAVEMENT_KINDS as readonly string[]).includes(p.kind)) {
          expect(
            field.heightAt(p.x, p.z) - field.deckAt(p.x, p.z),
            `${seed} ${p.kind}`,
          ).toBeCloseTo(KERB_LIFT, 2);
          for (const o of obstacles) {
            const dx = p.x - o.x;
            const dz = p.z - o.z;
            const c = Math.cos(o.yaw);
            const s = Math.sin(o.yaw);
            const u = dx * c - dz * s;
            const v = dx * s + dz * c;
            if (Math.abs(u) <= o.hx + 0.2 && Math.abs(v) <= o.hz + 0.2)
              misplaced.push(
                `${seed} ${p.kind} in a building at ${p.x.toFixed(1)},${p.z.toFixed(1)}`,
              );
          }
          if (p.kind === 'bench' || p.kind === 'treePit')
            for (const d of doors)
              if (Math.hypot(d.x - p.x, d.z - p.z) < 2 - 1e-6)
                misplaced.push(
                  `${seed} ${p.kind} by a door at ${p.x.toFixed(1)},${p.z.toFixed(1)}`,
                );
        }
        if (p.kind === 'manhole') {
          expect(field.surfaceAt(p.x, p.z)).toBe('tarmac');
          expect(Math.abs(field.heightAt(p.x, p.z) - field.deckAt(p.x, p.z))).toBeLessThan(1e-3);
          expect(stage.path.nearest(p.x, p.z, 20, hit)).toBe(true);
          expect(hit.distance).toBeLessThan(halfWidthAt(stage, hit.along) - 1);
        }
      }
      expect(misplaced).toEqual([]);
      for (const kind of [...PAVEMENT_KINDS, 'manhole', 'parkedCar'])
        expect(counts[kind] ?? 0, `${seed} ${kind}`).toBeGreaterThan(0);
      // Lamps keep their rhythm: roughly one per 30 m of route, give or take the junctions.
      expect(counts.lamp!).toBeGreaterThan(stage.length / 90);
      // Every street long enough carries tree pits on both pavements, about one per 15 m a side.
      const pits = props.filter((p) => p.kind === 'treePit');
      for (const st of town.streets) {
        const dx = st.x1 - st.x0;
        const dz = st.z1 - st.z0;
        const len = Math.hypot(dx, dz);
        if (len < 60) continue;
        const h = Math.atan2(dx, dz);
        const perSide = { left: 0, right: 0 };
        for (const p of pits) {
          const ux = p.x - st.x0;
          const uz = p.z - st.z0;
          const along = ux * Math.sin(h) + uz * Math.cos(h);
          const across = ux * Math.cos(h) - uz * Math.sin(h);
          // On the route the pavement follows the ribbon's edge, which tapers before the junctions.
          const hw =
            st.route && stage.path.nearest(p.x, p.z, 20, hit)
              ? halfWidthAt(stage, hit.along)
              : st.halfWidth;
          if (along < 0 || along > len || Math.abs(Math.abs(across) - hw - 1.6) > 0.3) continue;
          if (across > 0) perSide.left++;
          else perSide.right++;
        }
        const expected = (len - 30) / 15;
        expect(
          perSide.left,
          `${seed} left of street at ${st.x0.toFixed(0)},${st.z0.toFixed(0)}`,
        ).toBeGreaterThanOrEqual(Math.floor(expected * 0.5));
        expect(
          perSide.right,
          `${seed} right of street at ${st.x0.toFixed(0)},${st.z0.toFixed(0)}`,
        ).toBeGreaterThanOrEqual(Math.floor(expected * 0.5));
      }
    }
  }, 60000);
});
