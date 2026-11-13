import { describe, expect, it } from 'vitest';
import { junctionCrossings, ZEBRA_DEPTH } from '@/game/stage/Crossings';
import { onMedian } from '@/game/stage/Median';
import { generateStage } from '@/game/stage/StageGenerator';
import { TerrainField } from '@/game/stage/TerrainField';
import { TRAM_BED_HALF } from '@/game/stage/Tram';
import { stageIndexOf } from './stageIndex';

const URBAN_INDEX = stageIndexOf('urban');
const SEEDS = [1, 2, 3];

function segmentDistance(x0: number, z0: number, x1: number, z1: number, x: number, z: number) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len2 = dx * dx + dz * dz;
  const u = Math.min(1, Math.max(0, len2 > 0 ? ((x - x0) * dx + (z - z0) * dz) / len2 : 0));
  return Math.hypot(x - (x0 + dx * u), z - (z0 + dz * u));
}

// Generating a city takes about a second, so tests that build several get time for it.
describe('junctionCrossings', { timeout: 30_000 }, () => {
  it('lays every zebra and stop line on plain carriageway, clear of pavements, medians, trams and rings', () => {
    for (const seed of SEEDS) {
      const stage = generateStage(seed, URBAN_INDEX);
      const field = new TerrainField(stage);
      const town = stage.town!;
      const crossings = junctionCrossings(town, stage);
      // Junctions on the route carry crossings on their arms (those off it are plain crossroads).
      const onRoute = town.junctions.filter((j) => j.arms.some((a) => a.role === 'in'));
      expect(crossings.length).toBeGreaterThan(onRoute.length * 1.5);
      for (const c of crossings) {
        const lx = Math.cos(c.heading);
        const lz = -Math.sin(c.heading);
        const fx = Math.sin(c.heading);
        const fz = Math.cos(c.heading);
        const corners: [number, number][] = [];
        for (const a of [-ZEBRA_DEPTH / 2, ZEBRA_DEPTH / 2 + 1.3])
          for (const e of [-c.halfWidth + 0.5, 0, c.halfWidth - 0.5]) corners.push([a, e]);
        for (const [a, e] of corners) {
          const x = c.x + fx * a + lx * e;
          const z = c.z + fz * a + lz * e;
          expect(field.surfaceAt(x, z), `${seed}`).toBe('tarmac');
          expect(Math.abs(field.heightAt(x, z) - field.deckAt(x, z)), `${seed}`).toBeLessThan(1e-3);
          expect(onMedian(town.medians ?? [], x, z), `${seed}`).toBe(false);
          for (const t of town.trams ?? [])
            expect(segmentDistance(t.x0, t.z0, t.x1, t.z1, x, z)).toBeGreaterThan(TRAM_BED_HALF);
        }
      }
      expect(junctionCrossings(town, stage)).toEqual(crossings);
    }
  });
});
