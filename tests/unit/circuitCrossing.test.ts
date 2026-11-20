import { describe, expect, it } from 'vitest';
import { CROSS_CLEARANCE, CROSS_ZONE, findCrossing, lapGap } from '@/game/stage/CircuitCrossing';
import { generateCircuit } from '@/game/stage/CircuitGenerator';
import { barrierObstacles } from '@/game/stage/CircuitTrackside';
import { mulberry32 } from '@/game/rng';
import { generateStage } from '@/game/stage/StageGenerator';
import { createStageWorld } from '@/game/stage/StageWorld';
import { ROAD_LIFT, TerrainField } from '@/game/stage/TerrainField';
import { Autopilot } from '@/game/vehicle/Autopilot';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { resolveObstacleCollisions } from '@/game/vehicle/Collisions';
import { createControlInput } from '@/game/vehicle/ControlInput';
import { DEFAULT_ENV, VehicleSim } from '@/game/vehicle/VehicleSim';

const STAGES = [1, 6, 42, 989380427].map((seed) => generateStage(seed, 9));

describe('circuit crossings', () => {
  it('cross every lap over itself exactly once, the two stretches far apart round the lap', () => {
    for (let i = 0; i < 60; i++) {
      const c = generateCircuit(mulberry32(3000 + i * 13));
      const found = findCrossing(c.path, 200)!;
      expect(found).not.toBeNull();
      expect(Math.hypot(found.x - c.crossing.x, found.z - c.crossing.z)).toBeLessThan(1e-6);
      expect(lapGap(c.crossing.over, c.crossing.under, c.path.length)).toBeGreaterThan(400);
      // The start's grid keeps well clear of both stretches' ramps.
      for (const d of [c.crossing.over, c.crossing.under])
        expect(lapGap(c.startDistance, d, c.path.length)).toBeGreaterThan(200);
    }
  });

  it('lifts the bridge a full clearance over the tunnel road', () => {
    for (const stage of STAGES) {
      const field = new TerrainField(stage);
      const c = stage.circuit!.crossing;
      expect(field.roadHeightAt(c.over) - field.roadHeightAt(c.under)).toBeGreaterThan(
        CROSS_CLEARANCE - 0.01,
      );
    }
  });

  it('carries a car on the bridge over the cutting and lets one in the tunnel drive under it', () => {
    for (const stage of STAGES) {
      const field = new TerrainField(stage);
      const c = stage.circuit!.crossing;
      const at = { x: 0, z: 0, heading: 0 };
      for (const d of [-30, -12, 0, 12, 30]) {
        // The tunnel road, with no hint and with a car on it: its own deck.
        stage.path.sample(c.under + d, at);
        const under = field.roadHeightAt(c.under + d) + ROAD_LIFT;
        expect(Math.abs(field.heightAt(at.x, at.z) - under), `under ${d}`).toBeLessThan(0.15);
        expect(Math.abs(field.heightAt(at.x, at.z, under + 0.3) - under)).toBeLessThan(0.15);
        // The bridge road: a car up on it stays on its deck.
        stage.path.sample(c.over + d, at);
        const over = field.roadHeightAt(c.over + d) + ROAD_LIFT;
        expect(Math.abs(field.heightAt(at.x, at.z, over + 0.3) - over), `over ${d}`).toBeLessThan(
          0.15,
        );
      }
      // The terrain mesh is cut down to the tunnel road under the bridge.
      const s = { height: 0, roadBlend: 0, roadDistance: 0 };
      expect(field.sample(c.x, c.z, s).height).toBeLessThan(
        field.roadHeightAt(c.over) - CROSS_CLEARANCE + 1,
      );
    }
  });

  it('holds the crossing’s walls to the tunnel and its parapets to the bridge', () => {
    for (const stage of STAGES) {
      const field = new TerrainField(stage);
      const c = stage.circuit!.crossing;
      const over = field.roadHeightAt(c.over);
      const under = field.roadHeightAt(c.under);
      const boxes = barrierObstacles(stage, (d) => field.roadHeightAt(d));
      const near = boxes.filter((b) => Math.hypot(b.x - c.x, b.z - c.z) < 30);
      expect(near.some((b) => b.yMax !== undefined)).toBe(true);
      expect(near.some((b) => b.yMin !== undefined)).toBe(true);
      for (const b of near) {
        if (b.yMax !== undefined) {
          expect(b.yMax).toBeGreaterThan(under + 1);
          expect(b.yMax).toBeLessThan(over - 1);
        }
        if (b.yMin !== undefined) {
          expect(b.yMin).toBeGreaterThan(under + 1);
          expect(b.yMin).toBeLessThan(over - 1);
        }
      }
    }
  });

  it('keeps the circuits gentle: no grade over 12 %, under 20 m of climb, the crossing still clear', () => {
    for (const seed of [989380427, 1, 6, 42]) {
      for (const idx of [9, 19, 29]) {
        const stage = generateStage(seed, idx);
        const field = new TerrainField(stage);
        let lo = Infinity;
        let hi = -Infinity;
        for (let d = 0; d < stage.path.length; d += 2) {
          const h = field.roadHeightAt(d);
          lo = Math.min(lo, h);
          hi = Math.max(hi, h);
          expect(
            Math.abs(field.roadHeightAt(d + 10) - h) / 10,
            `${seed}/${idx} at ${d}`,
          ).toBeLessThan(0.12);
        }
        expect(hi - lo, `${seed}/${idx}`).toBeLessThan(20);
        const c = stage.circuit!.crossing;
        expect(field.roadHeightAt(c.over) - field.roadHeightAt(c.under)).toBeCloseTo(
          CROSS_CLEARANCE,
          2,
        );
      }
    }
  });

  it('keeps every checkpoint off the crossing', () => {
    for (const stage of STAGES) {
      const c = stage.circuit!.crossing;
      for (const g of stage.gates)
        for (const d of [c.over, c.under])
          expect(lapGap(g.distance, d, stage.path.length)).toBeGreaterThanOrEqual(
            CROSS_ZONE - 1e-6,
          );
    }
  });
});

describe('driving a circuit crossing', () => {
  it('takes a car round a whole lap, over the bridge and under it through the tunnel, on its own level', () => {
    const DT = 1 / 120;
    for (const seed of [1, 6, 42]) {
      const { stage, field, obstacles } = createStageWorld(seed, 9);
      const c = stage.circuit!.crossing;
      const spec = CAR_SPECS.hatchback;
      const sim = new VehicleSim(spec);
      sim.reset(stage.spawn, field);
      const pilot = new Autopilot(stage.path, spec, undefined, stage.startDistance);
      const input = createControlInput();
      const seen = { over: false, under: false };
      let travelled = 0;
      let last = pilot.distance;
      for (let t = 0; t < 150 && travelled < stage.path.length + 50; t += DT) {
        sim.step(DT, pilot.drive(sim.state, DEFAULT_ENV, input), field, DEFAULT_ENV);
        resolveObstacleCollisions(sim.state, obstacles);
        const along = pilot.distance;
        let d = along - last;
        d -= Math.round(d / stage.path.length) * stage.path.length;
        travelled += d;
        last = along;
        for (const k of ['over', 'under'] as const) {
          if (lapGap(along, c[k], stage.path.length) > 3) continue;
          seen[k] = true;
          const deck = field.roadHeightAt(along) + ROAD_LIFT;
          expect(Math.abs(sim.state.y - deck), `seed ${seed} ${k}`).toBeLessThan(0.8);
        }
      }
      expect(travelled, `seed ${seed}`).toBeGreaterThan(stage.path.length);
      expect(seen).toEqual({ over: true, under: true });
    }
  });
});
