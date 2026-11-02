import { describe, expect, it } from 'vitest';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { buildCarHull } from '@/render/car/CarHull';
import { nightcityEye, nightcityFrame, nightcityHull, sideAt } from '@/render/car/NightcityHull';

describe('NightcityHull', () => {
  for (const spec of Object.values(CAR_SPECS)) {
    it(`fits the ${spec.id}: axles inside, canopy over the eye, neon faces present`, () => {
      const hull = nightcityHull(spec);
      const f = nightcityFrame(spec);
      const zs = hull.stations.map((s) => s.z);
      for (let i = 1; i < zs.length; i++) expect(zs[i]!).toBeGreaterThan(zs[i - 1]!);
      // Both wheel wells lie within the body with room for the tyre.
      for (const z of hull.wells!.zs) {
        expect(z - hull.wells!.radius).toBeGreaterThan(f.tail);
        expect(z + hull.wells!.radius).toBeLessThan(f.nose);
      }
      // The driver's eye sits under the canopy, inboard of its edge.
      const eye = nightcityEye(spec);
      expect(f.roof).toBeGreaterThan(eye.y + 0.1);
      expect(f.peak).toBeLessThan(eye.z);
      expect(f.canopyFront).toBeGreaterThan(eye.z);
      expect(f.xRoof).toBeGreaterThanOrEqual(0.5);
      expect(f.xRoof).toBeGreaterThan(eye.x + 0.1);
      // Belt above the tyres, roof a real cabin's height above the belt.
      expect(f.belt).toBeGreaterThan(spec.wheelRadius * 2);
      expect(f.roof - f.belt).toBeGreaterThanOrEqual(0.5 - 1e-9);
      expect(f.scuttle).toBeGreaterThan(f.canopyFront);
      expect(f.nose - 0.35).toBeGreaterThan(f.scuttle);
      const mesh = buildCarHull(hull);
      const count = mesh.positions.length / 3;
      expect(mesh.glowStart).toBeGreaterThan(0);
      expect(mesh.glowStart).toBeLessThan(count);
      for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
      for (const c of mesh.colors) expect(Number.isFinite(c)).toBe(true);
    });
  }

  it('flares over both axles, pinches the waist between them and tapers to a blunt nose', () => {
    for (const spec of Object.values(CAR_SPECS)) {
      const f = nightcityFrame(spec);
      expect(f.flare).toBeGreaterThan(f.xBody);
      expect(sideAt(f, f.frontAxle)).toBeCloseTo(f.flare, 6);
      expect(sideAt(f, f.rearAxle)).toBeCloseTo(f.flare, 6);
      expect(sideAt(f, f.tail)).toBeCloseTo(f.flare, 6);
      const waist = (f.frontAxle + f.rearAxle) / 2;
      expect(sideAt(f, waist)).toBeLessThan(f.flare);
      expect(sideAt(f, waist)).toBeGreaterThanOrEqual(f.xBody);
      expect(sideAt(f, f.nose)).toBeLessThan(f.xBody);
      expect(sideAt(f, f.nose)).toBeGreaterThan(0.6 * f.xBody);
      // The canopy stays inboard of the flanks at every station.
      for (const s of nightcityHull(spec).stations) expect(s.xRoof).toBeLessThan(s.xBody);
    }
  });

  it('scales with the car: the truck body is longer, wider and taller than the hatchback', () => {
    const car = nightcityFrame(CAR_SPECS.hatchback);
    const truck = nightcityFrame(CAR_SPECS.dakar);
    expect(truck.nose - truck.tail).toBeGreaterThan(car.nose - car.tail);
    expect(truck.xBody).toBeGreaterThan(car.xBody);
    expect(truck.roof).toBeGreaterThan(car.roof);
  });
});
