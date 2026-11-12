import { describe, expect, it } from 'vitest';
import { junctionCrossings, ZEBRA_DEPTH } from '@/game/stage/Crossings';
import { onMedian } from '@/game/stage/Median';
import { BAY_WIDTH, parkedCars, parkingStretches } from '@/game/stage/ParkingBays';
import { STAGE_TYPES } from '@/game/stage/regions';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { onRoundabout } from '@/game/stage/Roundabout';
import { generateStage } from '@/game/stage/StageGenerator';
import { TerrainField } from '@/game/stage/TerrainField';
import { TRAM_BED_HALF } from '@/game/stage/Tram';
import { laneCount } from '@/render/road/LaneMarkings';
import { stageIndexOf } from './stageIndex';

const URBAN_INDEX = stageIndexOf('urban');
const SEEDS = [1, 2, 3];
const URBAN = STAGE_TYPES.urban.urban!;

function segmentDistance(x0: number, z0: number, x1: number, z1: number, x: number, z: number) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len2 = dx * dx + dz * dz;
  const u = Math.min(1, Math.max(0, len2 > 0 ? ((x - x0) * dx + (z - z0) * dz) / len2 : 0));
  return Math.hypot(x - (x0 + dx * u), z - (z0 + dz * u));
}

describe('junctionCrossings', () => {
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

describe('parkingStretches', () => {
  it('lines the three-lane straights with bays off the junctions, rings and start, two lanes between, some cars parked', () => {
    let cars = 0;
    for (const seed of SEEDS) {
      const stage = generateStage(seed, URBAN_INDEX);
      const town = stage.town!;
      const stretches = parkingStretches(town, stage, URBAN);
      for (const s of stretches) {
        expect(s.to - s.from).toBeGreaterThanOrEqual(11);
        for (let d = s.from; d <= s.to; d += 2) {
          expect(halfWidthAt(stage, d)).toBeCloseTo(URBAN.lanes.three, 6);
          expect(onRoundabout(town.roundabouts ?? [], d, 2 * stage.halfWidth)).toBe(false);
        }
        expect(s.from).toBeGreaterThanOrEqual(45);
        // Every crossing keeps off the bays.
        for (const c of junctionCrossings(town, stage)) {
          const d = segmentDistance(s.x0, s.z0, s.x1, s.z1, c.x, c.z);
          if (d < s.halfWidth) {
            const dx = s.x1 - s.x0;
            const dz = s.z1 - s.z0;
            const len = Math.hypot(dx, dz);
            const t = ((c.x - s.x0) * dx + (c.z - s.z0) * dz) / len;
            expect(t < -ZEBRA_DEPTH / 2 || t > len + ZEBRA_DEPTH / 2).toBe(true);
          }
        }
      }
      const parked = parkedCars(stretches, seed);
      cars += parked.length;
      for (const car of parked) {
        const s = stretches.find(
          (st) => segmentDistance(st.x0, st.z0, st.x1, st.z1, car.x, car.z) < st.halfWidth,
        )!;
        expect(s).toBeDefined();
        const off = segmentDistance(s.x0, s.z0, s.x1, s.z1, car.x, car.z);
        expect(off).toBeGreaterThan(s.halfWidth - 0.6 - BAY_WIDTH);
        expect(off).toBeLessThan(s.halfWidth - 0.6);
      }
      expect(parkedCars(stretches, seed)).toEqual(parked);
    }
    expect(cars).toBeGreaterThan(0);
  });

  it('counts two lanes on a bayed three-lane street and three on a plain one', () => {
    expect(laneCount(URBAN.lanes.three, true)).toBe(2);
    expect(laneCount(URBAN.lanes.three, false)).toBe(3);
    expect(laneCount(URBAN.lanes.four, false)).toBe(4);
  });
});
