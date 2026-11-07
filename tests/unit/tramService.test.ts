import { describe, expect, it } from 'vitest';
import {
  TRAM_FADE,
  TRAM_LENGTH,
  TRAM_SPEED,
  TRAM_WIDTH,
  tramBoxes,
  tramPose,
  tramSchedule,
} from '@/game/stage/TramService';
import { resolveBoxCollisions } from '@/game/vehicle/Collisions';
import { createVehicleState } from '@/game/vehicle/VehicleSim';
import { TRAM_WIRE_HEIGHT, type TramLine } from '@/game/stage/Tram';
import { TRAM, tramGeometry } from '@/render/scenery/TramGeometry';
import { TramFleet } from '@/render/town/TramFleet';
import type { Mesh } from 'three';

const LINE: TramLine = { x0: 0, z0: 0, x1: 0, z1: 150 };

describe('tramSchedule and tramPose', () => {
  it('runs each line on its own deterministic headway, the tram crossing end to end and back', () => {
    const [run] = tramSchedule([LINE, { x0: 10, z0: 0, x1: 110, z1: 0 }], 7);
    expect(tramSchedule([LINE], 7)[0]).toEqual(run);
    expect(run!.headway).toBeGreaterThanOrEqual(55);
    expect(run!.headway).toBeLessThanOrEqual(95);
    expect(run!.duration).toBeCloseTo((150 + TRAM_LENGTH + 2 * TRAM_FADE) / TRAM_SPEED, 6);
    // First run: forward along the line, faded in by the time the whole tram is on it.
    const t0 = -run!.offset;
    const start = tramPose(LINE, run!, t0 + 0.1)!;
    expect(start.opacity).toBeLessThan(0.1);
    expect(start.heading).toBeCloseTo(0, 6);
    const mid = tramPose(LINE, run!, t0 + run!.duration / 2)!;
    expect(mid.z).toBeCloseTo(75, 0);
    expect(mid.opacity).toBe(1);
    // Between runs there is no tram; the next run comes back the other way.
    expect(tramPose(LINE, run!, t0 + run!.duration + 1)).toBeNull();
    const back = tramPose(LINE, run!, t0 + run!.headway + run!.duration / 2)!;
    expect(Math.abs(Math.abs(back.heading) - Math.PI)).toBeLessThan(1e-6);
    expect(back.z).toBeCloseTo(75, 0);
    // The tram never stands beyond a line's end by more than its own half length and the fade.
    for (let t = t0; t < t0 + run!.headway; t += 0.5) {
      const p = tramPose(LINE, run!, t);
      if (p) expect(p.z).toBeGreaterThanOrEqual(-TRAM_LENGTH / 2 - TRAM_FADE - 1e-6);
      if (p) expect(p.z).toBeLessThanOrEqual(150 + TRAM_LENGTH / 2 + TRAM_FADE + 1e-6);
    }
  });
});

describe('tramGeometry', () => {
  it('is one non-indexed vertex-coloured body of the brief size on the rails, nose at +z', () => {
    const g = tramGeometry();
    expect(g.index).toBeNull();
    const pos = g.getAttribute('position');
    expect(g.getAttribute('color').count).toBe(pos.count);
    expect(pos.count).toBeGreaterThan(36 * 20);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.z - b.min.z).toBeCloseTo(TRAM.length, 0);
    // Mirrors stand off the flanks.
    expect(b.max.x - b.min.x).toBeLessThanOrEqual(TRAM.width + 0.8);
    // The pantograph's strips reach the contact wire exactly.
    expect(b.max.y).toBeCloseTo(TRAM_WIRE_HEIGHT, 2);
    expect(b.max.y).toBeLessThanOrEqual(TRAM.height);
    expect(b.min.y).toBeGreaterThanOrEqual(-0.01);
    // Headlights (cream) at the nose, tail lights (red) at the back.
    const col = g.getAttribute('color');
    let head = 0;
    let tail = 0;
    for (let i = 0; i < pos.count; i++) {
      const r = col.getX(i);
      const gg = col.getY(i);
      const bb = col.getZ(i);
      if (r > 0.9 && gg > 0.8 && bb > 0.5 && bb < 0.8 && pos.getZ(i) > 0) head++;
      if (r > 0.6 && gg < 0.1 && pos.getZ(i) < 0) tail++;
    }
    expect(head).toBeGreaterThan(0);
    expect(tail).toBeGreaterThan(0);
    g.dispose();
  });
});

describe('TramFleet', () => {
  it('poses one mesh per line on the rails at the timetable, hidden between runs, pitched with the deck', () => {
    const lines: TramLine[] = [LINE, { x0: 10, z0: 0, x1: 110, z1: 0 }];
    // A deck climbing 5 % along z.
    const field = {
      heightAt: (_x: number, z: number) => z * 0.05,
      deckAt: (_x: number, z: number) => z * 0.05,
    };
    const fleet = new TramFleet(lines, field, 7, false);
    const [run] = tramSchedule(lines, 7);
    const t = -run!.offset + run!.duration / 2;
    fleet.tick(t);
    const meshes = fleet.group.children as Mesh[];
    expect(meshes).toHaveLength(2);
    const pose = tramPose(LINE, run!, t)!;
    expect(meshes[0]!.visible).toBe(true);
    expect(meshes[0]!.position.x).toBeCloseTo(pose.x, 6);
    expect(meshes[0]!.position.z).toBeCloseTo(pose.z, 6);
    expect(meshes[0]!.position.y).toBeGreaterThan(pose.z * 0.05);
    // Climbing toward +z: the nose rises, a negative pitch about x.
    expect(meshes[0]!.rotation.x).toBeLessThan(0);
    expect(meshes[0]!.rotation.y).toBeCloseTo(pose.heading, 6);
    fleet.tick(-run!.offset + run!.duration + 1);
    expect(meshes[0]!.visible).toBe(false);
    fleet.dispose();
  });
});

describe('tramBoxes', () => {
  it('gives each solid tram an oriented box the car is stopped by, and none between runs or while faint', () => {
    const [run] = tramSchedule([LINE], 7);
    const t0 = -run!.offset;
    const mid = t0 + run!.duration / 2;
    const boxes = tramBoxes([LINE], [run!], mid);
    expect(boxes).toHaveLength(1);
    const pose = tramPose(LINE, run!, mid)!;
    expect(boxes[0]).toEqual({
      x: pose.x,
      z: pose.z,
      hx: TRAM_WIDTH / 2,
      hz: TRAM_LENGTH / 2,
      yaw: pose.heading,
    });
    expect(tramBoxes([LINE], [run!], t0 + 0.2)).toHaveLength(0);
    expect(tramBoxes([LINE], [run!], t0 + run!.duration + 1)).toHaveLength(0);
    // A car driving across the line, its front circle 0.1 m into the tram's flank, is stopped and bounced.
    const s = createVehicleState();
    s.x = -(TRAM_WIDTH / 2 + 0.9 - 0.1) - 1.0;
    s.z = pose.z;
    s.yaw = Math.PI / 2;
    s.vx = 10;
    const impact = resolveBoxCollisions(s, boxes);
    expect(impact).toBeCloseTo(10, 1);
    expect(s.vx).toBeLessThan(0);
  });
});
